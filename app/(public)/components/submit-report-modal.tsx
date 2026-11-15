"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"

import { createClient } from "@/lib/supabase/client"
import { barangays } from "../data/mock-data"
import { useDialogAccessibility } from "./use-dialog-accessibility"

// Same incident types as the admin Create Report page, so a verified report
// can be pre-filled there. "Not sure" is ignored when pre-filling.
const INCIDENT_TYPES = [
  "Line Rupture",
  "Water Leakage",
  "Low Water Pressure",
  "No Water Supply",
  "Water Service Interruption",
  "Water Quality Issue",
  "Not sure",
]

type Tab = "submit" | "track"
type ReportStatus = "pending" | "verified" | "rejected"

type TrackResult = {
  tracking_number: string
  status: ReportStatus
  rejection_reason: string | null
  barangay: string
  incident_type: string
  created_at: string
}

const barangayOptions = [...barangays].sort((a, b) => a.localeCompare(b))

// UI-only class tokens, matching the admin Submissions page.
const inputClass =
  "w-full rounded-none border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
const labelClass = "mb-2 block text-sm font-bold text-slate-800"
const btnSecondary =
  "rounded-none border border-slate-300 bg-white px-5 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
const btnPrimary =
  "rounded-none bg-[#123D73] px-5 py-3 text-base font-medium text-white transition-colors hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50"

const statusInfo: Record<
  ReportStatus,
  { label: string; badge: string; text: string }
> = {
  pending: {
    label: "Pending review",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    text: "Your report was received and is waiting for review by Tanza Water District staff.",
  },
  verified: {
    label: "Verified",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    text: "Your report was reviewed and verified by Tanza Water District staff.",
  },
  rejected: {
    label: "Not accepted",
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    text: "Your report was reviewed but could not be accepted.",
  },
}

type SelectOption = { value: string; label: string }

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
  )
}

// Searchable dropdown, same behavior as the Create Report page: it always
// opens downward, and the list renders in a portal so the modal never clips it.
function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
  invalid = false,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  ariaLabel: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [pos, setPos] = useState<{
    left: number
    width: number
    top: number
    maxHeight: number
  } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value)
  const display = selected?.label ?? ""
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function toggle() {
    if (open) {
      setOpen(false)
      setSearch("")
      return
    }

    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return

    const width = rect.width
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    // Always open below the field; shrink the list if there is little room.
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const maxHeight = Math.min(300, Math.max(spaceBelow, 200))

    setPos({ left, width, top: rect.bottom + 4, maxHeight })
    setSearch("")
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    function close() {
      setOpen(false)
      setSearch("")
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return
      }
      close()
    }

    // Capture phase + stopPropagation so Escape closes only the list,
    // not the whole modal behind it.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        close()
      }
    }

    function onScroll(event: Event) {
      if (listRef.current?.contains(event.target as Node)) return
      close()
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", close)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", close)
    }
  }, [open])

  function pick(next: string) {
    onChange(next)
    setOpen(false)
    setSearch("")
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
        className={`flex w-full items-center justify-between rounded-none border bg-white px-4 py-3 text-left text-base text-slate-800 shadow-sm transition-colors focus:outline-none focus:ring-2 ${
          invalid
            ? "border-red-500 hover:border-red-600 focus:border-red-600 focus:ring-red-500/20"
            : "border-slate-300 hover:border-[#123D73] focus:border-[#123D73] focus:ring-[#123D73]/20"
        }`}
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
                  setOpen(false)
                  setSearch("")
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>

            <div
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-y-auto p-1"
            >
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => pick("")}
                className={`w-full px-3 py-2.5 text-left text-base ${
                  !value
                    ? "bg-blue-50 font-semibold text-[#123D73]"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {placeholder}
              </button>

              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => pick(option.value)}
                  className={`w-full px-3 py-2.5 text-left text-base transition-colors ${
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
  )
}

