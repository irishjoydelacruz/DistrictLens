import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { AUTH_COOKIE_NAME } from "@/lib/supabase/portal"
import { barangays } from "../../../data/mock-data"
import { jsonError } from "../_lib"

export const runtime = "nodejs"

// Dapat bagong-bago ang pagbabago ng status bago ito i-announce.
// Hindi puwedeng i-replay ang request nang matagal pagkatapos.
const FRESH_WINDOW_MS = 10 * 60 * 1000

type IncidentRow = {
  id: string
  barangay_code: string | null
  incident_type: string
  status: string
  affected_area: string | null
  pumping_station_id: number | null
}

export async function POST(request: Request) {
  // Field worker lang ang puwedeng mag-trigger nito.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError("Unauthorized.", 401)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || profile.role !== "field_worker" || !profile.team_id) {
    return jsonError("Forbidden.", 403)
  }

  // Ang client ay nagpapadala lang ng deploymentId at status.
  // Ang server ang bumubuo ng mensahe, para hindi makapagpadala ng sariling text.
  let body: { deploymentId?: unknown; status?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid request.", 400)
  }

  if (
    typeof body.deploymentId !== "string" ||
    (body.status !== "ongoing" && body.status !== "resolved")
  ) {
    return jsonError("Invalid request.", 400)
  }

  const status: "ongoing" | "resolved" = body.status

  const { data: deployment } = await supabase
    .from("deployments")
    .select(
      `
        id,
        team_id,
        status,
        started_at,
        resolved_at,
        incidents (
          id,
          barangay_code,
          incident_type,
          status,
          affected_area,
          pumping_station_id
        )
      `,
    )
    .eq("id", body.deploymentId)
    .maybeSingle()

  // Sa sariling team lang ng worker.
  if (!deployment || deployment.team_id !== profile.team_id) {
    return jsonError("Forbidden.", 403)
  }

  const incident = (
    Array.isArray(deployment.incidents)
      ? deployment.incidents[0]
      : deployment.incidents
  ) as IncidentRow | null | undefined

  if (!incident) return jsonError("Incident not found.", 404)

  // Dapat totoong nangyari na ang status sa database.
  // Ang "resolved" ay kailangang Normal (green) na rin ang incident.
  const matches =
    status === "ongoing"
      ? deployment.status === "ongoing" || deployment.status === "in_progress"
      : deployment.status === "resolved" && incident.status === "green"

  if (!matches) return jsonError("Status does not match the assignment.", 409)

  const stamp = status === "resolved" ? deployment.resolved_at : deployment.started_at
  const stampTime = stamp ? Date.parse(stamp) : Number.NaN

  if (Number.isNaN(stampTime) || Date.now() - stampTime > FRESH_WINDOW_MS) {
    return jsonError("This update is too old to announce.", 409)
  }

  // Mga apektadong barangay, kinuha mula sa database.
  let codes: string[] = []

  if (incident.pumping_station_id !== null) {
    const { data } = await supabase
      .from("incident_barangays")
      .select("barangay_code")
      .eq("incident_id", incident.id)

    codes = (data ?? []).map((row) => row.barangay_code as string)
  } else if (incident.barangay_code) {
    codes = [incident.barangay_code]
  }

  if (codes.length === 0) return jsonError("No valid barangays.", 400)

  const origin = new URL(request.url).origin

  // Code -> pangalan, mula sa parehong GeoJSON na ginagamit ng app.
  const nameByCode = new Map<string, string>()
  try {
    const geoResponse = await fetch(`${origin}/data/tanza-barangays.geojson`, {
      cache: "no-store",
    })
    if (geoResponse.ok) {
      const geojson = await geoResponse.json()
      for (const feature of geojson.features ?? []) {
        const code = feature?.properties?.brgy_code
        const name = feature?.properties?.brgy_name
        if (typeof code === "string" && typeof name === "string") {
          nameByCode.set(code, name)
        }
      }
    }
  } catch {
    // Walang pangalan = walang valid na barangay sa ibaba.
  }

  const names = [
    ...new Set(
      codes
        .map((code) => nameByCode.get(code))
        .filter((name): name is string => typeof name === "string" && barangays.includes(name)),
    ),
  ]

  if (names.length === 0) return jsonError("No valid barangays.", 400)

  const area = incident.affected_area?.trim() ? ` ${incident.affected_area.trim()}.` : ""

  const title = (
    status === "resolved"
      ? `Naayos na: ${incident.incident_type}`
      : `Inaayos na: ${incident.incident_type}`
  ).slice(0, 100)

  const message = (
    status === "resolved"
      ? `Tapos na ang pag-aayos.${area}`
      : `Sinimulan na ng field team ang pag-aayos.${area}`
  ).slice(0, 240)

  const results = await Promise.all(
    names.map(async (barangay) => {
      try {
        const response = await fetch(`${origin}/api/alerts/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.ALERTS_SEND_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ barangay, title, message, url: "/" }),
          cache: "no-store",
        })
        return response.ok
      } catch {
        return false
      }
    }),
  )

  return Response.json(
    { ok: true, barangays: names.length, delivered: results.filter(Boolean).length },
    { headers: { "Cache-Control": "no-store" } },
  )
}