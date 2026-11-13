import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/portal";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Redirect while keeping any cookie changes (e.g. after signOut).
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Refresh and verify the Supabase session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isChangePasswordPage = pathname === "/change-password";
  const isAdminPage = pathname.startsWith("/admin");
  const isWorkerPage = pathname.startsWith("/worker");

  // 1. Not signed in: go to the single login page.
  if (!user) {
    return redirectTo("/login");
  }

  // 2. Load the profile. Fail closed if it cannot be verified.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, must_change_password, team_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return redirectTo("/login?error=profile");
  }

  const isAdminRole =
    profile.role === "super_admin" || profile.role === "customer_service";

  const isWorkerRole = profile.role === "field_worker";

  // 3. Reject unknown roles.
  if (!isAdminRole && !isWorkerRole) {
    await supabase.auth.signOut();
    return redirectTo("/login?error=role");
  }

  const home = isWorkerRole ? "/worker" : "/admin";

  // 4. Temporary password: change it first.
  if (profile.must_change_password === true && !isChangePasswordPage) {
    return redirectTo("/change-password");
  }

  // 5. Already changed: don't show the change-password page again.
  if (isChangePasswordPage && profile.must_change_password !== true) {
    return redirectTo(home);
  }

  // 6. Wrong workspace for this role: send them to their own.
  if (isAdminPage && !isAdminRole) return redirectTo(home);
  if (isWorkerPage && !isWorkerRole) return redirectTo(home);

  // 7. Field accounts need a team assignment.
  if (isWorkerRole && !profile.team_id && isWorkerPage) {
    await supabase.auth.signOut();
    return redirectTo("/login?error=team");
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/worker/:path*", "/change-password"],
};