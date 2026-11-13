"use client";

import { useEffect, useState } from "react";
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
  barangay_code: string | null;
  incident_type: string;
  status: string;
  reported_at: string;
  pumping_station_id: number | null;
  affected_area: string | null;
  etr: string | null;
  description: string | null;
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

type AffectedBarangay = {
  incident_id: string;
  barangay_code: string;
};

type Barangay = {
  name: string;
  code: string;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  affectedBarangays: string[];
  affectedArea: string | null;
  etr: string | null;
  time: string;
  type: "assignment" | "update" | "resolved";
  unread: boolean;
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

// Loading version of one notification row.
function NotificationSkeleton() {
  return (
    <div className="border-l-4 border-l-slate-200 px-4 py-5 sm:px-8">
      <div className="flex gap-4">
        <Skeleton className="h-11 w-11 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-32" />
          </div>

          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />

          <div className="mt-4 grid gap-4 border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-4 w-40 max-w-full" />
            </div>

            <div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-4 w-32 max-w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const supabase = createClient();

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [barangays, setBarangays] =
    useState<Barangay[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  // =========================
  // LOAD NOTIFICATIONS
  // =========================

  async function loadNotifications() {
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
      .select("id, role, team_id")
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
    // GET DEPLOYMENTS
    // =========================

    const {
      data: deployments,
      error: deploymentError,
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
          status,
          reported_at,
          pumping_station_id,
          affected_area,
          etr,
          description
        )
      `)
      .eq("team_id", profile.team_id)
      .order("assigned_at", {
        ascending: false,
      });

    if (deploymentError) {
      setErrorMessage(
        `Unable to load notifications: ${deploymentError.message}`
      );

      setLoading(false);
      return;
    }

    // =========================
    // GET AFFECTED BARANGAYS
    // =========================

    const {
      data: affectedBarangayData,
      error: affectedBarangayError,
    } = await supabase
      .from("incident_barangays")
      .select(
        "incident_id, barangay_code"
      );

    if (affectedBarangayError) {
      console.error(
        "Affected barangay loading error:",
        affectedBarangayError
      );
    }

    // =========================
    // LOAD BARANGAYS
    // =========================

    try {
      const response = await fetch(
        "/data/tanza-barangays.geojson"
      );

      const geojson = await response.json();

      const barangayList =
        geojson.features.map(
          (feature: any) => ({
            name: feature.properties.brgy_name,
            code: feature.properties.brgy_code,
          })
        );

      setBarangays(barangayList);

      createNotifications(
        (deployments as unknown as Deployment[]) ||
          [],
        (affectedBarangayData ||
          []) as AffectedBarangay[],
        barangayList
      );
    } catch (error) {
      console.error(
        "Error loading barangays:",
        error
      );

      createNotifications(
        (deployments as unknown as Deployment[]) ||
          [],
        (affectedBarangayData ||
          []) as AffectedBarangay[],
        []
      );
    }

    setLoading(false);
  }

  // =========================
  // BARANGAY NAME
  // =========================

  function getBarangayName(
    code: string | null,
    list: Barangay[]
  ) {
    if (!code) {
      return "";
    }

    const barangay = list.find(
      (item) => item.code === code
    );

    return barangay
      ? barangay.name
      : code;
  }

  // =========================
  // INCIDENT LABEL
  // =========================

  function getIncidentLabel(
    incident: Incident
  ) {
    if (incident.pumping_station_id) {
      return `Pumping Station #${incident.pumping_station_id} – ${incident.incident_type}`;
    }

    return incident.incident_type;
  }

  // =========================
  // CREATE NOTIFICATIONS
  // =========================

  function createNotifications(
    deployments: Deployment[],
    affectedBarangayList: AffectedBarangay[],
    barangayList: Barangay[]
  ) {
    const notificationList: NotificationItem[] =
      [];

    deployments.forEach(
      (deployment) => {
        const incident =
          deployment.incidents;

        if (!incident) {
          return;
        }

        // =========================
        // INCIDENT LABEL
        // =========================

        const incidentLabel =
          getIncidentLabel(incident);

        // =========================
        // AFFECTED BARANGAYS
        // =========================

        const affectedCodes =
          affectedBarangayList
            .filter(
              (item) =>
                String(item.incident_id) ===
                String(incident.id)
            )
            .map(
              (item) =>
                item.barangay_code
            );

        const affectedNames =
          affectedCodes
            .map(
              (code) =>
                getBarangayName(
                  code,
                  barangayList
                )
            )
            .filter(
              (name) => name !== ""
            );

        // =========================
        // NORMAL INCIDENT BARANGAY
        // =========================

        const normalIncidentBarangays =
          incident.barangay_code
            ? [
                getBarangayName(
                  incident.barangay_code,
                  barangayList
                ),
              ].filter(
                (name) => name !== ""
              )
            : [];

        // =========================
        // FINAL BARANGAY LIST
        // =========================

        const notificationBarangays =
          incident.pumping_station_id
            ? affectedNames
            : normalIncidentBarangays;

        // =========================
        // RESOLVED
        // =========================

        if (
          deployment.status ===
          "resolved"
        ) {
          notificationList.push({
            id: `resolved-${deployment.id}`,

            title:
              "Incident Resolved",

            message:
              `${incidentLabel} has been resolved.`,

            affectedBarangays:
              notificationBarangays || [],

            affectedArea:
              incident.affected_area,

            etr:
              incident.etr,

            time: formatTime(
              deployment.resolved_at
            ),

            type: "resolved",

            unread: false,
          });

          return;
        }

        // =========================
        // ONGOING
        // =========================

        if (
          deployment.status ===
            "ongoing" ||
          deployment.status ===
            "in_progress"
        ) {
          notificationList.push({
            id: `update-${deployment.id}`,

            title:
              "Incident Update",

            message:
              `${incidentLabel} is currently being handled by your team.`,

            affectedBarangays:
              notificationBarangays || [],

            affectedArea:
              incident.affected_area,

            etr:
              incident.etr,

            time: formatTime(
              deployment.assigned_at
            ),

            type: "update",

            unread: true,
          });

          return;
        }

        // =========================
        // ASSIGNED
        // =========================

        notificationList.push({
          id: `assignment-${deployment.id}`,

          title:
            "New Incident Assigned",

          message:
            `${incidentLabel} has been assigned to your team.`,

          affectedBarangays:
            notificationBarangays || [],

          affectedArea:
            incident.affected_area,

          etr:
            incident.etr,

          time: formatTime(
            deployment.assigned_at
          ),

          type: "assignment",

          unread: true,
        });
      }
    );

    setNotifications(
      notificationList
    );
  }

  // =========================
  // FORMAT TIME
  // =========================

  function formatTime(
    date: string | null
  ) {
    if (!date) {
      return "Recently";
    }

    return new Date(
      date
    ).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // =========================
  // FORMAT ETR
  // =========================

  function formatETR(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // =========================
  // ICON
  // (UI only: SVG icons and admin status colors, no emoji)
  // =========================

  function getIcon(
    type: NotificationItem["type"]
  ) {
    if (type === "assignment") {
      return {
        path: "M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 12h6 M9 16h4",
        tile: "border-blue-100 bg-blue-50 text-blue-800",
        border: "border-l-blue-600",
      };
    }

    if (type === "update") {
      return {
        path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
        tile: "border-amber-100 bg-amber-50 text-amber-800",
        border: "border-l-amber-500",
      };
    }

    return {
      path: "M20 6 9 17l-5-5",
      tile: "border-emerald-100 bg-emerald-50 text-emerald-800",
      border: "border-l-emerald-600",
    };
  }

  // =========================
  // COUNTS (for the summary cards)
  // =========================

  const assignedCount =
    notifications.filter(
      (item) => item.type === "assignment"
    ).length;

  const updateCount =
    notifications.filter(
      (item) => item.type === "update"
    ).length;

  const resolvedCount =
    notifications.filter(
      (item) => item.type === "resolved"
    ).length;

  const unreadCount =
    notifications.filter(
      (item) => item.unread
    ).length;

  // Skeleton only on the first load. When refreshing,
  // the old data stays visible with the "Updating" indicator.
  const showSkeleton =
    loading && notifications.length === 0;

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
            Unable to load notifications
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>

          <button
            onClick={loadNotifications}
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

      {showSkeleton && (
        <LoadingStatus label="Loading notifications..." />
      )}

      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">

        {/* HEADER */}

        <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-8 sm:py-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">

              <p className="text-sm font-bold text-indigo-100">
                Alerts
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                Notifications
              </h1>

              <p className="mt-2 text-base text-indigo-100">
                Updates and alerts for your team
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
                onClick={loadNotifications}
                disabled={loading}
                className="min-h-11 rounded-none border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60"
              >
                Refresh
              </button>

            </div>

          </div>

        </header>

        {/* SUMMARY */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">

          {[
            {
              label: "New assignments",
              count: assignedCount,
              accent: "bg-blue-600",
            },
            {
              label: "In progress",
              count: updateCount,
              accent: "bg-amber-500",
            },
            {
              label: "Resolved",
              count: resolvedCount,
              accent: "bg-emerald-600",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="relative min-w-0 border border-slate-300 bg-white p-4 sm:p-6"
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`}
              />

              <p className="text-sm font-bold text-slate-800">
                {card.label}
              </p>

              <p className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
                {showSkeleton ? (
                  <Skeleton className="h-9 w-14 sm:h-10" />
                ) : (
                  card.count
                )}
              </p>
            </div>
          ))}

        </div>

        {/* NOTIFICATION LIST */}

        <Panel
          title="Recent Updates"
          description="Alerts for your team, newest assignments first"
          rightLabel={
            showSkeleton
              ? "Loading..."
              : `${unreadCount} new of ${notifications.length}`
          }
        >

          {/* LOADING */}

          {showSkeleton && (
            <div className="divide-y divide-slate-200">
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
            </div>
          )}

          {/* EMPTY */}

          {!showSkeleton &&
            notifications.length === 0 && (
            <div className="px-4 py-12 text-center">

              <p className="text-base font-bold text-slate-800">
                No notifications yet
              </p>

              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                New assignments and updates for your team will
                appear here.
              </p>

            </div>
          )}

          {/* LIST */}

          {!showSkeleton && (
          <div className="divide-y divide-slate-200">

            {notifications.map(
              (notification) => {
                const affectedBarangays =
                  notification.affectedBarangays ||
                  [];

                const icon = getIcon(
                  notification.type
                );

                return (
                  <article
                    key={notification.id}
                    className={`border-l-4 px-4 py-5 sm:px-8 ${icon.border} ${
                      notification.unread
                        ? "bg-white"
                        : "bg-slate-50/60"
                    }`}
                  >

                    <div className="flex gap-4">

                      {/* ICON */}

                      <div
                        aria-hidden="true"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center border ${icon.tile}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d={icon.path} />
                        </svg>
                      </div>

                      {/* CONTENT */}

                      <div className="min-w-0 flex-1">

                        {/* TITLE */}

                        <div className="flex flex-wrap items-center justify-between gap-2">

                          <div className="flex min-w-0 flex-wrap items-center gap-2">

                            <h3 className="text-base font-bold text-[#123D73]">
                              {notification.title}
                            </h3>

                            {notification.unread && (
                              <span className="inline-flex items-center border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                New
                              </span>
                            )}

                          </div>

                          <p className="text-sm text-slate-500">
                            {notification.time}
                          </p>

                        </div>

                        {/* MESSAGE */}

                        <p className="mt-1.5 wrap-break-word text-base leading-7 text-slate-700">
                          {notification.message}
                        </p>

                        {/* DETAILS */}

                        {(affectedBarangays.length >
                          0 ||
                          notification.affectedArea ||
                          notification.etr) && (
                          <div className="mt-4 grid gap-4 border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">

                            {/* AFFECTED BARANGAYS */}

                            {affectedBarangays.length >
                              0 && (
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {affectedBarangays.length >
                                  1
                                    ? "Affected barangays"
                                    : "Affected barangay"}
                                </p>

                                <p className="mt-1.5 wrap-break-word text-sm leading-6 text-slate-800">
                                  {affectedBarangays.join(
                                    ", "
                                  )}
                                </p>
                              </div>
                            )}

                            {/* AFFECTED AREA */}

                            {notification.affectedArea && (
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Affected area
                                </p>

                                <p className="mt-1.5 wrap-break-word text-sm leading-6 text-slate-800">
                                  {
                                    notification.affectedArea
                                  }
                                </p>
                              </div>
                            )}

                            {/* ETR */}

                            {notification.etr && (
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Estimated restoration
                                </p>

                                <p className="mt-1.5 text-sm leading-6 text-slate-800">
                                  {formatETR(
                                    notification.etr
                                  )}
                                </p>
                              </div>
                            )}

                          </div>
                        )}

                      </div>

                    </div>

                  </article>
                );
              }
            )}

          </div>
          )}

        </Panel>

      </div>

    </div>
  );
}