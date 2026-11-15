"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "./icons";
import { StatusBadge } from "./status-badge";
import { Button } from "./ui";
import { SectionLabel } from "./section-label";
import { Progress } from "./progress";
import { useDialogAccessibility } from "./use-dialog-accessibility";

import {
  barangays,
  formatRestorationEstimate,
  getReportAffectedAreas,
  getReportAffectedLabel,
  getReportSourceDisplay,
  reportAffectsBarangay,
  type Report,
} from "../data/mock-data";
import { useIncidents } from "../data/use-incidents";

type HistoryContentProps = {
  selectedReportId?: number | null;
};

// Records shown per page.
const PAGE_SIZE = 6;

// Only this month's records are listed. Records that are still Active or
// Monitoring stay visible even if they were reported in an earlier month, so
// residents never lose sight of a problem that is not resolved yet.
// Set this to false to hide every record from earlier months.
const KEEP_UNRESOLVED_FROM_PAST_MONTHS = true;

// Same recency rule as the Home page: newest update first.
function reportTimestamp(report: Report) {
  const timestamp = Date.parse(`${report.date} ${report.time}`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// "Responding" = still unresolved and TWD has already started responding.
// Report progress steps: 1 = reported, 2 = responding, 3 = resolved.
function isResponding(report: Report) {
  return report.status !== "Normal" && report.progress === 2;
}

// "Recent" = updated in the last 7 days, plus anything still Active or
// Monitoring, so an unresolved problem never drops out of the default view.
const RECENT_DAYS = 7;

function isRecent(report: Report) {
  if (report.status !== "Normal") return true;

  const timestamp = report.updatedAt ?? reportTimestamp(report);
  return (
    timestamp === 0 || timestamp >= Date.now() - RECENT_DAYS * 86_400_000
  );
}

// Shared styles (same look as the Dashboard, Analytics, and Create Report pages).
// The "!" on rounded-none overrides the portal CSS that rounds every button.
const labelClass = "mb-2 block text-sm font-bold text-slate-800";

type SelectOption = { value: string; label: string };

function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

// Searchable dropdown, same look and behavior as the Submit Report form: it
// always opens downward, and the list renders in a portal so the panel never
// clips it.
function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? "";
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function toggle() {
    if (open) {
      setOpen(false);
      setSearch("");
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = rect.width;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    // Always open below the field; shrink the list if there is little room.
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxHeight = Math.min(300, Math.max(spaceBelow, 200));

    setPos({ left, width, top: rect.bottom + 4, maxHeight });
    setSearch("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
      setSearch("");
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }

    function onScroll(event: Event) {
      if (listRef.current?.contains(event.target as Node)) return;
      close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-none! border border-slate-300 bg-white px-4 py-3 text-left text-base text-slate-800 shadow-sm transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
      >
        <span
          className={`truncate ${display ? "font-medium text-slate-900" : "text-slate-500"}`}
        >
          {display || placeholder}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
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
        pos &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              maxHeight: pos.maxHeight,
            }}
            className="z-2100 flex flex-col overflow-hidden border border-slate-300 bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-2">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="min-w-0 flex-1 border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
              />
              <button
                type="button"
                aria-label="Close list"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none! border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>

            <div
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-y-auto p-1"
            >
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => pick(option.value)}
                  className={`w-full rounded-none! px-3 py-2.5 text-left text-base transition-colors ${
                    option.value === value
                      ? "bg-blue-50 font-semibold text-[#123D73]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500">{emptyText}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const secondaryButtonClass =
  "min-h-12 shrink-0 rounded-none! border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

function Panel({
  id,
  title,
  description,
  right,
  liveRegion = false,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  right?: string;
  liveRegion?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="min-w-0 scroll-mt-40 overflow-hidden border border-slate-300 bg-white"
    >
      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#123D73]">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        {right && (
          <span
            className="w-fit shrink-0 border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600"
            {...(liveRegion
              ? { "aria-live": "polite" as const, "aria-atomic": true }
              : {})}
          >
            {right}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}

export default function HistoryContent({
  selectedReportId = null,
}: HistoryContentProps) {
  // Live data from the database (same source as the Public Map).
  const { reports } = useIncidents();

  const [barangay, setBarangay] = useState("All Barangays");
  const [status, setStatus] = useState("All Statuses");
  const [type, setType] = useState("All Incident Types");
  const [period, setPeriod] = useState("Recent");
  const [etrOnly, setEtrOnly] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [page, setPage] = useState(1);
  // Phone only: the filter fields are tucked away until the visitor opens them.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Go back to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [barangay, status, type, period, etrOnly]);

  // Remembers which id we already opened, so the modal opens once per id
  // and does not pop back open when live data refreshes after closing it.
  const openedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedReportId == null) {
      openedIdRef.current = null;
      return;
    }

    if (openedIdRef.current === selectedReportId) return;

    const report = reports.find((item) => item.id === selectedReportId);

    // Reports may still be loading; this re-runs when they arrive.
    if (!report) return;

    openedIdRef.current = selectedReportId;
    setSelected(report);
  }, [selectedReportId, reports]);

  // Records from this month (plus unresolved ones from earlier months).
  const visibleReports = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return reports.filter((report) => {
      const timestamp = reportTimestamp(report);

      return (
        timestamp === 0 ||
        timestamp >= monthStart ||
        (KEEP_UNRESOLVED_FROM_PAST_MONTHS && report.status !== "Normal")
      );
    });
  }, [reports]);

  const types = useMemo(
    () => Array.from(new Set(visibleReports.map((report) => report.type))),
    [visibleReports],
  );

  const filtered = useMemo(
    () =>
      visibleReports.filter(
        (report) =>
          (barangay === "All Barangays" ||
            reportAffectsBarangay(report, barangay)) &&
          (status === "All Statuses" ||
            (status === "Responding"
              ? isResponding(report)
              : report.status === status)) &&
          (type === "All Incident Types" || report.type === type) &&
          (!etrOnly ||
            (report.status !== "Normal" && Boolean(report.restoration))) &&
          (period === "This month" || isRecent(report)),
      ).sort(
        // Most recent first.
        (a, b) =>
          (b.updatedAt ?? reportTimestamp(b)) -
          (a.updatedAt ?? reportTimestamp(a)),
      ),
    [visibleReports, barangay, status, type, period, etrOnly],
  );

  const reset = () => {
    setBarangay("All Barangays");
    setStatus("All Statuses");
    setType("All Incident Types");
    setPeriod("Recent");
    setEtrOnly(false);
  };

  const closeReport = () => setSelected(null);

  // Filters changed from their defaults (the status tabs are counted apart).
  const activeFilterCount =
    (period !== "Recent" ? 1 : 0) +
    (barangay !== "All Barangays" ? 1 : 0) +
    (type !== "All Incident Types" ? 1 : 0) +
    (etrOnly ? 1 : 0);

  // Status summary cards. They also work as the status filter.
  const statusCards = [
    {
      value: "All Statuses",
      label: "All records",
      count: visibleReports.length,
      dot: "",
    },
    {
      value: "Active",
      label: "Active",
      count: visibleReports.filter((report) => report.status === "Active")
        .length,
      dot: "bg-red-600",
    },
    {
      value: "Monitoring",
      label: "Monitoring",
      count: visibleReports.filter((report) => report.status === "Monitoring")
        .length,
      dot: "bg-amber-500",
    },
    {
      value: "Responding",
      label: "Responding",
      count: visibleReports.filter(isResponding).length,
      dot: "bg-blue-600",
    },
    {
      value: "Normal",
      label: "Normal",
      count: visibleReports.filter((report) => report.status === "Normal")
        .length,
      dot: "bg-emerald-600",
    },
  ];

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedReports = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const goToPage = (next: number) => {
    setPage(next);
    document
      .getElementById("etr-tracking")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <main id="main-content" className="min-w-0 flex-1 bg-[#F4F6F9]">
        <div className="w-full px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
          <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:p-5">
            {/* PAGE BANNER */}
            <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-6">
              <p className="text-sm font-bold text-indigo-100">
                Public records
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                Incident History
              </h1>

              <p className="mt-2 max-w-3xl text-base text-indigo-100">
                Review water-service incident records and service updates
                available in this portal.
              </p>
            </header>

            {/* STATUS SUMMARY (also works as the status filter) */}
            {/* Phone and tablet: a swipeable row of filter tabs inside a
                container. Large screens: the full summary cards. */}
            <div className="border border-slate-300 bg-white p-2 lg:border-0 lg:bg-transparent lg:p-0">
            <div
              role="group"
              aria-label="Filter by status"
              className="flex snap-x gap-2 overflow-x-auto lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible"
            >
              {statusCards.map((card) => {
                const active = status === card.value;

                return (
                  <button
                    key={card.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatus(card.value)}
                    className={`flex min-h-11 shrink-0 snap-start items-center gap-3 rounded-none! border px-4 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 lg:block lg:p-6 ${
                      active
                        ? "border-[#123D73] bg-blue-50"
                        : "border-slate-300 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-600">
                      {card.dot && (
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 rounded-full ${card.dot}`}
                        />
                      )}
                      {card.label}
                    </p>

                    <p className="text-base font-bold text-slate-900 lg:mt-3 lg:text-3xl">
                      {card.count}
                    </p>
                  </button>
                );
              })}
            </div>
            </div>

            <div id="reports" className="space-y-5">
              {/* SEARCH AND FILTERS */}
              <Panel
                title="Search and filters"
                description="Narrow the records by date, location, or type."
              >
                <div className="p-4 sm:p-6">
                  {/* Phone: one compact row that opens the filters */}
                  <button
                    type="button"
                    aria-expanded={filtersOpen}
                    aria-controls="history-filter-fields"
                    onClick={() => setFiltersOpen((current) => !current)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-none! border border-slate-300 bg-white px-4 py-2.5 text-left text-sm font-bold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 sm:hidden"
                  >
                    <span>
                      {filtersOpen ? "Hide filters" : "Show filters"}
                      {activeFilterCount > 0 && (
                        <span className="ml-2 font-medium text-slate-500">
                          ({activeFilterCount} applied)
                        </span>
                      )}
                    </span>

                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`size-4 shrink-0 text-slate-500 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  <div
                    id="history-filter-fields"
                    className={`${filtersOpen ? "mt-4 block" : "hidden"} sm:mt-0 sm:block`}
                  >
                  {/* Date / time period: same tab style as the status filter */}
                  <div className="mb-4">
                    <span className={labelClass}>Date / time period</span>

                    <div
                      role="group"
                      aria-label="Date / time period"
                      className="flex gap-2"
                    >
                      {["Recent", "This month"].map((option) => {
                        const active = period === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setPeriod(option)}
                            className={`flex min-h-11 flex-1 items-center justify-center rounded-none! border px-4 py-2.5 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 sm:flex-none sm:px-8 ${
                              active
                                ? "border-[#123D73] bg-blue-50 text-[#123D73]"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    {[
                      {
                        id: "history-barangay",
                        label: "Barangay",
                        value: barangay,
                        set: setBarangay,
                        options: ["All Barangays", ...barangays],
                      },
                      {
                        id: "history-type",
                        label: "Incident type",
                        value: type,
                        set: setType,
                        options: ["All Incident Types", ...types],
                      },
                    ].map((filter) => (
                      <div key={filter.id} className="min-w-0">
                        <span className={labelClass}>{filter.label}</span>

                        {/* Same searchable dropdown as the Submit Report form */}
                        <SearchSelect
                          value={filter.value}
                          onChange={filter.set}
                          ariaLabel={filter.label}
                          placeholder={filter.label}
                          searchPlaceholder={`Search ${filter.label.toLowerCase()}...`}
                          emptyText="No matches found."
                          options={filter.options.map((option) => ({
                            value: option,
                            label: option,
                          }))}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-4 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
                    <label className="flex cursor-pointer items-start gap-4 text-base text-slate-700">
                      <input
                        type="checkbox"
                        checked={etrOnly}
                        onChange={(event) => setEtrOnly(event.target.checked)}
                        className="mt-1 size-5 shrink-0 accent-[#123D73]"
                      />

                      <span>
                        <span className="block font-semibold text-slate-800">
                          Show incidents with an estimated restoration time
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-slate-500">
                          Only show eligible records that include a
                          restoration estimate.
                        </span>
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={reset}
                      className={secondaryButtonClass}
                    >
                      Reset filters
                    </button>
                  </div>
                  </div>
                </div>
              </Panel>

              {/* INCIDENT RECORDS */}
              <Panel
                id="etr-tracking"
                title="Incident records"
                description={`${
                  period === "Recent" ? "Recent records" : "This month's records"
                }, newest first. Select a record to view its details.`}
                right={
                  filtered.length === 0
                    ? "0 reports found"
                    : `${pageStart + 1}–${
                        pageStart + pagedReports.length
                      } of ${filtered.length}`
                }
                liveRegion
              >
                {filtered.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {pagedReports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => setSelected(report)}
                        aria-label={`View details for ${report.type}, ${report.status}, ${getReportSourceDisplay(report)}`}
                        className="history-record-row group grid w-full min-w-0 gap-5 rounded-none! border-l-4 border-l-transparent px-5 py-5 text-left transition-colors hover:border-l-[#123D73] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#123D73] sm:px-6 lg:grid-cols-[190px_minmax(0,1fr)_auto] lg:items-center"
                      >
                        {/* Date and time */}
                        <div className="min-w-0 lg:border-r lg:border-slate-200 lg:pr-5">
                          <p className="text-base font-semibold text-slate-800">
                            {report.date}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {report.time}
                          </p>
                        </div>

                        {/* Report details */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="wrap-break-word text-lg font-bold text-[#123D73]">
                              {report.type}
                            </h3>

                            <StatusBadge status={report.status} />

                            {isResponding(report) && (
                              // Same pill style as the Active / Monitoring badges.
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                Responding
                              </span>
                            )}
                          </div>

                          <p className="mt-2.5 flex items-start gap-3 text-base font-semibold text-slate-800">
                            <Icon
                              name="map-pin"
                              className="mt-1 size-4 shrink-0 text-[#123D73]"
                            />
                            <span className="wrap-break-word">
                              {getReportSourceDisplay(report)}
                            </span>
                          </p>

                          <p className="mt-2.5 wrap-break-word text-base leading-7 text-slate-600">
                            <span className="font-semibold text-slate-700">
                              {getReportAffectedLabel(report)}:
                            </span>{" "}
                            {getReportAffectedAreas(report).join(", ") ||
                              "No affected area recorded."}
                          </p>

                          <p className="mt-1.5 wrap-break-word text-base leading-7 text-slate-600">
                            <span className="font-semibold text-slate-700">
                              Estimated restoration:
                            </span>{" "}
                            {formatRestorationEstimate(report) ||
                              "Not provided in this record."}
                          </p>

                          <p className="mt-1.5 wrap-break-word text-base leading-7 text-slate-600">
                            <span className="font-semibold text-slate-700">
                              Latest response:
                            </span>{" "}
                            {report.latest || "No update recorded yet."}
                          </p>
                        </div>

                        {/* View details */}
                        <span className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-base font-semibold text-[#123D73] sm:justify-end lg:border-0 lg:pt-0">
                          <span className="lg:hidden">View report details</span>

                          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-300 bg-white text-[#123D73] transition-colors group-hover:border-[#123D73] group-hover:bg-[#E8EEF6]">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="size-5"
                              aria-hidden="true"
                            >
                              <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center sm:px-8">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center border border-blue-100 bg-blue-50 text-[#123D73]">
                      <Icon name="search" className="size-5" />
                    </span>

                    <h3 className="mt-4 text-lg font-bold text-slate-800">
                      No reports found
                    </h3>

                    <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-slate-600">
                      No incident records match your current filters. Try
                      changing your selections or resetting the filters.
                    </p>

                    <button
                      type="button"
                      onClick={reset}
                      className={`${secondaryButtonClass} mt-5`}
                    >
                      Reset filters
                    </button>
                  </div>
                )}

                {totalPages > 1 && (
                  <nav
                    aria-label="Incident record pages"
                    className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-6"
                  >
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="min-h-11 rounded-none! border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
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
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="min-h-11 rounded-none! border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                    >
                      Next
                    </button>
                  </nav>
                )}

                {filtered.length > 0 && (
                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                    <p className="text-sm leading-6 text-slate-500">
                      Public information only. Select an incident record for
                      its available details and restoration estimate.
                    </p>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </main>

      <HistoryReportModal report={selected} onClose={closeReport} />
    </>
  );
}

/**
 * Incident detail modal used only by Incident History.
 * Kept in this file so History no longer imports ./report-modal.
 */
function HistoryReportModal({
  report,
  onClose,
}: {
  report: Report | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogAccessibility(Boolean(report), onClose, dialogRef);

  if (!report) return null;

  return (
    <div className="portal-modal-backdrop fixed inset-0 z-2000 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-950/50 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close details"
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-detail-title"
        aria-describedby="incident-detail-description"
        tabIndex={-1}
        className="portal-modal-panel relative z-10 max-h-[calc(100dvh-0.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain border border-[#4438A8] bg-white shadow-2xl sm:max-h-[92vh]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-indigo-100">Incident History</p>
            <h2
              id="incident-detail-title"
              className="mt-2 wrap-break-word text-xl font-bold text-white sm:text-2xl"
            >
              {report.type}
            </h2>
            <p className="mt-2 wrap-break-word text-sm text-indigo-100">
              {getReportSourceDisplay(report)}
            </p>
          </div>

          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center border border-white/40 bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
            onClick={onClose}
            aria-label="Close incident details"
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={report.status} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {report.type}
            </span>
          </div>

          <div className="border border-slate-300 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {getReportAffectedLabel(report)}
            </p>
            <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-800">
              {getReportAffectedAreas(report).join(", ") ||
                "No affected area was specified in this record."}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Description
            </p>
            <p
              id="incident-detail-description"
              className="mt-2 text-sm leading-6 text-slate-700"
            >
              {report.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Estimated restoration time
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatRestorationEstimate(report) ||
                "Not provided in this record."}
            </p>
          </div>

          <div className="grid gap-4 border border-slate-300 bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Reported</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {report.date} · {report.time}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Latest update</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">
                {report.latest}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-wider text-slate-500">
              Response progress
            </p>
            <div className="overflow-x-auto pb-2">
              <Progress step={report.progress} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}