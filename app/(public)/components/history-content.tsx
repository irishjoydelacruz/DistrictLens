"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

// Shared styles (same look as the Dashboard, Analytics, and Create Report pages).
// The "!" on rounded-none overrides the portal CSS that rounds every button.
const labelClass = "mb-2 block text-sm font-bold text-slate-800";

const selectClass =
  "min-h-12 w-full appearance-none border border-slate-300 bg-white px-4 py-3 pr-11 text-base text-slate-800 transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

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
      className="min-w-0 overflow-hidden border border-slate-300 bg-white"
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
  const [period, setPeriod] = useState("Any time");
  const [etrOnly, setEtrOnly] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);

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

  const types = useMemo(
    () => Array.from(new Set(reports.map((report) => report.type))),
    [reports],
  );

  const filtered = useMemo(
    () =>
      reports.filter(
        (report) =>
          (barangay === "All Barangays" ||
            reportAffectsBarangay(report, barangay)) &&
          (status === "All Statuses" || report.status === status) &&
          (type === "All Incident Types" || report.type === type) &&
          (!etrOnly ||
            (report.status !== "Normal" && Boolean(report.restoration))) &&
          (period === "Any time" ||
            (period === "Today"
              ? report.date === "May 23, 2025"
              : report.date !== "May 23, 2025")),
      ),
    [reports, barangay, status, type, period, etrOnly],
  );

  const reset = () => {
    setBarangay("All Barangays");
    setStatus("All Statuses");
    setType("All Incident Types");
    setPeriod("Any time");
    setEtrOnly(false);
  };

  const closeReport = () => setSelected(null);

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

            <div id="reports" className="space-y-5">
              {/* SEARCH AND FILTERS */}
              <Panel
                title="Search and filters"
                description="Narrow the records by location, status, type, or date."
              >
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      {
                        id: "history-barangay",
                        label: "Barangay",
                        value: barangay,
                        set: setBarangay,
                        options: ["All Barangays", ...barangays],
                      },
                      {
                        id: "history-status",
                        label: "Status",
                        value: status,
                        set: setStatus,
                        options: [
                          "All Statuses",
                          "Active",
                          "Monitoring",
                          "Normal",
                        ],
                      },
                      {
                        id: "history-type",
                        label: "Incident type",
                        value: type,
                        set: setType,
                        options: ["All Incident Types", ...types],
                      },
                      {
                        id: "history-period",
                        label: "Date / time period",
                        value: period,
                        set: setPeriod,
                        options: ["Any time", "Today", "Earlier"],
                      },
                    ].map((filter) => (
                      <div key={filter.id} className="min-w-0">
                        <label htmlFor={filter.id} className={labelClass}>
                          {filter.label}
                        </label>

                        <div className="relative">
                          <select
                            id={filter.id}
                            value={filter.value}
                            onChange={(event) =>
                              filter.set(event.target.value)
                            }
                            className={selectClass}
                          >
                            {filter.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>

                          <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-500"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
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
              </Panel>

              {/* INCIDENT RECORDS */}
              <Panel
                id="etr-tracking"
                title="Incident records"
                description="Select a record to view its details."
                right={`${filtered.length} ${
                  filtered.length === 1 ? "report" : "reports"
                } found`}
                liveRegion
              >
                {filtered.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {filtered.map((report) => (
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