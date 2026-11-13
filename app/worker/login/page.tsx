"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/username";

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

export default function WorkerLoginPage() {
  const router = useRouter();

  // The username is the team name, e.g. "Team Alpha".
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotName, setForgotName] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    try {
      const email = usernameToEmail(username);

      if (!email) {
        setErrorMessage("Please enter your team name.");
        return;
      }

      // 1. Authenticate the account
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        setErrorMessage("Invalid team name or password.");
        return;
      }

      // 2. Check role and temporary-password status
      const response = await fetch("/api/auth/password-status", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        await supabase.auth.signOut();
        setErrorMessage(result.error ?? "Unable to verify your account.");
        return;
      }

      // 3. Only allow Field Team accounts
      if (result.role !== "field_worker") {
        await supabase.auth.signOut();
        setErrorMessage(
          "This account is not authorized for the Field Worker Portal."
        );
        return;
      }

      // 4. Force temporary-password change first
      if (result.mustChangePassword === true) {
        router.replace("/change-password?portal=worker");
        return;
      }

      // 5. Check the worker's team assignment
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMessage("Worker profile was not found.");
        return;
      }

      if (!profile.team_id) {
        await supabase.auth.signOut();
        setErrorMessage("This worker account has no assigned team.");
        return;
      }

      // 6. Go to the Worker Dashboard
      router.replace("/worker");
      router.refresh();
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotName }),
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
      setForgotLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F9] text-slate-900">
      {/* HEADER */}
      <header className="border-b border-t-4 border-slate-200 border-t-[#123D73] bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="relative h-12 w-12 shrink-0">
            <Image
              src="/images/twd-logo.jpg"
              alt="Tanza Water District official logo"
              fill
              sizes="48px"
              className="object-contain"
              priority
            />
          </div>

          <p className="text-lg font-bold text-[#123D73]">
            Tanza Water District
          </p>
        </div>
      </header>

      {/* LOGIN */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="border border-slate-300 bg-white">
            <div className="border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-6 text-center">
              <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white">
                DistrictLens
              </h1>
              <p className="mt-1 text-base text-indigo-100">
                Field Worker Portal
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <h2 className="text-center text-2xl font-bold text-[#123D73]">
                Team Login
              </h2>
              <p className="mt-2 text-center text-base text-slate-500">
                Enter your team name and password.
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Team name
                  </label>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Team Alpha"
                    autoComplete="username"
                    autoCapitalize="words"
                    required
                    className={`mt-2 ${fieldClass}`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-bold text-slate-800"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="text-sm font-medium text-[#123D73] hover:underline"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                    className={`mt-2 ${fieldClass}`}
                  />
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#123D73] py-3.5 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
              </form>

              {/* FORGOT PASSWORD (notifies the admin) */}
              <div className="mt-6 border-t border-slate-200 pt-5 text-center">
                {!forgotOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotName(username);
                    }}
                    className="text-sm font-medium text-[#123D73] hover:underline"
                  >
                    Forgot password?
                  </button>
                ) : (
                  <form
                    onSubmit={handleForgotPassword}
                    className="space-y-4 text-left"
                  >
                    <p className="text-sm text-slate-600">
                      Enter your team name. Your administrator will be
                      notified and will give you a temporary password.
                    </p>

                    <input
                      type="text"
                      value={forgotName}
                      onChange={(e) => setForgotName(e.target.value)}
                      placeholder="Team name"
                      aria-label="Team name"
                      required
                      className={fieldClass}
                    />

                    {forgotError && (
                      <p
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                      >
                        {forgotError}
                      </p>
                    )}

                    {forgotMessage && (
                      <p
                        role="status"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                      >
                        {forgotMessage}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotOpen(false);
                          setForgotMessage("");
                          setForgotError("");
                        }}
                        className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="flex-1 rounded-xl bg-[#123D73] py-3 text-sm font-semibold text-white hover:bg-[#0D2F59] disabled:opacity-60"
                      >
                        {forgotLoading ? "Sending..." : "Send request"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Authorized field personnel only
          </p>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <p className="px-4 py-5 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} SerbisyON. All rights reserved.
        </p>
      </footer>
    </div>
  );
}