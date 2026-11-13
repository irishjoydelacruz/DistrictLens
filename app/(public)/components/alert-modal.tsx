"use client"

import { useEffect, useRef, useState } from "react"

import { barangays } from "../data/mock-data"
import { Icon } from "./icons"
import { Button } from "./ui"
import { SectionLabel } from "./section-label"
import { useDialogAccessibility } from "./use-dialog-accessibility"

type PushConfig = { available: boolean; publicKey?: string }
type SavedSubscription = { barangay?: string }

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
    <div className="portal-modal-backdrop fixed inset-0 z-2000 flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:items-center sm:p-6">
      <button className="absolute inset-0 cursor-default" aria-label="Close modal" onClick={onClose} />
      <section id="alerts-modal" ref={dialogRef} aria-modal="true" role="dialog" aria-labelledby="alerts-title" aria-describedby="alerts-description" tabIndex={-1} className="portal-modal-panel relative z-10 max-h-[calc(100dvh-0.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-5 sm:gap-4 sm:px-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name="bell" /></div>
          <div className="min-w-0 flex-1">
            <SectionLabel>Barangay-specific updates</SectionLabel>
            <h2 id="alerts-title" className="mt-1 wrap-break-word text-lg font-bold text-slate-950 sm:text-xl">{enabled ? "Manage Barangay Alerts" : "Get Barangay Alerts"}</h2>
          </div>
          <Button variant="ghost" className="size-11! min-h-11! p-0!" onClick={onClose} aria-label="Close"><Icon name="close" className="size-4" /></Button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <p id="alerts-description" className="text-sm leading-6 text-slate-600">Get published water-service updates for one barangay as notifications on this browser. Choose your barangay and allow notifications when your browser asks.</p>

          {message && <p role="status" aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

          {enabled && !changing ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-xs font-medium text-slate-500">Sending updates for</p><p className="mt-1 font-bold text-slate-900">{alertBarangay}</p></div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Alerts on</span>
              </div>
            </div>
          ) : (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Choose your barangay</span>
              <select value={barangay} onChange={(event) => setBarangay(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                {barangays.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <span className="mt-2 block text-xs text-slate-500">You can change this barangay any time.</span>
            </label>
          )}

          <div className={`flex items-start gap-3 rounded-lg px-4 py-3 ${ready ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-950"}`}>
            <Icon name={ready ? "info" : "shield"} className="mt-0.5 size-4 shrink-0" />
            <div className="text-xs leading-5">
              {ready ? <><p className="font-semibold">Notifications {permission === "granted" ? "are allowed" : "will need your permission"}.</p><p>Your browser will receive updates when the portal sends a published alert for this barangay.</p></> : <><p className="font-semibold">{permission === "granted" ? "Browser permission is on; no alert subscription is saved." : "Web Push is not fully connected yet."}</p><p>{!supported ? "Use a browser that supports notifications on a secure HTTPS connection." : !secureContext ? "Notifications need a secure HTTPS connection." : config === null ? "Checking the alert service…" : "The portal administrator must configure its Web Push keys, subscription database, and alert sender before you can subscribe."}</p></>}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          {enabled && !changing ? <>
            <Button variant="secondary" disabled={busy} onClick={() => { setChanging(true); setMessage("") }}>Change Barangay</Button>
            <Button variant="secondary" disabled={busy} className="border-red-200! text-red-700! hover:bg-red-50!" onClick={() => void unsubscribe()}>{busy ? "Saving…" : "Turn Off Alerts"}</Button>
          </> : <>
            <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button disabled={busy || !ready} onClick={() => void subscribe()}><Icon name="bell" className="size-4" />{busy ? "Saving…" : enabled ? "Save Barangay" : config === null ? "Checking Alerts…" : ready ? permission === "granted" ? "Subscribe to Alerts" : "Allow Notifications" : "Alerts Not Configured"}</Button>
          </>}
        </div>
      </section>
    </div>
  )
}

export default AlertModal