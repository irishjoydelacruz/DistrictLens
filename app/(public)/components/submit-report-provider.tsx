"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"

import SubmitReportModal from "./submit-report-modal"

type SubmitReportTab = "submit" | "track"

type SubmitReportContextType = {
  submitReportOpen: boolean
  openSubmitReport: () => void
  openTrackReport: () => void
  closeSubmitReport: () => void
}

const SubmitReportContext = createContext<SubmitReportContextType | undefined>(
  undefined,
)

export function SubmitReportProvider({ children }: { children: ReactNode }) {
  const [submitReportOpen, setSubmitReportOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<SubmitReportTab>("submit")

  return (
    <SubmitReportContext.Provider
      value={{
        submitReportOpen,
        openSubmitReport: () => {
          setInitialTab("submit")
          setSubmitReportOpen(true)
        },
        openTrackReport: () => {
          setInitialTab("track")
          setSubmitReportOpen(true)
        },
        closeSubmitReport: () => setSubmitReportOpen(false),
      }}
    >
      {children}
      {/* The key resets the form each time the modal is opened. */}
      <SubmitReportModal
        key={submitReportOpen ? "open" : "closed"}
        open={submitReportOpen}
        initialTab={initialTab}
        onClose={() => setSubmitReportOpen(false)}
      />
    </SubmitReportContext.Provider>
  )
}

export function useSubmitReport() {
  const context = useContext(SubmitReportContext)
  if (!context)
    throw new Error("useSubmitReport must be used inside a SubmitReportProvider")
  return context
}