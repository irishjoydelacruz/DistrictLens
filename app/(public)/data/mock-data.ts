export type Status = "Active" | "Monitoring" | "Normal"
export type IncidentSourceType = "Barangay/Localized Area" | "Pumping Station"

export type Page = "home" | "public-map" | "history" | "about" | "contact"

export type IconName =
  | "bell"
  | "home"
  | "history"
  | "phone"
  | "mail"
  | "facebook"
  | "external"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "droplet"
  | "globe"
  | "info"
  | "map"
  | "map-pin"
  | "menu"
  | "search"
  | "shield"

export type Report = {
  id: number
  barangay: string
  title: string
  type: string
  status: Status
  description: string
  date: string
  time: string
  restoration: string
  latest: string
  progress: 1 | 2 | 3
  // Last update time (ms). Used to show the most recently changed records first.
  updatedAt?: number
  sourceType?: IncidentSourceType
  pumpingStation?: string
  affectedArea?: string
  affectedBarangays?: string[]
}

export type PumpingStation = {
  name: string
  servedAreas: string[]
}

const restorationDatePattern =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/

export function formatRestorationEstimate(
  report: Pick<Report, "date" | "restoration">,
) {
  const estimate = report.restoration.trim()

  if (!estimate || /^service restored$/i.test(estimate)) return estimate
  if (restorationDatePattern.test(estimate)) return estimate

  return `${report.date} · ${estimate}`
}

// Service areas transcribed from the user-provided TWD pumping station PDF.
// Incident-specific affectedBarangays on a report take precedence over these
// station service areas when present.
export const pumpingStations: PumpingStation[] = [
  { name: "Pumping Station #1", servedAreas: ["Poblacion I", "Poblacion II", "Poblacion III", "Poblacion IV", "Daang Amaya III", "Bucal"] },
  { name: "Pumping Station #2", servedAreas: ["Julugan I", "Julugan II", "Julugan III", "Julugan IV", "Julugan V", "Julugan VI", "Julugan VII", "Julugan VIII", "Daang Amaya I", "Daang Amaya II", "Biwas", "Amaya I"] },
  { name: "Pumping Station #3", servedAreas: ["Daang Amaya II", "Biwas"] },
  { name: "Pumping Station #4", servedAreas: ["Sahud Ulan (some portions)"] },
  { name: "Pumping Station #5", servedAreas: ["Hauskon Homes", "Julugan VII"] },
  { name: "Pumping Station #6", servedAreas: ["Mulawin", "Daang Amaya I", "Daang Amaya II", "Daang Amaya III", "Biwas", "Julugan I", "Julugan II", "Julugan III", "Julugan IV", "Julugan V", "Julugan VI", "Julugan VII", "Julugan VIII"] },
  { name: "Pumping Station #7", servedAreas: ["Paradahan I", "Paradahan II", "Bagtas", "Punta I", "Punta II"] },
  { name: "Pumping Station #8", servedAreas: ["Christine Village", "Biga", "Punta I", "Sanja Mayor", "Mulawin"] },
  { name: "Pumping Station #9", servedAreas: ["Poblacion I", "Poblacion II", "Poblacion III", "Poblacion IV", "Bucal", "Daang Amaya I", "Daang Amaya III"] },
  { name: "Pumping Station #10", servedAreas: ["Amaya I", "Amaya II", "Amaya III", "Amaya IV", "Amaya V", "Amaya VI", "Amaya VII"] },
  { name: "Pumping Station #11", servedAreas: ["Promise Land Subdivision", "Bucal", "Santol (some portions)"] },
  { name: "Pumping Station #12", servedAreas: ["Julugan", "Biwas", "Daang Amaya II"] },
  { name: "Pumping Station #13", servedAreas: ["Biga", "Sanja Mayor", "Mulawin", "Punta I"] },
]

function normalizeAreaName(value: string) {
  const normalized = value
    .replace(/^brgy\.?\s*/i, "")
    .replace(/\bsahud-ulan\b/i, "sahud ulan")
    .replace(/\s*\(some portions\)/i, "")
    .trim()
    .toLocaleLowerCase()
  const poblacion = normalized.match(/^poblacion\s+([ivx]+)$/)
  return poblacion ? `barangay ${poblacion[1]} (pob.)` : normalized
}

export function getReportSourceLocation(report: Report) {
  if (report.sourceType === "Pumping Station") {
    return report.pumpingStation || "Pumping Station"
  }
  return report.barangay
}

export function getReportSourceDisplay(report: Report) {
  return report.sourceType === "Pumping Station"
    ? getReportSourceLocation(report)
    : `Brgy. ${getReportSourceLocation(report)}`
}

export function getReportAffectedLabel(report: Report) {
  return report.sourceType === "Pumping Station"
    ? report.affectedBarangays?.length
      ? "Affected barangays"
      : "Station service areas / potentially affected barangays"
    : "Affected area / barangay"
}

