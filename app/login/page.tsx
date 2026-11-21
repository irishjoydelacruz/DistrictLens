"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DISTRICTLENS_LOGO = "/images/districtlenslogo.png";

// UI class tokens
const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

const labelClass = "mb-1.5 block text-sm font-semibold text-slate-800";

const btnPrimary =
  "w-full rounded-xl bg-[#123D73] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50";

const QUERY_ERRORS: Record<string, string> = {
  profile: "Unable to verify your account. Please sign in again.",
  role: "Your account does not have a valid role.",
  team: "This field account has no assigned team. Contact your administrator.",
  pending: "Your account is waiting for administrator approval.",
  rejected:
    "Your account request was declined. Please contact the administrator.",
  callback: "Sign-in could not be completed. Please try again.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    QUERY_ERRORS[searchParams.get("error") ?? ""] ?? ""
  );
  const [loading, setLoading] = useState(false);

  const noticeParam = searchParams.get("notice");
  const notice =
    noticeParam === "reset"
      ? "Password updated. You can now log in."
      : noticeParam === "verified"
      ? "Email verified. Wait for the administrator to approve your account, then log in."
      : "";

  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const email = identifier.trim().toLowerCase();

    if (!email) {
      setError("Please enter your email.");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Authenticate the user
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError("Invalid email or password.");
        return;
      }

      // Step 2: Check approval, role and temporary password status
      const response = await fetch("/api/auth/password-status", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        await supabase.auth.signOut();
        setError(
          result.error ?? "Unable to verify your account. Please try again."
        );
        return;
      }

      // Step 3: Temporary password: change it first
      if (result.mustChangePassword === true) {
        window.location.href = "/change-password";
        return;
      }

      // Step 4: Send the user to their own workspace
      if (result.role === "field_worker") {
        window.location.href = "/worker";
        return;
      }

      if (
        result.role === "super_admin" ||
        result.role === "customer_service"
      ) {
        window.location.href = "/admin";
        return;
      }

      await supabase.auth.signOut();
      setError("Your account does not have a valid role.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");

    const supabase = createClient();
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (googleError) {
      setError("Unable to start Google sign-in. Please try again.");
    }
  }

  return (
    <div className="min-h-dvh w-full bg-white">
      {/* HEADER: logo and button both go back to the public portal */}
      <header className="sticky top-0 z-50 h-16 w-full border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full w-full max-w-[1700px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Back to the Tanza Water District public portal"
            className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73] focus-visible:ring-offset-2"
          >
            {/* TWD LOGO */}
            <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
              <Image
                src="/images/twd-logo.jpg"
                alt="Tanza Water District official logo"
                fill
                sizes="48px"
                className="rounded-full object-contain"
                priority
              />
            </div>

            {/* TWD NAME */}
            <p className="truncate text-sm font-bold tracking-tight text-[#123D73] sm:text-lg">
              Tanza Water District
            </p>
          </Link>

          {/* BACK TO PUBLIC PORTAL */}
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#123D73] px-3.5 py-2 text-sm font-semibold text-[#123D73] transition hover:bg-[#123D73] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73] focus-visible:ring-offset-2"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back to public portal</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      {/* MAIN SPLIT LAYOUT */}
      <main className="grid min-h-[calc(100dvh-64px)] grid-cols-1 md:grid-cols-2">
        {/* LEFT BRANDING (desktop and tablet only) */}
        <section className="relative hidden flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#E6F0FA] via-[#DDF0F8] to-[#C6E9F5] px-6 py-12 md:flex md:min-h-[calc(100dvh-64px)]">
          {/* SOFT GLOW BEHIND LOGO */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-[65%] rounded-full bg-white/60 blur-3xl"
            aria-hidden="true"
          />

          {/* DISTRICTLENS LOGO */}
          <div className="relative mx-auto mb-5 h-28 w-28 sm:h-32 sm:w-32 lg:h-40 lg:w-40">
            <Image
              src={DISTRICTLENS_LOGO}
              alt="DistrictLens Logo"
              fill
              priority
              sizes="(max-width: 1024px) 128px, 160px"
              className="object-contain"
            />
          </div>

          {/* BRAND NAME */}
          <h1 className="relative text-center text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            <span className="text-[#123D73]">District</span>
            <span className="text-[#007AA3]">Lens</span>
          </h1>

          {/* BRAND TAGLINE */}
          <p className="relative mt-4 flex flex-wrap items-center justify-center gap-2 text-center text-sm font-semibold tracking-wide text-[#123D73] lg:text-base">
            <span>Monitor</span>
            <span className="text-[#007AA3]">╼</span>
            <span>Report</span>
            <span className="text-[#007AA3]">╼</span>
            <span>Locate</span>
          </p>

          {/* DESCRIPTION */}
          <p className="relative mt-2 max-w-70 text-center text-sm leading-5 text-slate-700 font-medium">
            Operations Dashboard and Incident Monitoring System
          </p>

          {/* BOTTOM WAVE */}
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full"
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 64 C240 100 480 100 720 64 C960 28 1200 28 1440 64 L1440 120 L0 120 Z"
              fill="#00A6D6"
              fillOpacity="0.18"
            />
            <path
              d="M0 84 C240 112 480 112 720 84 C960 56 1200 56 1440 84 L1440 120 L0 120 Z"
              fill="#123D73"
              fillOpacity="0.14"
            />
          </svg>
        </section>

        {/* RIGHT SIDE: LOGIN + FOOTER */}
        <div className="flex min-h-140 flex-col md:min-h-[calc(100dvh-64px)] md:border-l md:border-slate-200">
          {/* LOGIN FORM */}
          <section className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10 lg:px-14">
            <div className="relative z-10 my-auto w-full max-w-100">
              {/* WELCOME HEADER */}
              <div className="mb-5 text-center md:hidden">
                {/* MOBILE LOGO AND BRANDING */}
                <div className="mb-4 flex flex-col items-center md:hidden">
                  <div className="flex items-center justify-center gap-4">
                    <div className="relative h-14 w-14 shrink-0">
                      <Image
                        src={DISTRICTLENS_LOGO}
                        alt="DistrictLens Logo"
                        fill
                        priority
                        sizes="56px"
                        className="object-contain"
                      />
                    </div>

                    <div className="h-10 w-px bg-slate-200" />

                    <div className="flex flex-col text-left">
                      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                        <span className="text-[#123D73]">District</span>
                        <span className="text-[#00A6D6]">Lens</span>
                      </h1>

                      <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-slate-400">
                        AUTHORIZED PERSONNEL
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 max-w-sm text-center text-sm leading-5 text-slate-500">
                    Operations Dashboard and Incident Monitoring System
                  </p>
                </div>

              </div>

              {/* LOGIN TITLE */}
              <p className="font-sans text-xl font-semibold text-[#123D73] lg:text-2xl">
                Log In to your account
              </p>

              {/* LOGIN FORM */}
              <form onSubmit={handleLogin} className="mt-4 space-y-4">
                {/* EMAIL ADDRESS */}
                <div>
                  <label htmlFor="identifier" className={labelClass}>
                    Email Address
                  </label>

                  <div className="relative">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#123D73]/60"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path
                        d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"
                        strokeLinecap="round"
                      />
                    </svg>

                    <input
                      id="identifier"
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      autoComplete="email"
                      className={`${inputClass} pl-11`}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password
                  </label>

                  <div className="relative">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#123D73]/60"
                      aria-hidden="true"
                    >
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                    </svg>

                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className={`${inputClass} pl-11 pr-16`}
                      placeholder="Enter your password"
                    />

                    {/* SHOW / HIDE PASSWORD */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-4 text-slate-500 transition hover:text-[#123D73]"
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                          <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 9 4 10 7-0.4 1.2-1.3 2.5-2.5 3.5" />
                          <path d="M6.2 6.2C3.8 7.5 2.4 9.5 2 12c1 3 5 7 10 7 1.2 0 2.3-.2 3.3-.6" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* NOTICE MESSAGE */}
                {notice && (
                  <p
                    role="status"
                    className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                  >
                    {notice}
                  </p>
                )}

                {/* ERROR MESSAGE */}
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                {/* FORGOT PASSWORD */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="cursor-pointer text-sm font-medium text-[#123D73] transition-colors hover:text-[#087E87] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* LOGIN BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`${btnPrimary} cursor-pointer shadow-md transition-all hover:brightness-110`}
                >
                  {loading ? "Logging in..." : "LOGIN"}
                </button>
              </form>

              {/* DIVIDER */}
              <div className="relative flex items-center py-3">
                <div className="grow border-t border-slate-200" />
                <span className="mx-4 text-xs font-medium uppercase text-slate-400">
                  OR
                </span>
                <div className="grow border-t border-slate-200" />
              </div>

              {/* GOOGLE LOGIN BUTTON */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#123D73] hover:bg-slate-50"
              >
                <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.98 6.19c4.65-4.3 6.81-10.62 6.81-17.84z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.91-5.81l-7.98-6.19c-2.15 1.45-4.89 2.3-7.93 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                Continue with Google
              </button>

              {/* SIGN UP */}
              <p className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="cursor-pointer font-semibold text-[#123D73] hover:underline"
                >
                  Sign Up
                </button>
              </p>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="flex min-h-16 shrink-0 items-center justify-center">
            <p className="text-center text-xs text-slate-500">
              &copy; {year} SerbisyON. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}