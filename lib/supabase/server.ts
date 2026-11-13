import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import {
  PORTAL_COOKIE_NAMES,
  isPortal,
  portalFromLocation,
  type Portal,
} from "./portal";

// Works out which portal's session this request belongs to:
//  1. the x-portal header set by proxy.ts (page requests)
//  2. the page that made the request (Referer), e.g. /admin or /worker
//  3. whichever portal session cookie exists
async function detectPortal(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): Promise<Portal> {
  const requestHeaders = await headers();

  const fromHeader = requestHeaders.get("x-portal");
  if (isPortal(fromHeader)) return fromHeader;

  const referer = requestHeaders.get("referer");

  if (referer) {
    try {
      const url = new URL(referer);
      const fromReferer = portalFromLocation(url.pathname, url.searchParams);
      if (fromReferer) return fromReferer;
    } catch {
      // Ignore an invalid Referer header.
    }
  }

  const names = cookieStore.getAll().map((cookie) => cookie.name);

  if (names.some((name) => name.startsWith(PORTAL_COOKIE_NAMES.admin))) {
    return "admin";
  }

  if (names.some((name) => name.startsWith(PORTAL_COOKIE_NAMES.worker))) {
    return "worker";
  }

  return "admin";
}

// Call createClient() as before, or pass the portal explicitly:
// createClient("admin") for admin-only API routes.
export async function createClient(portal?: Portal) {
  const cookieStore = await cookies();
  const resolved = portal ?? (await detectPortal(cookieStore));

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { name: PORTAL_COOKIE_NAMES[resolved] },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot always set cookies.
          }
        },
      },
    }
  );
}