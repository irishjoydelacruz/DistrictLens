import { barangays } from "../../../data/mock-data"
import { databaseConfigured, databaseRequest, isValidPushEndpoint, jsonError, missingConfigurationMessage, webPushConfigured } from "../_lib"

export const runtime = "nodejs"

type BrowserSubscription = {
  endpoint?: unknown
  keys?: { auth?: unknown; p256dh?: unknown }
}

export async function POST(request: Request) {
  if (!webPushConfigured()) return jsonError(missingConfigurationMessage(), 503)
  let body: { barangay?: unknown; subscription?: BrowserSubscription }
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid subscription request.", 400)
  }

  const { barangay, subscription } = body
  const endpoint = subscription?.endpoint
  const auth = subscription?.keys?.auth
  const p256dh = subscription?.keys?.p256dh
  if (typeof barangay !== "string" || !barangays.includes(barangay)) return jsonError("Choose a valid barangay.", 400)
  if (
    !isValidPushEndpoint(endpoint) ||
    typeof auth !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(auth) ||
    typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{64,128}$/.test(p256dh)
  ) {
    return jsonError("The browser returned an invalid push subscription.", 400)
  }

  const query = new URLSearchParams({ on_conflict: "endpoint" })
  try {
    const response = await databaseRequest(`alert_subscriptions?${query}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ endpoint, barangay, subscription, updated_at: new Date().toISOString() }),
    })
    if (!response.ok) {
      console.error("Supabase error:", response.status, await response.text())
      return jsonError("Could not save your subscription. Check the alert database setup.", 502)
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Database request failed:", error)
    return jsonError("Could not reach the alert database.", 502)
  }
}

export async function DELETE(request: Request) {
  if (!databaseConfigured()) return jsonError(missingConfigurationMessage(), 503)
  let endpoint: unknown
  try {
    const body = (await request.json()) as { endpoint?: unknown }
    endpoint = body.endpoint
  } catch {
    return jsonError("Invalid unsubscribe request.", 400)
  }
  if (!isValidPushEndpoint(endpoint)) return jsonError("A valid browser push endpoint is required.", 400)

  const query = new URLSearchParams({ endpoint: `eq.${endpoint}` })
  try {
    const response = await databaseRequest(`alert_subscriptions?${query}`, { method: "DELETE", headers: { Prefer: "return=minimal" } })
    if (!response.ok) return jsonError("Could not remove your subscription.", 502)
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return jsonError("Could not reach the alert database.", 502)
  }
}