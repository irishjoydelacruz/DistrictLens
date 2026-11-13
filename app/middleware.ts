
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(
      new URL("/admin/login", request.url)
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Middleware profile error:", profileError?.message);

    return NextResponse.redirect(
      new URL("/admin/login", request.url)
    );
  }

  // Temporary password: require password change first.
  if (profile.must_change_password) {
    return NextResponse.redirect(
      new URL("/change-password", request.url)
    );
  }

  // Admin portal: Super Admin and Customer Service only.
  if (pathname.startsWith("/admin")) {
    if (
      pathname.startsWith("/admin/users") &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.redirect(
        new URL("/admin", request.url)
      );
    }

    const adminRoles = ["super_admin", "customer_service"];

    if (!adminRoles.includes(profile.role)) {
      return NextResponse.redirect(
        new URL(
          profile.role === "field_team"
            ? "/worker"
            : "/admin/login",
          request.url
        )
      );
    }
  }

  // Field Team portal: Field Team role only.
  if (pathname.startsWith("/worker")) {
    if (profile.role !== "field_team") {
      return NextResponse.redirect(
        new URL(
          ["super_admin", "customer_service"].includes(profile.role)
            ? "/admin"
            : "/admin/login",
          request.url
        )
      );
    }
  }

  return response;
}


export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/worker",
    "/worker/:path*",
  ],
};