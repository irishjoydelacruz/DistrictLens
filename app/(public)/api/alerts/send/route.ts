import { timingSafeEqual } from "node:crypto"
import * as webpush from "web-push"

import { barangays } from "../../../data/mock-data"
import { databaseConfigured, databaseRequest, jsonError, webPushConfigured } from "../_lib"

export const runtime = "nodejs"

type SavedSubscription = {
  endpoint: string
  subscription: webpush.PushSubscription
}

function isAuthorized(request: Request) {
  const secret = process.env.ALERTS_SEND_SECRET
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
  if (!secret || !supplied) return false
  const expectedBytes = Buffer.from(secret)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return jsonError("Unauthorized.", 401)
  if (!webPushConfigured() || !databaseConfigured()) return jsonError("Web Push is not configured.", 503)

  let body: { barangay?: unknown; title?: unknown; message?: unknown; url?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid alert message.", 400)
  }

  const { barangay, title, message, url } = body
  if (typeof barangay !== "string" || !barangays.includes(barangay)) return jsonError("Choose a valid barangay.", 400)
  if (typeof title !== "string" || title.trim().length < 1 || title.length > 100) return jsonError("Title must be between 1 and 100 characters.", 400)
  if (typeof message !== "string" || message.trim().length < 1 || message.length > 240) return jsonError("Message must be between 1 and 240 characters.", 400)
  const targetUrl = typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/"

  const query = new URLSearchParams({ select: "endpoint,subscription", barangay: `eq.${barangay}` })
  try {
    const response = await databaseRequest(`alert_subscriptions?${query}`)
    if (!response.ok) return jsonError("Could not load alert subscribers.", 502)
    const subscribers = (await response.json()) as SavedSubscription[]
    webpush.setVapidDetails(
      process.env.WEB_PUSH_SUBJECT!,
      process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY!,
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY!,
    )

    const results = await Promise.all(
      subscribers.map(async (subscriber) => {
        try {
          await webpush.sendNotification(
            subscriber.subscription,
            JSON.stringify({ title: title.trim(), body: message.trim(), url: targetUrl }),
          )
          return { sent: true, expired: false }
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode
          return { sent: false, expired: statusCode === 404 || statusCode === 410, endpoint: subscriber.endpoint }
        }
      }),
    )

    const expired = results.filter((result) => result.expired && "endpoint" in result).map((result) => result.endpoint)
    const removed = await Promise.all(
      expired.map(async (endpoint) => {
        const filter = new URLSearchParams({ endpoint: `eq.${endpoint}` })
        try {
          const removal = await databaseRequest(`alert_subscriptions?${filter}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          })
          return removal.ok
        } catch {
          return false
        }
      }),
    )

    return Response.json(
      { sent: results.filter((result) => result.sent).length, removedExpired: removed.filter(Boolean).length },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return jsonError("Could not deliver barangay alerts.", 502)
  }
}