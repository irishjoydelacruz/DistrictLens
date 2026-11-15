import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const MAX_PER_WINDOW = 5
const WINDOW_MS = 10 * 60 * 1000
const DUPLICATE_DAYS = 7

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // palitan kung iba ang pangalan sa inyo
  { auth: { persistSession: false } },
)

async function verifyTurnstile(token: string, ip: string) {
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        remoteip: ip,
      }),
    },
  )
  const data = await res.json()
  return data.success === true
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const sourceHash = crypto
    .createHash("sha256")
    .update(ip + process.env.RATE_LIMIT_SALT)
    .digest("hex")

  // 1. Rate limit
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count } = await admin
    .from("submission_attempts")
    .select("*", { count: "exact", head: true })
    .eq("source_hash", sourceHash)
    .gte("created_at", since)

  if ((count ?? 0) >= MAX_PER_WINDOW) {
    return NextResponse.json(
      {
        error:
          "You have submitted several reports within a short period. Please try again later.",
      },
      { status: 429 },
    )
  }
  await admin.from("submission_attempts").insert({ source_hash: sourceHash })

  // 2. Turnstile
  if (!body.turnstileToken || !(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 400 },
    )
  }

  // 3. Save gamit ang existing RPC
  const address = body.address?.trim() || null

  const { data: tracking, error } = await admin.rpc("submit_customer_report", {
    p_name: body.name,
    p_contact: body.contact,
    p_barangay: body.barangay,
    p_address: address,
    p_type: body.incidentType,
    p_description: body.description,
  })

  if (error || typeof tracking !== "string") {
    const message = error?.message ?? ""
    const friendly = /^(Please|The address)/.test(message)
    return NextResponse.json(
      {
        error: friendly
          ? message
          : "We could not send your report. Please try again.",
      },
      { status: friendly ? 400 : 500 },
    )
  }

  // 4. Duplicate check (hindi nito hinaharang ang report kapag pumalya)
  try {
    if (address && body.incidentType !== "Not sure") {
      const cutoff = new Date(
        Date.now() - DUPLICATE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
      const pattern = address
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[%_]/g, "\\$&")

      const { data: current, error: currentError } = await admin
        .from("customer_reports")
        .select("id")
        .eq("tracking_number", tracking)
        .single()

      if (currentError) {
        console.error("Duplicate check: cannot find new report:", currentError)
      }

      if (current) {
        const { data: matches, error: matchError } = await admin
          .from("customer_reports")
          .select("id")
          .neq("id", current.id)
          .eq("incident_type", body.incidentType)
          .eq("barangay", body.barangay)
          .in("status", ["pending", "verified"])
          .gte("created_at", cutoff)
          .ilike("address", `%${pattern}%`)
          .order("created_at", { ascending: true })
          .limit(1)

        if (matchError) {
          console.error("Duplicate check: search failed:", matchError)
        }

        console.log("Duplicate check matches:", matches)

        if (matches?.[0]) {
          const { error: updateError } = await admin
            .from("customer_reports")
            .update({ possible_duplicate_of: matches[0].id })
            .eq("id", current.id)

          if (updateError) {
            console.error("Duplicate check: update failed:", updateError)
          }
        }
      }
    }
  } catch (e) {
    console.error("Duplicate check failed:", e)
  }

  return NextResponse.json({ trackingNumber: tracking })
}