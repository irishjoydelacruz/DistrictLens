import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Landing point for Google sign-in and password reset links.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  if (!code && !tokenHash) {
    console.error("AUTH CALLBACK: missing code/token_hash");
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const supabase = await createClient();

  // Reset links use token_hash (works in any browser/device).
  // Google sign-in keeps using the PKCE code.
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: (type as "recovery") ?? "recovery",
      })
    : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    console.error("AUTH CALLBACK ERROR:", error.message);
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  // Password reset link: go straight to the new-password page.
  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const adminSupabase = createAdminClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, status, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=profile`);
  }

  // Google sign-ups stay pending until an administrator approves them.
  if (profile.status !== "approved") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${
        profile.status === "rejected" ? "rejected" : "pending"
      }`
    );
  }

  if (profile.must_change_password === true) {
    return NextResponse.redirect(`${origin}/change-password`);
  }

  return NextResponse.redirect(
    `${origin}${profile.role === "field_worker" ? "/worker" : "/admin"}`
  );
}