function SubmitReportModal({
  open,
  onClose,
  initialTab = "submit",
}: {
  open: boolean
  onClose: () => void
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [barangayList, setBarangayList] = useState<string[]>(barangayOptions)

  // Submit form
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [barangay, setBarangay] = useState("")
  const [incidentType, setIncidentType] = useState("")
  const [address, setAddress] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [copied, setCopied] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  // Track form
  const [trackingInput, setTrackingInput] = useState("")
  const [trackBusy, setTrackBusy] = useState(false)
  const [trackError, setTrackError] = useState("")
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null)

  const dialogRef = useRef<HTMLElement>(null)

  useDialogAccessibility(open, onClose, dialogRef)

  // Use the same barangay names as the admin Create Report page (GeoJSON),
  // so a verified report matches its barangay exactly. Falls back to the
  // portal list if the file cannot be loaded.
  useEffect(() => {
    if (!open) return
    let active = true

    const loadBarangays = async () => {
      try {
        const response = await fetch("/data/tanza-barangays.geojson")
        if (!response.ok) return
        const data = await response.json()
        const names: string[] = (data.features ?? [])
          .map(
            (feature: { properties?: Record<string, string> }) =>
              feature.properties?.brgy_name ||
              feature.properties?.barangay ||
              feature.properties?.Barangay ||
              feature.properties?.name ||
              "",
          )
          .filter(Boolean)

        if (active && names.length > 0) {
          setBarangayList(
            [...new Set(names)].sort((a, b) => a.localeCompare(b)),
          )
        }
      } catch {
        // Keep the fallback list.
      }
    }

    void loadBarangays()
    return () => {
      active = false
    }
  }, [open])

  const resetForm = () => {
    setName("")
    setContact("")
    setBarangay("")
    setIncidentType("")
    setAddress("")
    setDescription("")
    setError("")
    setTrackingNumber("")
    setCopied(false)
    setAttempted(false)
    setTurnstileToken(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    // The searchable dropdowns are not native selects, so check them here.
    if (!barangay || !incidentType) {
      setAttempted(true)
      setError(
        !barangay
          ? "Please select your barangay."
          : "Please select the type of problem.",
      )
      return
    }

    if (!turnstileToken) {
      setError("Please complete the verification first.")
      return
    }

    setError("")
    setBusy(true)

    try {
      const res = await fetch("/api/customer-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact,
          barangay,
          address,
          incidentType,
          description,
          turnstileToken,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || typeof data.trackingNumber !== "string") {
        setError(
          data.error ?? "We could not send your report. Please try again.",
        )
        return
      }

      setTrackingNumber(data.trackingNumber)
    } catch {
      setError("Something went wrong. Please check your connection and try again.")
    } finally {
      setBusy(false)
      // The Turnstile token is single-use, so a new one is needed.
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    }
  }

  const copyTrackingNumber = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const handleTrack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const code = trackingInput.trim()
    if (!code || trackBusy) return

    setTrackBusy(true)
    setTrackError("")
    setTrackResult(null)

    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        "track_customer_report",
        { p_tracking: code },
      )

      if (rpcError) {
        setTrackError("We could not check that tracking number. Please try again.")
        return
      }

      const rows = (data as TrackResult[] | null) ?? []

      if (rows.length === 0) {
        setTrackError(
          "No report was found with that tracking number. Please check it and try again.",
        )
        return
      }

      setTrackResult(rows[0])
    } catch {
      setTrackError("Something went wrong. Please check your connection and try again.")
    } finally {
      setTrackBusy(false)
    }
  }

  if (!open) return null

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 px-4 py-3 text-base font-semibold transition-colors ${
      active
        ? "border-[#123D73] text-[#123D73]"
        : "border-transparent text-slate-500 hover:text-slate-800"
    }`

  return (
    <div className="portal-modal-backdrop fixed inset-0 z-2000 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-900/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-6">
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Close modal"
        onClick={onClose}
      />

      <section
        id="submit-report-modal"
        ref={dialogRef}
        aria-modal="true"
        role="dialog"
        aria-labelledby="submit-report-title"
        tabIndex={-1}
        className="portal-modal-panel relative z-10 max-h-[calc(100dvh-0.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain border border-[#4438A8] bg-white shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-100">
              Report a water service problem
            </p>
            <h2
              id="submit-report-title"
              className="mt-1 wrap-break-word text-xl font-bold text-white"
            >
              Submit a Report
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-2xl leading-none text-indigo-100 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>

        <div
          role="tablist"
          className="flex border-b border-slate-300 bg-white px-2 sm:px-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "submit"}
            className={tabClass(tab === "submit")}
            onClick={() => setTab("submit")}
          >
            Submit a Report
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "track"}
            className={tabClass(tab === "track")}
            onClick={() => setTab("track")}
          >
            Track a Report
          </button>
        </div>

        {tab === "submit" && trackingNumber ? (
          <>
            <div className="space-y-6 px-6 py-6 sm:px-8">
              <p
                role="status"
                aria-live="polite"
                className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-800"
              >
                Your report was sent. Tanza Water District staff will review it.
              </p>

              <div className="border border-slate-300 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">
                  Your tracking number
                </p>
                <p className="mt-1.5 break-all font-mono text-2xl font-bold tracking-wide text-slate-900">
                  {trackingNumber}
                </p>
                <button
                  type="button"
                  className={`${btnSecondary} mt-4`}
                  onClick={() => void copyTrackingNumber()}
                >
                  {copied ? "Copied" : "Copy tracking number"}
                </button>
              </div>

              <p className="text-base leading-7 text-slate-600">
                Keep this number. Use it under Track a Report to check whether
                your report was verified.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" className={btnSecondary} onClick={resetForm}>
                Submit Another Report
              </button>
              <button type="button" className={btnPrimary} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : tab === "submit" ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <p className="text-base leading-7 text-slate-600">
                Tell us about the water service problem in your area. Staff
                will review your report before it is acted on.
              </p>

              {error && (
                <p
                  role="alert"
                  className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {error}
                </p>
              )}

              <label className="block">
                <span className={labelClass}>Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Contact number</span>
                <input
                  type="tel"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  required
                  maxLength={20}
                  autoComplete="tel"
                  placeholder="e.g. 09123456789"
                  className={inputClass}
                />
              </label>

              <div>
                <span className={labelClass}>Barangay</span>
                <SearchSelect
                  value={barangay}
                  onChange={setBarangay}
                  ariaLabel="Barangay"
                  placeholder="Select your barangay"
                  searchPlaceholder="Search barangay..."
                  emptyText="No barangays found."
                  invalid={attempted && !barangay}
                  options={barangayList.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
                {attempted && !barangay && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    Please select your barangay.
                  </p>
                )}
              </div>

              <div>
                <span className={labelClass}>Type of problem</span>
                <SearchSelect
                  value={incidentType}
                  onChange={setIncidentType}
                  ariaLabel="Type of problem"
                  placeholder="Select the type of problem"
                  searchPlaceholder="Search type of problem..."
                  emptyText="No problem types found."
                  invalid={attempted && !incidentType}
                  options={INCIDENT_TYPES.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
                {attempted && !incidentType && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    Please select the type of problem.
                  </p>
                )}
              </div>

              <label className="block">
                <span className={labelClass}>
                  Address or landmark{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                </span>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  maxLength={200}
                  placeholder="Street, purok, or nearby landmark"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Describe the problem</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  className={inputClass}
                />
                <span className="mt-2 block text-right text-sm text-slate-500">
                  {description.length}/1000
                </span>
              </label>

              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !turnstileToken}
                className={btnPrimary}
              >
                {busy ? "Sending…" : "Send Report"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTrack}>
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <p className="text-base leading-7 text-slate-600">
                Enter the tracking number you received after submitting your
                report.
              </p>

              <label className="block">
                <span className={labelClass}>Tracking number</span>
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(event) => setTrackingInput(event.target.value)}
                  required
                  maxLength={30}
                  placeholder="e.g. CR-1A2B3C4D"
                  className={`${inputClass} uppercase`}
                />
              </label>

              {trackError && (
                <p
                  role="alert"
                  className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {trackError}
                </p>
              )}

              {trackResult && (
                <div
                  role="status"
                  aria-live="polite"
                  className="border border-slate-300 bg-white p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="break-all font-mono text-base font-semibold text-slate-900">
                      {trackResult.tracking_number}
                    </p>
                    <span
                      className={`inline-flex items-center border px-3 py-1.5 text-sm font-medium ${statusInfo[trackResult.status].badge}`}
                    >
                      {statusInfo[trackResult.status].label}
                    </span>
                  </div>

                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {statusInfo[trackResult.status].text}
                  </p>

                  {trackResult.status === "rejected" &&
                    trackResult.rejection_reason && (
                      <p className="mt-3 text-base leading-7 text-slate-700">
                        <span className="font-semibold">Reason:</span>{" "}
                        {trackResult.rejection_reason}
                      </p>
                    )}

                  <dl className="mt-4 grid gap-x-8 gap-y-5 border-t border-slate-200 pt-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-semibold text-slate-500">
                        Barangay
                      </dt>
                      <dd className="mt-1.5 text-base text-slate-900">
                        {trackResult.barangay}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-slate-500">
                        Type of problem
                      </dt>
                      <dd className="mt-1.5 text-base text-slate-900">
                        {trackResult.incident_type}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-semibold text-slate-500">
                        Submitted
                      </dt>
                      <dd className="mt-1.5 text-base text-slate-900">
                        {new Date(trackResult.created_at).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button
                type="button"
                disabled={trackBusy}
                onClick={onClose}
                className={btnSecondary}
              >
                Close
              </button>
              <button type="submit" disabled={trackBusy} className={btnPrimary}>
                {trackBusy ? "Checking…" : "Check Status"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

export default SubmitReportModal