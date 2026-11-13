"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Incident = {
  id: string;
  barangay_code: string;
  incident_type: string;
  description: string | null;
  status: string;
  reported_at: string;
};

type Deployment = {
  id: string;
  incident_id: string;
  team_id: string;
  status: string;
  assigned_at: string;
  resolved_at: string | null;
  incidents: Incident | null;
};

type Barangay = {
  name: string;
  code: string;
};

type HomeProps = {
  refreshKey: number;
};

// Counts up from 0 to `value` when the number scrolls into view
// (same behavior as the admin dashboard).
function CountUp({
  value,
  duration = 1100,
}: {
  value: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    let frame = 0;

    const play = () => {
      cancelAnimationFrame(frame);
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out
        setDisplay(Math.round(value * eased));

        if (progress < 1) frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            play();
          } else {
            cancelAnimationFrame(frame);
            setDisplay(0);
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  );
}

// Same card structure as the admin dashboard summary cards.
function SummaryCard({
  label,
  value,
  description,
  color,
  percent,
}: {
  label: string;
  value: number;
  description: string;
  color: "red" | "yellow" | "green" | "blue";
  percent?: number;
}) {
  const accents = {
    red: "bg-red-600",
    yellow: "bg-amber-500",
    green: "bg-emerald-600",
    blue: "bg-[#123D73]",
  };

  return (
    <div className="relative min-w-0 border border-slate-300 bg-white p-4 sm:p-6">
      {/* Top accent bar */}
      <div
        className={`absolute inset-x-0 top-0 h-0.5 ${accents[color]}`}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">{label}</p>

        {percent !== undefined && (
          <span className="text-xs font-semibold text-slate-500">
            <CountUp value={percent} />%
          </span>
        )}
      </div>

      <p className="mt-3 text-3xl font-bold text-slate-900 sm:mt-4 sm:text-4xl">
        <CountUp value={value} />
      </p>

      <p className="mt-2 text-xs text-slate-500 sm:text-sm">
        {description}
      </p>
    </div>
  );
}

// Same panel structure as the admin dashboard.
function Panel({
  title,
  description,
  rightLabel,
  children,
}: {
  title: string;
  description: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden border border-slate-300 bg-white">
      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#123D73]">{title}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{description}</p>
        </div>

        {rightLabel && (
          <span className="w-fit shrink-0 border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
            {rightLabel}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

export default function Home({
  refreshKey,
}: HomeProps) {
  const [deployments, setDeployments] =
    useState<Deployment[]>([]);

  const [barangays, setBarangays] =
    useState<Barangay[]>([]);

  const [teamName, setTeamName] =
    useState("");

  const [workerName, setWorkerName] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const supabase = createClient();

  // =========================
  // LOAD DATA
  // =========================

  useEffect(() => {
    loadHomeData();
  }, [refreshKey]);

  async function loadHomeData() {
    setLoading(true);
    setErrorMessage("");

    // =========================
    // GET USER
    // =========================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMessage(
        "You are not logged in."
      );

      setLoading(false);
      return;
    }

    // =========================
    // GET PROFILE
    // =========================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "id, full_name, role, team_id"
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      setErrorMessage(
        `Unable to load profile: ${profileError.message}`
      );

      setLoading(false);
      return;
    }

    // =========================
    // CHECK FIELD WORKER
    // =========================

    if (profile.role !== "field_worker") {
      setErrorMessage(
        "This account is not a Field Worker account."
      );

      setLoading(false);
      return;
    }

    // =========================
    // CHECK TEAM
    // =========================

    if (!profile.team_id) {
      setErrorMessage(
        "This Field Worker account has no assigned team."
      );

      setLoading(false);
      return;
    }

    // =========================
    // GET TEAM NAME
    // (shows which team is signed in, e.g. Team Alpha)
    // =========================

    setWorkerName(profile.full_name || "");

    const {
      data: team,
      error: teamError,
    } = await supabase
      .from("teams")
      .select("name")
      .eq("id", profile.team_id)
      .single();

    if (teamError) {
      console.error(
        "Error loading team:",
        teamError
      );
    } else {
      setTeamName(team?.name || "");
    }

    // =========================
    // GET DEPLOYMENTS
    // =========================

    const {
      data,
      error,
    } = await supabase
      .from("deployments")
      .select(`
        id,
        incident_id,
        team_id,
        status,
        assigned_at,
        resolved_at,
        incidents (
          id,
          barangay_code,
          incident_type,
          description,
          status,
          reported_at
        )
      `)
      .eq("team_id", profile.team_id)
      .order("assigned_at", {
        ascending: false,
      });

    if (error) {
      setErrorMessage(
        `Unable to load assignments: ${error.message}`
      );

      setLoading(false);
      return;
    }

    setDeployments(
      (data as unknown as Deployment[]) || []
    );

    // =========================
    // GET BARANGAYS
    // =========================

    try {
      const response = await fetch(
        "/data/tanza-barangays.geojson"
      );

      const geojson = await response.json();

      const barangayList =
        geojson.features.map(
          (feature: any) => ({
            name:
              feature.properties.brgy_name,
            code:
              feature.properties.brgy_code,
          })
        );

      setBarangays(barangayList);
    } catch (error) {
      console.error(
        "Error loading barangays:",
        error
      );
    }

    setLoading(false);
  }

  // =========================
  // BARANGAY NAME
  // =========================

  function getBarangayName(
    code: string
  ) {
    const barangay = barangays.find(
      (item) => item.code === code
    );

    return barangay
      ? barangay.name
      : code;
  }

  // =========================
  // RESOLVED CHECK
  // =========================

  function isResolved(
    deployment: Deployment
  ) {
    return (
      deployment.status === "resolved" ||
      deployment.resolved_at !== null
    );
  }

  // =========================
  // COUNTS
  // =========================

  const criticalCount =
    deployments.filter(
      (deployment) =>
        !isResolved(deployment) &&
        deployment.incidents?.status ===
          "red"
    ).length;

  const monitoringCount =
    deployments.filter(
      (deployment) =>
        !isResolved(deployment) &&
        deployment.incidents?.status ===
          "yellow"
    ).length;

  const resolvedCount =
    deployments.filter(
      (deployment) =>
        isResolved(deployment) ||
        deployment.incidents?.status ===
          "green"
    ).length;

  const totalAssignments =
    deployments.length;

  const percent = (count: number) =>
    totalAssignments > 0
      ? Math.round((count / totalAssignments) * 100)
      : 0;

  // =========================
  // ACTIVE INCIDENTS
  // =========================

  const activeDeployments =
    deployments.filter(
      (deployment) =>
        !isResolved(deployment) &&
        deployment.incidents &&
        (
          deployment.incidents.status ===
            "red" ||
          deployment.incidents.status ===
            "yellow"
        )
    );

  // =========================
  // STATUS LABEL
  // (UI only: colors and wording match the admin portal)
  // =========================

  function getStatusLabel(
    status: string
  ) {
    if (status === "red") {
      return {
        label: "Active",
        className:
          "border-red-200 bg-red-50 text-red-800",
        border: "border-l-red-600",
      };
    }

    if (status === "yellow") {
      return {
        label: "Monitoring",
        className:
          "border-amber-200 bg-amber-50 text-amber-800",
        border: "border-l-amber-500",
      };
    }

    return {
      label: "Normal",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800",
      border: "border-l-emerald-600",
    };
  }

  // =========================
  // ERROR
  // =========================

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-md px-3 pt-4">

        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-5"
        >

          <h2 className="text-base font-bold text-red-800">
            Unable to load dashboard
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>

          <button
            onClick={loadHomeData}
            className="mt-4 min-h-11 rounded-none border border-red-700 bg-red-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700/30"
          >
            Try Again
          </button>

        </div>

      </div>
    );
  }

  // =========================
  // MAIN UI
  // =========================

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8">

      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">

        {/* WELCOME BANNER */}

        <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-8 sm:py-6">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0">

              <p className="text-sm font-bold text-indigo-100">
                Field Worker Portal
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                Welcome to DistrictLens
              </h1>

              <p className="mt-2 text-base text-indigo-100">
                Your team&apos;s assignments and incident updates
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-indigo-100">
                <span>Tanza, Cavite</span>
                <span className="text-indigo-300">|</span>
                <time>
                  {new Date().toLocaleDateString("en-PH", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>

            </div>

            {/* SUBTLE REFRESH INDICATOR */}

            {loading && (
              <div
                className="flex shrink-0 items-center gap-2 text-xs font-medium text-indigo-100"
                aria-live="polite"
              >
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Updating
              </div>
            )}

          </div>

        </header>

        {/* TEAM CARD */}

        <section className="border border-slate-300 bg-white p-4 sm:p-6">

          <div className="flex items-center gap-4">

            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-[#123D73]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
                <path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                <path d="M21 20v-1a4 4 0 0 0-3-3.87" />
                <path d="M16 4.13a3.5 3.5 0 0 1 0 6.74" />
              </svg>
            </div>

            <div className="min-w-0">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Field Team
              </p>

              <h2 className="mt-0.5 truncate text-lg font-bold text-[#123D73]">
                {teamName ||
                  (loading
                    ? "Loading team..."
                    : "Team")}
              </h2>

              {workerName && (
                <p className="mt-0.5 truncate text-sm text-slate-600">
                  Signed in as {workerName}
                </p>
              )}

            </div>

          </div>

        </section>

        {/* MY ASSIGNMENTS (same cards as the admin dashboard) */}

        <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">

          <SummaryCard
            label="Active"
            value={criticalCount}
            description="Requires immediate attention"
            color="red"
            percent={percent(criticalCount)}
          />

          <SummaryCard
            label="Monitoring"
            value={monitoringCount}
            description="Incidents under monitoring"
            color="yellow"
            percent={percent(monitoringCount)}
          />

          <SummaryCard
            label="Resolved"
            value={resolvedCount}
            description="Completed assignments"
            color="green"
            percent={percent(resolvedCount)}
          />

          <SummaryCard
            label="Total Assignments"
            value={totalAssignments}
            description="All assigned incidents"
            color="blue"
          />

        </div>

        {/* ACTIVE INCIDENTS */}

        <Panel
          title="Active Incidents"
          description="Assigned incidents that still need your team's attention"
          rightLabel={`${activeDeployments.length} ${
            activeDeployments.length === 1
              ? "incident"
              : "incidents"
          }`}
        >

          <div className="p-4 sm:p-6">

            {/* NO ACTIVE INCIDENTS */}

            {activeDeployments.length === 0 && (
              <div className="px-4 py-8 text-center">

                <p className="text-base font-bold text-slate-800">
                  No active incidents
                </p>

                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  All assigned incidents are currently resolved.
                </p>

              </div>
            )}

            {/* ACTIVE LIST */}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4 xl:grid-cols-3">

              {activeDeployments
                .slice(0, 5)
                .map((deployment) => {

                  const incident =
                    deployment.incidents;

                  if (!incident) {
                    return null;
                  }

                  const status =
                    getStatusLabel(
                      incident.status
                    );

                  return (
                    <div
                      key={deployment.id}
                      className={`border border-l-4 border-slate-300 bg-white p-4 ${status.border}`}
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <span
                            className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>

                          <h3 className="mt-3 text-base font-bold leading-snug text-[#123D73]">
                            {incident.incident_type}
                          </h3>

                          <p className="mt-1.5 text-sm font-medium text-slate-800">
                            {getBarangayName(
                              incident.barangay_code
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Assigned{" "}
                            {new Date(
                              deployment.assigned_at
                            ).toLocaleString()}
                          </p>

                        </div>

                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white text-[#123D73]"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </span>

                      </div>

                    </div>
                  );
                })}

            </div>

            {/* MORE THAN 5 */}

            {activeDeployments.length > 5 && (
              <p className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
                Showing 5 of {activeDeployments.length} active
                incidents. See all in Assignments.
              </p>
            )}

          </div>

        </Panel>

      </div>

    </div>
  );
}