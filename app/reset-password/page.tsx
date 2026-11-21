"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-2 block text-sm font-semibold text-slate-800";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getSession()
      .then(
        ({ data }: { data: { session: { user?: unknown } | null } }) => {
          if (data.session) {
            setHasSession(true);
          }
          setReady(true);
        }
      );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string, session: { user?: unknown } | null) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setHasSession(true);
          setReady(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      window.location.href = "/login?notice=reset";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-800">
      <div className="w-full max-w-md border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[#123D73]">
          Set a new password
        </h1>

        {!ready ? (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        ) : !hasSession ? (
          <>
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              This reset link is invalid or has expired. Please request a new
              one.
            </p>

            <Link
              href="/login"
              className="mt-5 inline-block text-sm font-medium text-[#123D73] underline-offset-2 hover:underline"
            >
              Back to login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="new-password" className={labelClass}>
                New password
              </label>
              <input
                id="new-password"
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
              <label htmlFor="confirm-password" className={labelClass}>
                Confirm new password
              </label>
              <input
                id="confirm-password"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#123D73] px-4 py-3.5 text-base font-bold uppercase tracking-[0.15em] text-white transition hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}