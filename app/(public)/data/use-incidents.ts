"use client"

import { useEffect, useSyncExternalStore } from "react"
import {
  getReportsVersion,
  getSyncError,
  haveReportsLoaded,
  reports,
  subscribeReports,
} from "./mock-data"
import { startIncidentSync } from "./incident-sync"

// Call this at the top of any component that shows incidents. It starts the
// live updates (every ~45s) and re-renders the component when data changes.
export function useIncidents() {
  useSyncExternalStore(subscribeReports, getReportsVersion, () => 0)

  useEffect(() => startIncidentSync(), [])

  return { reports, loaded: haveReportsLoaded(), error: getSyncError() }
}