import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = [
  "super_admin",
  "customer_service",
  "field_worker",
] as const;

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Verify the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 2. Get the user's profile using the server admin client
    const adminSupabase = createAdminClient();

    const { data: profile, error } = await adminSupabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("PASSWORD STATUS ERROR:", error.message);

      return NextResponse.json(
        { error: "Unable to load user profile." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 3. Validate the user's role
    if (
      !VALID_ROLES.includes(
        profile.role as (typeof VALID_ROLES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Your account does not have a valid role." },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 4. Return password status and role
    return NextResponse.json(
      {
        role: profile.role,
        mustChangePassword:
          profile.must_change_password === true,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("PASSWORD STATUS ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
