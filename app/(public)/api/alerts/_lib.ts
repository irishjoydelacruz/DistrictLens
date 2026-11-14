export function webPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
      process.env.WEB_PUSH_SUBJECT &&
      process.env.ALERTS_SEND_SECRET &&
      databaseConfigured(),
  )
}

export function databaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function isValidPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false
  try {
    const endpoint = new URL(value)
    const host = endpoint.hostname.toLowerCase()
    const knownPushService =
      host === "fcm.googleapis.com" ||
      host.endsWith(".fcm.googleapis.com") ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".notify.windows.com")
    return endpoint.protocol === "https:" && knownPushService
  } catch {
    return false
  }
}

export function missingConfigurationMessage() {
  return "Barangay alerts are not configured yet. Please contact the portal administrator."
}

export async function databaseRequest(path: string, init: RequestInit = {}) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "")
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !serviceKey) throw new Error("Subscription database is not configured")

  // Legacy keys (eyJ...) are JWTs and need the Authorization header.
  // New sb_secret_ keys only go in the apikey header.
  const isLegacyJwt = serviceKey.startsWith("eyJ")

  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      ...(isLegacyJwt ? { Authorization: `Bearer ${serviceKey}` } : {}),
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  })
}

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } })
}