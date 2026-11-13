// Shared by the login page and the admin API.
// The user only ever sees their name (e.g. "Juan Dela Cruz"). Supabase Auth
// still needs an email-shaped identifier, so one is derived from the name here.
// This function must stay identical everywhere it is used.

export const USERNAME_EMAIL_DOMAIN = "districtlens.local";

export function normalizeUsername(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove accents (ñ -> n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".") // spaces and symbols -> "."
    .replace(/^\.+|\.+$/g, ""); // trim leading/trailing "."
}

export function usernameToEmail(value: string): string {
  const slug = normalizeUsername(value);
  return slug ? `${slug}@${USERNAME_EMAIL_DOMAIN}` : "";
}