export function getReportAffectedAreas(report: Report) {
  if (report.sourceType === "Pumping Station") {
    if (report.affectedBarangays?.length) return report.affectedBarangays
    return (
      pumpingStations.find(
        (station) => station.name.toLocaleLowerCase() === report.pumpingStation?.trim().toLocaleLowerCase(),
      )
        ?.servedAreas ?? []
    )
  }
  return [report.affectedArea?.trim() || `Brgy. ${report.barangay}`]
}

export function reportAffectsBarangay(report: Report, barangayName: string) {
  const requested = normalizeAreaName(barangayName)
  if (report.sourceType === "Pumping Station") {
    return getReportAffectedAreas(report).some(
      (area) => {
        const servedArea = normalizeAreaName(area.split(",")[0])
        return requested === servedArea || requested.startsWith(`${servedArea} `)
      },
    )
  }

  const recorded = normalizeAreaName(report.barangay)
  return requested === recorded || requested.startsWith(`${recorded} `)
}

export function getBarangayStatus(barangayName: string): Status {
  const matching = reports.filter((report) => reportAffectsBarangay(report, barangayName))
  if (matching.some((report) => report.status === "Active")) return "Active"
  if (matching.some((report) => report.status === "Monitoring")) return "Monitoring"
  return "Normal"
}

const statusRank: Record<Status, number> = { Active: 0, Monitoring: 1, Normal: 2 }

// Every unresolved incident that affects a barangay: most severe first,
// then most recently updated. Resolved ("Normal") incidents are left out.
export function getBarangayReports(barangayName: string): Report[] {
  return reports
    .filter(
      (report) => report.status !== "Normal" && reportAffectsBarangay(report, barangayName),
    )
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    )
}

export function getStatusSummary(status: Status) {
  switch (status) {
    case "Active":
      return "An active service incident is recorded for this barangay."
    case "Monitoring":
      return "A reported service condition in this barangay is being monitored."
    case "Normal":
      return "No current issue is recorded for this barangay."
  }
}

export const barangays = [
  "Amaya I",
  "Amaya II",
  "Amaya III",
  "Amaya IV",
  "Amaya V",
  "Amaya VI",
  "Amaya VII",
  "Bagtas",
  "Barangay I (Pob.)",
  "Barangay II (Pob.)",
  "Barangay III (Pob.)",
  "Barangay IV (Pob.)",
  "Biga",
  "Biwas",
  "Bucal",
  "Bunga",
  "Calibuyo",
  "Capipisa",
  "Daang Amaya I",
  "Daang Amaya II",
  "Daang Amaya III",
  "Halayhay",
  "Julugan I",
  "Julugan II",
  "Julugan III",
  "Julugan IV",
  "Julugan V",
  "Julugan VI",
  "Julugan VII",
  "Julugan VIII",
  "Lambingan",
  "Mulawin",
  "Paradahan I",
  "Paradahan II",
  "Punta I",
  "Punta II",
  "Sahud Ulan",
  "Sanja Mayor",
  "Santol",
  "Tanauan",
  "Tres Cruses",
]

// =========================================
// LIVE INCIDENT RECORDS
// `reports` is filled from the database (see incident-sync.ts) and kept
// up to date. It starts empty. Components should call useIncidents()
// (use-incidents.ts) so they re-render when the data changes.
// =========================================
export let reports: Report[] = []

let reportsSignature = ""
let reportsVersion = 0
let reportsLoaded = false
const reportListeners = new Set<() => void>()

export function setReports(next: Report[]) {
  const signature = JSON.stringify(next)

  if (reportsLoaded && signature === reportsSignature) return

  reports = next
  reportsSignature = signature
  reportsLoaded = true
  reportsVersion += 1
  reportListeners.forEach((listener) => listener())
}

export function subscribeReports(listener: () => void) {
  reportListeners.add(listener)
  return () => {
    reportListeners.delete(listener)
  }
}

export function getReportsVersion() {
  return reportsVersion
}

export function haveReportsLoaded() {
  return reportsLoaded
}

let syncError: string | null = null

export function setSyncError(message: string | null) {
  if (syncError === message) return
  syncError = message
  reportsVersion += 1
  reportListeners.forEach((listener) => listener())
}

export function getSyncError() {
  return syncError
}

export const statusStyle: Record<Status, string> = {
  Active: "bg-red-50 text-red-700 ring-red-600/10",
  Monitoring: "bg-yellow-50 text-amber-800 ring-yellow-500/20",
  Normal: "bg-emerald-50 text-emerald-700 ring-emerald-500/10",
}

export const statusDot: Record<Status, string> = {
  Active: "bg-red-500",
  Monitoring: "bg-yellow-400",
  Normal: "bg-green-500",
}