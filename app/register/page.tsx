"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-2 block text-sm font-semibold text-slate-800";
const btnPrimary =
  "w-full rounded-xl bg-[#123D73] px-4 py-3.5 text-base font-bold uppercase tracking-[0.15em] text-white transition hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const name = fullName.trim();
    const mail = email.trim().toLowerCase();

    if (!name) return setError("Please enter your full name.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/login?notice=verified`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Email already registered (Supabase returns no identities).
      if (data.user && data.user.identities?.length === 0) {
        setError("This email is already registered. Try signing in instead.");
        return;
      }

      // Never keep a session for an unapproved account.
      if (data.session) await supabase.auth.signOut();

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 text-slate-800">
      <div className="w-full max-w-md border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <Image
              src="/images/twd-logo.jpg"
              alt="Tanza Water District official logo"
              fill
              sizes="48px"
              className="object-contain"
            />
          </div>
          <p className="text-lg font-bold text-[#123D73]">DistrictLens</p>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-[#123D73]">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your account must be approved by an administrator before you can
          sign in.
        </p>

        {done ? (
          <div
            role="status"
            className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            Account request sent. Check your email to verify your address,
            then wait for the administrator to approve your account.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              className="mt-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="reg-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  className={inputClass}
                  placeholder="e.g. Juan Dela Cruz"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="reg-confirm" className={labelClass}>
                  Confirm password
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="Re-enter your password"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? "Sending..." : "Request account"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 border-t border-slate-200 pt-5">
          <Link
            href="/login"
            className="text-sm font-medium text-[#123D73] underline-offset-2 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}