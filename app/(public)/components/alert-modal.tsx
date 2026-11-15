"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { barangays } from "../data/mock-data"
import { Icon } from "./icons"
import { useDialogAccessibility } from "./use-dialog-accessibility"

type PushConfig = { available: boolean; publicKey?: string }
type SavedSubscription = { barangay?: string }

// UI-only class tokens, matching the Submit Report modal.
const labelClass = "mb-2 block text-sm font-bold text-slate-800"
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-none border border-slate-300 bg-white px-5 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-none bg-[#123D73] px-5 py-3 text-base font-medium text-white transition-colors hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50"
const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-none border border-red-200 bg-white px-5 py-3 text-base font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"

const barangayOptions = [...barangays].sort((a, b) => a.localeCompare(b))

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

// Searchable dropdown, same as the Submit Report modal: it always opens
// downward, and the list renders in a portal so the modal never clips it.
function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
  allowClear = true,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  ariaLabel: string
  allowClear?: boolean
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
        className="flex w-full items-center justify-between rounded-none border border-slate-300 bg-white px-4 py-3 text-left text-base text-slate-800 shadow-sm transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
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
              {allowClear && (
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
              )}

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

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function AlertModal({
  open,
  onClose,
  alertBarangay,
  enabled,
  onSave,
}: {
  open: boolean
  onClose: () => void
  alertBarangay: string
  enabled: boolean
  onSave: (barangay: string, enabled: boolean) => void
}) {
  const [barangay, setBarangay] = useState(alertBarangay || barangays[0])
  const [changing, setChanging] = useState(!enabled)
  const [config, setConfig] = useState<PushConfig | null>(null)
  const [supported, setSupported] = useState(true)
  const [secureContext, setSecureContext] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const dialogRef = useRef<HTMLElement>(null)

  useDialogAccessibility(open, onClose, dialogRef)

  useEffect(() => {
    if (!open) return
    let active = true
    const check = async () => {
      const browserSupportsPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      if (!active) return
      setSupported(browserSupportsPush)
      setSecureContext(window.isSecureContext)
      setPermission(browserSupportsPush ? Notification.permission : "unsupported")
      try {
        const response = await fetch("/api/alerts/config", { cache: "no-store" })
        const data = (await response.json()) as PushConfig
        if (!active) return
        setConfig(data)
        if (browserSupportsPush) {
          const registration = await navigator.serviceWorker.getRegistration("/")
          const subscription = await registration?.pushManager.getSubscription()
          if (subscription) {
            const saved = await fetch(`/api/alerts/subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`, { cache: "no-store" })
            if (saved.ok) {
              const preference = (await saved.json()) as SavedSubscription
              if (active && preference.barangay) setBarangay(preference.barangay)
            }
          }
        }
      } catch {
        if (active) setError("We could not check the alert service. Please check your connection and try again.")
      }
    }
    void check()
    return () => { active = false }
  }, [open, alertBarangay, enabled])

  const subscribe = async () => {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (!supported || !window.isSecureContext) throw new Error("Browser notifications require a supported browser and a secure HTTPS connection.")

      let currentPermission = Notification.permission
      if (currentPermission === "default") currentPermission = await Notification.requestPermission()
      setPermission(currentPermission)
      if (currentPermission !== "granted") throw new Error(currentPermission === "denied" ? "Notifications are blocked in your browser settings. Allow them there, then try again." : "Notification permission was not granted.")

      // Ask for browser permission directly from the visitor's click, even while
      // server configuration is incomplete. Permission alone is not a saved
      // subscription; only report alerts as enabled after the API persists it.
      if (!config?.available || !config.publicKey) {
        throw new Error("Browser permission is on, but this portal is not connected to its Web Push keys and subscription database yet. Contact the portal administrator to finish setup.")
      }

      const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(config.publicKey),
      })
      const response = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barangay, subscription: subscription.toJSON() }),
      })
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string }
        if (!enabled) await subscription.unsubscribe().catch(() => false)
        throw new Error(result.error || "We could not save your subscription. Please try again.")
      }
      onSave(barangay, true)
      setChanging(false)
      setMessage(enabled ? "Your barangay preference has been updated." : "You’re subscribed to barangay alerts.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not subscribe right now. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const registration = await navigator.serviceWorker.getRegistration("/")
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch("/api/alerts/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        if (!response.ok) throw new Error("We could not remove your subscription. Please try again.")
        await subscription.unsubscribe()
      }
      onSave("", false)
      setChanging(true)
      setMessage("Barangay alerts are turned off for this browser.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not turn off alerts. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  const ready = config?.available === true && supported && secureContext

  return (
    <div className="portal-modal-backdrop fixed inset-0 z-2000 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-900/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-6">
      <button className="absolute inset-0 cursor-default" aria-label="Close modal" onClick={onClose} />
      <section
        id="alerts-modal"
        ref={dialogRef}
        aria-modal="true"
        role="dialog"
        aria-labelledby="alerts-title"
        aria-describedby="alerts-description"
        tabIndex={-1}
        className="portal-modal-panel relative z-10 max-h-[calc(100dvh-0.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain border border-[#4438A8] bg-white shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-100">Barangay-specific updates</p>
            <h2 id="alerts-title" className="mt-1 wrap-break-word text-xl font-bold text-white">
              {enabled ? "Manage Barangay Alerts" : "Get Barangay Alerts"}
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

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p id="alerts-description" className="text-base leading-7 text-slate-600">
            Get published water-service updates for one barangay as notifications on this browser. Choose your barangay and allow notifications when your browser asks.
          </p>

          {message && (
            <p role="status" aria-live="polite" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </p>
          )}

          {enabled && !changing ? (
            <div className="border border-slate-300 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Sending updates for</p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">{alertBarangay}</p>
                </div>
                <span className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
                  Alerts on
                </span>
              </div>
            </div>
          ) : (
            <div>
              <span className={labelClass}>Choose your barangay</span>
              <SearchSelect
                value={barangay}
                onChange={setBarangay}
                ariaLabel="Barangay"
                placeholder="Select your barangay"
                searchPlaceholder="Search barangay..."
                emptyText="No barangays found."
                allowClear={false}
                options={barangayOptions.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
              <span className="mt-2 block text-sm text-slate-500">You can change this barangay any time.</span>
            </div>
          )}

          <div
            className={`flex items-start gap-3 border px-4 py-3 ${
              ready ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <Icon name={ready ? "info" : "shield"} className="mt-0.5 size-4 shrink-0" />
            <div className="text-sm leading-6">
              {ready ? (
                <>
                  <p className="font-semibold">Notifications {permission === "granted" ? "are allowed" : "will need your permission"}.</p>
                  <p>Your browser will receive updates when the portal sends a published alert for this barangay.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    {permission === "granted" ? "Browser permission is on; no alert subscription is saved." : "Web Push is not fully connected yet."}
                  </p>
                  <p>
                    {!supported
                      ? "Use a browser that supports notifications on a secure HTTPS connection."
                      : !secureContext
                        ? "Notifications need a secure HTTPS connection."
                        : config === null
                          ? "Checking the alert service…"
                          : "The portal administrator must configure its Web Push keys, subscription database, and alert sender before you can subscribe."}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          {enabled && !changing ? (
            <>
              <button type="button" disabled={busy} className={btnSecondary} onClick={() => { setChanging(true); setMessage("") }}>
                Change Barangay
              </button>
              <button type="button" disabled={busy} className={btnDanger} onClick={() => void unsubscribe()}>
                {busy ? "Saving…" : "Turn Off Alerts"}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} className={btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="button" disabled={busy || !ready} className={btnPrimary} onClick={() => void subscribe()}>
                <Icon name="bell" className="size-4" />
                {busy
                  ? "Saving…"
                  : enabled
                    ? "Save Barangay"
                    : config === null
                      ? "Checking Alerts…"
                      : ready
                        ? permission === "granted"
                          ? "Subscribe to Alerts"
                          : "Allow Notifications"
                        : "Alerts Not Configured"}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default AlertModal