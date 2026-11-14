import { webPushConfigured } from "../_lib"

export const runtime = "nodejs"

export async function GET() {
  const available = webPushConfigured()
  return Response.json(
    {
      available,
      publicKey: available ? process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY : undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}