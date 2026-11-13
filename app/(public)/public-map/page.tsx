"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Header from "../components/header";
import { Icon } from "../components/icons";
import Map from "../components/map";
import { PageIntro } from "../components/page-intro";
import {
  barangays,
  formatRestorationEstimate,
  getReportAffectedAreas,
  getReportAffectedLabel,
  getReportSourceDisplay,
  getReportSourceLocation,
  reportAffectsBarangay,
  reports,
  type Report,
  type Status,
} from "../data/mock-data";

const statuses: Status[] = ["Active", "Monitoring", "Normal"];

const statusClasses: Record<
  Status,
  { dot: string; badge: string; label: string }
> = {
  Active: {
    dot: "status-indicator-dot",
    badge: "bg-red-50 text-red-700",
    label: "Active",
  },
  Monitoring: {
    dot: "status-indicator-dot",
    badge: "bg-yellow-50 text-amber-800",
    label: "Monitoring",
  },
  Normal: {
    dot: "status-indicator-dot",
    badge: "bg-emerald-50 text-emerald-700",
    label: "Normal",
  },
};

export default function PublicMap() {
  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(
    null,
  );
  const [focusBarangay, setFocusBarangay] = useState<string | null>(null);

  const barangayNames = useMemo(() => [...barangays].sort(), []);

  const incidentTypes = useMemo(
    () => [...new Set(reports.map((report) => report.type))].sort(),
    [],
  );

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return reports.filter((report) => {
      const matchesSearch =
        !query ||
        getReportSourceLocation(report).toLocaleLowerCase().includes(query) ||
        getReportAffectedAreas(report).some((area) => area.toLocaleLowerCase().includes(query)) ||
        report.barangay.toLocaleLowerCase().includes(query) ||
        report.title.toLocaleLowerCase().includes(query) ||
        report.type.toLocaleLowerCase().includes(query);

      return (
        matchesSearch &&
        (barangayFilter === "all" || reportAffectsBarangay(report, barangayFilter)) &&
        (statusFilter === "all" || report.status === statusFilter) &&
        (typeFilter === "all" || report.type === typeFilter)
      );
    });
  }, [search, barangayFilter, statusFilter, typeFilter]);

  const activeFilters = [barangayFilter, statusFilter, typeFilter].filter(
    (filter) => filter !== "all",
  ).length;

  const clearFilters = () => {
    setSearch("");
    setBarangayFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const focusReport = (report: Report) => {
    const affectedBarangay = barangays.find((name) => reportAffectsBarangay(report, name)) ?? report.barangay;
    setSelectedBarangay(affectedBarangay);
    setFocusBarangay(affectedBarangay);
    setPanelOpen(false);
  };

  const filteredBarangays = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (barangayFilter !== "all") return [barangayFilter];

    if (statusFilter === "all" && typeFilter === "all" && !query) {
      return undefined;
    }

    const reportMatches = barangayNames.filter((name) =>
      filteredReports.some((report) => reportAffectsBarangay(report, name)),
    );
    const nameMatches = query
      ? barangayNames.filter((name) =>
          name.toLocaleLowerCase().includes(query),
        )
      : [];

    return [...new Set([...reportMatches, ...nameMatches])];
  }, [
    barangayFilter,
    barangayNames,
    filteredReports,
    search,
    statusFilter,
    typeFilter,
  ]);

  return (
    <div className="public-map-page flex min-h-screen flex-1 flex-col bg-slate-50 text-slate-900">
      <Header />

      <main id="main-content" className="public-map-main flex flex-1 flex-col">
      <PageIntro
        eyebrow="Public Information"
        title="Public Map"
        text="Explore Tanza barangay boundaries and the incident records available in this portal."
      />

      <section className="public-map-area">
        <div className="map-workspace public-map-workspace">
          <section id="map-view" className="map-frame" aria-label="Tanza barangay map">
            <div className="map-toolbar">
              <label className="map-search">
                <span aria-hidden="true" className="flex shrink-0 text-blue-800">
                  <Icon name="search" className="size-4" />
                </span>

                <input
                  aria-label="Search barangay or incident"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search barangay or incident..."
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </label>

              <button
                type="button"
                className={`map-filter-button ${filtersOpen ? "is-active" : ""}`}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="map-filters"
              >
                <span aria-hidden="true">☷</span>
                Filters
                {activeFilters > 0 && (
                  <span className="filter-count">{activeFilters}</span>
                )}
              </button>
            </div>

            <div id="map-filters" className="map-filters" hidden={!filtersOpen}>
                <div className="map-filter-grid">
                  <label>
                    Barangay
                    <select
                      value={barangayFilter}
                      onChange={(event) =>
                        setBarangayFilter(event.target.value)
                      }
                    >
                      <option value="all">All Barangays</option>
                      {barangayNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Normal">Normal</option>
                      <option value="Monitoring">Monitoring</option>
                      <option value="Active">Active</option>
                    </select>
                  </label>

                  <label>
                    Incident type
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                    >
                      <option value="all">All Types</option>
                      {incidentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="reset-filters"
                >
                  Reset filters
                </button>
            </div>

            <div className="map-canvas">
              <Map
                onBarangayClick={(name) => {
                  setSelectedBarangay(name);
                  setFocusBarangay(name);
                }}
                onPopupClose={() => {
                  setSelectedBarangay(null);
                }}
                focusBarangay={focusBarangay}
                selectedBarangay={selectedBarangay}
                visibleBarangays={filteredBarangays}
              />
            </div>

            <div className="map-legend" role="group" aria-label="Map status legend">
              <span className="map-legend-title">Legend</span>
              {statuses.map((status) => (
                <span key={status} className="map-legend-item">
                  <span
                    aria-hidden="true"
                    className="map-legend-swatch"
                    data-status={status.toLowerCase()}
                  />
                  {status}
                </span>
              ))}
            </div>
          </section>

          <aside className={`incident-panel ${panelOpen ? "is-open" : ""}`} aria-label="Latest updates">
            <button
              type="button"
              className="incident-panel-toggle"
              onClick={() => setPanelOpen((open) => !open)}
              aria-expanded={panelOpen}
              aria-controls="latest-updates-list"
            >
              <span className="mobile-sheet-handle" />

              <span className="incident-panel-heading">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                  Latest updates
                </span>

                <span className="mt-1 block text-sm font-bold text-slate-900">
                  Incidents{" "}
                  <span className="incident-count">
                    {filteredReports.length}
                  </span>
                </span>
              </span>
            </button>

            <div className="incident-panel-subtitle">
              Incident records available for Tanza
            </div>

            <div
              id="latest-updates-list"
              className="incident-list"
              role="region"
              aria-label="Latest service updates"
              aria-live="polite"
            >
              {filteredReports.length ? (
                filteredReports.map((report) => (
                  <article
                    key={report.id}
                    data-status={report.status.toLowerCase()}
                    className={`incident-card ${
                      selectedBarangay && reportAffectsBarangay(report, selectedBarangay) ? "is-selected" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => focusReport(report)}
                      className="incident-card-select"
                      aria-label={`Show ${getReportSourceLocation(report)} on the map`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses[report.status].badge}`}
                        >
                          <span
                            className={statusClasses[report.status].dot}
                            data-status={report.status.toLowerCase()}
                            aria-hidden="true"
                          />
                          {report.status}
                        </span>

                        <span className="text-[10px] text-slate-400">
                          {report.date}
                        </span>
                      </div>

                      <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900">
                        {report.type} — {getReportSourceDisplay(report)}
                      </h3>

                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
                        {report.title}
                      </p>

                      <p className="mt-1.5 wrap-break-word text-[11px] leading-4 text-slate-500">
                        <span className="font-semibold text-slate-600">{getReportAffectedLabel(report)}:</span>{" "}
                        {getReportAffectedAreas(report).join(", ")}
                      </p>

                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
                        {report.description}
                      </p>

                      {report.restoration && (
                        <p className="mt-2 wrap-break-word text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">
                            Estimated restoration:
                          </span>{" "}
                          {formatRestorationEstimate(report)}
                        </p>
                      )}

                      <p className="mt-3 border-t border-slate-100 pt-3 text-left text-[10px] text-slate-400">
                        {report.time}
                      </p>
                    </button>

                    <Link
                      href={`/history?report=${report.id}`}
                      scroll={false}
                      onClick={() => setPanelOpen(false)}
                      className="incident-card-details"
                      aria-label={`View details for ${getReportSourceLocation(report)}: ${report.title}`}
                    >
                      View details <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))
              ) : (
                <div className="incident-empty">
                  <span className="text-2xl" aria-hidden="true">
                    ⌕
                  </span>

                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    No matching incidents
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Try changing your search or filters.
                  </p>

                  <button
                    type="button"
                    className="mt-3 text-xs font-semibold text-blue-700"
                    onClick={clearFilters}
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>

            <Link href="/history" className="incident-panel-footer">
              View all reports →
            </Link>
          </aside>
        </div>
      </section>

      </main>
    </div>
  );
}