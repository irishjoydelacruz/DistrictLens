"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Incident = {
  id: number;
  barangay_code: string | null;
  incident_type: string;
  status: string;
  reported_at: string;
  pumping_station_id: number | null;
  affected_area: string | null;
};

type Barangay = { name: string; code: string };

type PumpingStation = {
  id: number;
  name: string;
  location: string | null;
};

type IncidentBarangay = {
  incident_id: number;
  barangay_code: string;
};

type Period = "recent" | "all" | "year" | "30d" | "month";

// "Most recent" shows only the latest reports (same as Submissions).
const RECENT_LIMIT = 10;

const INCIDENT_TYPES = [
  "Line Rupture",
  "Water Leakage",
  "Low Water Pressure",
  "No Water Supply",
  "Water Service Interruption",
  "Water Quality Issue",
];

// Same colors as the dashboard's Incident Analytics chart.
const INCIDENT_COLORS: Record<string, string> = {
  "Line Rupture": "#ef4444",
  "Water Leakage": "#3b82f6",
  "Low Water Pressure": "#f59e0b",
  "No Water Supply": "#8b5cf6",
  "Water Service Interruption": "#10b981",
  "Water Quality Issue": "#ec4899",
};

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "all", label: "All time" },
  { value: "year", label: "This year" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
];

/* -------------------------
   CARD CATALOG
   Everything the user can add to the page. The order here is the order
   the cards appear in on the page.
------------------------- */

type CardId =
  | "total"
  | "topType"
  | "topBarangay"
  | "topStation"
  | "active"
  | "monitoring"
  | "resolved"
  | "frequency"
  | "trend"
  | "barangays"
  | "stations";

type CardGroup = "summary" | "status" | "detail";

const CARD_OPTIONS: {
  id: CardId;
  label: string;
  description: string;
  group: CardGroup;
}[] = [
  {
    id: "total",
    label: "Total Incidents",
    description: "Reports in the selected period",
    group: "summary",
  },
  {
    id: "topType",
    label: "Most Frequent Incident",
    description: "Incident type with the most reports",
    group: "summary",
  },
  {
    id: "topBarangay",
    label: "Most Reported Barangay",
    description: "Barangay with the most reports",
    group: "summary",
  },
  {
    id: "topStation",
    label: "Most Affected Pumping Station",
    description: "Station with the most reports",
    group: "summary",
  },
  {
    id: "active",
    label: "Active",
    description: "Incidents needing immediate attention",
    group: "status",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Incidents being monitored",
    group: "status",
  },
  {
    id: "resolved",
    label: "Resolved",
    description: "Resolved incident reports",
    group: "status",
  },
  {
    id: "frequency",
    label: "Incident Frequency",
    description: "Reports by incident type",
    group: "detail",
  },
  {
    id: "trend",
    label: "Monthly Trend",
    description: "Reports per month, last 6 months",
    group: "detail",
  },
  {
    id: "barangays",
    label: "Affected Barangays",
    description: "Full ranking of barangays with reports",
    group: "detail",
  },
  {
    id: "stations",
    label: "Pumping Station Incidents",
    description: "Reports linked to each pumping station",
    group: "detail",
  },
];

const GROUP_LABELS: Record<CardGroup, string> = {
  summary: "Highlights",
  status: "Status",
  detail: "Charts and rankings",
};

const ALL_CARD_IDS = CARD_OPTIONS.map((option) => option.id);

// Nothing is pre-selected: cards appear in the order the user adds them.
const DEFAULT_CARDS: CardId[] = [];

// Big cards take the full width; the small ones sit three to a row.
const WIDE_CARDS = new Set<CardId>(
  CARD_OPTIONS.filter((option) => option.group === "detail").map(
    (option) => option.id
  )
);

// The chosen cards are remembered in this browser.
const STORAGE_KEY = "districtlens-analytics-cards";

function statusLabel(status: string) {
  if (status === "red") return "Active";
  if (status === "yellow") return "Monitoring";
  return "Resolved";
}

