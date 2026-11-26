"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "leaflet/dist/leaflet.css";
// Same map the public portal uses.
import Map from "@/app/(public)/components/map";

type Incident = {
  id: number;
  barangay_code: string | null;
  incident_type: string;
  status: string;
  reported_at: string;
  pumping_station_id: number | null;
  affected_area: string | null;
};

type Barangay = {
  name: string;
  code: string;
};

const incidentTypes = [
  "Line Rupture",
  "Water Leakage",
  "Low Water Pressure",
  "No Water Supply",
  "Water Service Interruption",
  "Water Quality Issue",
];

const incidentColors: Record<string, string> = {
  "Line Rupture": "#ef4444",
  "Water Leakage": "#3b82f6",
  "Low Water Pressure": "#f59e0b",
  "No Water Supply": "#8b5cf6",
  "Water Service Interruption": "#10b981",
  "Water Quality Issue": "#ec4899",
};

// Column layout for the Recent Incident Reports table (desktop only)
const reportGridCols =
  "lg:grid-cols-[112px_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_112px_190px]";

// Status helpers (same as the Analytics page)
function statusLabel(status: string) {
  if (status === "red") return "Active";
  if (status === "yellow") return "Monitoring";
  return "Resolved";
}

function statusBadge(status: string) {
  if (status === "red") return "border-red-200 bg-red-50 text-red-800";
  if (status === "yellow") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function statusColor(status: string) {
  if (status === "red") return "#ef4444";
  if (status === "yellow") return "#fbbf24";
  return "#34d399";
}

function statusDot(status: string) {
  if (status === "red") return "bg-red-500";
  if (status === "yellow") return "bg-amber-400";
  return "bg-emerald-500";
}

// Shows the number as-is (no counting animation).
function CountUp({ value }: { value: number }) {
  return <span className="tabular-nums">{value}</span>;
}

function ReportCount({ count }: { count: number }) {
  return (
    <>
      <CountUp value={count} /> {count === 1 ? "report" : "reports"}
    </>
  );
}

type DashboardProps = {
  // Switches the admin page to another section (e.g. "submissions").
  onNavigate?: (section: string) => void;
};

export default function Dashboard({ onNavigate }: DashboardProps = {}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentBarangays, setIncidentBarangays] = useState<
    { incident_id: number; barangay_code: string }[]
  >([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);

  // Incident map (same behavior as the public map)
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(
    null
  );
  const [focusBarangay, setFocusBarangay] = useState<string | null>(null);
  const [fullView, setFullView] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Full-screen map: lock page scroll and let Esc exit.
  useEffect(() => {
    if (!fullView) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullView(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fullView]);

  // Auto refresh (silent: no skeleton, keeps old data if it fails)
  useAutoRefresh(() => void loadDashboard(true));

  async function loadDashboard(silent = false) {
    if (!silent) setLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("incidents")
      .select(
        "id, barangay_code, incident_type, status, reported_at, pumping_station_id, affected_area"
      )
      .order("reported_at", { ascending: false });

    if (error) {
      console.error("Incident loading error:", error);
      if (!silent) setLoading(false);
      return;
    }

    setIncidents(data || []);

    const {
      data: affectedBarangayData,
      error: affectedBarangayError,
    } = await supabase
      .from("incident_barangays")
      .select("incident_id, barangay_code");

    if (affectedBarangayError) {
      console.error(
        "Affected barangay loading error:",
        affectedBarangayError
      );
    } else {
      setIncidentBarangays(affectedBarangayData || []);
    }

    // The barangay list never changes, so only fetch it on a normal load.
    if (!silent) {
      try {
        const response = await fetch("/data/tanza-barangays.geojson");

        if (!response.ok) {
          throw new Error("Unable to load barangay GeoJSON.");
        }

        const geojson = await response.json();

        const list = geojson.features.map((feature: any) => ({
          name: feature.properties.brgy_name,
          code: feature.properties.brgy_code,
        }));

        setBarangays(list);
      } catch (error) {
        console.error("Barangay loading error:", error);
      }

      setLoading(false);
    }
  }

  function getBarangayName(code: string | null) {
    if (!code) return "Pumping Station Incident";

    return barangays.find((item) => item.code === code)?.name || code;
  }

  const activeCount = incidents.filter(
    (item) => item.status === "red"
  ).length;

  const monitoringCount = incidents.filter(
    (item) => item.status === "yellow"
  ).length;

  const resolvedCount = incidents.filter(
    (item) => item.status === "green"
  ).length;

  const totalReports = incidents.length;
  const recentReports = incidents.slice(0, 5);

  const barangayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const statuses: Record<string, string> = {};

    function updateBarangay(code: string, status: string) {
      if (!code) return;

      counts[code] = (counts[code] || 0) + 1;

      const currentStatus = statuses[code];

      // Priority: active > monitoring > resolved
      if (
        !currentStatus ||
        status === "red" ||
        (status === "yellow" && currentStatus === "green")
      ) {
        statuses[code] = status;
      }
    }

    incidents.forEach((incident) => {
      if (incident.barangay_code) {
        updateBarangay(incident.barangay_code, incident.status);
      }
    });

    incidents.forEach((incident) => {
      if (!incident.pumping_station_id) return;

      incidentBarangays
        .filter((item) => item.incident_id === incident.id)
        .forEach((item) => {
          updateBarangay(item.barangay_code, incident.status);
        });
    });

    return Object.entries(counts)
      .map(([code, count]) => ({
        code,
        name: getBarangayName(code),
        count,
        status: statuses[code] || "green",
      }))
      .sort(
        (a, b) =>
          b.count - a.count || a.name.localeCompare(b.name)
      )
      .slice(0, 5);
  }, [incidents, incidentBarangays, barangays]);

  const incidentTypeCounts = useMemo(() => {
    return incidentTypes
      .map((type) => ({
        type,
        count: incidents.filter(
          (incident) => incident.incident_type === type
        ).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [incidents]);

  const mostFrequentIncident =
    incidentTypeCounts[0]?.type || "—";

  const mostFrequentIncidentCount =
    incidentTypeCounts[0]?.count || 0;

  const mostReportedBarangay =
    barangayCounts[0]?.name || "—";

  const mostReportedBarangayCount =
    barangayCounts[0]?.count || 0;

  const pumpingStationCounts = useMemo(() => {
    const counts: Record<number, number> = {};

    incidents.forEach((incident) => {
      if (!incident.pumping_station_id) return;

      counts[incident.pumping_station_id] =
        (counts[incident.pumping_station_id] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([id, count]) => ({
        id: Number(id),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.id - b.id);
  }, [incidents]);

  const mostAffectedPumpingStation =
    pumpingStationCounts[0]
      ? `Pumping Station #${pumpingStationCounts[0].id}`
      : "—";

  const mostAffectedPumpingStationCount =
    pumpingStationCounts[0]?.count || 0;

  return (
    <div className="space-y-5 border border-[#4438A8] bg-white p-3 text-slate-900 sm:space-y-8 sm:p-8">
      <style>{`
        @keyframes dash-ping {
          0% { opacity: 0.65; transform: scale(1); }
          80%, 100% { opacity: 0; transform: scale(2.6); }
        }

        .dash-ping {
          animation: dash-ping 1.9s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .dash-ping {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>

      {/* WELCOME BANNER
          Phone: title on top, then the location/date on the left and the
          two logos right beside it.
          sm and up: text on the left, bigger logos on the right. */}
      <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4 sm:gap-x-6 sm:gap-y-0">
          {/* Title */}
          <div className="col-span-2 row-start-1 min-w-0 sm:col-span-1">
            <p className="text-xs font-bold text-indigo-100 sm:text-sm">
              Tanza Water District
            </p>

            <h2 className="mt-1.5 text-xl font-bold text-white sm:mt-2 sm:text-2xl">
              Welcome to DistrictLens
            </h2>

            <p className="mt-1.5 text-sm text-indigo-100 sm:mt-2 sm:text-base">
              Incident Monitoring and Operations Dashboard
            </p>
          </div>

          {/* Location and date */}
          <div className="col-start-1 row-start-2 flex min-w-0 flex-col gap-0.5 text-sm text-indigo-100 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <span>Tanza, Cavite</span>
            <span className="hidden text-indigo-300 sm:inline">|</span>
            <time>
              {new Date().toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>

          {/* Official logos */}
          <div className="col-start-2 row-start-2 flex shrink-0 items-center justify-end gap-2 sm:row-span-2 sm:row-start-1 sm:ml-auto sm:mr-8 sm:justify-center sm:gap-5 lg:mr-16">
            {/* Municipality of Tanza Logo */}
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 shadow-md sm:h-24 sm:w-24 sm:p-2 lg:h-28 lg:w-28">
              <img
                src="/images/tanza-logo.jpe"
                alt="Municipality of Tanza logo"
                className="h-full w-full object-contain"
              />
            </div>

            {/* Tanza Water District Logo */}
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 shadow-md sm:h-24 sm:w-24 sm:p-2 lg:h-28 lg:w-28">
              <img
                src="/images/twd-logo.jpg"
                alt="Tanza Water District logo"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading state: skeleton */}
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* SUMMARY CARDS: 2 x 2 on phones, one row on wide screens */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
            <SummaryCard
              label="Active Incidents"
              value={activeCount}
              description="Requires immediate attention"
              color="red"
              pulse={activeCount > 0}
            />

            <SummaryCard
              label="Monitoring"
              value={monitoringCount}
              description="Incidents under monitoring"
              color="yellow"
            />

            <SummaryCard
              label="Resolved"
              value={resolvedCount}
              description="Resolved incident reports"
              color="green"
            />

            <SummaryCard
              label="Total Incidents"
              value={totalReports}
              description="All submitted incidents"
              color="blue"
            />
          </div>

          {/* ANALYTICS */}
          <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2">
            <Panel
              title="Incident Analytics"
              description="Distribution by incident type"
            >
              <RadialIncidentChart
                data={incidentTypeCounts}
                total={totalReports}
              />
            </Panel>

            <Panel
              title="Top Affected Barangays"
              description="Barangays with the most reports"
            >
              <style>{`
                @keyframes brgy-bar-grow {
                  from { transform: scaleX(0); }
                  to { transform: scaleX(1); }
                }

                @keyframes brgy-bar-sheen {
                  from { transform: translateX(-120%); }
                  to { transform: translateX(320%); }
                }

                .brgy-bar {
                  position: relative;
                  overflow: hidden;
                  transform-origin: left center;
                  animation: brgy-bar-grow 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                /* Soft light that keeps sweeping along the bar */
                .brgy-bar::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  width: 35%;
                  background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 255, 255, 0.55),
                    transparent
                  );
                  animation: brgy-bar-sheen 2.4s ease-in-out var(--sheen-delay, 0ms) infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                  .brgy-bar,
                  .brgy-bar::after {
                    animation: none;
                  }
                }
              `}</style>

              {barangayCounts.length === 0 ? (
                <EmptyNote text="No barangay data available." />
              ) : (
                <div className="flex min-w-0 flex-1 flex-col">
                  {/* Ranked list — bar length is relative to the top barangay */}
                  <ol className="flex flex-1 flex-col justify-between gap-5 sm:gap-6">
                    {barangayCounts.map((item, index) => {
                      const maxCount = barangayCounts[0]?.count || 1;

                      const width = Math.max(
                        4,
                        (item.count / maxCount) * 100
                      );

                      return (
                        <li key={item.code} className="min-w-0">
                          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            {/* Rank */}
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold sm:h-9 sm:w-9 ${
                                index === 0
                                  ? "bg-[#123D73] text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {index + 1}
                            </span>

                            <div className="min-w-0 flex-1">
                              {/* Phone: the full barangay name on its own line,
                                  then the status and the count below it.
                                  sm and up: everything on one row. */}
                              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <p
                                  title={item.name}
                                  className={`wrap-break-word text-base font-semibold leading-5 sm:truncate ${
                                    index === 0
                                      ? "text-[#123D73]"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {item.name}
                                </p>

                                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                                  <span
                                    className={`inline-flex items-center justify-center border px-2 py-1 text-xs font-semibold sm:w-24 ${statusBadge(
                                      item.status
                                    )}`}
                                  >
                                    {statusLabel(item.status)}
                                  </span>

                                  <span className="text-right text-base font-bold text-[#123D73] sm:w-10">
                                    <CountUp value={item.count} />
                                  </span>
                                </div>
                              </div>

                              {/* Animated bar */}
                              <div className="mt-2 h-2.5 w-full bg-slate-100 sm:mt-2.5 sm:h-3">
                                <div
                                  className="brgy-bar h-full"
                                  style={
                                    {
                                      width: `${width}%`,
                                      backgroundColor: statusColor(item.status),
                                      animationDelay: `${index * 90}ms`,
                                      "--sheen-delay": `${900 + index * 300}ms`,
                                    } as React.CSSProperties
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-slate-200 pt-4 text-sm font-medium text-slate-600 sm:mt-8 sm:pt-5">
                    <StatusLegend color="bg-red-500" label="Active" />
                    <StatusLegend color="bg-amber-400" label="Monitoring" />
                    <StatusLegend color="bg-emerald-500" label="Resolved" />
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* INSIGHTS */}
          <section className="overflow-hidden border border-slate-300 bg-slate-300">
            <div className="grid grid-cols-1 gap-px md:grid-cols-3">
              <InsightCard
                label="Most Frequent Incident"
                value={mostFrequentIncident}
                detail={<ReportCount count={mostFrequentIncidentCount} />}
              />

              <InsightCard
                label="Most Reported Barangay"
                value={mostReportedBarangay}
                detail={<ReportCount count={mostReportedBarangayCount} />}
              />

              <InsightCard
                label="Most Affected Pumping Station"
                value={mostAffectedPumpingStation}
                detail={<ReportCount count={mostAffectedPumpingStationCount} />}
              />
            </div>
          </section>

          {/* RECENT INCIDENT REPORTS — latest 5 */}
          <Panel
            title="Recent Incident Reports"
            description="Latest 5 incident reports recorded in the system"
            flush
          >
            {recentReports.length === 0 ? (
              <div className="flex min-h-64 flex-1 items-center justify-center px-6">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-xl text-slate-400">
                    —
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    No recent incident reports
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    New reports will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div
                role="table"
                aria-label="Recent incident reports"
                className="min-w-0"
              >
                {/* Column headings — desktop only */}
                <div
                  role="row"
                  className={`hidden border-b border-slate-200 bg-slate-50 px-8 py-3 text-sm font-semibold text-slate-500 lg:grid lg:gap-6 xl:gap-8 ${reportGridCols}`}
                >
                  <span role="columnheader">ID</span>
                  <span role="columnheader">Incident Type</span>
                  <span role="columnheader">Location</span>
                  <span role="columnheader">Affected</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Reported</span>
                </div>

                <div className="divide-y divide-slate-200">
                  {recentReports.map((incident) => {
                    const affectedBarangays = incidentBarangays
                      .filter(
                        (item) => item.incident_id === incident.id
                      )
                      .map((item) =>
                        getBarangayName(item.barangay_code)
                      );

                    const locationLabel = incident.pumping_station_id
                      ? `Pumping Station #${incident.pumping_station_id}`
                      : getBarangayName(incident.barangay_code);

                    const affectedLabel =
                      incident.pumping_station_id &&
                      affectedBarangays.length > 0
                        ? affectedBarangays.slice(0, 2).join(", ") +
                          (affectedBarangays.length > 2
                            ? ` +${affectedBarangays.length - 2}`
                            : "")
                        : incident.affected_area ||
                          "No affected area specified";

                    const reportedDate = new Date(incident.reported_at);

                    return (
                      <div
                        key={incident.id}
                        role="row"
                        className={`grid grid-cols-1 gap-2 px-4 py-4 transition-colors duration-200 hover:bg-slate-50 sm:px-8 sm:py-5 lg:items-center lg:gap-6 xl:gap-8 lg:py-4 ${reportGridCols}`}
                      >
                        <span
                          role="cell"
                          className="mb-1 text-sm font-semibold tabular-nums text-[#123D73] lg:mb-0 lg:pr-2"
                        >
                          INC-{String(incident.id).padStart(4, "0")}
                        </span>

                        <span
                          role="cell"
                          className="min-w-0 wrap-break-word text-sm font-medium text-slate-800"
                        >
                          {incident.incident_type}
                        </span>

                        <span
                          role="cell"
                          className="min-w-0 wrap-break-word text-sm text-slate-700"
                        >
                          <span className="text-slate-400 lg:hidden">
                            Location:{" "}
                          </span>
                          {locationLabel}
                        </span>

                        <span
                          role="cell"
                          title={affectedLabel}
                          className="min-w-0 wrap-break-word text-sm text-slate-600"
                        >
                          <span className="text-slate-400 lg:hidden">
                            Affected:{" "}
                          </span>
                          {affectedLabel}
                        </span>

                        <span
                          role="cell"
                          className="inline-flex items-center gap-2 text-sm text-slate-700"
                        >
                          <span
                            aria-hidden="true"
                            className="relative inline-flex h-2.5 w-2.5 shrink-0"
                          >
                            {incident.status === "red" && (
                              <span
                                className={`dash-ping absolute inset-0 ${statusDot(
                                  incident.status
                                )}`}
                              />
                            )}
                            <span
                              className={`relative h-2.5 w-2.5 ${statusDot(
                                incident.status
                              )}`}
                            />
                          </span>
                          {statusLabel(incident.status)}
                        </span>

                        <span role="cell" className="text-sm text-slate-500">
                          {reportedDate.toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" · "}
                          {reportedDate.toLocaleTimeString("en-PH", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          {/* INCIDENT MAP — full width at the very bottom */}
          <Panel
            title="Incident Map"
            description="Barangay-level view of incident status"
            rightLabel="Tanza, Cavite"
            flush
          >
            {/* Normal card, or a fixed full-screen overlay when fullView is on. */}
            <div
              className={
                fullView
                  ? "fixed inset-0 z-1300 flex h-dvh flex-col bg-white"
                  : ""
              }
            >
              {fullView && (
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-4 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-100">
                      Tanza Water District
                    </p>
                    <h2 className="truncate text-lg font-bold text-white">
                      Incident Map
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFullView(false)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-none! border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                    Exit full view
                  </button>
                </div>
              )}

              {/* isolate + z-0 keeps Leaflet's internal z-indexes inside
                  the map so it never paints over the admin header. */}
              <div
                className={`relative isolate z-0 min-w-0 overflow-hidden bg-slate-100 [&_.leaflet-map]:absolute [&_.leaflet-map]:inset-0 ${
                  fullView ? "min-h-0 flex-1" : "h-90 sm:h-110 lg:h-122.5"
                }`}
              >
                <Map
                  key={fullView ? "map-full" : "map-card"}
                  onBarangayClick={(name) => {
                    setSelectedBarangay(name);
                    setFocusBarangay(name);
                  }}
                  onPopupClose={() => setSelectedBarangay(null)}
                  focusBarangay={focusBarangay}
                  selectedBarangay={selectedBarangay}
                />

                {!fullView && (
                  <button
                    type="button"
                    onClick={() => setFullView(true)}
                    aria-label="View map in full screen"
                    className="absolute right-3 top-3 z-1000 inline-flex items-center gap-2 rounded-none! border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#123D73] shadow-sm transition-colors hover:border-[#123D73] hover:bg-[#E8EEF6]"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                    </svg>
                    Full view
                  </button>
                )}

                <div className="pointer-events-none absolute bottom-3 left-3 z-400 max-w-[calc(100%-1.5rem)] border border-slate-300 bg-white/95 px-3 py-3 sm:bottom-5 sm:left-5 sm:max-w-[calc(100%-2.5rem)] sm:px-4 sm:py-3.5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 sm:mb-3">
                    Incident Status
                  </p>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                    <StatusLegend color="bg-red-500" label="Active" />
                    <StatusLegend color="bg-amber-400" label="Monitoring" />
                    <StatusLegend color="bg-emerald-500" label="Resolved" />
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  description,
  onLinkClick,
  linkLabel,
  rightLabel,
  flush = false,
  children,
}: {
  title: string;
  description: string;
  onLinkClick?: () => void;
  linkLabel?: string;
  rightLabel?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden border border-slate-300 bg-white">
      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-5">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-[#123D73]">{title}</h3>
          <p className="mt-1.5 text-sm text-slate-500">{description}</p>
        </div>

        {onLinkClick && linkLabel ? (
          <button
            type="button"
            onClick={onLinkClick}
            className="group inline-flex w-fit shrink-0 items-center gap-2 border border-slate-300 px-4 py-2 text-sm font-medium text-[#123D73] transition-all duration-200 hover:border-[#123D73] hover:bg-slate-50"
          >
            {linkLabel}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </button>
        ) : rightLabel ? (
          <span className="w-fit shrink-0 border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
            {rightLabel}
          </span>
        ) : null}
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col ${
          flush ? "" : "p-4 sm:p-8"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

function InsightCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-white p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-3 wrap-break-word text-2xl font-semibold text-[#123D73] sm:mt-4 sm:text-3xl">
        {value}
      </p>

      <p className="mt-2 text-base text-slate-500">{detail}</p>
    </div>
  );
}

function RadialIncidentChart({
  data,
  total,
}: {
  data: { type: string; count: number }[];
  total: number;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const size = 230;
  const center = size / 2;
  const radii = [92, 80, 68, 56, 44, 32];

  // Rings sweep through 270° (75% of a full circle), leaving the
  // top-left quadrant open.
  const ARC_SPAN = 0.75;
  const trackOn = ARC_SPAN * 100;

  function handleSelect(type: string) {
    setSelectedType((current) =>
      current === type ? null : type
    );
  }

  const selectedItem = data.find(
    (item) => item.type === selectedType
  );

  return (
    <div className="min-w-0">
      <style>{`
        @keyframes ring-intro-sweep {
          from { stroke-dasharray: 0 100; }
          to { stroke-dasharray: var(--on) var(--off); }
        }

        @keyframes ring-select-sweep {
          from { stroke-dasharray: 0 100; }
          to { stroke-dasharray: var(--on) var(--off); }
        }

        @keyframes ring-pop {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }

        .ring-intro {
          animation: ring-intro-sweep 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .ring-select {
          animation: ring-select-sweep 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .ring-pop {
          animation: ring-pop 350ms ease-out both;
        }

        @keyframes ring-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.68; }
        }

        .ring-breathe {
          animation: ring-breathe 3.4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .ring-intro,
          .ring-select,
          .ring-pop,
          .ring-breathe {
            animation: none;
          }
        }
      `}</style>

      {selectedItem && (
        <div className="mb-5 flex items-center justify-between gap-3 border border-blue-100 bg-blue-50 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="h-3 w-3 shrink-0"
              style={{
                backgroundColor:
                  incidentColors[selectedItem.type] || "#3b82f6",
              }}
            />

            <span className="truncate text-sm font-semibold text-[#123D73]">
              Showing {selectedItem.type}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedType(null)}
            className="shrink-0 px-2 py-1 text-sm font-semibold text-blue-700 transition-colors hover:bg-white"
          >
            Show all
          </button>
        </div>
      )}

      <div className="relative mx-auto h-61.25 w-full max-w-75">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full overflow-visible"
          aria-label="Incident distribution radial chart"
          role="img"
        >
          {data.map((item, index) => {
            const percentage =
              total > 0 ? (item.count / total) * 100 : 0;

            // Share of the 270° track this ring fills
            const arcOn = Number((percentage * ARC_SPAN).toFixed(2));
            const arcOff = Number((100 - arcOn).toFixed(2));

            const radius = radii[index] ?? radii[radii.length - 1];
            const color = incidentColors[item.type] || "#3b82f6";
            const isSelected = selectedType === item.type;
            const hasSelection = selectedType !== null;
            const strokeWidth = isSelected ? 11 : 8;

            return (
              <g
                key={item.type}
                onClick={() => handleSelect(item.type)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    handleSelect(item.type);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Show ${item.type}: ${item.count} incidents`}
                className="cursor-pointer outline-none"
              >
                {/* Track: solid, light 270° arc (no transparency, so it never looks muddy) */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="#eef2f7"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  pathLength={100}
                  strokeDasharray={`${trackOn} ${100 - trackOn}`}
                  transform={`rotate(-90 ${center} ${center})`}
                  style={{ transition: "stroke-width 300ms ease-out" }}
                />

                {/* Value arc: only this layer fades when another ring is selected */}
                {percentage > 0 && (
                  <g
                    className="ring-breathe"
                    style={{ animationDelay: `${1200 + index * 450}ms` }}
                  >
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="butt"
                    pathLength={100}
                    strokeDasharray={`${arcOn} ${arcOff}`}
                    transform={`rotate(-90 ${center} ${center})`}
                    className={isSelected ? "ring-select" : "ring-intro"}
                    style={
                      {
                        "--on": arcOn,
                        "--off": arcOff,
                        opacity: hasSelection && !isSelected ? 0.2 : 1,
                        animationDelay: isSelected
                          ? "0ms"
                          : `${index * 90}ms`,
                        transition:
                          "stroke-width 300ms ease-out, opacity 250ms ease-in-out",
                      } as React.CSSProperties
                    }
                  />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        <div
          key={selectedItem ? selectedItem.type : "total"}
          className="ring-pop pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          {selectedItem ? (
            <>
              <span
                className="text-3xl font-bold tracking-tight"
                style={{
                  color: incidentColors[selectedItem.type] || "#123D73",
                }}
              >
                <CountUp value={selectedItem.count} />
              </span>

              <span className="mt-1 max-w-25 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Selected
              </span>
            </>
          ) : (
            <>
              <span className="text-3xl font-bold tracking-tight text-[#123D73]">
                <CountUp value={total} />
              </span>

              <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Incidents
              </span>
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Select a ring to filter the chart
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.map((item) => {
          const isSelected = selectedType === item.type;
          const hasSelection = selectedType !== null;

          return (
            <button
              key={item.type}
              type="button"
              onClick={() => handleSelect(item.type)}
              className={`flex min-w-0 items-center gap-3 border px-3 py-2.5 text-left transition-colors duration-300 ${
                isSelected
                  ? "border-blue-200 bg-blue-50"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50"
              } ${
                hasSelection && !isSelected ? "opacity-50" : ""
              }`}
              aria-pressed={isSelected}
            >
              <span
                className="h-3 w-3 shrink-0"
                style={{
                  backgroundColor:
                    incidentColors[item.type] || "#3b82f6",
                }}
              />

              <span
                title={item.type}
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700"
              >
                {item.type}
              </span>

              <span className="shrink-0 text-sm font-bold text-[#123D73]">
                <CountUp value={item.count} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  color,
  pulse = false,
}: {
  label: string;
  value: number;
  description: string;
  color: "red" | "yellow" | "green" | "blue";
  pulse?: boolean;
}) {
  const accents = {
    red: "bg-red-600",
    yellow: "bg-amber-500",
    green: "bg-emerald-600",
    blue: "bg-[#123D73]",
  };

  return (
    <div className="relative min-w-0 border border-slate-300 bg-white p-4 sm:p-7">
      {/* Top accent bar */}
      <div
        className={`absolute inset-x-0 top-0 h-0.5 ${accents[color]}`}
      />

      <p className="flex items-center gap-2 text-sm font-bold leading-5 text-slate-800 sm:gap-2.5">
        {pulse && (
          <span
            aria-hidden="true"
            className="relative inline-flex h-2.5 w-2.5 shrink-0"
          >
            <span className={`dash-ping absolute inset-0 ${accents[color]}`} />
            <span className={`relative h-2.5 w-2.5 ${accents[color]}`} />
          </span>
        )}
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-slate-900 sm:mt-4 sm:text-4xl">
        <CountUp value={value} />
      </p>

      <p className="mt-1.5 text-xs leading-4 text-slate-500 sm:mt-2 sm:text-sm sm:leading-5">
        {description}
      </p>
    </div>
  );
}

function StatusLegend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 shrink-0 ${color}`} />
      <span>{label}</span>
    </div>
  );
}

/* -------------------------
   SKELETON LOADING
   (same order as the loaded layout)
------------------------- */

function DashboardSkeleton() {
  return (
    <div
      className="space-y-5 sm:space-y-8"
      role="status"
      aria-label="Loading dashboard"
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-slate-300 bg-white p-4 sm:p-7">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-4 h-10 w-1/3" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </div>
        ))}
      </div>

      {/* Chart + barangays */}
      <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-slate-300 bg-white">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-8 sm:py-5">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-3 h-4 w-2/3" />
            </div>
            <div className="p-4 sm:p-8">
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 gap-px border border-slate-300 bg-slate-300 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white p-5 sm:p-7">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-4 h-9 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/3" />
          </div>
        ))}
      </div>

      {/* Recent reports */}
      <div className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-8 sm:py-5">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-2 items-center gap-4 px-4 py-4 sm:px-8 sm:py-5 lg:grid-cols-6"
            >
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-8 sm:py-5">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="mt-3 h-4 w-1/3" />
        </div>
        <Skeleton className="h-90 w-full sm:h-110 lg:h-122.5" />
      </div>
    </div>
  );
}

/* -------------------------
   SHARED HELPERS
   (skeleton, auto refresh)
------------------------- */

const REFRESH_MS = 30_000; // auto refresh every 30 seconds

// Runs `refresh` every REFRESH_MS while the tab is visible, and once more
// when the user comes back to the tab.
function useAutoRefresh(
  refresh: () => void,
  enabled = true,
  intervalMs = REFRESH_MS
) {
  const latest = useRef(refresh);

  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };

    const id = window.setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", run);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, intervalMs]);
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 ${className}`}
    />
  );
}