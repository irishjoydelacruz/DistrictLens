"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-log";

type ReportStatus = "pending" | "verified" | "rejected";

type CustomerReport = {
  id: string;
  tracking_number: string;
  customer_name: string;
  contact_number: string;
  barangay: string;
  address: string | null;
  incident_type: string;
  description: string;
  status: ReportStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  incident_id: number | null;
  created_at: string;
  possible_duplicate_of: string | null;
  duplicate_resolution: "same" | "different" | null;
};

// What Create Report receives to pre-fill a new report from a customer report.
export type CustomerReportPrefill = {
  customerReportId: string;
  trackingNumber: string;
  barangay: string;
  address: string;
  incidentType: string;
  description: string;
};

type Dialog = { type: "verify" | "reject"; report: CustomerReport } | null;

const tabs: { key: ReportStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

const statusTone: Record<ReportStatus, { label: string; badge: string }> = {
  pending: {
    label: "Pending",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  verified: {
    label: "Verified",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  rejected: {
    label: "Rejected",
    badge: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

/* SHARED STYLES (same look as Create Report) */

const fieldClass =
  "mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

const primaryButtonClass =
  "bg-[#123D73] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#0D2F59] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "inline-flex w-fit items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:opacity-50";

// Smaller buttons for the actions inside an opened report.
const compactPrimaryClass =
  "bg-[#123D73] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0D2F59] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 disabled:cursor-not-allowed disabled:opacity-50";

const compactRejectClass =
  "border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200";

const compactSecondaryClass =
  "border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:opacity-50";

// Column layout shared by the list header and every report row (desktop).
const rowGrid =
  "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_1rem]";

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Banner({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-6 sm:px-8">
      <p className="text-sm font-bold text-indigo-100">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
      <p className="mt-2 text-base text-indigo-100">{description}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 wrap-break-word text-base font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}

export default function CustomerReports({
  onPendingChange,
  onCreateReport,
}: {
  // Lets the navigation badge stay in sync with this page.
  onPendingChange?: (count: number) => void;
  // Opens Create Report with the customer's details already filled in.
  onCreateReport?: (prefill: CustomerReportPrefill) => void;
}) {
  const [reports, setReports] = useState<CustomerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<ReportStatus>("pending");
  // The report that is opened in the list (one at a time).
  const [openId, setOpenId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("customer_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Unable to load customer reports:", error);
      setLoadError("Unable to load customer reports. Please try again.");
    } else {
      const list = (data ?? []) as CustomerReport[];
      setReports(list);
      onPendingChange?.(list.filter((item) => item.status === "pending").length);
      setLoadError("");
    }

    setLoading(false);
  }, [onPendingChange]);

  // Load on open, then check for new reports every 30 seconds.
  useEffect(() => {
    void load();

    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function closeDialog() {
    if (busyId) return;
    setDialog(null);
    setReason("");
  }

  async function review(
    report: CustomerReport,
    status: "verified" | "rejected",
    rejectionReason?: string
  ) {
    setBusyId(report.id);
    setNotice("");
    setNoticeIsError(false);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Only a report that is still pending can be reviewed, so two staff
      // members cannot overwrite each other's decision.
      const { data, error } = await supabase
        .from("customer_reports")
        .update({
          status,
          rejection_reason: status === "rejected" ? rejectionReason : null,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", report.id)
        .eq("status", "pending")
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        setNotice(
          "This report was already reviewed by someone else. The list was refreshed."
        );
        setNoticeIsError(true);
      } else {
        setNotice(
          `Report ${report.tracking_number} was marked as ${status}.`
        );
        await logActivity({
          action:
            status === "verified"
              ? "customer_report.verify"
              : "customer_report.reject",
          entityType: "customer_report",
          entityId: report.tracking_number,
          details: `${status === "verified" ? "verified" : "rejected"} customer report ${report.tracking_number}.`,
        });
      }

      setDialog(null);
      setReason("");
      await load();
    } catch (error) {
      console.error("Unable to review customer report:", error);
      setNotice("Unable to save your decision. Please try again.");
      setNoticeIsError(true);
    } finally {
      setBusyId(null);
    }
  }

  // "Same Incident" rejects the new report as a duplicate of the existing one.
  // "Different Incident" keeps it pending and clears the warning.
  async function resolveDuplicate(report: CustomerReport, same: boolean) {
    setBusyId(report.id);
    setNotice("");
    setNoticeIsError(false);

    try {
      const supabase = createClient();
      const existing = reports.find(
        (item) => item.id === report.possible_duplicate_of
      );

      let payload: Record<string, unknown> = {
        duplicate_resolution: "different",
      };

      if (same) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        payload = {
          duplicate_resolution: "same",
          status: "rejected",
          rejection_reason: `Duplicate of report ${
            existing?.tracking_number ?? "an existing report"
          }.`,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        };
      }

      const { data, error } = await supabase
        .from("customer_reports")
        .update(payload)
        .eq("id", report.id)
        .eq("status", "pending")
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        setNotice(
          "This report was already reviewed by someone else. The list was refreshed."
        );
        setNoticeIsError(true);
      } else {
        setNotice(
          same
            ? `Report ${report.tracking_number} was marked as a duplicate.`
            : `Report ${report.tracking_number} was kept as a separate incident.`
        );
        await logActivity({
          action: same ? "customer_report.reject" : "customer_report.review",
          entityType: "customer_report",
          entityId: report.tracking_number,
          details: same
            ? `marked customer report ${report.tracking_number} as a duplicate.`
            : `kept customer report ${report.tracking_number} as a separate incident.`,
        });
      }

      await load();
    } catch (error) {
      console.error("Unable to resolve duplicate:", error);
      setNotice("Unable to save your decision. Please try again.");
      setNoticeIsError(true);
    } finally {
      setBusyId(null);
    }
  }

  const counts: Record<ReportStatus, number> = {
    pending: reports.filter((item) => item.status === "pending").length,
    verified: reports.filter((item) => item.status === "verified").length,
    rejected: reports.filter((item) => item.status === "rejected").length,
  };

  const visible = reports.filter((item) => item.status === tab);

  const reasonTooShort = reason.trim().length < 5;

  return (
    <>
      {/* CONFIRMATION DIALOG */}
      {dialog && (
        <div
          className="fixed inset-0 z-1100 flex items-center justify-center bg-slate-950/55 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-md border border-slate-300 bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
          >
            <h2
              id="review-dialog-title"
              className="text-xl font-bold text-[#123D73]"
            >
              {dialog.type === "verify"
                ? "Verify this report?"
                : "Reject this report?"}
            </h2>

            <p className="mt-2 text-base leading-6 text-slate-600">
              {dialog.type === "verify"
                ? `Report ${dialog.report.tracking_number} will be marked as verified. The customer will see this when they track the report.`
                : `Report ${dialog.report.tracking_number} will be marked as rejected. The customer will see the reason you enter below.`}
            </p>

            {dialog.type === "reject" && (
              <div className="mt-4">
                <label
                  htmlFor="reject-reason"
                  className="block text-sm font-bold text-slate-800"
                >
                  Reason for rejection
                </label>
                <textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="e.g. Duplicate of an existing report, or not a water service concern."
                  className={fieldClass}
                />
                <p className="mt-2 text-sm text-slate-500">
                  {reason.length}/300 (at least 5 characters)
                </p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDialog}
                disabled={busyId !== null}
                className={`${secondaryButtonClass} px-4`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  dialog.type === "verify"
                    ? void review(dialog.report, "verified")
                    : void review(dialog.report, "rejected", reason.trim())
                }
                disabled={
                  busyId !== null ||
                  (dialog.type === "reject" && reasonTooShort)
                }
                className={`${primaryButtonClass} px-4`}
              >
                {busyId
                  ? "Saving..."
                  : dialog.type === "verify"
                    ? "Yes, verify"
                    : "Yes, reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 border border-[#4438A8] bg-white p-6 text-slate-900 sm:p-8">
        <Banner
          eyebrow="Public submissions"
          title="Customer Reports"
          description="Review reports sent by residents through the public portal. Verify the valid ones and reject the rest."
        />

        {/* TABS + REFRESH */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Phone: the 3 tabs share one line (equal width).
              sm and up: normal size, width follows the content. */}
          <div
            className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2"
            role="tablist"
            aria-label="Customer report status"
          >
            {tabs.map((item) => {
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(item.key);
                    setOpenId(null);
                  }}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border px-2 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:gap-2 sm:px-5 ${
                    active
                      ? "border-[#123D73] bg-[#123D73] text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                  <span
                    className={`min-w-5 px-1 py-0.5 text-center text-xs font-bold sm:min-w-6 sm:px-1.5 ${
                      active
                        ? "bg-white/20 text-white"
                        : item.key === "pending" && counts.pending > 0
                          ? "bg-red-600 text-white"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {counts[item.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            className={smallButtonClass}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {notice && (
          <div
            role={noticeIsError ? "alert" : "status"}
            className={`border p-4 text-sm ${
              noticeIsError
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {notice}
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {loadError}
          </div>
        )}

        {/* LIST */}
        {loading ? (
          <p className="text-base text-slate-500">Loading customer reports...</p>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-lg font-bold text-[#123D73]">
              {tab === "pending"
                ? "No pending reports"
                : tab === "verified"
                  ? "No verified reports"
                  : "No rejected reports"}
            </p>
            <p className="mt-2 text-base text-slate-600">
              {tab === "pending"
                ? "New reports from the public portal will appear here."
                : "Reports you review will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-300 border border-slate-300 bg-white">
            {/* Column titles (desktop) */}
            <div
              aria-hidden="true"
              className={`hidden gap-x-4 bg-slate-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid ${rowGrid}`}
            >
              <span>Report</span>
              <span>Barangay</span>
              <span>Problem</span>
              <span>Customer</span>
              <span className="text-center">Status</span>
              <span />
            </div>

            {visible.map((report) => {
              const isOpen = openId === report.id;
              const panelId = `customer-report-${report.id}`;
              const tone = statusTone[report.status];

              const hasDuplicateWarning =
                report.status === "pending" &&
                !!report.possible_duplicate_of &&
                !report.duplicate_resolution;

              const existingReport = hasDuplicateWarning
                ? reports.find((item) => item.id === report.possible_duplicate_of)
                : undefined;

              return (
                <article key={report.id}>
                  {/* Collapsed row: click to open or close the details */}
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : report.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5 ${rowGrid} ${
                      isOpen ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    <div className="col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto">
                      <p className="break-all text-base font-bold text-[#123D73]">
                        {report.tracking_number}
                      </p>
                      {hasDuplicateWarning && (
                        <span className="mt-1 inline-flex items-center gap-1 border border-yellow-400 bg-yellow-100 px-1.5 py-0.5 text-xs font-semibold text-yellow-900">
                          <WarningIcon className="h-3.5 w-3.5 text-yellow-600" />
                          Possible duplicate
                        </span>
                      )}
                      <p className="text-xs text-slate-500">
                        {formatDate(report.created_at)}
                      </p>
                    </div>

                    <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600 md:contents">
                      <span className="md:truncate md:text-base md:text-slate-900">
                        {report.barangay}
                      </span>
                      <span className="md:truncate md:text-base md:text-slate-900">
                        {report.incident_type}
                      </span>
                      <span className="md:truncate md:text-base md:text-slate-900">
                        {report.customer_name}
                      </span>
                    </div>

                    <div className="col-start-2 row-start-1 flex items-center gap-3 md:contents">
                      <span
                        className={`inline-flex w-24 items-center justify-center border px-2 py-1 text-xs font-semibold md:w-full md:text-sm ${tone.badge}`}
                      >
                        {tone.label}
                      </span>
                      <svg
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                          isOpen ? "rotate-180" : ""
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
                    </div>
                  </button>

                  {/* Opened details */}
                  {isOpen && (
                    <div
                      id={panelId}
                      className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5"
                    >
                      {/* Possible duplicate warning */}
                      {hasDuplicateWarning && (
                        <div
                          role="alert"
                          className="mb-4 border-y border-r border-l-4 border-y-yellow-300 border-r-yellow-300 border-l-yellow-500 bg-yellow-50 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <WarningIcon className="mt-0.5 h-6 w-6 shrink-0 text-yellow-600" />

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold uppercase tracking-wide text-yellow-900">
                                Possible duplicate report
                              </p>
                              <p className="mt-1 text-sm text-yellow-900">
                                A similar report was found in the system.
                                Please review both submissions before
                                approving.
                              </p>

                              {existingReport ? (
                                <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm text-slate-800 sm:grid-cols-2">
                                  <div>
                                    <dt className="font-semibold">
                                      Existing report
                                    </dt>
                                    <dd>{existingReport.tracking_number}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold">Status</dt>
                                    <dd>
                                      {statusTone[existingReport.status].label}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold">Type</dt>
                                    <dd>{existingReport.incident_type}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold">Barangay</dt>
                                    <dd>{existingReport.barangay}</dd>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <dt className="font-semibold">Location</dt>
                                    <dd>
                                      {existingReport.address ||
                                        "Not provided."}
                                    </dd>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <dt className="font-semibold">Submitted</dt>
                                    <dd>
                                      {formatDate(existingReport.created_at)}
                                    </dd>
                                  </div>
                                </dl>
                              ) : (
                                <p className="mt-2 text-sm text-yellow-900">
                                  The existing report is not in the current
                                  list.
                                </p>
                              )}

                              <div className="mt-4 flex flex-wrap justify-end gap-3">
                                <button
                                  type="button"
                                  disabled={busyId !== null}
                                  onClick={() =>
                                    void resolveDuplicate(report, false)
                                  }
                                  className={compactSecondaryClass}
                                >
                                  Different Incident
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId !== null}
                                  onClick={() =>
                                    void resolveDuplicate(report, true)
                                  }
                                  className={compactPrimaryClass}
                                >
                                  Same Incident
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                        <Detail
                          label="Contact number"
                          value={report.contact_number}
                        />
                        <Detail
                          label="Address or landmark"
                          value={report.address || "Not provided."}
                        />
                        <Detail
                          label="Description"
                          value={report.description}
                          wide
                        />

                        {report.status === "rejected" && (
                          <Detail
                            label="Reason for rejection"
                            value={
                              report.rejection_reason || "No reason recorded."
                            }
                            wide
                          />
                        )}

                        {report.status !== "pending" && (
                          <Detail
                            label="Reviewed"
                            value={formatDate(report.reviewed_at)}
                          />
                        )}

                        {report.status === "verified" && report.incident_id && (
                          <Detail
                            label="Incident report"
                            value={`Created (Incident ID ${report.incident_id})`}
                          />
                        )}
                      </div>

                      {report.status === "pending" && (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setReason("");
                              setDialog({ type: "reject", report });
                            }}
                            className={compactRejectClass}
                          >
                            Reject
                          </button>

                          <button
                            type="button"
                            onClick={() => setDialog({ type: "verify", report })}
                            className={compactPrimaryClass}
                          >
                            Verify
                          </button>
                        </div>
                      )}

                      {report.status === "verified" &&
                        !report.incident_id &&
                        onCreateReport && (
                          <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                            <button
                              type="button"
                              onClick={() =>
                                onCreateReport({
                                  customerReportId: report.id,
                                  trackingNumber: report.tracking_number,
                                  barangay: report.barangay,
                                  address: report.address ?? "",
                                  incidentType: report.incident_type,
                                  description: report.description,
                                })
                              }
                              className={compactPrimaryClass}
                            >
                              Create Report
                            </button>
                          </div>
                        )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}