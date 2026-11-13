"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthenticationProps = {
  children: React.ReactNode;
};

export default function Authentication({
  children,
}: AuthenticationProps) {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  async function checkAuthentication() {
    // Check logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // No active session
    if (!user) {
      router.replace("/worker/login");
      return;
    }

    // Get worker profile
    const {
      data: profile,
      error,
    } = await supabase
      .from("profiles")
      .select("role, team_id")
      .eq("id", user.id)
      .single();

    // Profile not found
    if (error || !profile) {
      await supabase.auth.signOut();
      router.replace("/worker/login");
      return;
    }

    // Only Field Workers
    if (profile.role !== "field_worker") {
      await supabase.auth.signOut();
      router.replace("/worker/login");
      return;
    }

    // Field Worker must have a team
    if (!profile.team_id) {
      await supabase.auth.signOut();
      router.replace("/worker/login");
      return;
    }

    // Authentication successful
    setChecking(false);
  }

  // While checking authentication
  if (checking) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">

          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

          <p className="mt-4 text-sm text-gray-500">
            Checking access...
          </p>

        </div>
      </main>
    );
  }

  return <>{children}</>;
}