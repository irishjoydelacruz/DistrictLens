// One login session shared by the Admin workspace and the Field Worker
// workspace. Everyone signs in through the single /login page.

export type Portal = "admin" | "worker";

// Name of the single Supabase session cookie.
export const AUTH_COOKIE_NAME = "sb-auth";

// Kept so existing code that passes a portal (createClient("worker"), etc.)
// still works. Both portals now use the same cookie.
export const PORTAL_COOKIE_NAMES: Record<Portal, string> = {
  admin: AUTH_COOKIE_NAME,
  worker: AUTH_COOKIE_NAME,
};

export function isPortal(value: unknown): value is Portal {
  return value === "admin" || value === "worker";
}

// Which workspace does a page belong to?
//  - /worker and /worker/...  -> worker
//  - /admin and /admin/...    -> admin
//  - shared pages (such as /change-password) may use ?portal=admin|worker
export function portalFromLocation(
  pathname: string,
  search?: string | URLSearchParams
): Portal | null {
  if (pathname === "/worker" || pathname.startsWith("/worker/")) {
    return "worker";
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  const fromQuery = new URLSearchParams(search ?? "").get("portal");

  return isPortal(fromQuery) ? fromQuery : null;
}