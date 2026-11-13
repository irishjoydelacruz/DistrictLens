import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Verify the logged-in user
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in again." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 2. Validate the request body
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const newPassword =
      typeof body === "object" &&
      body !== null &&
      "newPassword" in body
        ? body.newPassword
        : undefined;

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 12
    ) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters." },
        { status: 400 }
      );
    }

    // 3. Load the user's profile
    const adminSupabase = createAdminClient();

    const { data: profile, error: profileError } =
      await adminSupabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "PASSWORD PROFILE ERROR:",
        profileError.message
      );

      return NextResponse.json(
        { error: "Unable to verify your account." },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    const validRoles = [
      "super_admin",
      "customer_service",
      "field_worker",
    ];

    if (!validRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: "Your account role is invalid." },
        { status: 403 }
      );
    }

    if (profile.must_change_password !== true) {
      return NextResponse.json(
        {
          error:
            "Your account does not require a temporary password change.",
        },
        { status: 400 }
      );
    }

    // 4. Update the authenticated user's Supabase Auth password
    const { error: passwordError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (passwordError) {
      return NextResponse.json(
        { error: passwordError.message },
        { status: 400 }
      );
    }

    // 5. Clear the temporary-password flag after password update
    const { data: updatedProfile, error: updateError } =
      await adminSupabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id)
        .eq("must_change_password", true)
        .select("id")
        .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error(
        "PASSWORD FLAG UPDATE ERROR:",
        updateError?.message ?? "No profile row updated."
      );

      return NextResponse.json(
        {
          error:
            "Your password was changed, but your account setup needs administrator assistance.",
        },
        { status: 500 }
      );
    }

    // 6. Return success
    return NextResponse.json(
      { message: "Password updated successfully." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("PASSWORD CHANGE ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}