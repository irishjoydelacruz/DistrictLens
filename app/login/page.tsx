"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/username";

// UI-only class tokens (same look as the admin login).
const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-2 block text-sm font-semibold text-slate-800";
const btnPrimary =
  "w-full rounded-xl bg-[#123D73] px-4 py-3.5 text-base font-bold uppercase tracking-[0.15em] text-white transition hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50";

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
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    QUERY_ERRORS[searchParams.get("error") ?? ""] ?? ""
  );
  const [loading, setLoading] = useState(false);

  const noticeParam = searchParams.get("notice");
  const notice =
    noticeParam === "reset"
      ? "Password updated. You can now sign in."
      : noticeParam === "verified"
      ? "Email verified. Wait for the administrator to approve your account, then sign in."
      : "";

  // "Forgot password": email gets a reset link, username notifies the admin
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotName, setForgotName] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  async function handleGoogle() {
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

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // An email is used as typed; anything else is a username (full name or
    // team name) and is converted to its internal login.
    const identifier = username.trim();
    const email = identifier.includes("@")
      ? identifier.toLowerCase()
      : usernameToEmail(identifier);

    if (!email) {
      setError("Please enter your email or username.");
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
        setError("Invalid email/username or password.");
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

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setForgotBusy(true);

    try {
      const value = forgotName.trim();

      // Real email: Supabase sends the reset link.
      if (value.includes("@")) {
        const supabase = createClient();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          value.toLowerCase(),
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
          }
        );

        if (resetError) {
          setForgotError("Unable to send the reset email. Please try again.");
          return;
        }

        setForgotMessage(
          "If this email is registered, a reset link has been sent. Check your inbox and spam folder."
        );
        return;
      }

      // Username: notify the administrator (existing flow).
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const result = await response.json();

      if (!response.ok) {
        setForgotError(result.error ?? "Unable to send your request.");
        return;
      }

      setForgotMessage(result.message);
    } catch {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-800">
      {/* HEADER */}
      <header className="border-b border-t-4 border-slate-200 border-t-[#123D73] bg-white">
        <div className="mx-auto flex min-h-22 max-w-[1600px] items-center px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <Image
                src="/images/twd-logo.jpg"
                alt="Tanza Water District official logo"
                fill
                sizes="64px"
                className="object-contain"
                priority
              />
            </div>

            <p className="truncate text-base font-bold tracking-tight text-[#123D73] sm:text-xl">
              Tanza Water District
            </p>
          </div>
        </div>
      </header>

      {/* SPLIT LAYOUT */}
      <main className="grid flex-1 md:grid-cols-2">
        {/* Brand side */}
        <section className="flex flex-col items-center justify-center bg-linear-to-br from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-12 text-center">
          <div className="relative h-44 w-44 shrink-0 rounded-full border-4 border-white/30 bg-white p-3 shadow-md sm:h-56 sm:w-56 lg:h-72 lg:w-72">
            <Image
              src="/images/twd-logo.jpg"
              alt="Tanza Water District official logo"
              fill
              sizes="(min-width: 1024px) 288px, (min-width: 640px) 224px, 176px"
              className="rounded-full object-contain p-3"
              priority
            />
          </div>

          <h2 className="mt-8 text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl">
            DistrictLens
          </h2>

          <p className="mt-2 text-sm font-medium text-indigo-100 sm:text-base">
            Tanza Water District Staff Portal
          </p>

          <p className="mt-3 flex items-center gap-4 text-sm text-indigo-200">
            <span>Monitor</span>
            <span>Report</span>
            <span>Locate</span>
          </p>
        </section>

        {/* Login side */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-bold text-[#123D73] sm:text-3xl">
              Login
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Enter your email or username and password
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-6">
              <div>
                <label htmlFor="username" className={labelClass}>
                  Email or Username
                </label>

                <div className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path
                      d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"
                      strokeLinecap="round"
                    />
                  </svg>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className={`${inputClass} pl-11`}
                    placeholder="Email, full name or team name"
                  />
                </div>
              </div>

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
                    className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  >
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path
                      d="M8 11V8a4 4 0 0 1 8 0v3"
                      strokeLinecap="round"
                    />
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

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-slate-500 hover:text-[#123D73]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {notice && (
                <p
                  role="status"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  {notice}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            {/* GOOGLE + REGISTER */}
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Continue with Google
            </button>

            <p className="mt-4 text-center text-sm text-slate-600">
              No account yet?{" "}
              <Link
                href="/register"
                className="font-medium text-[#123D73] underline-offset-2 hover:underline"
              >
                Request an account
              </Link>
            </p>

            {/* FORGOT PASSWORD */}
            <div className="mt-6 border-t border-slate-200 pt-5">
              {!forgotOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(true);
                    setForgotName(username);
                  }}
                  className="text-sm font-medium text-[#123D73] underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              ) : (
                <form onSubmit={handleForgot} className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Enter your email to receive a reset link. If your account
                    has no email, enter your username and the administrator
                    will give you a temporary password.
                  </p>

                  <input
                    type="text"
                    value={forgotName}
                    onChange={(e) => setForgotName(e.target.value)}
                    required
                    aria-label="Email or username"
                    placeholder="Email or username"
                    className={inputClass}
                  />

                  {forgotError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      {forgotError}
                    </p>
                  )}

                  {forgotMessage && (
                    <p
                      role="status"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                    >
                      {forgotMessage}
                    </p>
                  )}

                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={forgotBusy}
                      className="rounded-xl bg-[#123D73] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {forgotBusy ? "Sending..." : "Send request"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotOpen(false);
                        setForgotMessage("");
                        setForgotError("");
                      }}
                      className="text-sm font-medium text-slate-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-5">
              <Link
                href="/"
                className="text-sm font-medium text-[#123D73] underline-offset-2 hover:underline"
              >
                Back to public portal
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white px-6 py-5 text-center">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} SerbisyON. All rights reserved.
        </p>
      </footer>
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