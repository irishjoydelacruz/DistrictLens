import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/username";

// Public endpoint: lets a user who forgot their password notify the admin.
// It never reveals whether the username exists, and it does not reset anything.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username =
      typeof body.username === "string" ? body.username.trim() : "";

    const key = usernameToEmail(username);

    if (!key) {
      return NextResponse.json(
        { error: "Please enter your username." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("id, full_name");

    if (profilesError) {
      console.error("FORGOT PASSWORD LOOKUP ERROR:", profilesError.message);

      return NextResponse.json(
        { error: "Unable to send your request. Please try again." },
        { status: 500 }
      );
    }

    const match = (profiles ?? []).find(
      (item) => usernameToEmail(item.full_name ?? "") === key
    );

    if (match) {
      // One open request per user is enough.
      const { data: existing } = await adminSupabase
        .from("password_reset_requests")
        .select("id")
        .eq("user_id", match.id)
        .eq("status", "pending")
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error: insertError } = await adminSupabase
          .from("password_reset_requests")
          .insert({ user_id: match.id, status: "pending" });

        if (insertError) {
          console.error("FORGOT PASSWORD INSERT ERROR:", insertError.message);
        }
      }
    }

    return NextResponse.json({
      message:
        "Your request was sent. Please contact your administrator to receive a temporary password.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}