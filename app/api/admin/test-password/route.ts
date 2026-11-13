import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Check who's logged in
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if current user is Super Admin
    const adminSupabase = createAdminClient();

    const { data: profile, error: profileError } =
      await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 403 }
      );
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only Super Admin can set a test password." },
        { status: 403 }
      );
    }

    // Get test user's ID and temporary password
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { error: "User ID and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // Set password
    const { error } =
      await adminSupabase.auth.admin.updateUserById(
        userId,
        {
          password,
        }
      );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Temporary password set successfully.",
    });

  } catch (error) {
    console.error("TEST PASSWORD ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}