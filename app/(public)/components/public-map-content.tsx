"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import Map from "./map";
import {
  barangays,
  formatRestorationEstimate,
  getReportAffectedAreas,
  getReportAffectedLabel,
  getReportSourceDisplay,
  getReportSourceLocation,
  reportAffectsBarangay,
  type Report,
  type Status,
} from "../data/mock-data";
import { useIncidents } from "../data/use-incidents";

type PublicMapContentProps = {
  onNavigate: (section: "history", reportId?: number) => void;
};

// Same status colors as the admin portal.
const statusTone: Record<
  Status,
  { badge: string; bar: string; top: string; dot: string }
> = {
  Active: {
    badge: "border-red-200 bg-red-50 text-red-800",
    bar: "bg-red-600",
    top: "border-t-red-600",
    dot: "bg-red-600",
  },
  Monitoring: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    bar: "bg-amber-500",
    top: "border-t-amber-500",
    dot: "bg-amber-500",
  },
  Normal: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-600",
    top: "border-t-emerald-600",
    dot: "bg-emerald-600",
  },
};

// Same class tokens as the admin Submissions page.
const inputClass =
  "w-full rounded-none border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-2 block text-sm font-bold text-slate-800";

type DropdownOption = { value: string; label: string };

// Custom dropdown that replaces the native <select>, same as the admin
// Submissions page. The list renders in a portal so it is never clipped
// by the overflow-hidden map card.
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

    // Always open downward; shorten the list (it scrolls) if space is tight.
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
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
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
          document.body,
        )}
    </>
  );
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex w-32 items-center justify-center gap-2 border px-3 py-1.5 text-sm font-semibold ${statusTone[status].badge}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${statusTone[status].dot}`}
      />
      {status}
    </span>
  );
}

// Same page frame as the History page: a bordered container that holds
// the banner and the page content.
function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:p-5">
        {children}
      </div>
    </div>
  );
}

// Same banner as the History page. `children` goes under the description
// (e.g. buttons); `aside` sits on the right (e.g. logos).
function PageBanner({
  eyebrow,
  title,
  text,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-indigo-100">{eyebrow}</p>

          <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>

          <p className="mt-2 max-w-3xl text-base text-indigo-100">{text}</p>

          {children}
        </div>

        {aside}
      </div>
    </header>
  );
}

const statuses: Status[] = ["Active", "Monitoring", "Normal"];

// Lower number = more critical = shown first when sorting by criticality.
const statusRank: Record<Status, number> = {
  Active: 0,
  Monitoring: 1,
  Normal: 2,
};

// Newest-first is the default order of the "Latest updates" list.
type SortMode = "newest" | "oldest" | "critical";

const sortOptions: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "critical", label: "Most critical first" },
];

// Same recency rule as the History page.
function reportTime(report: Report) {
  const timestamp =
    report.updatedAt ?? Date.parse(`${report.date} ${report.time}`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// Most critical first (Active, Monitoring, Normal); newest first within a
// status.
function byCriticality(a: Report, b: Report) {
  return (
    statusRank[a.status] - statusRank[b.status] ||
    reportTime(b) - reportTime(a)
  );
}

export default function PublicMapContent({
  onNavigate,
}: PublicMapContentProps) {
  const { reports } = useIncidents(); // live data from the database
  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(
    null,
  );
  const [focusBarangay, setFocusBarangay] = useState<string | null>(null);
  const [fullView, setFullView] = useState(false);
  // Where the current selection came from. Only a click on the MAP moves the
  // matching reports to the top of the list; clicking a report card in the
  // list never reorders it under the visitor's finger.
  const [selectionSource, setSelectionSource] = useState<
    "map" | "list" | null
  >(null);
  // Goes up by one on every map click, so the list jumps back to the top
  // even when the same barangay is clicked twice.
  const [mapClickTick, setMapClickTick] = useState(0);
  // How the "Latest updates" list is sorted. Newest issue first by default.
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  // When the selection last changed. Opening a popup can make the map report
  // the previous popup closing a moment later; that must not wipe the new
  // selection (it made the highlighted card vanish right after a click).
  const lastSelectAtRef = useRef(0);

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

  // Map -> list: when a barangay is clicked on the map, its reports move to
  // the top of the "Latest updates" list (see `displayReports` below), and the
  // list scrolls back to the top so they are right there. Only the list
  // scrolls, not the whole page.
  useEffect(() => {
    if (mapClickTick === 0) return;

    const list = document.getElementById("latest-updates-list");
    if (!list) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    list.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [mapClickTick]);

  const barangayNames = useMemo(() => [...barangays].sort(), []);

  const incidentTypes = useMemo(
    () => [...new Set(reports.map((report) => report.type))].sort(),
    [reports],
  );

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return reports.filter((report) => {
      const matchesSearch =
        !query ||
        getReportSourceLocation(report).toLocaleLowerCase().includes(query) ||
        getReportAffectedAreas(report).some((area) =>
          area.toLocaleLowerCase().includes(query),
        ) ||
        report.barangay.toLocaleLowerCase().includes(query) ||
        report.title.toLocaleLowerCase().includes(query) ||
        report.type.toLocaleLowerCase().includes(query);

      return (
        matchesSearch &&
        (barangayFilter === "all" ||
          reportAffectsBarangay(report, barangayFilter)) &&
        (statusFilter === "all" || report.status === statusFilter) &&
        (typeFilter === "all" || report.type === typeFilter)
      );
    });
  }, [reports, search, barangayFilter, statusFilter, typeFilter]);

  // Order of the "Latest updates" list:
  //   - By default the newest issue comes first. The "Sort by" control can
  //     switch to oldest first, or to most critical first (Active, then
  //     Monitoring, then Normal).
  //   - When a barangay was clicked on the map, the reports that affect it are
  //     pinned to the top, most critical (Active) first. The rest of the list
  //     keeps the chosen sort.
  const displayReports = useMemo(() => {
    const ordered = [...filteredReports].sort((a, b) => {
      if (sortMode === "oldest") return reportTime(a) - reportTime(b);
      if (sortMode === "critical") return byCriticality(a, b);
      return reportTime(b) - reportTime(a);
    });

    if (!selectedBarangay || selectionSource !== "map") {
      return ordered;
    }

    const matches = ordered
      .filter((report) => reportAffectsBarangay(report, selectedBarangay))
      .sort(byCriticality);
    const others = ordered.filter(
      (report) => !reportAffectsBarangay(report, selectedBarangay),
    );

    return [...matches, ...others];
  }, [filteredReports, selectedBarangay, selectionSource, sortMode]);

  const activeFilters = [barangayFilter, statusFilter, typeFilter].filter(
    (filter) => filter !== "all",
  ).length;

  const clearFilters = () => {
    setSearch("");
    setBarangayFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const focusReport = (report: Report) => {
    const affectedBarangay =
      barangays.find((name) => reportAffectsBarangay(report, name)) ??
      report.barangay;

    lastSelectAtRef.current = Date.now();
    setSelectionSource("list");
    setSelectedBarangay(affectedBarangay);
    setFocusBarangay(affectedBarangay);
    document
      .getElementById("map-view")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredBarangays = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (barangayFilter !== "all") {
      return [barangayFilter];
    }

    if (statusFilter === "all" && typeFilter === "all" && !query) {
      return undefined;
    }

    const reportMatches = barangayNames.filter((name) =>
      filteredReports.some((report) => reportAffectsBarangay(report, name)),
    );

    const nameMatches = query
      ? barangayNames.filter((name) =>
          name.toLocaleLowerCase().includes(query),
        )
      : [];

    return [...new Set([...reportMatches, ...nameMatches])];
  }, [
    barangayFilter,
    barangayNames,
    filteredReports,
    search,
    statusFilter,
    typeFilter,
  ]);

  return (
    <main id="main-content" className="min-w-0 flex-1 bg-[#F4F6F9]">
      <PageShell>
        {/* PAGE BANNER */}
        <PageBanner
          eyebrow="Public information"
          title="Tanza Water Service Map"
          text="View current water service conditions and reported incidents across Tanza barangays."
        />

        {/* HOW TO USE + LEGEND */}
        <section className="flex flex-col gap-5 border border-slate-300 bg-white px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#123D73]">
              How to use the map
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a barangay on the map, or a report from the list, to
              view its latest service information.
            </p>
          </div>

          {/* Always one line. Smaller text and tighter gaps on phones. */}
          <div
            className="flex flex-nowrap items-center gap-x-3 sm:gap-x-6"
            role="group"
            aria-label="Map status legend"
          >
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500 sm:text-sm sm:tracking-[0.08em]">
              Status
            </span>

            {statuses.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-700 sm:gap-2 sm:text-sm"
              >
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${statusTone[status].dot}`}
                />
                {status}
              </span>
            ))}
          </div>
        </section>

        {/* MAP + RECENT REPORTS */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* MAP CARD */}
          <section
            id="map-view"
            className="min-w-0 overflow-hidden border border-slate-300 bg-white"
            aria-label="Tanza barangay map"
          >
            <div className="flex flex-col gap-5 border-b border-slate-200 px-5 py-5 sm:px-6">
              {/* Title and "Tanza, Cavite" stay on one row, even on phones */}
              <div className="flex flex-nowrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#123D73]">
                    Barangay Service Map
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Click a barangay to view its latest report
                  </p>
                </div>

                <span className="w-fit shrink-0 whitespace-nowrap border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:px-4 sm:py-2 sm:text-sm">
                  Tanza, Cavite
                </span>
              </div>

              {/* SEARCH + FILTER TOGGLE */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="map-search" className={labelClass}>
                    Search
                  </label>

                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#123D73]"
                    >
                      <Icon name="search" className="size-4" />
                    </span>

                    <input
                      id="map-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Barangay, incident, or location"
                      className={`${inputClass} pl-11 ${search ? "pr-11" : ""}`}
                    />

                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-none! border-0 bg-transparent p-0 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
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
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  aria-controls="map-filters"
                  className={`inline-flex items-center justify-center gap-2 border px-5 py-3 text-base font-medium transition-colors ${
                    filtersOpen
                      ? "border-[#123D73] bg-[#E8EEF6] text-[#123D73]"
                      : "border-slate-300 bg-white text-[#123D73] hover:border-[#123D73] hover:bg-[#E8EEF6]"
                  }`}
                >
                  Filters
                  {activeFilters > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center bg-[#123D73] px-1.5 text-xs font-bold text-white">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </div>

              {/* FILTER PANEL */}
              <div
                id="map-filters"
                hidden={!filtersOpen}
                className="border border-slate-300 bg-white p-5"
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <label htmlFor="map-barangay" className={labelClass}>
                      Barangay
                    </label>
                    <Dropdown
                      id="map-barangay"
                      value={barangayFilter}
                      onChange={setBarangayFilter}
                      options={[
                        { value: "all", label: "All barangays" },
                        ...barangayNames.map((name) => ({
                          value: name,
                          label: name,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label htmlFor="map-status" className={labelClass}>
                      Status
                    </label>
                    <Dropdown
                      id="map-status"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: "all", label: "All statuses" },
                        { value: "Normal", label: "Normal" },
                        { value: "Monitoring", label: "Monitoring" },
                        { value: "Active", label: "Active" },
                      ]}
                    />
                  </div>

                  <div>
                    <label htmlFor="map-type" className={labelClass}>
                      Incident type
                    </label>
                    <Dropdown
                      id="map-type"
                      value={typeFilter}
                      onChange={setTypeFilter}
                      options={[
                        { value: "all", label: "All types" },
                        ...incidentTypes.map((type) => ({
                          value: type,
                          label: type,
                        })),
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-base text-slate-600">
                  <span>
                    {filteredReports.length}{" "}
                    {filteredReports.length === 1 ? "incident" : "incidents"}{" "}
                    shown
                  </span>

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>

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
                      Public information
                    </p>
                    <h2 className="truncate text-lg font-bold text-white">
                      Tanza Water Service Map
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

              {/* isolate + z-0 keeps Leaflet's internal z-indexes (up to 1000)
                  inside the map so it never paints over the sticky header. */}
              <div
                className={`relative isolate z-0 overflow-hidden bg-slate-100 ${
                  fullView ? "min-h-0 flex-1" : "h-136 sm:h-150"
                }`}
              >
                <Map
                  key={fullView ? "map-full" : "map-card"}
                  onBarangayClick={(name) => {
                    lastSelectAtRef.current = Date.now();
                    setSelectionSource("map");
                    setSelectedBarangay(name);
                    setFocusBarangay(name);
                    setMapClickTick((tick) => tick + 1);
                  }}
                  onPopupClose={() => {
                    // Ignore the close that comes from opening another popup.
                    if (Date.now() - lastSelectAtRef.current < 600) return;
                    setSelectedBarangay(null);
                  }}
                  focusBarangay={focusBarangay}
                  selectedBarangay={selectedBarangay}
                  visibleBarangays={filteredBarangays}
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
              </div>
            </div>
          </section>

          {/* RECENT REPORTS */}
          <aside
            className="flex min-w-0 flex-col overflow-hidden border border-slate-300 bg-white"
            aria-label="Latest updates"
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#123D73]">
                  Latest updates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Incident records available for Tanza
                </p>
              </div>

              <span className="w-fit shrink-0 border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                {filteredReports.length}{" "}
                {filteredReports.length === 1 ? "incident" : "incidents"}
              </span>
            </div>

            {filteredReports.length > 1 && (
              <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 sm:px-6">
                <label
                  htmlFor="report-sort"
                  className="shrink-0 text-sm font-bold text-slate-800"
                >
                  Sort by
                </label>

                <div className="min-w-0 flex-1">
                  <Dropdown
                    id="report-sort"
                    value={sortMode}
                    onChange={(value) => setSortMode(value as SortMode)}
                    options={sortOptions}
                  />
                </div>
              </div>
            )}

            <div
              id="latest-updates-list"
              className="max-h-160 space-y-4 overflow-y-auto bg-[#F4F6F9] p-4"
              role="region"
              aria-label="Latest service updates"
              aria-live="polite"
            >
              {filteredReports.length ? (
                displayReports.map((report) => {
                  const selected =
                    selectedBarangay &&
                    reportAffectsBarangay(report, selectedBarangay);

                  return (
                    <article
                      key={report.id}
                      data-status={report.status.toLowerCase()}
                      className={`border border-t-[3px] transition-colors duration-200 hover:border-[#123D73] ${
                        statusTone[report.status].top
                      } ${
                        selected
                          ? "border-[#123D73] bg-blue-50 shadow-[0_0_0_1px_#123D73]"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => focusReport(report)}
                        className="block w-full rounded-none! p-5 text-left"
                        aria-label={`Show ${getReportSourceLocation(report)} on the map`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <StatusPill status={report.status} />

                          <span className="text-sm text-slate-500">
                            {report.date}
                          </span>
                        </div>

                        <h3 className="mt-4 text-lg font-bold leading-snug text-[#123D73]">
                          {report.type}
                        </h3>

                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {getReportSourceDisplay(report)}
                        </p>

                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                          {report.title}
                        </p>

                        <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-600">
                          <span className="font-semibold text-slate-700">
                            {getReportAffectedLabel(report)}:
                          </span>{" "}
                          {getReportAffectedAreas(report).join(", ")}
                        </p>

                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                          {report.description}
                        </p>

                        {report.restoration && (
                          <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-600">
                            <span className="font-semibold text-slate-700">
                              Estimated restoration:
                            </span>{" "}
                            <strong className="text-slate-800">
                              {formatRestorationEstimate(report)}
                            </strong>
                          </p>
                        )}

                        <p className="mt-3 inline-flex w-full items-center gap-1.5 border-t border-slate-200 pt-3 text-sm text-slate-500">
                          <Icon name="clock" className="size-4" />
                          {report.time}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigate("history", report.id)}
                        className="flex w-full items-center justify-between rounded-none! border-t border-slate-200 px-5 py-3 text-sm font-semibold text-[#123D73] transition-colors hover:bg-[#E8EEF6]"
                        aria-label={`View details for ${getReportSourceLocation(report)}: ${report.title}`}
                      >
                        View details
                        <Icon name="chevron" className="size-4" />
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center border border-blue-100 bg-blue-50 text-[#123D73]">
                    <Icon name="search" className="size-5" />
                  </span>

                  <p className="mt-4 text-lg font-bold text-slate-800">
                    No matching incidents
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Try changing your search or filters.
                  </p>

                  <button
                    type="button"
                    className="mt-4 inline-flex min-h-10 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-[#123D73] transition-colors hover:border-[#123D73] hover:bg-[#E8EEF6]"
                    onClick={clearFilters}
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate("history")}
              className="flex items-center justify-between rounded-none! border-t border-slate-200 px-5 py-4 text-left text-sm font-semibold text-[#123D73] transition-colors hover:bg-[#E8EEF6] sm:px-6"
            >
              View all reports
              <Icon name="chevron" className="size-4" />
            </button>
          </aside>
        </div>
      </PageShell>
    </main>
  );
}