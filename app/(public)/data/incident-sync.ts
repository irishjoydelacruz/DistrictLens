import {
  setReports,
  setSyncError,
  type IncidentSourceType,
  type Report,
  type Status,
} from "./mock-data"

// =========================================
// Loads incidents from the `public_incidents` view in Supabase and keeps the
// public portal up to date. Uses plain fetch (no extra package needed).
// Required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// =========================================

const REFRESH_MS = 45_000
const TIME_ZONE = "Asia/Manila"
const GEOJSON_URL = "/data/tanza-barangays.geojson"

// Set to false once everything works to silence the debug logs.
const DEBUG = true

type IncidentRow = {
  id: number | string
  incident_type: string | null
  status: "red" | "yellow" | "green" | string
  barangay_code: string | number | null
  affected_area: string | null
  etr: string | null
  description: string | null
  reported_at: string | null
  updated_at: string | null
  pumping_station: string | null
  progress: number | null
  affected_barangay_codes: (string | number)[] | null
}

const statusFromDb: Record<string, Status> = {
  red: "Active",
  yellow: "Monitoring",
  green: "Normal",
}

const latestText: Record<1 | 2 | 3, string> = {
  1: "The report has been received and is being prepared for response.",
  2: "Field personnel are responding to the incident.",
  3: "Work has been completed and normal service is confirmed.",
}

// Makes "042108001", 42108001 and " 42108001 " all match each other.
function normalizeCode(code: string | number | null | undefined) {
  if (code == null) return ""
  return String(code).trim().replace(/^0+/, "")
}

let codeToName: Map<string, string> | null = null

async function loadBarangayNames() {
  if (codeToName) return codeToName

  const response = await fetch(GEOJSON_URL)
  if (!response.ok) {
    throw new Error(
      `Barangay list could not be loaded: ${GEOJSON_URL} returned ${response.status}. ` +
        `Put tanza-barangays.geojson inside public/data/ of this project.`,
    )
  }

  const data = (await response.json()) as {
    features: { properties?: Record<string, unknown> }[]
  }
  const map = new Map<string, string>()

  for (const feature of data.features) {
    const code = feature.properties?.brgy_code
    const name = feature.properties?.brgy_name
    if (code != null && typeof name === "string") {
      map.set(normalizeCode(code as string | number), name.trim())
    }
  }

  codeToName = map
  return map
}

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
})

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

function formatEtr(etr: string | null, resolved: boolean) {
  if (resolved) return "Service restored"
  if (!etr || !etr.trim()) return "To be announced"

  const value = etr.trim()

  // Time only, e.g. "17:30:00" -> "5:30 PM"
  const timeOnly = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (timeOnly) {
    const hours = Number(timeOnly[1])
    const suffix = hours >= 12 ? "PM" : "AM"
    return `${hours % 12 || 12}:${timeOnly[2]} ${suffix}`
  }

  // Full timestamp or date -> "October 29, 2026 · 7:00 PM"
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = parseDate(value)
    if (date) {
      return value.length <= 10
        ? dateFormat.format(date)
        : `${dateFormat.format(date)} · ${timeFormat.format(date)}`
    }
  }

  return value
}

type DropReason = "unknown-status" | "no-barangay"

function toReport(
  row: IncidentRow,
  names: Map<string, string>,
  dropped: { id: number | string; reason: DropReason }[],
): Report | null {
  const status = statusFromDb[row.status]
  if (!status) {
    dropped.push({ id: row.id, reason: "unknown-status" })
    return null
  }

  const primaryName =
    row.barangay_code != null ? names.get(normalizeCode(row.barangay_code)) : undefined
  const isStation = Boolean(row.pumping_station)
  const affectedNames = (row.affected_barangay_codes ?? [])
    .map((code) => names.get(normalizeCode(code)))
    .filter((name): name is string => Boolean(name))

  // An incident needs at least one known barangay to appear on the map.
  const barangay = primaryName ?? affectedNames[0]
  if (!barangay && !isStation) {
    dropped.push({ id: row.id, reason: "no-barangay" })
    return null
  }

  const reportedAt = parseDate(row.reported_at)
  const updatedAt = parseDate(row.updated_at) ?? reportedAt
  const progress = (status === "Normal" ? 3 : row.progress === 2 ? 2 : row.progress === 3 ? 3 : 1) as
    | 1
    | 2
    | 3
  const type = row.incident_type?.trim() || "Service Incident"
  const sourceType: IncidentSourceType = isStation ? "Pumping Station" : "Barangay/Localized Area"

  return {
    id: Number(row.id),
    barangay: barangay ?? "",
    title: type,
    type,
    status,
    description:
      row.description?.trim() ||
      "Tanza Water District is aware of this service condition and is handling it.",
    date: reportedAt ? dateFormat.format(reportedAt) : "",
    time: reportedAt ? timeFormat.format(reportedAt) : "",
    restoration: formatEtr(row.etr, status === "Normal"),
    latest: latestText[progress],
    progress,
    sourceType,
    pumpingStation: row.pumping_station ?? undefined,
    affectedArea: row.affected_area?.trim() || undefined,
    affectedBarangays: isStation && affectedNames.length ? affectedNames : undefined,
    updatedAt: updatedAt ? updatedAt.getTime() : undefined,
  }
}

export async function refreshIncidents() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    console.error(
      "Incident sync: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Check .env.local and restart the dev server.",
    )
    setSyncError("The service status connection is not set up.")
    return
  }

  try {
    // 1) Barangay names (static file)
    const names = await loadBarangayNames()

    // 2) Incidents (Supabase view)
    const endpoint = `${url}/rest/v1/public_incidents?select=*&order=updated_at.desc.nullslast&limit=500`
    // New publishable keys (sb_publishable_...) are not JWTs, so only send
    // Authorization for old-style JWT keys (eyJ...).
    const headers: Record<string, string> = { apikey: key }
    if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`

    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`public_incidents request failed (${response.status}): ${detail}`)
    }

    const rows = (await response.json()) as IncidentRow[]
    const dropped: { id: number | string; reason: DropReason }[] = []
    const reports = rows
      .map((row) => toReport(row, names, dropped))
      .filter((report): report is Report => report !== null)

    if (DEBUG) {
      console.log(
        `Incident sync: ${rows.length} rows from db, ${reports.length} reports shown, ${dropped.length} dropped`,
      )
      if (rows[0]) console.log("Incident sync sample row:", rows[0])
      if (dropped.length) console.log("Incident sync dropped rows:", dropped)
    }

    setReports(reports)
    setSyncError(null)
  } catch (error) {
    console.error("Incident sync error:", error)
    setSyncError("Service updates could not be refreshed. Showing the last known information.")
  }
}

let subscribers = 0
let timer: ReturnType<typeof setInterval> | null = null

function handleVisibility() {
  if (document.visibilityState === "visible") void refreshIncidents()
}

// Starts auto-refresh. Returns a function that stops it (safe to share
// between several components).
export function startIncidentSync() {
  subscribers += 1

  if (subscribers === 1) {
    void refreshIncidents()
    timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshIncidents()
    }, REFRESH_MS)
    document.addEventListener("visibilitychange", handleVisibility)
  }

  return () => {
    subscribers -= 1
    if (subscribers === 0) {
      if (timer) clearInterval(timer)
      timer = null
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }
}