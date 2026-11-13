"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Icon } from "../components/icons"
import Header from "../components/header"
import { Button } from "../components/ui"
import { StatusBadge } from "../components/status-badge"
import { PageIntro } from "../components/page-intro"
import { ReportModal } from "../components/report-modal"
import {
  barangays,
  formatRestorationEstimate,
  getReportAffectedAreas,
  getReportAffectedLabel,
  getReportSourceDisplay,
  reports,
  reportAffectsBarangay,
  type Report,
} from "../data/mock-data"

export default function HistoryPage() {
  const router = useRouter()
  const [barangay, setBarangay] = useState("All Barangays")
  const [status, setStatus] = useState("All Statuses")
  const [type, setType] = useState("All Incident Types")
  const [period, setPeriod] = useState("Any time")
  const [etrOnly, setEtrOnly] = useState(false)
  const [selected, setSelected] = useState<Report | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reportId = Number(params.get("report"))
    const statusFilter = params.get("status")
    // Sync one-time URL shortcut state into the existing interactive filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtrOnly(params.get("view") === "etr")
    if (["Active", "Monitoring", "Normal"].includes(statusFilter ?? "")) {
      setStatus(statusFilter === "Normal" ? "Normal" : statusFilter!)
    }
    if (!Number.isFinite(reportId) || reportId <= 0) return
    const report = reports.find((item) => item.id === reportId)
    // Resolve the existing deep-link after hydration so direct incident links still open the detail modal.
    if (report) setSelected(report)
  }, [])

  const filtered = useMemo(
    () =>
      reports.filter(
        (report) =>
          (barangay === "All Barangays" || reportAffectsBarangay(report, barangay)) &&
          (status === "All Statuses" || report.status === status) &&
          (type === "All Incident Types" || report.type === type) &&
          (!etrOnly || (report.status !== "Normal" && Boolean(report.restoration))) &&
          (period === "Any time" ||
            (period === "Today"
              ? report.date === "May 23, 2025"
              : report.date !== "May 23, 2025")),
      ),
    [barangay, status, type, period, etrOnly],
  )

  const reset = () => {
    setBarangay("All Barangays")
    setStatus("All Statuses")
    setType("All Incident Types")
    setPeriod("Any time")
    setEtrOnly(false)
  }

  const types = Array.from(new Set(reports.map((report) => report.type)))

  const closeReport = () => {
    setSelected(null)
    if (new URLSearchParams(window.location.search).has("report")) {
      router.replace("/history", { scroll: false })
    }
  }

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
      <PageIntro
        eyebrow="Public records"
        title="Incident History"
        text="Review water-service incident records and service updates available in this portal."
      />

      <section id="reports" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12 anchor-target">
        <div className="history-filter-panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Icon name="search" className="size-4 text-blue-700" />

            <h2 className="text-sm font-bold text-slate-900">
              Filter public reports
            </h2>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Barangay",
                value: barangay,
                set: setBarangay,
                options: ["All Barangays", ...barangays],
              },
              {
                label: "Status",
                value: status,
                set: setStatus,
                options: ["All Statuses", "Active", "Monitoring", "Normal"],
              },
              {
                label: "Incident type",
                value: type,
                set: setType,
                options: ["All Incident Types", ...types],
              },
              {
                label: "Date / time period",
                value: period,
                set: setPeriod,
                options: ["Any time", "Today", "Earlier"],
              },
            ].map((filter) => (
              <label key={filter.label}>
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  {filter.label}
                </span>

                <select
                  value={filter.value}
                  onChange={(event) => filter.set(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {filter.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div id="etr-tracking" className="mt-8 flex items-center justify-between anchor-target">
          <p className="text-sm font-bold text-slate-900" aria-live="polite" aria-atomic="true">
            {filtered.length}{" "}
            {filtered.length === 1 ? "report" : "reports"}
          </p>

          <Button variant="ghost" onClick={reset} className="text-xs">
            Reset filters
          </Button>
        </div>

        {filtered.length ? (
          <div className="history-report-list mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {filtered.map((report, index) => (
              <button
                key={report.id}
                onClick={() => setSelected(report)}
                aria-label={`View details for ${report.type}, ${report.status}, ${getReportSourceDisplay(report)}`}
                className={`history-report-row grid w-full gap-3 p-5 text-left sm:grid-cols-[164px_minmax(0,1fr)_auto] sm:items-center ${
                  index ? "border-t border-slate-100" : ""
                }`}
              >
                <div className="sm:pr-2">
                  <p className="text-sm font-bold text-slate-800">
                    {report.date}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {report.time}
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="wrap-break-word font-bold text-slate-950">
                      {report.type}
                    </p>

                    <StatusBadge status={report.status} />
                  </div>

                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    {getReportSourceDisplay(report)}
                  </p>

                  <p className="mt-1 wrap-break-word text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">{getReportAffectedLabel(report)}:</span>{" "}
                    {getReportAffectedAreas(report).join(", ")}
                  </p>

                  <p className="mt-2 wrap-break-word text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Estimated restoration time:</span>{" "}
                    {formatRestorationEstimate(report) || "Not provided in this record."}
                  </p>
                </div>

                <span className="hidden size-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 sm:flex">
                  <Icon name="chevron" className="size-4" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
              <Icon name="search" />
            </span>

            <h2 className="mt-4 text-lg font-bold text-slate-900">
              No reports found
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Try changing or resetting your filters.
            </p>

            <Button
              variant="secondary"
              onClick={reset}
              className="mt-5"
            >
              Reset filters
            </Button>
          </div>
        )}
      </section>
      </main>

      <ReportModal
        report={selected}
        onClose={closeReport}
      />
    </>
  )
}