"use client"

import { useRef } from "react"

import {
  formatRestorationEstimate,
  getReportAffectedAreas,
  getReportAffectedLabel,
  getReportSourceDisplay,
  type Report,
} from "../data/mock-data"

import { Icon } from "./icons"
import { Button } from "./ui"
import { SectionLabel } from "./section-label"
import { StatusBadge } from "./status-badge"
import { Progress } from "./progress"
import { useDialogAccessibility } from "./use-dialog-accessibility"

export function ReportModal({
  report,
  onClose,
}: {
  report: Report | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  useDialogAccessibility(Boolean(report), onClose, dialogRef)

  if (!report) return null

  return (
    <div className="portal-modal-backdrop fixed inset-0 z-2000 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-950/40 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:items-center sm:p-6">
      <button
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
        className="portal-modal-panel relative z-10 max-h-[calc(100dvh-0.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <SectionLabel>Incident detail</SectionLabel>

            <h2 id="incident-detail-title" className="mt-1 wrap-break-word text-xl font-bold text-slate-950">
              {report.type}
            </h2>

            <p className="mt-1 text-sm font-medium text-slate-500">
              {getReportSourceDisplay(report)}
            </p>
          </div>

          <Button
            variant="ghost"
            className="size-11! min-h-11! p-0!"
            onClick={onClose}
            aria-label="Close incident details"
          >
            <Icon name="close" className="size-4" />
          </Button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={report.status} />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {report.type}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {getReportAffectedLabel(report)}
            </p>
            <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-800">
              {getReportAffectedAreas(report).join(", ") || "No affected area was specified in this record."}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Description
            </p>

            <p id="incident-detail-description" className="mt-2 text-sm leading-6 text-slate-700">
              {report.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Estimated restoration time
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatRestorationEstimate(report) || "Not provided in this record."}
            </p>
          </div>

          <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
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
  )
}