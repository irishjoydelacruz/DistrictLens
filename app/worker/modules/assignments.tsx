"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
// =========================
// SKELETON LOADING
// (square corners and slate colors, same as the admin Dashboard)
// =========================

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-slate-200 motion-safe:animate-pulse ${className}`}
    />
  );
}

// Screen readers hear this while the skeleton is shown.
function LoadingStatus({ label = "Loading..." }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

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
  started_at: string | null;
  resolved_at: string | null;
  incidents: Incident | null;
};

type Barangay = {
  name: string;
  code: string;
};

// Exported so the parent page can use the same type.
export type Filter =
  | "all"
  | "todo"
  | "assigned"
  | "ongoing"
  | "resolved"
  | "red"
  | "yellow";

type AssignmentsProps = {
  refreshKey: number;
  // Filter selected when the tab opens (e.g. "resolved" from Team).
  initialFilter?: Filter;
  onSelectAssignment: (
    deployment: Deployment
  ) => void;
};

// Same panel structure as the admin portal.
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

// Loading version of an assignment card.
function AssignmentCardSkeleton() {
  return (
    <div className="flex w-full flex-col border border-l-4 border-slate-300 border-l-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-20" />
      </div>

      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2.5 h-4 w-1/2" />
      <Skeleton className="mt-2 h-3 w-2/3" />

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-9 shrink-0" />
      </div>
    </div>
  );
}

export default function Assignments({
  refreshKey,
  initialFilter = "todo",
  onSelectAssignment,
}: AssignmentsProps) {

  const [filter, setFilter] =
    useState<Filter>(initialFilter);

  const [deployments, setDeployments] =
    useState<Deployment[]>([]);

  const [barangays, setBarangays] =
    useState<Barangay[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  // Pagination
  const [page, setPage] =
    useState(1);

  const listTopRef =
    useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // Go back to page 1 whenever the filter changes.
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // =========================
  // LOAD ASSIGNMENTS
  // =========================

  useEffect(() => {
    loadAssignments();
  }, [refreshKey]);

  async function loadAssignments() {
    setLoading(true);
    setErrorMessage("");

    // =========================
    // GET LOGGED-IN USER
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
        `This account is not a Field Worker account. Current role: ${profile.role}`
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
    // GET DEPLOYMENTS
    // (started_at is included so Incident Details can
    // show the "Ongoing" time)
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
        started_at,
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
      .eq(
        "team_id",
        profile.team_id
      )
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

    const deploymentList =
      (data as unknown as Deployment[]) ||
      [];

    // =========================
    // GET BARANGAYS
    // =========================

    try {
      const response = await fetch(
        "/data/tanza-barangays.geojson"
      );

      const geojson =
        await response.json();

      const barangayList =
        geojson.features.map(
          (feature: any) => ({
            name:
              feature.properties.brgy_name,
            code:
              feature.properties.brgy_code,
          })
        );

      setBarangays(
        barangayList
      );

    } catch (error) {

      console.error(
        "Error loading barangays:",
        error
      );

    }

    // Set the deployments last so the skeleton is replaced
    // only when everything (including barangay names) is ready.
    setDeployments(deploymentList);

    setLoading(false);
  }

  // Skeleton only on the first load. When refreshing,
  // the old data stays visible with the "Updating" indicator.
  const showSkeleton =
    loading && deployments.length === 0;

  // =========================
  // BARANGAY NAME
  // =========================

  function getBarangayName(
    code: string
  ) {

    const barangay =
      barangays.find(
        (item) =>
          item.code === code
      );

    return barangay
      ? barangay.name
      : code;
  }

  // =========================
  // INCIDENT STATUS
  // (UI only: colors and wording match the admin portal)
  // =========================

  function getIncidentStatus(
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
      label: "Resolved",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800",
      border: "border-l-emerald-600",
    };
  }

  // =========================
  // DEPLOYMENT STATUS
  // (UI only: same colors as the admin Assignments page)
  // =========================

  function getProgressStatus(
    status: string
  ) {

    if (
      status === "ongoing" ||
      status === "in_progress"
    ) {
      return {
        label: "Ongoing",
        className:
          "border-amber-200 bg-amber-50 text-amber-800",
        dot: "bg-amber-500",
      };
    }

    if (status === "resolved") {
      return {
        label: "Resolved",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        dot: "bg-emerald-600",
      };
    }

    return {
      label: "Assigned",
      className:
        "border-blue-200 bg-blue-50 text-blue-800",
      dot: "bg-blue-600",
    };
  }

  // =========================
  // PROGRESS HELPERS
  // (same rules as getProgressStatus and the Team tab)
  // =========================

  function isOngoing(status: string) {
    return (
      status === "ongoing" ||
      status === "in_progress"
    );
  }

  // Still needs work: not resolved, and the incident
  // is not already marked resolved (green).
  function isTodo(
    deploymentStatus: string,
    incidentStatus: string
  ) {
    return (
      deploymentStatus !== "resolved" &&
      incidentStatus !== "green"
    );
  }

  function isAssigned(status: string) {
    return (
      !isOngoing(status) &&
      status !== "resolved"
    );
  }

  // =========================
  // FILTER
  // =========================

  const filteredDeployments =
    deployments.filter(
      (deployment) => {

        const incident =
          deployment.incidents;

        if (!incident) {
          return false;
        }

        if (filter === "all") {
          return true;
        }

        // To do = work that still needs to be done
        if (filter === "todo") {
          return isTodo(
            deployment.status,
            incident.status
          );
        }

        // Progress filters (based on the team's own progress)
        if (filter === "assigned") {
          return isAssigned(deployment.status);
        }

        if (filter === "ongoing") {
          return isOngoing(deployment.status);
        }

        if (filter === "resolved") {
          return (
            incident.status ===
              "green" ||
            deployment.status ===
              "resolved"
          );
        }

        // Incident filters ("red" = Active, "yellow" = Monitoring)
        return (
          incident.status ===
          filter
        );
      }
    );

  // =========================
  // FILTER COUNTS
  // (same conditions as the filter above)
  // =========================

  const withIncident =
    deployments.filter(
      (deployment) =>
        deployment.incidents
    );

  const counts = {
    all: withIncident.length,

    todo: withIncident.filter(
      (deployment) =>
        isTodo(
          deployment.status,
          deployment.incidents?.status ?? ""
        )
    ).length,

    assigned: withIncident.filter(
      (deployment) =>
        isAssigned(deployment.status)
    ).length,

    ongoing: withIncident.filter(
      (deployment) =>
        isOngoing(deployment.status)
    ).length,

    red: withIncident.filter(
      (deployment) =>
        deployment.incidents?.status ===
        "red"
    ).length,

    yellow: withIncident.filter(
      (deployment) =>
        deployment.incidents?.status ===
        "yellow"
    ).length,

    resolved: withIncident.filter(
      (deployment) =>
        deployment.incidents?.status ===
          "green" ||
        deployment.status ===
          "resolved"
    ).length,
  };

  const statCards: {
    value: Filter;
    label: string;
    count: number;
  }[] = [
    {
      value: "todo",
      label: "To do",
      count: counts.todo,
    },
    {
      value: "ongoing",
      label: "Ongoing",
      count: counts.ongoing,
    },
    {
      value: "assigned",
      label: "Assigned",
      count: counts.assigned,
    },
    {
      value: "resolved",
      label: "Resolved",
      count: counts.resolved,
    },
  ];

  // Smaller chips under the cards: filter by incident status.
  const incidentChips: {
    value: Filter;
    label: string;
    count: number;
    dot: string;
  }[] = [
    {
      value: "red",
      label: "Active",
      count: counts.red,
      dot: "bg-red-600",
    },
    {
      value: "yellow",
      label: "Monitoring",
      count: counts.yellow,
      dot: "bg-amber-500",
    },
  ];

  // =========================
  // SORT (most urgent first)
  // Ongoing, then Assigned, then Resolved.
  // Inside each group: Active incidents first.
  // =========================

  function progressRank(status: string) {
    if (isOngoing(status)) return 0;
    if (status === "resolved") return 2;
    return 1;
  }

  function incidentRank(status: string) {
    if (status === "red") return 0;
    if (status === "yellow") return 1;
    return 2;
  }

  const sortedDeployments = [
    ...filteredDeployments,
  ].sort((a, b) => {
    const byProgress =
      progressRank(a.status) -
      progressRank(b.status);

    if (byProgress !== 0) return byProgress;

    return (
      incidentRank(a.incidents?.status ?? "") -
      incidentRank(b.incidents?.status ?? "")
    );
  });

  // =========================
  // PAGINATION (6 per page)
  // =========================

  const PAGE_SIZE = 6;

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedDeployments.length / PAGE_SIZE
    )
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const pageStart =
    (currentPage - 1) * PAGE_SIZE;

  const pagedDeployments =
    sortedDeployments.slice(
      pageStart,
      pageStart + PAGE_SIZE
    );

  function goToPage(next: number) {
    setPage(next);

    listTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
            Unable to load assignments
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>

          <button
            onClick={loadAssignments}
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
    <div
      className="mx-auto w-full max-w-[1600px] px-3 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8"
      aria-busy={showSkeleton}
    >

      {showSkeleton && <LoadingStatus />}

      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">

        {/* HEADER */}

        <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-8 sm:py-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">

              <p className="text-sm font-bold text-indigo-100">
                Assignments
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                My Team&apos;s Assignments
              </h1>

              <p className="mt-2 text-base text-indigo-100">
                Incidents assigned to your team. Select one to
                view its details and update your progress.
              </p>

            </div>

            <div className="flex shrink-0 items-center gap-4">

              {/* SUBTLE REFRESH INDICATOR (only when refreshing) */}

              {loading && !showSkeleton && (
                <div
                  className="flex items-center gap-2 text-xs font-medium text-indigo-100"
                  aria-live="polite"
                >
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating
                </div>
              )}

              <button
                type="button"
                onClick={loadAssignments}
                disabled={loading}
                className="min-h-11 rounded-none border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60"
              >
                Refresh
              </button>

            </div>

          </div>

        </header>

        {/* STATUS SUMMARY (also works as the filter) */}

        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">

          {statCards.map((card) => {
            const active = filter === card.value;

            return (
              <button
                key={card.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setFilter(card.value)
                }
                className={`rounded-none border p-4 text-left transition sm:p-6 ${
                  active
                    ? "border-[#123D73] bg-blue-50"
                    : "border-slate-300 bg-white hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-bold text-slate-600">
                  {card.label}
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900 sm:mt-3">
                  {showSkeleton ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    card.count
                  )}
                </p>
              </button>
            );
          })}

        </div>

        {/* INCIDENT STATUS CHIPS (tap again to clear) */}

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">

          <span className="text-sm font-semibold text-slate-600">
            Incident status:
          </span>

          {incidentChips.map((chip) => {
            const active = filter === chip.value;

            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setFilter(
                    active ? "todo" : chip.value
                  )
                }
                className={`inline-flex min-h-11 items-center gap-2 rounded-none border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 ${
                  active
                    ? "border-[#123D73] bg-blue-50 text-[#123D73]"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${chip.dot}`}
                />
                {chip.label}
                <span className="text-slate-500">
                  {showSkeleton ? "–" : chip.count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() =>
              setFilter(
                filter === "all" ? "todo" : "all"
              )
            }
            className={`inline-flex min-h-11 items-center gap-2 rounded-none border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 sm:ml-auto ${
              filter === "all"
                ? "border-[#123D73] bg-blue-50 text-[#123D73]"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Show all
            <span className="text-slate-500">
              {showSkeleton ? "–" : counts.all}
            </span>
          </button>

        </div>

        {/* ASSIGNMENTS */}

        <Panel
          title="Assigned Incidents"
          description="Ongoing first, then the newest assignments"
          rightLabel={
            showSkeleton
              ? "Loading..."
              : sortedDeployments.length === 0
                ? "0 assignments"
                : `${pageStart + 1}–${
                    pageStart + pagedDeployments.length
                  } of ${sortedDeployments.length}`
          }
        >

          <div
            ref={listTopRef}
            className="scroll-mt-28 p-4 sm:p-6"
          >

            {/* LOADING */}

            {showSkeleton && (
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AssignmentCardSkeleton />
                <AssignmentCardSkeleton />
                <AssignmentCardSkeleton />
                <AssignmentCardSkeleton />
                <AssignmentCardSkeleton />
                <AssignmentCardSkeleton />
              </div>
            )}

            {/* EMPTY */}

            {!showSkeleton &&
              filteredDeployments.length ===
              0 && (
              <div className="px-4 py-10 text-center">

                <p className="text-base font-bold text-slate-800">
                  No assignments found
                </p>

                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  Assignments for your team will appear here, or
                  try choosing a different filter.
                </p>

                {filter !== "all" && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilter("all")
                    }
                    className="mt-5 min-h-11 rounded-none border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
                  >
                    Show all assignments
                  </button>
                )}

              </div>
            )}

            {/* LIST */}

            {!showSkeleton && (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">

              {pagedDeployments.map(
                (deployment) => {

                  const incident =
                    deployment.incidents;

                  if (!incident) {
                    return null;
                  }

                  const incidentStatus =
                    getIncidentStatus(
                      incident.status
                    );

                  const progressStatus =
                    getProgressStatus(
                      deployment.status
                    );

                  return (
                    <button
                      key={deployment.id}
                      type="button"
                      onClick={() =>
                        onSelectAssignment(
                          deployment
                        )
                      }
                      className={`group flex w-full flex-col rounded-none border border-l-4 border-slate-300 bg-white p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73] ${incidentStatus.border}`}
                    >

                      {/* STATUS BADGES */}

                      <div className="flex flex-wrap items-center gap-2">

                        <span
                          className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${incidentStatus.className}`}
                        >
                          Incident: {incidentStatus.label}
                        </span>

                        <span
                          className={`inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-semibold ${progressStatus.className}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${progressStatus.dot}`}
                          />
                          {progressStatus.label}
                        </span>

                      </div>

                      {/* INCIDENT TYPE */}

                      <h3 className="mt-3 text-base font-bold leading-snug text-[#123D73]">
                        {incident.incident_type}
                      </h3>

                      {/* BARANGAY */}

                      <p className="mt-1.5 flex items-start gap-2 text-sm font-medium text-slate-800">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#123D73]"
                        >
                          <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>

                        <span className="min-w-0 wrap-break-word">
                          {getBarangayName(
                            incident.barangay_code
                          )}
                        </span>
                      </p>

                      {/* ASSIGNED TIME */}

                      <p className="mt-1 text-xs text-slate-500">
                        Assigned{" "}
                        {new Date(
                          deployment.assigned_at
                        ).toLocaleString()}
                      </p>

                      {/* VIEW DETAILS */}

                      <span className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm font-semibold text-[#123D73]">
                        View details

                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white transition-colors group-hover:bg-slate-50"
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
                      </span>

                    </button>
                  );
                }
              )}

            </div>
            )}

            {/* PAGINATION */}

            {!showSkeleton && totalPages > 1 && (
              <nav
                aria-label="Assignments pages"
                className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4"
              >
                <button
                  type="button"
                  onClick={() =>
                    goToPage(currentPage - 1)
                  }
                  disabled={currentPage === 1}
                  className="min-h-11 rounded-none border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                >
                  Previous
                </button>

                <p
                  className="text-sm font-medium text-slate-600"
                  aria-live="polite"
                >
                  Page {currentPage} of {totalPages}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    goToPage(currentPage + 1)
                  }
                  disabled={currentPage === totalPages}
                  className="min-h-11 rounded-none border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                >
                  Next
                </button>
              </nav>
            )}

          </div>

        </Panel>

      </div>

    </div>
  );
}