"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const response = await fetch(
          "/api/auth/password-status",
          { cache: "no-store" }
        );

        const result = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        if (result.mustChangePassword !== true) {
          router.replace("/login");
          return;
        }

        setReady(true);
      } catch {
        if (!cancelled) {
          setErrorMessage(
            "Unable to check your account. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkStatus();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");

    if (!ready || saving) return;

    if (newPassword.length < 12) {
      setErrorMessage(
        "Use at least 12 characters for your new password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/auth/complete-password-change",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newPassword }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Unable to change your password."
        );
        return;
      }

      // Sign out after the server confirms the password change.
      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">
          Checking your account...
        </p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8">
          <p role="status" className="text-slate-600">
            {errorMessage || "Redirecting..."}
          </p>

          {errorMessage && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
            >
              Try Again
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Change Your Password
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            For account security, replace your temporary
            password before continuing to DistrictLens.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-slate-700"
          >
            New password
          </label>

          <input
            id="newPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <p className="text-xs text-slate-500">
            Use at least 12 characters.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-slate-700"
          >
            Confirm new password
          </label>

          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) =>
              setShowPassword(event.target.checked)
            }
            className="rounded border-slate-300"
          />
          Show passwords
        </label>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !ready}
          className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Updating password..."
            : "Save New Password"}
        </button>
      </form>
    </main>
  );
}