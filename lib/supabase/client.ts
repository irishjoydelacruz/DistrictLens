import { createBrowserClient } from "@supabase/ssr";
import {
  PORTAL_COOKIE_NAMES,
  isPortal,
  portalFromLocation,
  type Portal,
} from "./portal";

type BrowserClient = ReturnType<typeof createBrowserClient>;

// One client per portal (the browser can hold both sessions at once).
const clients: Partial<Record<Portal, BrowserClient>> = {};

function detectPortal(): Portal {
  if (typeof window === "undefined") return "admin";

  const fromLocation = portalFromLocation(
    window.location.pathname,
    window.location.search
  );

  if (fromLocation) return fromLocation;

  try {
    const saved = window.sessionStorage.getItem("districtlens-portal");
    if (isPortal(saved)) return saved;
  } catch {
    // sessionStorage may be unavailable; fall back to the admin portal.
  }

  return "admin";
}

// Call createClient() as before. The portal is detected from the page URL,
// or pass it explicitly: createClient("worker").
export function createClient(portal?: Portal) {
  const resolved = portal ?? detectPortal();

  const existing = clients[resolved];
  if (existing) return existing;

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { name: PORTAL_COOKIE_NAMES[resolved] },
      isSingleton: false,
    }
  );

  // Browser-only cache. On the server a fresh client is returned each time.
  if (typeof window !== "undefined") {
    clients[resolved] = client;
  }

  return client;
}