function statusBadge(status: string) {
  if (status === "red") return "border-red-200 bg-red-50 text-red-800";
  if (status === "yellow") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function statusColor(status: string) {
  if (status === "red") return "#ef4444";
  if (status === "yellow") return "#fbbf24";
  return "#34d399";
}

// Worst status wins: active > monitoring > resolved.
function worseStatus(current: string | undefined, next: string) {
  if (!current) return next;
  if (current === "red" || next === "red") return "red";
  if (current === "yellow" || next === "yellow") return "yellow";
  return "green";
}

export default function FrequentIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentBarangays, setIncidentBarangays] = useState<
    IncidentBarangay[]
  >([]);
  const [stations, setStations] = useState<PumpingStation[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [period, setPeriod] = useState<Period>("recent");

  const [barangayPage, setBarangayPage] = useState(1);
  const [stationPage, setStationPage] = useState(1);

  // Which cards the user picked
  const [selectedCards, setSelectedCards] =
    useState<CardId[]>(DEFAULT_CARDS);
  const [cardsLoaded, setCardsLoaded] = useState(false);

  // Load the saved choice once, after the page mounts
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setSelectedCards(
            parsed.filter((id): id is CardId =>
              ALL_CARD_IDS.includes(id)
            )
          );
        }
      }
    } catch (error) {
      console.error("Could not read saved cards:", error);
    }

    setCardsLoaded(true);
  }, []);

  // Save the choice whenever it changes (but not before the first load)
  useEffect(() => {
    if (!cardsLoaded) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(selectedCards)
      );
    } catch (error) {
      console.error("Could not save cards:", error);
    }
  }, [selectedCards, cardsLoaded]);

  // Drag and drop (reordering)
  const [draggedId, setDraggedId] = useState<CardId | null>(null);
  const [overId, setOverId] = useState<CardId | null>(null);

  function moveCard(from: CardId, to: CardId) {
    setSelectedCards((current) => {
      const fromIndex = current.indexOf(from);
      const toIndex = current.indexOf(to);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function resetDrag() {
    setDraggedId(null);
    setOverId(null);
  }

  function toggleCard(id: CardId) {
    setSelectedCards((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  // `silent` = background refresh: no skeleton, no flicker, keeps old data
  // on failure.
  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }

    const supabase = createClient();

    const [incidentResult, affectedResult, stationResult] =
      await Promise.all([
        supabase
          .from("incidents")
          .select(
            "id, barangay_code, incident_type, status, reported_at, pumping_station_id, affected_area"
          )
          .order("reported_at", { ascending: false }),

        supabase
          .from("incident_barangays")
          .select("incident_id, barangay_code"),

        supabase
          .from("pumping_stations")
          .select("id, name, location"),
      ]);

    if (incidentResult.error) {
      console.error("Error loading incidents:", incidentResult.error);

      if (!silent) {
        setLoadError(
          `Could not load analytics: ${incidentResult.error.message}`
        );
        setLoading(false);
      }
      return;
    }

    setIncidents((incidentResult.data ?? []) as Incident[]);

    let partialError = "";

    if (affectedResult.error) {
      console.error(
        "Error loading incident_barangays:",
        affectedResult.error
      );
      partialError =
        "Affected barangays could not be loaded, so pumping station incidents may be missing from the barangay ranking.";

      if (!silent) setIncidentBarangays([]);
    } else {
      setIncidentBarangays(
        (affectedResult.data ?? []) as IncidentBarangay[]
      );
    }

    if (stationResult.error) {
      console.error("Error loading pumping_stations:", stationResult.error);
      if (!silent) setStations([]);
    } else {
      setStations((stationResult.data ?? []) as PumpingStation[]);
    }

    // The barangay list never changes, so only fetch it on a normal load.
    if (!silent) {
      try {
        const response = await fetch("/data/tanza-barangays.geojson");
        if (!response.ok) throw new Error("Could not load GeoJSON");

        const geojson = await response.json();

        setBarangays(
          (geojson.features ?? []).map((feature: any) => ({
            name: String(
              feature.properties?.brgy_name ?? "Unknown barangay"
            ),
            code: String(feature.properties?.brgy_code ?? ""),
          }))
        );
      } catch (error) {
        console.error("Error loading barangays:", error);
      }
    }

    setLoadError(partialError);

    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto refresh
  useAutoRefresh(() => void loadData(true));

  // Go back to page 1 when the period changes
  useEffect(() => {
    setBarangayPage(1);
    setStationPage(1);
  }, [period]);

  /* -------------------------
     DERIVED DATA
  ------------------------- */

  const getBarangayName = useCallback(
    (code: string) =>
      barangays.find((item) => item.code === code)?.name ?? code,
    [barangays]
  );

  const getStationName = useCallback(
    (id: number) =>
      stations.find((item) => item.id === id)?.name ??
      `Pumping Station #${id}`,
    [stations]
  );

  const periodIncidents = useMemo(() => {
    if (period === "all") return incidents;

    if (period === "recent") {
      return [...incidents]
        .sort(
          (a, b) =>
            new Date(b.reported_at).getTime() -
            new Date(a.reported_at).getTime()
        )
        .slice(0, RECENT_LIMIT);
    }

    const now = new Date();

    return incidents.filter((incident) => {
      const date = new Date(incident.reported_at);
      if (Number.isNaN(date.getTime())) return false;

      if (period === "year") {
        return date.getFullYear() === now.getFullYear();
      }

      if (period === "month") {
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth()
        );
      }

      // Last 30 days
      return now.getTime() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;
    });
  }, [incidents, period]);

  const total = periodIncidents.length;

  const statusCounts = useMemo(() => {
    const result = { red: 0, yellow: 0, green: 0 };

    periodIncidents.forEach((incident) => {
      if (incident.status === "red") result.red += 1;
      else if (incident.status === "yellow") result.yellow += 1;
      else result.green += 1;
    });

    return result;
  }, [periodIncidents]);

  const typeCounts = useMemo(() => {
    const types = Array.from(
      new Set([
        ...INCIDENT_TYPES,
        ...periodIncidents.map((item) => item.incident_type),
      ])
    );

    return types
      .map((type) => ({
        type,
        count: periodIncidents.filter(
          (item) => item.incident_type === type
        ).length,
      }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }, [periodIncidents]);

  // Each incident counts once per barangay it affected. Pumping station
  // incidents have no barangay_code, so their barangays come from
  // incident_barangays (this is what was missing before, causing "null").
  const barangayCounts = useMemo(() => {
    const linksByIncident = new Map<number, Set<string>>();

    incidentBarangays.forEach((item) => {
      if (!item.barangay_code) return;

      const set = linksByIncident.get(item.incident_id) ?? new Set<string>();
      set.add(item.barangay_code);
      linksByIncident.set(item.incident_id, set);
    });

    const map = new Map<string, { count: number; status: string }>();

    periodIncidents.forEach((incident) => {
      const codes = new Set<string>(
        linksByIncident.get(incident.id) ?? []
      );

      if (codes.size === 0 && incident.barangay_code) {
        codes.add(incident.barangay_code);
      }

      codes.forEach((code) => {
        const entry = map.get(code) ?? { count: 0, status: "" };
        entry.count += 1;
        entry.status = worseStatus(entry.status, incident.status);
        map.set(code, entry);
      });
    });

    return Array.from(map.entries())
      .map(([code, value]) => ({
        code,
        name: getBarangayName(code),
        count: value.count,
        status: value.status || "green",
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [periodIncidents, incidentBarangays, getBarangayName]);

  const stationCounts = useMemo(() => {
    const map = new Map<number, number>();

    periodIncidents.forEach((incident) => {
      if (incident.pumping_station_id == null) return;

      map.set(
        incident.pumping_station_id,
        (map.get(incident.pumping_station_id) ?? 0) + 1
      );
    });

    return Array.from(map.entries())
      .map(([id, count]) => ({ id, name: getStationName(id), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [periodIncidents, getStationName]);

  // Last 6 months, independent of the period filter.
  const monthlyTrend = useMemo(() => {
    const now = new Date();

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - (5 - index),
        1
      );

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("en-PH", { month: "short" }),
        year: date.getFullYear(),
        count: 0,
      };
    });

    incidents.forEach((incident) => {
      const date = new Date(incident.reported_at);
      if (Number.isNaN(date.getTime())) return;

      const month = months.find(
        (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`
      );

      if (month) month.count += 1;
    });

    return months;
  }, [incidents]);

  const topType = typeCounts[0] && typeCounts[0].count > 0 ? typeCounts[0] : null;
  const topBarangay = barangayCounts[0] ?? null;
  const topStation = stationCounts[0] ?? null;

  const maxType = Math.max(...typeCounts.map((item) => item.count), 1);
  const maxBarangay = Math.max(barangayCounts[0]?.count ?? 0, 1);
  const maxStation = Math.max(stationCounts[0]?.count ?? 0, 1);
  const maxMonth = Math.max(...monthlyTrend.map((item) => item.count), 1);

  // Pagination (10 per page)
  const barangayView = paginate(barangayCounts, barangayPage);
  const stationView = paginate(stationCounts, stationPage);

  const percent = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const reportsText = (count: number) =>
    `${count} ${count === 1 ? "report" : "reports"}`;

  const statusCards = [
    {
      id: "active" as const,
      label: "Active",
      count: statusCounts.red,
      note: "Requires immediate attention",
      color: "bg-red-600",
    },
    {
      id: "monitoring" as const,
      label: "Monitoring",
      count: statusCounts.yellow,
      note: "Incidents being monitored",
      color: "bg-amber-500",
    },
    {
      id: "resolved" as const,
      label: "Resolved",
      count: statusCounts.green,
      note: "Resolved incident reports",
      color: "bg-emerald-600",
    },
  ];

  const handleFor = (id: CardId) => (
    <DragHandle
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);

        // Show the whole card while dragging, not just the button
        const card = event.currentTarget.closest("[data-card]");
        if (card) event.dataTransfer.setDragImage(card, 24, 24);

        setDraggedId(id);
      }}
      onDragEnd={resetDrag}
    />
  );

  function renderCard(id: CardId): React.ReactNode {
    switch (id) {
      case "total":
        return (
          <StatCard
            accent="bg-[#123D73]"
            label="Total Incidents"
            value={String(total)}
            detail="All reported incidents"
            handle={handleFor("total")}
            onRemove={() => toggleCard("total")}
          />
        );

      case "topType":
        return (
          <StatCard
            accent="bg-[#123D73]"
            label="Most Frequent Incident"
            value={topType ? topType.type : "—"}
            detail={
              topType ? reportsText(topType.count) : "No reports yet"
            }
            handle={handleFor("topType")}
            onRemove={() => toggleCard("topType")}
          />
        );

      case "topBarangay":
        return (
          <StatCard
            accent="bg-[#123D73]"
            label="Most Reported Barangay"
            value={topBarangay ? topBarangay.name : "—"}
            detail={
              topBarangay
                ? reportsText(topBarangay.count)
                : "No barangay data"
            }
            handle={handleFor("topBarangay")}
            onRemove={() => toggleCard("topBarangay")}
          />
        );

      case "topStation":
        return (
          <StatCard
            accent="bg-[#123D73]"
            label="Most Affected Pumping Station"
            value={topStation ? topStation.name : "—"}
            detail={
              topStation
                ? reportsText(topStation.count)
                : "No pumping station incidents"
            }
            handle={handleFor("topStation")}
            onRemove={() => toggleCard("topStation")}
          />
        );

      case "active":
      case "monitoring":
      case "resolved": {
        const item = statusCards.find((card) => card.id === id);
        if (!item) return null;

        return (
          <StatCard
            accent={item.color}
            label={item.label}
            value={String(item.count)}
            detail={item.note}
            handle={handleFor(item.id)}
            onRemove={() => toggleCard(item.id)}
          />
        );
      }

      case "frequency":
        return (
                <Panel
                  title="Incident Frequency"
                  description="Number of reports by incident type"
                  handle={handleFor("frequency")}
                  onRemove={() => toggleCard("frequency")}
                >
                  {total === 0 ? (
                    <EmptyNote text="No incident reports in this period." />
                  ) : (
                    <ul className="space-y-7">
                      {typeCounts.map((item) => (
                        <li key={item.type}>
                          <div className="mb-2.5 flex items-center justify-between gap-4">
                            <span className="flex min-w-0 items-center gap-3 text-base font-medium text-slate-800">
                              <span
                                className="h-3 w-3 shrink-0"
                                style={{
                                  backgroundColor:
                                    INCIDENT_COLORS[item.type] ?? "#3b82f6",
                                }}
                              />
                              <span className="truncate">{item.type}</span>
                            </span>

                            <span className="shrink-0 text-base font-bold text-[#123D73]">
                              {item.count}
                              <span className="ml-2 text-sm font-medium text-slate-500">
                                ({percent(item.count)}%)
                              </span>
                            </span>
                          </div>

                          <div className="h-3 w-full bg-slate-100">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${(item.count / maxType) * 100}%`,
                                backgroundColor:
                                  INCIDENT_COLORS[item.type] ?? "#3b82f6",
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
        );

      case "trend":
        return (
                <Panel
                  title="Monthly Trend"
                  description="Reports per month, last 6 months"
                  handle={handleFor("trend")}
                  onRemove={() => toggleCard("trend")}
                >
                  <div className="flex h-72 items-end gap-5 border-b border-slate-300 px-2">
                    {monthlyTrend.map((month) => (
                      <div
                        key={month.key}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      >
                        <span className="mb-2 text-center text-sm font-bold text-[#123D73]">
                          {month.count}
                        </span>

                        <div
                          title={`${month.label} ${month.year}: ${month.count}`}
                          className="w-full bg-[#123D73]"
                          style={{
                            height: `${
                              month.count > 0
                                ? Math.max(4, (month.count / maxMonth) * 85)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-5 px-2">
                    {monthlyTrend.map((month) => (
                      <span
                        key={month.key}
                        className="min-w-0 flex-1 text-center text-sm font-medium text-slate-600"
                      >
                        {month.label}
                      </span>
                    ))}
                  </div>
                </Panel>
        );

      case "barangays":
        return (
                <Panel
                  title="Affected Barangays"
                  description={`All ${barangayCounts.length} barangays with reports. Pumping station incidents count toward every barangay they affected.`}
                  handle={handleFor("barangays")}
                  onRemove={() => toggleCard("barangays")}
                >
                  {barangayCounts.length === 0 ? (
                    <EmptyNote text="No barangay data in this period." />
                  ) : (
                    <>
                      <ol className="grid grid-cols-1 gap-x-16 gap-y-7 2xl:grid-cols-2">
                        {barangayView.pageItems.map((item, index) => {
                          // Rank continues across pages (page 2 starts at 11)
                          const rank =
                            (barangayView.page - 1) * PAGE_SIZE + index;

                          return (
                            <li key={item.code}>
                              <div className="flex items-center gap-4">
                                <span
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center text-base font-bold ${
                                    rank === 0
                                      ? "bg-[#123D73] text-white"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {rank + 1}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-4">
                                    <p
                                      title={item.name}
                                      className={`truncate text-base font-semibold ${
                                        rank === 0
                                          ? "text-[#123D73]"
                                          : "text-slate-800"
                                      }`}
                                    >
                                      {item.name}
                                    </p>

                                    <div className="flex shrink-0 items-center gap-3">
                                      <span
                                        className={`inline-block w-28 border px-3 py-1 text-center text-sm font-semibold ${statusBadge(
                                          item.status
                                        )}`}
                                      >
                                        {statusLabel(item.status)}
                                      </span>

                                      <span className="min-w-12 text-right text-base font-bold text-[#123D73]">
                                        {item.count}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-2.5 h-3 w-full bg-slate-100">
                                    <div
                                      className="h-full transition-all"
                                      style={{
                                        width: `${Math.max(
                                          4,
                                          (item.count / maxBarangay) * 100
                                        )}%`,
                                        backgroundColor: statusColor(
                                          item.status
                                        ),
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>

                      <p className="mt-8 border-t border-slate-200 pt-5 text-base text-slate-500">
                        Bar color shows the most severe current status in
                        that barangay.
                      </p>

                      <div className="-mx-6 -mb-6 mt-6 sm:-mx-8 sm:-mb-8">
                        <Pagination
                          page={barangayView.page}
                          totalPages={barangayView.totalPages}
                          total={barangayCounts.length}
                          onPageChange={setBarangayPage}
                        />
                      </div>
                    </>
                  )}
                </Panel>
        );

      case "stations":
        return (
                <Panel
                  title="Pumping Station Incidents"
                  description="Reports linked to a pumping station"
                  handle={handleFor("stations")}
                  onRemove={() => toggleCard("stations")}
                >
                  {stationCounts.length === 0 ? (
                    <EmptyNote text="No pumping station incidents in this period." />
                  ) : (
                    <>
                      <ul className="grid grid-cols-1 gap-x-16 gap-y-7 2xl:grid-cols-2">
                        {stationView.pageItems.map((item) => (
                          <li key={item.id}>
                            <div className="mb-2.5 flex items-center justify-between gap-4">
                              <span
                                title={item.name}
                                className="truncate text-base font-medium text-slate-800"
                              >
                                {item.name}
                              </span>

                              <span className="shrink-0 text-base font-bold text-[#123D73]">
                                {item.count}
                              </span>
                            </div>

                            <div className="h-3 w-full bg-slate-100">
                              <div
                                className="h-full bg-[#123D73] transition-all"
                                style={{
                                  width: `${Math.max(
                                    4,
                                    (item.count / maxStation) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="-mx-6 -mb-6 mt-8 sm:-mx-8 sm:-mb-8">
                        <Pagination
                          page={stationView.page}
                          totalPages={stationView.totalPages}
                          total={stationCounts.length}
                          onPageChange={setStationPage}
                        />
                      </div>
                    </>
                  )}
                </Panel>
        );

      default:
        return null;
    }
  }

  /* -------------------------
     RENDER
  ------------------------- */

  return (
    <div className="space-y-8 border border-[#4438A8] bg-white p-6 text-slate-900 sm:p-8">
      {/* HEADER */}
      <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-indigo-100">Analytics</p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Incident Analytics
            </h2>
            <p className="mt-2 text-base text-indigo-100">
              Add the cards you want from the list on the right. They show
              in the order you add them, and you can drag them to rearrange.
            </p>
          </div>

          <button
            onClick={() => void loadData()}
            className="border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="border border-amber-200 bg-amber-50 p-4 text-base text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* PERIOD FILTER */}
      <section className="border border-slate-300 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-bold text-slate-800">Period</p>
            <p className="mt-1 text-base text-slate-500">
              {period === "recent"
                ? `Latest ${RECENT_LIMIT} reports, newest first (${total} shown)`
                : `${total} ${total === 1 ? "report" : "reports"} in the selected period`}
            </p>
          </div>

          <div
            role="group"
            aria-label="Select period"
            className="grid grid-cols-2 sm:flex"
          >
            {PERIOD_OPTIONS.map((option) => {
              const active = period === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPeriod(option.value)}
                  className={`border px-5 py-3 text-base font-medium transition-colors sm:-ml-px sm:first:ml-0 ${
                    active
                      ? "border-[#123D73] bg-[#123D73] text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* CARDS + PICKER */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Picker: first on mobile, right side on desktop */}
        <aside className="order-first min-w-0 lg:order-last">
          <CardPicker
            selected={selectedCards}
            onToggle={toggleCard}
            onAddAll={() => setSelectedCards(ALL_CARD_IDS)}
            onClear={() => setSelectedCards([])}
          />
        </aside>

        <div className="min-w-0 space-y-8">
          {loading || !cardsLoaded ? (
            <AnalyticsSkeleton />
          ) : selectedCards.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6">
              <div className="text-center">
                <p className="text-base font-semibold text-slate-700">
                  No cards selected
                </p>
                <p className="mt-2 text-base text-slate-500">
                  Add a card from the list on the right to see it here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {selectedCards.map((id) => (
                <div
                  key={id}
                  data-card
                  onDragOver={(event) => {
                    if (!draggedId || draggedId === id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (overId !== id) setOverId(id);
                  }}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null
                      )
                    ) {
                      setOverId((current) =>
                        current === id ? null : current
                      );
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedId && draggedId !== id) {
                      moveCard(draggedId, id);
                    }
                    resetDrag();
                  }}
                  className={`min-w-0 transition-opacity ${
                    WIDE_CARDS.has(id) ? "col-span-full" : ""
                  } ${draggedId === id ? "opacity-40" : ""} ${
                    overId === id ? "ring-2 ring-[#123D73] ring-offset-4" : ""
                  }`}
                >
                  {renderCard(id)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   CARD PICKER (right side)
------------------------- */

function CardPicker({
  selected,
  onToggle,
  onAddAll,
  onClear,
}: {
  selected: CardId[];
  onToggle: (id: CardId) => void;
  onAddAll: () => void;
  onClear: () => void;
}) {
  const groups: CardGroup[] = ["summary", "status", "detail"];

  return (
    <section className="border border-slate-300 bg-white lg:sticky lg:top-4">
      <div className="border-b border-slate-200 px-6 py-5">
        <h3 className="text-lg font-bold text-[#123D73]">Cards</h3>
        <p className="mt-2 text-base text-slate-500">
          {selected.length} of {CARD_OPTIONS.length} cards shown
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Cards appear in the order you add them.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onAddAll}
            disabled={selected.length === CARD_OPTIONS.length}
            className="border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add all
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={selected.length === 0}
            className="border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {groups.map((group) => (
          <div key={group} className="px-6 py-5">
            <p className="text-sm font-semibold text-slate-500">
              {GROUP_LABELS[group]}
            </p>

            <ul className="mt-3 space-y-2">
              {CARD_OPTIONS.filter((option) => option.group === group).map(
                (option) => {
                  const added = selected.includes(option.id);

                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        aria-pressed={added}
                        onClick={() => onToggle(option.id)}
                        className={`flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left transition-colors ${
                          added
                            ? "border-[#123D73] bg-blue-50"
                            : "border-slate-300 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-sm text-slate-500">
                            {option.description}
                          </span>
                        </span>

                        <span
                          className={`shrink-0 text-sm font-semibold ${
                            added ? "text-[#123D73]" : "text-slate-600"
                          }`}
                        >
                          {added ? "Added" : "Add"}
                        </span>
                      </button>
                    </li>
                  );
                }
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${label} card`}
      className="shrink-0 border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
    >
      Remove
    </button>
  );
}

function DragHandle({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title="Drag to reorder"
      aria-hidden="true"
      className="shrink-0 cursor-grab select-none border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 active:cursor-grabbing"
    >
      Drag
    </span>
  );
}

// Every small card (highlights and status) uses this one layout, so they
// all have the same height and line up in each row.
function StatCard({
  accent,
  label,
  value,
  detail,
  handle,
  onRemove,
}: {
  accent: string;
  label: string;
  value: string;
  detail: string;
  handle: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-52 min-w-0 flex-col border border-slate-300 bg-white p-6 sm:p-7">
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />

      <div className="flex items-center justify-end gap-2">
        {handle}
        <RemoveButton label={label} onClick={onRemove} />
      </div>

      {/* Room for a two-line label so values line up across cards */}
      <p className="mt-3 min-h-10 text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 wrap-break-word text-3xl font-semibold text-[#123D73]">
        {value}
      </p>

      {/* Pinned to the bottom so every card ends at the same place */}
      <p className="mt-auto pt-3 text-base text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  handle,
  onRemove,
  children,
}: {
  title: string;
  description: string;
  handle: React.ReactNode;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border border-slate-300 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-[#123D73]">{title}</h3>
          <p className="mt-2 text-base text-slate-500">{description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {handle}
          <RemoveButton label={title} onClick={onRemove} />
        </div>
      </div>

      <div className="p-6 sm:p-8">{children}</div>
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-base text-slate-500">{text}</p>
    </div>
  );
}

/* -------------------------
   SKELETON LOADING
------------------------- */

function AnalyticsSkeleton() {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-label="Loading analytics"
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-slate-300 bg-white p-6 sm:p-7">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-4 h-9 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/3" />
          </div>
        ))}
      </div>

      <div className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   SHARED HELPERS
   (skeleton, pagination, auto refresh)
------------------------- */

const PAGE_SIZE = 10;
const REFRESH_MS = 30_000; // auto refresh every 30 seconds

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
  };
}

// Runs `refresh` every REFRESH_MS while the tab is visible, and once more
// when the user comes back to the tab.
function useAutoRefresh(
  refresh: () => void,
  enabled = true,
  intervalMs = REFRESH_MS
) {
  const latest = useRef(refresh);

  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };

    const id = window.setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", run);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, intervalMs]);
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 ${className}`}
    />
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-300 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-sm text-slate-600">
        Showing{" "}
        <span className="font-semibold text-slate-900">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-slate-900">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={btn}
        >
          Previous
        </button>

        <span className="px-3 text-sm font-semibold text-slate-700">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={btn}
        >
          Next
        </button>
      </div>
    </div>
  );
}