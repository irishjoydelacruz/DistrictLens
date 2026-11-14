import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { AUTH_COOKIE_NAME } from "@/lib/supabase/portal"
import { barangays } from "../../../data/mock-data"
import { jsonError } from "../_lib"

export const runtime = "nodejs"

export async function POST(request: Request) {
  // Staff lang ang puwedeng mag-trigger nito.
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile || !["super_admin", "customer_service"].includes(profile.role)) {
    return jsonError("Forbidden.", 403)
  }

  let body: { barangays?: unknown; title?: unknown; message?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid request.", 400)
  }

  if (typeof body.title !== "string" || typeof body.message !== "string") {
    return jsonError("Invalid message.", 400)
  }
  const title = body.title.slice(0, 100)
  const message = body.message.slice(0, 240)

  const names = Array.isArray(body.barangays)
    ? [
        ...new Set(
          body.barangays.filter((n): n is string => typeof n === "string" && barangays.includes(n)),
        ),
      ]
    : []
  if (names.length === 0) return jsonError("No valid barangays.", 400)

  const origin = new URL(request.url).origin
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