"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Barangay = { name: string; code: string };

type PumpingStation = {
  id: number;
  name: string;
  location: string | null;
};

type IncidentBarangay = {
  incident_id: number;
  barangay_code: string;
};

type IncidentInfo = {
  id: number;
  barangay_code: string | null;
  incident_type: string;
  status: string;
  description: string | null;
  etr: string | null;
  pumping_station_id: number | null;
  affected_area: string | null;
};

type DeploymentRow = {
  id: string;
  incident_id: number;
  team_id: string;
  status: string;
  assigned_at: string;
  started_at: string | null;
  resolved_at: string | null;
  incident: IncidentInfo | null;
  team: { name: string } | null;
};

type AssignmentStatus = "assigned" | "ongoing" | "resolved";

/* =========================================
   HELPERS
========================================= */

// The field portal writes "ongoing"; older rows may use "in_progress".
function normalizeStatus(status: string): AssignmentStatus {
  if (status === "ongoing" || status === "in_progress") return "ongoing";
  if (status === "resolved") return "resolved";
  return "assigned";
}

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; badge: string; dot: string }
> = {
  assigned: {
    label: "Assigned",
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    dot: "bg-blue-600",
  },
  ongoing: {
    label: "Ongoing",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-600",
  },
};

function getIncidentStatus(status: string) {
  if (status === "red") {
    return {
      label: "Active",
      badge: "border-red-200 bg-red-50 text-red-800",
    };
  }

  if (status === "yellow") {
    return {
      label: "Monitoring",
      badge: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: "Normal",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

function formatDateTime(
  value: string | null | undefined,
  fallback = "—"
): string {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(
  from: string | null,
  to: string | null,
  fallback = "—"
): string {
  if (!from || !to) return fallback;

  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return fallback;

  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Less than a minute";

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins && !days) parts.push(`${mins}m`);

  return parts.join(" ");
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getLatestUpdate(deployment: DeploymentRow) {
  if (deployment.resolved_at) {
    return { label: "Resolved", at: deployment.resolved_at };
  }

  if (deployment.started_at) {
    return { label: "Started", at: deployment.started_at };
  }

  return { label: "Assigned", at: deployment.assigned_at };
}

/* UI-only class tokens (same look as the Submissions page). */
const inputClass =
  "w-full rounded-none border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-2 block text-sm font-bold text-slate-800";

/* =========================================
   DROPDOWN (same component style as Submissions)
========================================= */

type DropdownOption = { value: string; label: string };

function Dropdown({
  id,
  value,
  onChange,
  options,
  placeholder = "Select",
  searchable,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const showSearch = searchable ?? options.length > 7;
  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom - 16;

    setPosition({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + 4,
      maxHeight: Math.max(120, Math.min(280, spaceBelow)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };

    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between border border-slate-300 bg-white px-4 py-3 text-left text-base text-slate-800 shadow-sm transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
      >
        <span
          className={
            selected
              ? "truncate font-medium text-slate-900"
              : "truncate text-slate-500"
          }
        >
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-1200 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-lg"
          >
            {showSearch && (
              <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-2">
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  aria-label="Search options"
                  className="w-full border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
                />
              </div>
            )}

            <div
              role="listbox"
              className="min-h-0 max-h-56 flex-1 overflow-y-auto p-1"
            >
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`w-full px-4 py-3 text-left text-base transition-colors ${
                    option.value === value
                      ? "bg-blue-50 font-semibold text-[#123D73]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-4 py-4 text-base text-slate-500">
                  No results found.
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* =========================================
   PAGE
========================================= */

export default function Deployment() {
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [stations, setStations] = useState<PumpingStation[]>([]);
  const [incidentBarangays, setIncidentBarangays] = useState<
    IncidentBarangay[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | AssignmentStatus
  >("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  /* -------------------------
     LOAD DEPLOYMENTS
     `silent` = background refresh: no skeleton, keeps the current data
     (and the current page / open log) if the request fails.
  ------------------------- */

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }

    const supabase = createClient();

    const [deploymentResult, affectedResult, stationResult] =
      await Promise.all([
        supabase
          .from("deployments")
          .select(
            `
            id,
            incident_id,
            team_id,
            status,
            assigned_at,
            started_at,
            resolved_at,
            incident:incidents (
              id,
              barangay_code,
              incident_type,
              status,
              description,
              etr,
              pumping_station_id,
              affected_area
            ),
            team:teams (
              name
            )
          `
          )
          .order("assigned_at", { ascending: false }),

        supabase
          .from("incident_barangays")
          .select("incident_id, barangay_code"),

        supabase
          .from("pumping_stations")
          .select("id, name, location"),
      ]);

    if (deploymentResult.error) {
      console.error("Error loading deployments:", deploymentResult.error);

      if (!silent) {
        setLoadError(
          `Could not load assignments: ${deploymentResult.error.message}`
        );
        setLoading(false);
      }
      return;
    }

    setDeployments(
      (deploymentResult.data ?? []).map((row: any) => ({
        ...row,
        incident: pickOne<IncidentInfo>(row.incident),
        team: pickOne<{ name: string }>(row.team),
      })) as DeploymentRow[]
    );

    if (affectedResult.error) {
      console.error(
        "Error loading incident_barangays:",
        affectedResult.error
      );
      if (!silent) setIncidentBarangays([]);
    } else {
      setIncidentBarangays(
        (affectedResult.data ?? []) as IncidentBarangay[]
      );
    }

    if (stationResult.error) {
      console.error(
        "Error loading pumping_stations:",
        stationResult.error
      );
      if (!silent) setStations([]);
    } else {
      setStations((stationResult.data ?? []) as PumpingStation[]);
    }

    setLoadError("");
    setLastUpdated(new Date());
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto refresh: picks up updates made from the field portal.
  useAutoRefresh(() => void loadData(true));

  // Go back to page 1 whenever a filter changes
  // (a background refresh does NOT reset the page).
  useEffect(() => {
    setPage(1);
  }, [search, teamFilter, statusFilter]);

  /* -------------------------
     LOAD BARANGAY NAMES
  ------------------------- */

  useEffect(() => {
    async function loadBarangays() {
      try {
        const response = await fetch("/data/tanza-barangays.geojson");
        if (!response.ok) throw new Error("Could not load GeoJSON");

        const data = await response.json();

        setBarangays(
          (data.features ?? []).map((feature: any) => ({
            name: String(
              feature.properties?.brgy_name ?? "Unknown barangay"
            ),
            code: String(feature.properties?.brgy_code ?? ""),
          }))
        );
      } catch (error) {
        console.error("Error loading barangays:", error);
      }
    }

    void loadBarangays();
  }, []);

  /* -------------------------
     LOOKUPS
  ------------------------- */

  const getBarangayName = (code: string): string =>
    barangays.find((item) => item.code === code)?.name ?? code;

  const getStation = (id: number | null | undefined) =>
    id == null ? null : stations.find((item) => item.id === id) ?? null;

  const getAffectedNames = (deployment: DeploymentRow): string[] => {
    const incident = deployment.incident;
    if (!incident) return [];

    const codes = incidentBarangays
      .filter((item) => item.incident_id === incident.id)
      .map((item) => item.barangay_code);

    const unique = [...new Set(codes)];

    if (unique.length > 0) return unique.map(getBarangayName);
    if (incident.barangay_code) return [getBarangayName(incident.barangay_code)];
    return [];
  };

  /* -------------------------
     FILTERS
  ------------------------- */

  const teamOptions = useMemo(
    () =>
      Array.from(
        new Set(
          deployments
            .map((item) => item.team?.name)
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [deployments]
  );

  const counts = useMemo(() => {
    const result = { all: deployments.length, assigned: 0, ongoing: 0, resolved: 0 };

    deployments.forEach((item) => {
      result[normalizeStatus(item.status)] += 1;
    });

    return result;
  }, [deployments]);

  const visibleDeployments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return deployments.filter((deployment) => {
      if (
        statusFilter !== "all" &&
        normalizeStatus(deployment.status) !== statusFilter
      ) {
        return false;
      }

      if (
        teamFilter !== "all" &&
        (deployment.team?.name ?? "") !== teamFilter
      ) {
        return false;
      }

      if (!term) return true;

      const incident = deployment.incident;
      const station = getStation(incident?.pumping_station_id);

      const haystack = [
        deployment.team?.name ?? "",
        incident?.incident_type ?? "",
        String(deployment.incident_id),
        station?.name ?? "",
        station?.location ?? "",
        incident?.affected_area ?? "",
        incident?.description ?? "",
        getAffectedNames(deployment).join(" "),
        STATUS_META[normalizeStatus(deployment.status)].label,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    }).sort(
      // Most recent activity (assigned, started or resolved) first.
      (a, b) =>
        new Date(getLatestUpdate(b).at).getTime() -
        new Date(getLatestUpdate(a).at).getTime()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deployments,
    search,
    teamFilter,
    statusFilter,
    barangays,
    stations,
    incidentBarangays,
  ]);

  // Pagination (10 per page)
  const {
    pageItems: pagedDeployments,
    page: currentPage,
    totalPages,
  } = paginate(visibleDeployments, page);

  const statCards: {
    value: "all" | AssignmentStatus;
    label: string;
    count: number;
  }[] = [
    { value: "all", label: "All assignments", count: counts.all },
    { value: "assigned", label: "Assigned", count: counts.assigned },
    { value: "ongoing", label: "Ongoing", count: counts.ongoing },
    { value: "resolved", label: "Resolved", count: counts.resolved },
  ];

  /* -------------------------
     RENDER
  ------------------------- */

  return (
    <div className="space-y-6 border border-[#4438A8] bg-white p-6 text-slate-900 sm:p-8">
      {/* HEADER */}
      <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-indigo-100">
              Assignments
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Field Team Assignments
            </h2>
            <p className="mt-2 text-base text-indigo-100">
              Monitor assigned teams and the progress they report from
              the field portal.
            </p>
          </div>

          <button
            onClick={() => void loadData()}
            className="border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* STATUS SUMMARY (also works as a status filter) */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border border-slate-300 bg-white p-5 sm:p-6"
              >
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-4 h-9 w-1/4" />
              </div>
            ))
          : statCards.map((card) => {
              const active = statusFilter === card.value;

              return (
                <button
                  key={card.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(card.value)}
                  className={`border p-5 text-left transition sm:p-6 ${
                    active
                      ? "border-[#123D73] bg-blue-50"
                      : "border-slate-300 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-bold text-slate-600">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    {card.count}
                  </p>
                </button>
              );
            })}
      </div>

      {/* FILTERS */}
      <section className="border border-slate-300 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="assignment-search" className={labelClass}>
              Search
            </label>

            <input
              id="assignment-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Team, incident, barangay, station, description"
              className={inputClass}
            />
          </div>

          <div className="w-full lg:w-72">
            <label htmlFor="team-filter" className={labelClass}>
              Team
            </label>

            <Dropdown
              id="team-filter"
              value={teamFilter}
              onChange={setTeamFilter}
              options={[
                { value: "all", label: "All teams" },
                ...teamOptions.map((name) => ({
                  value: name,
                  label: name,
                })),
              ]}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-base text-slate-600">
          <span>
            {visibleDeployments.length}{" "}
            {visibleDeployments.length === 1
              ? "assignment"
              : "assignments"}{" "}
            shown
            <span className="mx-2 text-slate-300">|</span>
            Newest first
            {lastUpdated && (
              <>
                <span className="mx-2 text-slate-300">|</span>
                Updated{" "}
                {lastUpdated.toLocaleTimeString("en-PH", {
                  timeZone: "Asia/Manila",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </>
            )}
          </span>

          <button
            onClick={() => {
              setSearch("");
              setTeamFilter("all");
              setStatusFilter("all");
            }}
            className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* TABLE */}
      <section className="overflow-hidden border border-[#4438A8] bg-white">
        {loadError && (
          <div
            role="alert"
            className="m-6 border border-amber-200 bg-amber-50 p-4 text-base text-amber-800"
          >
            {loadError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-r [&_th]:border-white/20 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
            <thead className="border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
              <tr>
                {[
                  "Team",
                  "Incident",
                  "Location / Affected Area",
                  "Status",
                  "Latest Update",
                  "Activity Log",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-6 py-4 text-sm font-semibold uppercase tracking-wide text-indigo-50"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="align-top">
                    <td className="min-w-44 px-6 py-6">
                      <Skeleton className="h-5 w-3/4" />
                    </td>

                    <td className="min-w-56 px-6 py-6">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="mt-2 h-4 w-1/3" />
                      <Skeleton className="mt-3 h-8 w-44" />
                    </td>

                    <td className="min-w-72 px-6 py-6">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="mt-2 h-5 w-full" />
                      <Skeleton className="mt-4 h-4 w-1/3" />
                      <Skeleton className="mt-2 h-5 w-2/3" />
                    </td>

                    <td className="px-6 py-6">
                      <Skeleton className="h-8 w-36" />
                    </td>

                    <td className="px-6 py-6">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="mt-2 h-4 w-32" />
                    </td>

                    <td className="px-6 py-6">
                      <Skeleton className="h-9 w-24" />
                    </td>
                  </tr>
                ))
              ) : visibleDeployments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-base font-semibold text-slate-900">
                      No matching assignments
                    </p>
                    <p className="mt-2 text-base text-slate-500">
                      Assigned teams will appear here, or try changing
                      your search and filters.
                    </p>
                  </td>
                </tr>
              ) : (
                pagedDeployments.map((deployment) => {
                  const incident = deployment.incident;
                  const status = normalizeStatus(deployment.status);
                  const meta = STATUS_META[status];
                  const incidentStatus = getIncidentStatus(
                    incident?.status ?? "green"
                  );
                  const station = getStation(
                    incident?.pumping_station_id
                  );
                  const affectedNames = getAffectedNames(deployment);
                  const latest = getLatestUpdate(deployment);
                  const expanded = expandedId === deployment.id;

                  const steps = [
                    {
                      key: "assigned",
                      label: "Assigned",
                      at: deployment.assigned_at,
                      note: "Team was assigned to this incident",
                      done: true,
                    },
                    {
                      key: "started",
                      label: "Started",
                      at: deployment.started_at,
                      note: "Field worker started the task",
                      done: Boolean(deployment.started_at),
                    },
                    {
                      key: "resolved",
                      label: "Resolved",
                      at: deployment.resolved_at,
                      note: "Task completed and incident set to Normal",
                      done: Boolean(deployment.resolved_at),
                    },
                  ];

                  return (
                    <Fragment key={deployment.id}>
                      <tr className="align-top hover:bg-slate-50">
                        <td className="min-w-44 px-6 py-6">
                          <p className="text-base font-semibold text-slate-900">
                            {deployment.team?.name ?? "Unknown team"}
                          </p>
                        </td>

                        <td className="min-w-56 px-6 py-6">
                          <p className="text-base font-semibold text-slate-900">
                            {incident?.incident_type ??
                              "Unknown incident"}
                          </p>
                          <p className="mt-1 font-mono text-sm text-slate-500">
                            INC-
                            {String(deployment.incident_id).padStart(
                              4,
                              "0"
                            )}
                          </p>
                          <span
                            className={`mt-3 inline-flex w-44 justify-center rounded border px-3 py-1.5 text-sm font-medium ${incidentStatus.badge}`}
                          >
                            Incident: {incidentStatus.label}
                          </span>
                        </td>

                        <td className="min-w-72 max-w-md px-6 py-6">
                          <div className="space-y-4">
                            {station && (
                              <p className="text-base font-semibold text-slate-900">
                                {station.name}
                              </p>
                            )}

                            <div>
                              <p className="text-sm font-semibold text-slate-500">
                                {affectedNames.length > 1
                                  ? "Barangays"
                                  : "Barangay"}
                              </p>
                              <p className="mt-1 wrap-break-word text-base leading-6 text-slate-900">
                                {affectedNames.length > 0
                                  ? affectedNames.join(", ")
                                  : "—"}
                              </p>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-500">
                                Affected area
                              </p>
                              <p
                                title={incident?.affected_area ?? ""}
                                className="mt-1 line-clamp-3 wrap-break-word text-base leading-6 text-slate-900"
                              >
                                {incident?.affected_area || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-6">
                          <span
                            className={`inline-flex w-36 items-center justify-center gap-2 whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium ${meta.badge}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${meta.dot}`}
                            />
                            {meta.label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-6 py-6">
                          <p className="text-base font-semibold text-slate-900">
                            {latest.label}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDateTime(latest.at)}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-6 py-6">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedId(
                                expanded ? null : deployment.id
                              )
                            }
                            className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {expanded ? "Hide log" : "View log"}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-slate-50 px-6 py-8 sm:px-8"
                          >
                            <div className="grid gap-8 lg:grid-cols-3">
                              {/* TIMELINE */}
                              <div className="lg:col-span-2">
                                <h3 className="text-base font-bold text-[#123D73]">
                                  Activity log
                                </h3>

                                <ol className="mt-5">
                                  {steps.map((step, index) => (
                                    <li
                                      key={step.key}
                                      className="flex gap-4"
                                    >
                                      <div className="flex flex-col items-center">
                                        <span
                                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                                            step.done
                                              ? step.key === "resolved"
                                                ? "bg-emerald-600"
                                                : "bg-[#123D73]"
                                              : "bg-slate-300"
                                          }`}
                                        >
                                          {step.done ? "✓" : index + 1}
                                        </span>

                                        {index < steps.length - 1 && (
                                          <span className="my-1 w-px flex-1 bg-slate-300" />
                                        )}
                                      </div>

                                      <div className="pb-6">
                                        <p
                                          className={`text-base font-semibold ${
                                            step.done
                                              ? "text-slate-900"
                                              : "text-slate-400"
                                          }`}
                                        >
                                          {step.label}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-600">
                                          {step.done
                                            ? formatDateTime(step.at)
                                            : "Waiting..."}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                          {step.note}
                                        </p>
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              </div>

                              {/* DETAILS */}
                              <div className="space-y-4 text-base">
                                <div className="border border-slate-300 bg-white p-4">
                                  <p className="text-sm font-bold text-slate-500">
                                    Response time
                                  </p>
                                  <p className="mt-1.5 font-semibold text-slate-900">
                                    {deployment.started_at
                                      ? formatDuration(
                                          deployment.assigned_at,
                                          deployment.started_at
                                        )
                                      : "Waiting for team to start"}
                                  </p>
                                </div>

                                <div className="border border-slate-300 bg-white p-4">
                                  <p className="text-sm font-bold text-slate-500">
                                    Work duration
                                  </p>
                                  <p className="mt-1.5 font-semibold text-slate-900">
                                    {deployment.resolved_at
                                      ? formatDuration(
                                          deployment.started_at,
                                          deployment.resolved_at,
                                          "Start time not recorded"
                                        )
                                      : deployment.started_at
                                      ? "In progress"
                                      : "—"}
                                  </p>
                                </div>

                                <div className="border border-slate-300 bg-white p-4">
                                  <p className="text-sm font-bold text-slate-500">
                                    ETR
                                  </p>
                                  <p className="mt-1.5 font-semibold text-slate-900">
                                    {formatDateTime(
                                      incident?.etr,
                                      "Not set"
                                    )}
                                  </p>
                                </div>

                                {incident?.description && (
                                  <div className="border border-slate-300 bg-white p-4">
                                    <p className="text-sm font-bold text-slate-500">
                                      Description
                                    </p>
                                    <p className="mt-1.5 whitespace-pre-wrap leading-7 text-slate-700">
                                      {incident.description}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={visibleDeployments.length}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}

/* -------------------------
   SHARED HELPERS
   (skeleton, pagination, auto refresh)
------------------------- */

const PAGE_SIZE = 10;
const REFRESH_MS = 30_000; // auto refresh every 30 seconds

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
  };
}

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

function Pagination({
  page,
  totalPages,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-sm text-slate-600">
        Showing{" "}
        <span className="font-semibold text-slate-900">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-slate-900">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={btn}
        >
          Previous
        </button>

        <span className="px-3 text-sm font-semibold text-slate-700">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={btn}
        >
          Next
        </button>
      </div>
    </div>
  );
}