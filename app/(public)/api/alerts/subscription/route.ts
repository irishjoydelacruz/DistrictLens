import { databaseConfigured, databaseRequest, isValidPushEndpoint, jsonError, missingConfigurationMessage } from "../_lib"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!databaseConfigured()) return jsonError(missingConfigurationMessage(), 503)
  const endpoint = new URL(request.url).searchParams.get("endpoint")
  if (!isValidPushEndpoint(endpoint)) return Response.json({ barangay: "" })

  const query = new URLSearchParams({ select: "barangay", endpoint: `eq.${endpoint}` })
  try {
    const response = await databaseRequest(`alert_subscriptions?${query}`)
    if (!response.ok) return jsonError("Could not load subscription.", 502)
    const rows = (await response.json()) as { barangay: string }[]
    return Response.json({ barangay: rows[0]?.barangay ?? "" }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return jsonError("Could not reach the alert database.", 502)
  }
}