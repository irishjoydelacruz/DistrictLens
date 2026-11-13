"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import AlertModal from "./alert-modal"

type AlertContextType = {
  alertOpen: boolean
  alertsEnabled: boolean
  alertBarangay: string
  openAlerts: () => void
  closeAlerts: () => void
  refreshAlerts: () => Promise<void>
  saveAlerts: (barangay: string, enabled: boolean) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

async function getSavedBarangay(endpoint: string) {
  const response = await fetch(`/api/alerts/subscription?endpoint=${encodeURIComponent(endpoint)}`, { cache: "no-store" })
  if (!response.ok) return ""
  const data = (await response.json()) as { barangay?: string }
  return data.barangay || ""
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [alertBarangay, setAlertBarangay] = useState("")

  const refreshAlerts = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setAlertsEnabled(false)
        setAlertBarangay("")
        return
      }
      const registration = await navigator.serviceWorker.getRegistration("/")
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) {
        setAlertsEnabled(false)
        setAlertBarangay("")
        return
      }
      const barangay = await getSavedBarangay(subscription.endpoint)
      setAlertBarangay(barangay)
      setAlertsEnabled(Boolean(barangay))
    } catch {
      setAlertsEnabled(false)
      setAlertBarangay("")
    }
  }, [])

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      await Promise.resolve()
      if (active) await refreshAlerts()
    }
    void hydrate()
    return () => { active = false }
  }, [refreshAlerts])

  const saveAlerts = (barangay: string, enabled: boolean) => {
    setAlertBarangay(enabled ? barangay : "")
    setAlertsEnabled(enabled)
  }

  return (
    <AlertContext.Provider
      value={{
        alertOpen,
        alertsEnabled,
        alertBarangay,
        openAlerts: () => setAlertOpen(true),
        closeAlerts: () => setAlertOpen(false),
        refreshAlerts,
        saveAlerts,
      }}
    >
      {children}
      <AlertModal
        key={alertOpen ? "open" : "closed"}
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        alertBarangay={alertBarangay}
        enabled={alertsEnabled}
        onSave={saveAlerts}
      />
    </AlertContext.Provider>
  )
}

export function useAlerts() {
  const context = useContext(AlertContext)
  if (!context) throw new Error("useAlerts must be used inside an AlertProvider")
  return context
}