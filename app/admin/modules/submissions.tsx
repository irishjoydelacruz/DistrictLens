"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-log";

type Incident = {
  id: number;
  barangay_code: string | null;
  incident_type: string;
  status: string;
  etr: string | null;
  reported_at: string;
  updated_at?: string | null;
  description: string | null;
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
type IncidentAssignment = {
  incident_id: number;
  status: string;
  team: { name: string } | { name: string }[] | null;
};
type ArchiveMode = "recent" | "all" | "date" | "month" | "year";

// "Most recent" view shows only the latest reports.
const RECENT_LIMIT = 10;

const INCIDENT_TYPES = [
  "Line Rupture",
  "Water Leakage",
  "Low Water Pressure",
  "No Water Supply",
  "Water Service Interruption",
  "Water Quality Issue",
];

const STATUS_OPTIONS = [
  { value: "green", label: "Resolved / Normal" },
  { value: "yellow", label: "Monitoring" },
  { value: "red", label: "Active / Severe" },
];

const pad = (n: number) => String(n).padStart(2, "0");

// Converts a stored ETR timestamp into the "YYYY-MM-DDTHH:mm" local value
// used by the date/time picker (same format as the Create Report form).
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// UI-only class tokens, kept in one place so the look stays consistent.
// Compact on phones, roomier from the `sm` breakpoint up.
const inputClass =
  "w-full rounded-none border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 sm:px-4 sm:py-3";
const labelClass = "mb-1.5 block text-sm font-bold text-slate-800 sm:mb-2";
const btnSecondary =
  "rounded-none border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:px-5 sm:py-3";
const btnPrimary =
  "rounded-none bg-[#123D73] px-4 py-2.5 text-base font-medium text-white hover:bg-[#0D2F59] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3";

// Same size for every status / assignment badge in the table.
const badgeBase =
  "mx-auto flex h-9 w-full max-w-36 items-center justify-center gap-2 border px-2 text-center text-sm font-medium";

type DropdownOption = { value: string; label: string };

// Custom dropdown that replaces the native <select>, styled like the
// Create Report dropdowns. The list renders in a portal so it is never
// clipped by the scrolling modal.
function Dropdown({
  id,
  value,
  onChange,
  options,
  placeholder = "Select",
  searchable,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const showSearch = searchable ?? options.length > 7;
  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Always open downward; shorten the list (it scrolls) if space is tight.
    const spaceBelow = window.innerHeight - rect.bottom - 16;

    setPosition({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + 4,
      maxHeight: Math.max(120, Math.min(280, spaceBelow)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };

    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between border border-slate-300 bg-white px-3 py-2.5 text-left text-base text-slate-800 shadow-sm transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 sm:px-4 sm:py-3"
      >
        <span
          className={
            selected ? "truncate font-medium text-slate-900" : "truncate text-slate-500"
          }
        >
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
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
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-1200 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-lg"
          >
            {showSearch && (
              <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-2">
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  aria-label="Search options"
                  className="w-full border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
                />
              </div>
            )}

            <div
              role="listbox"
              className="min-h-0 max-h-56 flex-1 overflow-y-auto p-1"
            >
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`w-full px-3 py-2.5 text-left text-base transition-colors sm:px-4 sm:py-3 ${
                    option.value === value
                      ? "bg-blue-50 font-semibold text-[#123D73]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-4 py-4 text-base text-slate-500">
                  No results found.
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function getTeamName(assignment: IncidentAssignment) {
  const team = Array.isArray(assignment.team)
    ? assignment.team[0]
    : assignment.team;

  return team?.name ?? "Unnamed team";
}

function getAssignmentProgress(status: string) {
  if (status === "ongoing" || status === "in_progress") {
    return {
      label: "Ongoing",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (status === "resolved") {
    return {
      label: "Resolved",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return {
    label: "Assigned",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  };
}

export default function Submissions() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [stations, setStations] = useState<PumpingStation[]>([]);
  const [incidentBarangays, setIncidentBarangays] = useState<
    IncidentBarangay[]
  >([]);

  const [assignments, setAssignments] = useState<IncidentAssignment[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  // UI only: filters are collapsed by default on phones.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [archiveMode, setArchiveMode] = useState<ArchiveMode>("recent");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear())
  );

  const [page, setPage] = useState(1);

  const [selectedIncident, setSelectedIncident] =
    useState<Incident | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const [editForm, setEditForm] = useState({
    barangay_code: "",
    incident_type: "",
    status: "green",
    etr: "",
    description: "",
    pumping_station_id: "",
    affected_area: "",
    affected_barangay_codes: [] as string[],
  });

  const [etrOpen, setEtrOpen] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // `silent` = background refresh: no skeleton, keeps the current data
  // (and the current page / filters) if the request fails.
  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }

    const supabase = createClient();

    const [
      incidentResult,
      affectedResult,
      stationResult,
      assignmentResult,
    ] = await Promise.all([
        supabase
          .from("incidents")
          .select(
            "id, barangay_code, incident_type, status, etr, reported_at, updated_at, description, pumping_station_id, affected_area"
          )
          .order("updated_at", { ascending: false }),

        supabase
          .from("incident_barangays")
          .select("incident_id, barangay_code"),

        supabase
          .from("pumping_stations")
          .select("id, name, location"),

        supabase
          .from("deployments")
          .select("incident_id, status, team:teams(name)"),
      ]);

    // Team assignments are informational; a failure here should not
    // block the reports table.
    if (assignmentResult.error) {
      console.error(
        "Error loading deployments:",
        assignmentResult.error
      );
      if (!silent) setAssignments([]);
    } else {
      setAssignments(
        (assignmentResult.data ?? []) as unknown as IncidentAssignment[]
      );
    }

    if (incidentResult.error) {
      console.error("Error loading incidents:", incidentResult.error);

      if (!silent) {
        setLoadError(
          `Could not load submissions: ${incidentResult.error.message}`
        );
        setIncidents([]);
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

      partialError = `Reports loaded, but affected barangays could not be loaded: ${affectedResult.error.message}`;
      if (!silent) setIncidentBarangays([]);
    } else {
      setIncidentBarangays(
        (affectedResult.data ?? []) as IncidentBarangay[]
      );
    }

    if (stationResult.error) {
      console.error(
        "Error loading pumping_stations:",
        stationResult.error
      );

      if (!silent) setStations([]);
    } else {
      // Natural sort so "Pumping Station 2" comes before "Pumping Station 10".
      const sortedStations = [
        ...((stationResult.data ?? []) as PumpingStation[]),
      ].sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }) || a.id - b.id
      );

      setStations(sortedStations);
    }

    // The barangay list never changes, so only fetch it on a normal load.
    if (!silent) {
      try {
        const response = await fetch("/data/tanza-barangays.geojson");

        if (!response.ok) {
          throw new Error("Could not load barangay GeoJSON");
        }

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

  // Auto refresh (paused while a save is in progress)
  useAutoRefresh(() => void loadData(true), !saving);

  // Go back to page 1 whenever a filter changes
  // (a background refresh does NOT reset the page).
  useEffect(() => {
    setPage(1);
  }, [
    search,
    archiveMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    typeFilter,
    statusFilter,
    stationFilter,
    assignmentFilter,
  ]);

  const getBarangayName = (
    code: string | null | undefined
  ): string => {
    if (!code) return "—";

    return (
      barangays.find((item) => item.code === code)?.name ?? code
    );
  };

  const getStationName = (
    id: number | null | undefined
  ): string => {
    if (id == null) return "Barangay-based incident";

    return (
      stations.find((item) => item.id === id)?.name ??
      `Pumping Station #${id}`
    );
  };

  const getIncidentAffectedCodes = (
    incident: Incident
  ): string[] => {
    const codes = incidentBarangays
      .filter((item) => item.incident_id === incident.id)
      .map((item) => item.barangay_code);

    if (codes.length > 0) {
      return [...new Set(codes)];
    }

    if (incident.barangay_code) {
      return [incident.barangay_code];
    }

    return [];
  };

  const formatDate = (
    value: string | null | undefined
  ): string => {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatDateOnly = (value: string | null | undefined): string => {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-PH", { dateStyle: "medium" });
  };

  const formatTimeOnly = (value: string | null | undefined): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("en-PH", { timeStyle: "short" });
  };

  // Display-only: turns a stored ETR (time or timestamp) into readable text.
  // Plain text such as "2PM" is shown as-is.
  const formatEtr = (value: string | null | undefined): string => {
    if (!value) return "Not set";

    const text = value.trim();

    const timeOnly = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeOnly) {
      const d = new Date();
      d.setHours(Number(timeOnly[1]), Number(timeOnly[2]), 0, 0);
      return d.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      });
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      const d = new Date(text);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
    }

    return text;
  };

  const getStatusStyle = (status: string): string => {
    if (status === "red") {
      return "border-red-200 bg-red-50 text-red-800";
    }

    if (status === "yellow") {
      return "border-amber-200 bg-amber-50 text-amber-800";
    }

    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  };

  const getStatusDot = (status: string): string => {
    if (status === "red") return "bg-red-600";
    if (status === "yellow") return "bg-amber-500";
    return "bg-emerald-600";
  };

  const getStatusLabel = (status: string): string => {
    return (
      STATUS_OPTIONS.find((item) => item.value === status)?.label ??
      status
    );
  };

  const visibleIncidents = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matches = incidents.filter((incident) => {
      const reported = new Date(incident.reported_at);
      const validDate = !Number.isNaN(reported.getTime());

      const dateKey = validDate
        ? `${reported.getFullYear()}-${String(
            reported.getMonth() + 1
          ).padStart(2, "0")}-${String(
            reported.getDate()
          ).padStart(2, "0")}`
        : "";

      const monthKey = validDate
        ? `${reported.getFullYear()}-${String(
            reported.getMonth() + 1
          ).padStart(2, "0")}`
        : "";

      if (
        archiveMode === "date" &&
        (!selectedDate || dateKey !== selectedDate)
      ) {
        return false;
      }

      if (
        archiveMode === "month" &&
        (!selectedMonth || monthKey !== selectedMonth)
      ) {
        return false;
      }

      if (
        archiveMode === "year" &&
        (!selectedYear ||
          String(reported.getFullYear()) !== selectedYear)
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        incident.incident_type !== typeFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        incident.status !== statusFilter
      ) {
        return false;
      }

      if (
        stationFilter !== "all" &&
        String(incident.pumping_station_id ?? "none") !==
          stationFilter
      ) {
        return false;
      }

      if (assignmentFilter !== "all") {
        const hasTeam = assignments.some(
          (item) => item.incident_id === incident.id
        );

        if (assignmentFilter === "assigned" && !hasTeam) return false;
        if (assignmentFilter === "unassigned" && hasTeam) return false;
      }

      if (!term) return true;

      const stationName = getStationName(
        incident.pumping_station_id
      );

      const affectedNames = getIncidentAffectedCodes(incident)
        .map(getBarangayName)
        .join(" ");

      const haystack = [
        String(incident.id),
        incident.incident_type,
        incident.status,
        incident.barangay_code ?? "",
        getBarangayName(incident.barangay_code),
        stationName,
        incident.affected_area ?? "",
        affectedNames,
        incident.description ?? "",
        incident.etr ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });

    if (archiveMode === "recent") {
      return [...matches]
        .sort(
          (a, b) =>
            new Date(b.updated_at ?? b.reported_at).getTime() -
            new Date(a.updated_at ?? a.reported_at).getTime()
        )
        .slice(0, RECENT_LIMIT);
    }

    return matches;
  }, [
    incidents,
    search,
    archiveMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    typeFilter,
    statusFilter,
    stationFilter,
    assignmentFilter,
    assignments,
    barangays,
    stations,
    incidentBarangays,
  ]);

  // Pagination (10 per page)
  const {
    pageItems: pagedIncidents,
    page: currentPage,
    totalPages,
  } = paginate(visibleIncidents, page);

  const openView = (incident: Incident) => {
    setSelectedIncident(incident);
    setEditing(false);
    setActionError("");
  };

  // FIX: Use the checked incident parameter instead of nullable state.
  const beginEdit = (
    incident: Incident | null = selectedIncident
  ) => {
    if (!incident) return;

    const codes = getIncidentAffectedCodes(incident);

    setSelectedIncident(incident);

    setEditForm({
      barangay_code: incident.barangay_code ?? "",
      incident_type: incident.incident_type,
      status: incident.status,
      etr: toLocalInput(incident.etr),
      description: incident.description ?? "",
      pumping_station_id:
        incident.pumping_station_id != null
          ? String(incident.pumping_station_id)
          : "",
      affected_area: incident.affected_area ?? "",
      affected_barangay_codes: codes,
    });

    setActionError("");
    setEtrOpen(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selectedIncident) return;

    setSaving(true);
    setActionError("");

    const supabase = createClient();
    const incidentId = selectedIncident.id;
    const isStationIncident = Boolean(editForm.pumping_station_id);

    const updatedFields = {
      barangay_code: isStationIncident
        ? null
        : editForm.barangay_code || null,
      incident_type: editForm.incident_type,
      status: editForm.status,
      etr: editForm.etr ? new Date(editForm.etr).toISOString() : null,
      description: editForm.description.trim() || null,
      pumping_station_id: isStationIncident
        ? Number(editForm.pumping_station_id)
        : null,
      affected_area: editForm.affected_area.trim() || null,
    };

    const { data, error } = await supabase
      .from("incidents")
      .update(updatedFields)
      .eq("id", incidentId)
      .select(
        "id, barangay_code, incident_type, status, etr, reported_at, updated_at, description, pumping_station_id, affected_area"
      )
      .single();

    if (error) {
      console.error("Error updating incident:", error);

      setActionError(
        `Could not save report changes: ${error.message}`
      );
      setSaving(false);
      return;
    }

    const statusNote =
      selectedIncident.status !== editForm.status
        ? ` Status changed from ${getStatusLabel(selectedIncident.status)} to ${getStatusLabel(editForm.status)}.`
        : "";

    await logActivity({
      action: "report.update",
      entityType: "incident",
      entityId: incidentId,
      details: `updated incident report INC-${String(incidentId).padStart(4, "0")}.${statusNote}`,
    });

    const desiredCodes = isStationIncident
      ? [...new Set(editForm.affected_barangay_codes)]
      : [];

    const { error: deleteLinksError } = await supabase
      .from("incident_barangays")
      .delete()
      .eq("incident_id", incidentId);

    if (deleteLinksError) {
      console.error(
        "Error clearing incident barangay links:",
        deleteLinksError
      );

      setActionError(
        `The report was saved, but affected barangays could not be updated: ${deleteLinksError.message}`
      );
    } else if (desiredCodes.length > 0) {
      const rows = desiredCodes.map((barangay_code) => ({
        incident_id: incidentId,
        barangay_code,
      }));

      const { error: insertLinksError } = await supabase
        .from("incident_barangays")
        .insert(rows);

      if (insertLinksError) {
        console.error(
          "Error saving incident barangay links:",
          insertLinksError
        );

        setActionError(
          `The report was saved, but affected barangays could not be updated: ${insertLinksError.message}`
        );
      }
    }

    const updated = data as Incident;

    setIncidents((current) =>
      current.map((item) =>
        item.id === updated.id ? updated : item
      )
    );

    const { data: freshLinks } = await supabase
      .from("incident_barangays")
      .select("incident_id, barangay_code")
      .eq("incident_id", incidentId);

    if (freshLinks) {
      setIncidentBarangays((current) => [
        ...current.filter(
          (item) => item.incident_id !== incidentId
        ),
        ...(freshLinks as IncidentBarangay[]),
      ]);
    }

    setSelectedIncident(updated);
    setEditing(false);
    setSaving(false);
  };

  const closeModal = () => {
    setSelectedIncident(null);
    setConfirmSave(false);
    setEditing(false);
    setActionError("");
  };

  const years = Array.from(
    new Set(
      incidents
        .map((item) => {
          const date = new Date(item.reported_at);

          return Number.isNaN(date.getTime())
            ? ""
            : String(date.getFullYear());
        })
        .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));

  // UI only: number of active filters, shown on the mobile Filters button.
  const activeFilterCount = [
    archiveMode !== "recent",
    typeFilter !== "all",
    statusFilter !== "all",
    stationFilter !== "all",
    assignmentFilter !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-4 border border-[#4438A8] bg-white p-3 text-slate-900 sm:space-y-6 sm:p-8">
      <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold text-indigo-100 sm:text-sm">
              Submissions
            </p>
            <h2 className="mt-1 text-xl font-bold text-white sm:mt-2 sm:text-2xl">
              Incident Reports
            </h2>
            <p className="mt-2 hidden text-base text-indigo-100 sm:block">
              View full report details or edit the report and its affected
              barangays.
            </p>
          </div>

          <button
            onClick={() => void loadData()}
            className="shrink-0 border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 sm:px-5 sm:py-2.5 sm:text-base"
          >
            Refresh
          </button>
        </div>
      </div>

      <section className="border border-slate-300 bg-white p-4 sm:p-8">
        <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end">
          <div className="flex items-end gap-2 lg:contents">
            <div className="min-w-0 flex-1">
              <label htmlFor="submission-search" className={labelClass}>
                Search
              </label>

              <input
                id="submission-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, incident, station, barangay, description"
                className={inputClass}
              />
            </div>

            {/* Phone only: collapse / expand the rest of the filters */}
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="submission-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex shrink-0 items-center gap-2 border border-slate-300 bg-white px-3 py-2.5 text-base font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 sm:px-4 lg:hidden"
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-[#123D73] px-1.5 text-xs font-semibold leading-5 text-white">
                  {activeFilterCount}
                </span>
              )}
              <svg
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                  filtersOpen ? "rotate-180" : ""
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
            </button>
          </div>

          <div
            id="submission-filters"
            className={`${
              filtersOpen ? "block" : "hidden"
            } w-full lg:block lg:w-56`}
          >
            <label htmlFor="archive-mode" className={labelClass}>
              Archive view
            </label>

            <Dropdown
              id="archive-mode"
              value={archiveMode}
              onChange={(v) => setArchiveMode(v as ArchiveMode)}
              options={[
                { value: "recent", label: "Most recent" },
                { value: "all", label: "All reports" },
                { value: "date", label: "Specific date" },
                { value: "month", label: "By month" },
                { value: "year", label: "By year" },
              ]}
            />
          </div>

          {archiveMode === "date" && (
            <div
              className={`${
                filtersOpen ? "block" : "hidden"
              } w-full lg:block lg:w-52`}
            >
              <label htmlFor="archive-date" className={labelClass}>
                Date
              </label>

              <input
                id="archive-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {archiveMode === "month" && (
            <div
              className={`${
                filtersOpen ? "block" : "hidden"
              } w-full lg:block lg:w-52`}
            >
              <label htmlFor="archive-month" className={labelClass}>
                Month
              </label>

              <input
                id="archive-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {archiveMode === "year" && (
            <div
              className={`${
                filtersOpen ? "block" : "hidden"
              } w-full lg:block lg:w-44`}
            >
              <label htmlFor="archive-year" className={labelClass}>
                Year
              </label>

              <Dropdown
                id="archive-year"
                value={selectedYear}
                onChange={setSelectedYear}
                options={[
                  { value: "", label: "All years" },
                  ...years.map((year) => ({ value: year, label: year })),
                ]}
              />
            </div>
          )}
        </div>

        <div
          className={`${
            filtersOpen ? "grid" : "hidden"
          } mt-3 grid-cols-2 gap-3 sm:mt-5 sm:gap-5 lg:grid lg:grid-cols-4 [&_label]:truncate`}
        >
          <div>
            <label htmlFor="type-filter" className={labelClass}>
              Incident type
            </label>

            <Dropdown
              id="type-filter"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All types" },
                ...Array.from(
                  new Set([
                    ...INCIDENT_TYPES,
                    ...incidents.map((item) => item.incident_type),
                  ])
                ).map((type) => ({ value: type, label: type })),
              ]}
            />
          </div>

          <div>
            <label htmlFor="status-filter" className={labelClass}>
              Status
            </label>

            <Dropdown
              id="status-filter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All statuses" },
                ...STATUS_OPTIONS,
              ]}
            />
          </div>

          <div>
            <label htmlFor="assignment-filter" className={labelClass}>
              Team assignment
            </label>

            <Dropdown
              id="assignment-filter"
              value={assignmentFilter}
              onChange={setAssignmentFilter}
              options={[
                { value: "all", label: "All reports" },
                { value: "assigned", label: "Assigned to a team" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
          </div>

          <div>
            <label htmlFor="station-filter" className={labelClass}>
              Location type / station
            </label>

            <Dropdown
              id="station-filter"
              value={stationFilter}
              onChange={setStationFilter}
              options={[
                { value: "all", label: "All locations" },
                { value: "none", label: "Barangay-based only" },
                ...stations.map((station) => ({
                  value: String(station.id),
                  label: station.name,
                })),
                ...Array.from(
                  new Set<number>(
                    incidents
                      .filter(
                        (item) =>
                          item.pumping_station_id != null &&
                          !stations.some(
                            (station) =>
                              station.id === item.pumping_station_id
                          )
                      )
                      .map((item) => item.pumping_station_id as number)
                  )
                ).map((stationId) => ({
                  value: String(stationId),
                  label: `Pumping Station #${stationId}`,
                })),
              ]}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:mt-6 sm:gap-3 sm:pt-5 sm:text-base">
          <span>
            {visibleIncidents.length}{" "}
            {visibleIncidents.length === 1 ? "report" : "reports"} shown
            <span className="hidden sm:inline">
              <span className="mx-2 text-slate-300">|</span>
              {archiveMode === "recent"
                ? `Latest ${RECENT_LIMIT} reports by recent activity`
                : "Most recently updated first"}
            </span>
          </span>

          <button
            onClick={() => {
              setSearch("");
              setArchiveMode("recent");
              setSelectedDate("");
              setSelectedMonth(new Date().toISOString().slice(0, 7));
              setSelectedYear(String(new Date().getFullYear()));
              setTypeFilter("all");
              setStatusFilter("all");
              setStationFilter("all");
              setAssignmentFilter("all");
            }}
            className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden border border-[#4438A8] bg-white">

        {loadError && (
          <div
            role="alert"
            className="m-4 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:m-6 sm:text-base"
          >
            {loadError}
          </div>
        )}

        {/* Desktop table (hidden on phones / tablets) */}
        <div className="hidden overflow-x-auto lg:block lg:overflow-visible">
          <table className="w-full min-w-275 table-fixed text-left lg:min-w-0 [&_td]:wrap-break-word [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-r [&_th]:border-white/20 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
              <tr>
                {[
                  { label: "Report", center: false },
                  { label: "Location", center: false },
                  { label: "Affected Barangays / Area", center: false },
                  { label: "Status", center: true },
                  { label: "Assigned Team", center: true },
                  { label: "Reported At", center: false },
                  { label: "Actions", center: true },
                ].map(({ label, center }) => (
                  <th
                    key={label}
                    className={`px-4 py-4 text-xs font-semibold uppercase tracking-wide text-indigo-50 xl:text-sm ${
                      center ? "text-center" : ""
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="align-middle">
                    <td className="px-4 py-5">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="mt-2 h-4 w-1/3" />
                      <Skeleton className="mt-3 h-4 w-full" />
                    </td>

                    <td className="px-4 py-5">
                      <Skeleton className="h-5 w-4/5" />
                      <Skeleton className="mt-2 h-4 w-1/2" />
                    </td>

                    <td className="px-4 py-5">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="mt-2 h-5 w-full" />
                      <Skeleton className="mt-4 h-4 w-1/3" />
                      <Skeleton className="mt-2 h-5 w-2/3" />
                    </td>

                    <td className="px-4 py-5">
                      <Skeleton className="mx-auto h-9 w-full max-w-36" />
                    </td>

                    <td className="px-4 py-5">
                      <Skeleton className="mx-auto h-5 w-3/4" />
                      <Skeleton className="mx-auto mt-2 h-9 w-full max-w-36" />
                    </td>

                    <td className="px-4 py-5">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="mt-2 h-4 w-14" />
                    </td>

                    <td className="px-2 py-5">
                      <div className="flex justify-center gap-2">
                        <Skeleton className="h-9 w-16" />
                        <Skeleton className="h-9 w-16" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : visibleIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <p className="text-base font-semibold text-slate-900">
                      No matching submissions
                    </p>
                    <p className="mt-2 text-base text-slate-500">
                      Try changing your search or archive filters.
                    </p>
                  </td>
                </tr>
              ) : (
                pagedIncidents.map((incident) => {
                  const affectedCodes =
                    getIncidentAffectedCodes(incident);

                  const affectedNames =
                    affectedCodes.map(getBarangayName);

                  const station = stations.find(
                    (item) =>
                      item.id === incident.pumping_station_id
                  );

                  const incidentAssignments = assignments.filter(
                    (item) => item.incident_id === incident.id
                  );

                  return (
                    <tr
                      key={incident.id}
                      className="align-middle hover:bg-slate-50"
                    >
                      <td className="px-4 py-5">
                        <p className="text-base font-semibold text-slate-900">
                          {incident.incident_type}
                        </p>
                        <p className="mt-1 font-mono text-sm text-slate-500">
                          INC-{String(incident.id).padStart(4, "0")}
                        </p>
                        {incident.description && (
                          <p className="mt-3 max-w-sm line-clamp-2 wrap-break-word text-sm leading-6 text-slate-600">
                            {incident.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-5">
                        <p className="text-base text-slate-900">
                          {getStationName(
                            incident.pumping_station_id
                          )}
                        </p>

                        {incident.pumping_station_id != null &&
                          station?.location && (
                            <p className="mt-1 text-sm text-slate-500">
                              {station.location}
                            </p>
                          )}

                        {incident.pumping_station_id == null &&
                          incident.barangay_code && (
                            <p className="mt-1 text-sm text-slate-500">
                              {getBarangayName(
                                incident.barangay_code
                              )}
                            </p>
                          )}
                      </td>

                      <td className="px-4 py-5">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-500">
                              {affectedNames.length > 1
                                ? "Barangays"
                                : "Barangay"}
                            </p>
                            <p className="mt-1 wrap-break-word text-base leading-6 text-slate-900">
                              {affectedNames.length > 0
                                ? affectedNames.join(", ")
                                : "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-500">
                              Affected area
                            </p>
                            <p
                              title={incident.affected_area ?? ""}
                              className="mt-1 line-clamp-3 wrap-break-word text-base leading-6 text-slate-900"
                            >
                              {incident.affected_area || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        <span
                          className={`${badgeBase} ${getStatusStyle(
                            incident.status
                          )}`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${getStatusDot(
                              incident.status
                            )}`}
                          />
                          {getStatusLabel(incident.status)}
                        </span>
                      </td>

                      <td className="px-4 py-5">
                        {incidentAssignments.length === 0 ? (
                          <span
                            className={`${badgeBase} border-dashed border-slate-300 bg-white text-slate-500`}
                          >
                            Unassigned
                          </span>
                        ) : (
                          <div className="space-y-3">
                            {incidentAssignments.map(
                              (assignment, index) => {
                                const progress =
                                  getAssignmentProgress(
                                    assignment.status
                                  );

                                return (
                                  <div
                                    key={index}
                                    className="text-center"
                                  >
                                    <p className="text-base font-semibold text-slate-900">
                                      {getTeamName(assignment)}
                                    </p>
                                    <span
                                      className={`${badgeBase} mt-1.5 font-semibold ${progress.className}`}
                                    >
                                      {progress.label}
                                    </span>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-5">
                        <p className="text-base text-slate-900">
                          {formatDateOnly(incident.reported_at)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatTimeOnly(incident.reported_at)}
                        </p>
                        {incident.updated_at &&
                          new Date(incident.updated_at).getTime() -
                            new Date(incident.reported_at).getTime() >
                            60000 && (
                            <p className="mt-2 text-xs font-semibold text-[#123D73]">
                              Updated {formatDateOnly(incident.updated_at)},{" "}
                              {formatTimeOnly(incident.updated_at)}
                            </p>
                          )}
                      </td>

                      <td className="px-2 py-5">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            onClick={() => openView(incident)}
                            className="h-9 w-16 border border-slate-300 bg-white text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            View
                          </button>

                          {/* FIX: Pass the incident through a callback. */}
                          <button
                            onClick={() => beginEdit(incident)}
                            className="h-9 w-16 bg-[#123D73] text-center text-sm font-medium text-white transition-colors hover:bg-[#0D2F59]"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list (replaces the wide table below lg) */}
        <div className="divide-y divide-slate-300 lg:hidden">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </div>
            ))
          ) : visibleIncidents.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-base font-semibold text-slate-900">
                No matching submissions
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Try changing your search or archive filters.
              </p>
            </div>
          ) : (
            pagedIncidents.map((incident) => {
              const affectedNames =
                getIncidentAffectedCodes(incident).map(getBarangayName);

              const station = stations.find(
                (item) => item.id === incident.pumping_station_id
              );

              const incidentAssignments = assignments.filter(
                (item) => item.incident_id === incident.id
              );

              return (
                <article key={incident.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-snug text-slate-900">
                        {incident.incident_type}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        INC-{String(incident.id).padStart(4, "0")}
                      </p>
                    </div>

                    <span
                      className={`inline-flex h-7 shrink-0 items-center gap-1.5 border px-2 text-xs font-medium ${getStatusStyle(
                        incident.status
                      )}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDot(
                          incident.status
                        )}`}
                      />
                      {getStatusLabel(incident.status)}
                    </span>
                  </div>

                  {incident.description && (
                    <p className="mt-2 line-clamp-2 wrap-break-word text-sm leading-5 text-slate-600">
                      {incident.description}
                    </p>
                  )}

                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex gap-3">
                      <dt className="w-20 shrink-0 font-semibold text-slate-500">
                        Location
                      </dt>
                      <dd className="min-w-0 wrap-break-word text-slate-900">
                        {getStationName(incident.pumping_station_id)}
                        {incident.pumping_station_id != null &&
                          station?.location && (
                            <span className="block text-xs text-slate-500">
                              {station.location}
                            </span>
                          )}
                        {incident.pumping_station_id == null &&
                          incident.barangay_code && (
                            <span className="block text-xs text-slate-500">
                              {getBarangayName(incident.barangay_code)}
                            </span>
                          )}
                      </dd>
                    </div>

                    <div className="flex gap-3">
                      <dt className="w-20 shrink-0 font-semibold text-slate-500">
                        {affectedNames.length > 1 ? "Barangays" : "Barangay"}
                      </dt>
                      <dd className="min-w-0 wrap-break-word text-slate-900">
                        {affectedNames.length > 0
                          ? affectedNames.join(", ")
                          : "—"}
                      </dd>
                    </div>

                    {incident.affected_area && (
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 font-semibold text-slate-500">
                          Area
                        </dt>
                        <dd className="line-clamp-2 min-w-0 wrap-break-word text-slate-900">
                          {incident.affected_area}
                        </dd>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <dt className="w-20 shrink-0 font-semibold text-slate-500">
                        Team
                      </dt>
                      <dd className="min-w-0">
                        {incidentAssignments.length === 0 ? (
                          <span className="text-slate-500">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {incidentAssignments.map((assignment, index) => {
                              const progress = getAssignmentProgress(
                                assignment.status
                              );

                              return (
                                <span
                                  key={index}
                                  className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium ${progress.className}`}
                                >
                                  {getTeamName(assignment)}
                                  <span className="opacity-70">·</span>
                                  {progress.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </dd>
                    </div>

                    <div className="flex gap-3">
                      <dt className="w-20 shrink-0 font-semibold text-slate-500">
                        Reported
                      </dt>
                      <dd className="min-w-0 text-slate-900">
                        {formatDateOnly(incident.reported_at)},{" "}
                        {formatTimeOnly(incident.reported_at)}
                        {incident.updated_at &&
                          new Date(incident.updated_at).getTime() -
                            new Date(incident.reported_at).getTime() >
                            60000 && (
                            <span className="block text-xs font-semibold text-[#123D73]">
                              Updated {formatDateOnly(incident.updated_at)},{" "}
                              {formatTimeOnly(incident.updated_at)}
                            </span>
                          )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openView(incident)}
                      className="h-10 border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      View
                    </button>
                    <button
                      onClick={() => beginEdit(incident)}
                      className="h-10 bg-[#123D73] text-sm font-medium text-white transition-colors hover:bg-[#0D2F59]"
                    >
                      Edit
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {!loading && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={visibleIncidents.length}
            onPageChange={setPage}
          />
        )}
      </section>

      {selectedIncident &&
        createPortal(
        <div
          className="fixed inset-0 z-1000 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-modal-title"
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden border border-[#4438A8] bg-white shadow-lg sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="flex shrink-0 items-start justify-between border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-4 py-4 sm:px-8 sm:py-5">
              <div>
                <h2
                  id="incident-modal-title"
                  className="text-xl font-bold text-white"
                >
                  {editing
                    ? "Edit Incident Report"
                    : "Incident Report"}
                </h2>
                <p className="mt-1 font-mono text-sm text-indigo-100">
                  INC-
                  {String(selectedIncident.id).padStart(4, "0")}
                </p>
              </div>

              <button
                aria-label="Close modal"
                onClick={closeModal}
                className="rounded-md px-3 py-1 text-2xl leading-none text-indigo-100 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>

            {editing ? (
              <div className="space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                  <div>
                    <label className={labelClass}>Location type</label>

                    <Dropdown
                      value={
                        editForm.pumping_station_id
                          ? "station"
                          : "barangay"
                      }
                      onChange={(v) =>
                        setEditForm((current) => ({
                          ...current,
                          pumping_station_id:
                            v === "station"
                              ? current.pumping_station_id ||
                                (stations[0]
                                  ? String(stations[0].id)
                                  : "")
                              : "",
                          affected_barangay_codes:
                            v === "station"
                              ? current.affected_barangay_codes
                              : [],
                        }))
                      }
                      options={[
                        {
                          value: "barangay",
                          label: "Barangay-based incident",
                        },
                        {
                          value: "station",
                          label: "Pumping station incident",
                        },
                      ]}
                    />
                  </div>

                  {editForm.pumping_station_id ? (
                    <div>
                      <label className={labelClass}>
                        Pumping station
                      </label>

                      <Dropdown
                        value={editForm.pumping_station_id}
                        onChange={(v) =>
                          setEditForm((current) => ({
                            ...current,
                            pumping_station_id: v,
                          }))
                        }
                        placeholder="Select station"
                        options={stations.map((station) => ({
                          value: String(station.id),
                          label: station.name,
                        }))}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Barangay</label>

                      <Dropdown
                        value={editForm.barangay_code}
                        onChange={(v) =>
                          setEditForm((current) => ({
                            ...current,
                            barangay_code: v,
                          }))
                        }
                        placeholder="Select barangay"
                        options={barangays.map((item) => ({
                          value: item.code,
                          label: item.name,
                        }))}
                      />
                    </div>
                  )}
                </div>

                {editForm.pumping_station_id && (
                  <div>
                    <label className={labelClass}>
                      Affected barangays
                    </label>

                    <div className="max-h-64 overflow-y-auto rounded-md border border-slate-300 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {barangays.map((item) => (
                          <label
                            key={item.code}
                            className="flex items-center gap-3 text-base text-slate-700"
                          >
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-slate-300 accent-[#123D73]"
                              checked={editForm.affected_barangay_codes.includes(
                                item.code
                              )}
                              onChange={(e) =>
                                setEditForm((current) => ({
                                  ...current,
                                  affected_barangay_codes:
                                    e.target.checked
                                      ? [
                                          ...current.affected_barangay_codes,
                                          item.code,
                                        ]
                                      : current.affected_barangay_codes.filter(
                                          (code) =>
                                            code !== item.code
                                        ),
                                }))
                              }
                            />
                            {item.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Select every barangay affected by this station
                      incident.
                    </p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                  <div>
                    <label className={labelClass}>Incident type</label>

                    <Dropdown
                      value={editForm.incident_type}
                      onChange={(v) =>
                        setEditForm((current) => ({
                          ...current,
                          incident_type: v,
                        }))
                      }
                      placeholder="Select incident type"
                      options={[
                        ...(editForm.incident_type &&
                        !INCIDENT_TYPES.includes(editForm.incident_type)
                          ? [
                              {
                                value: editForm.incident_type,
                                label: editForm.incident_type,
                              },
                            ]
                          : []),
                        ...INCIDENT_TYPES.map((type) => ({
                          value: type,
                          label: type,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Status</label>

                    <Dropdown
                      value={editForm.status}
                      onChange={(v) =>
                        setEditForm((current) => ({
                          ...current,
                          status: v,
                        }))
                      }
                      placeholder="Select status"
                      options={[
                        ...(editForm.status &&
                        !STATUS_OPTIONS.some(
                          (option) => option.value === editForm.status
                        )
                          ? [
                              {
                                value: editForm.status,
                                label: editForm.status,
                              },
                            ]
                          : []),
                        ...STATUS_OPTIONS,
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-5 sm:space-y-6">
                  <div>
                    <label className={labelClass}>Affected area</label>

                    <input
                      type="text"
                      value={editForm.affected_area}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          affected_area: e.target.value,
                        })
                      }
                      placeholder="Describe the affected area"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Estimated time of resolution
                    </label>

                    <button
                      type="button"
                      aria-expanded={etrOpen}
                      onClick={() => {
                        setEtrOpen((open) => !open);
                        const base = editForm.etr
                          ? new Date(editForm.etr)
                          : new Date();
                        if (!Number.isNaN(base.getTime())) {
                          setCalendarMonth(
                            new Date(
                              base.getFullYear(),
                              base.getMonth(),
                              1
                            )
                          );
                        }
                      }}
                      className={`${inputClass} flex items-center justify-between text-left`}
                    >
                      <span
                        className={
                          editForm.etr
                            ? "text-slate-900"
                            : "text-slate-400"
                        }
                      >
                        {editForm.etr
                          ? formatEtr(editForm.etr)
                          : "Select date and time"}
                      </span>
                      <svg
                        className="h-4 w-4 text-slate-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <rect x="3.5" y="5" width="17" height="16" rx="1.5" />
                        <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
                      </svg>
                    </button>

                    {etrOpen && (
                      <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            aria-label="Previous month"
                            onClick={() =>
                              setCalendarMonth(
                                new Date(
                                  calendarMonth.getFullYear(),
                                  calendarMonth.getMonth() - 1,
                                  1
                                )
                              )
                            }
                            className="rounded-md border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50"
                          >
                            ‹
                          </button>

                          <p className="text-sm font-semibold text-slate-900">
                            {calendarMonth.toLocaleDateString("en-PH", {
                              month: "long",
                              year: "numeric",
                            })}
                          </p>

                          <button
                            type="button"
                            aria-label="Next month"
                            onClick={() =>
                              setCalendarMonth(
                                new Date(
                                  calendarMonth.getFullYear(),
                                  calendarMonth.getMonth() + 1,
                                  1
                                )
                              )
                            }
                            className="rounded-md border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50"
                          >
                            ›
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm font-semibold text-slate-500">
                          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                            (day) => (
                              <span key={day} className="py-1">
                                {day}
                              </span>
                            )
                          )}
                        </div>

                        <div className="mt-1 grid grid-cols-7 gap-1">
                          {Array.from(
                            {
                              length: new Date(
                                calendarMonth.getFullYear(),
                                calendarMonth.getMonth(),
                                1
                              ).getDay(),
                            },
                            (_, index) => (
                              <span key={`empty-${index}`} />
                            )
                          )}

                          {Array.from(
                            {
                              length: new Date(
                                calendarMonth.getFullYear(),
                                calendarMonth.getMonth() + 1,
                                0
                              ).getDate(),
                            },
                            (_, index) => {
                              const day = index + 1;
                              const dateValue = `${calendarMonth.getFullYear()}-${pad(
                                calendarMonth.getMonth() + 1
                              )}-${pad(day)}`;
                              const isSelected =
                                editForm.etr.split("T")[0] === dateValue;
                              const isToday =
                                new Date().toDateString() ===
                                new Date(
                                  calendarMonth.getFullYear(),
                                  calendarMonth.getMonth(),
                                  day
                                ).toDateString();

                              return (
                                <button
                                  key={dateValue}
                                  type="button"
                                  onClick={() =>
                                    setEditForm((current) => ({
                                      ...current,
                                      etr: `${dateValue}T${
                                        current.etr.split("T")[1] || "12:00"
                                      }`,
                                    }))
                                  }
                                  className={`h-9 rounded text-sm ${
                                    isSelected
                                      ? "bg-[#123D73] font-semibold text-white"
                                      : isToday
                                      ? "border border-[#123D73] text-[#123D73] hover:bg-slate-100"
                                      : "text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            }
                          )}
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <label className={labelClass}>Time</label>

                          <input
                            type="time"
                            value={editForm.etr.split("T")[1] || ""}
                            onChange={(e) =>
                              setEditForm((current) => {
                                const today = new Date();
                                const datePart =
                                  current.etr.split("T")[0] ||
                                  `${today.getFullYear()}-${pad(
                                    today.getMonth() + 1
                                  )}-${pad(today.getDate())}`;
                                return {
                                  ...current,
                                  etr: `${datePart}T${e.target.value}`,
                                };
                              })
                            }
                            className={inputClass}
                          />
                        </div>

                        <div className="mt-4 flex justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setEditForm((current) => ({
                                ...current,
                                etr: "",
                              }))
                            }
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Clear
                          </button>

                          <button
                            type="button"
                            onClick={() => setEtrOpen(false)}
                            className={btnPrimary}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Description</label>

                  <textarea
                    rows={4}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe the incident"
                    className={inputClass}
                  />
                </div>

                {actionError && (
                  <p
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {actionError}
                  </p>
                )}

                <div className="flex gap-2 border-t border-slate-200 pt-4 sm:justify-end sm:gap-3">
                  <button
                    disabled={saving}
                    onClick={() => {
                      setEditing(false);
                      setActionError("");
                    }}
                    className={`${btnSecondary} flex-1 sm:flex-none`}
                  >
                    Cancel
                  </button>

                  <button
                    disabled={
                      saving ||
                      !editForm.incident_type ||
                      (editForm.pumping_station_id
                        ? !editForm.pumping_station_id
                        : !editForm.barangay_code)
                    }
                    onClick={() => setConfirmSave(true)}
                    className={`${btnPrimary} flex-1 sm:flex-none`}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 overflow-y-auto p-4 sm:space-y-7 sm:p-8">
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 sm:gap-y-6">
                  <div>
                    <dt className="text-sm font-semibold text-slate-500">
                      Incident type
                    </dt>
                    <dd className="mt-1.5 text-base text-slate-900">
                      {selectedIncident.incident_type}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-semibold text-slate-500">
                      Location
                    </dt>
                    <dd className="mt-1.5 text-base text-slate-900">
                      {selectedIncident.pumping_station_id != null
                        ? getStationName(
                            selectedIncident.pumping_station_id
                          )
                        : getBarangayName(
                            selectedIncident.barangay_code
                          )}
                    </dd>

                    {selectedIncident.pumping_station_id != null && (
                      <dd className="mt-1 text-sm text-slate-500">
                        {stations.find(
                          (item) =>
                            item.id ===
                            selectedIncident.pumping_station_id
                        )?.location ?? "Station location not available"}
                      </dd>
                    )}
                  </div>

                  <div>
                    <dt className="text-sm font-semibold text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-1">
                      <span
                        className={`inline-flex w-44 items-center justify-center gap-2 rounded border px-3 py-1.5 text-sm font-medium ${getStatusStyle(
                          selectedIncident.status
                        )}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${getStatusDot(
                            selectedIncident.status
                          )}`}
                        />
                        {getStatusLabel(selectedIncident.status)}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-semibold text-slate-500">
                      Estimated time of resolution
                    </dt>
                    <dd className="mt-1.5 text-base text-slate-900">
                      {formatEtr(selectedIncident.etr)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-semibold text-slate-500">
                      Reported at
                    </dt>
                    <dd className="mt-1.5 text-base text-slate-900">
                      {formatDate(selectedIncident.reported_at)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-semibold text-slate-500">
                      Report ID
                    </dt>
                    <dd className="mt-1.5 font-mono text-base text-slate-900">
                      INC-
                      {String(selectedIncident.id).padStart(4, "0")}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-slate-200 pt-5">
                  <p className="text-sm font-semibold text-slate-500">
                    Affected barangays
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {getIncidentAffectedCodes(selectedIncident).length >
                    0 ? (
                      getIncidentAffectedCodes(selectedIncident).map(
                        (code) => (
                          <span
                            key={code}
                            className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-base text-slate-700"
                          >
                            {getBarangayName(code)}
                          </span>
                        )
                      )
                    ) : (
                      <span className="text-base text-slate-500">
                        No affected barangays recorded.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Affected area
                  </p>
                  <div className="mt-2 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-base leading-7 text-slate-700">
                    {selectedIncident.affected_area ||
                      "No affected area specified."}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Description
                  </p>
                  <div className="mt-2 min-h-20 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-base leading-7 text-slate-700">
                    {selectedIncident.description ||
                      "No description provided."}
                  </div>
                </div>

                {actionError && (
                  <p
                    role="alert"
                    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    {actionError}
                  </p>
                )}

                <div className="flex gap-2 border-t border-slate-200 pt-4 sm:justify-between">
                  <button
                    onClick={closeModal}
                    className={`${btnSecondary} flex-1 sm:flex-none`}
                  >
                    Close
                  </button>

                  <button
                    onClick={() => beginEdit(selectedIncident)}
                    className={`${btnPrimary} flex-1 sm:flex-none`}
                  >
                    Edit Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
        )}

      {confirmSave &&
        selectedIncident &&
        createPortal(
          <div
            className="fixed inset-0 z-1100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
            role="presentation"
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-save-title"
              aria-describedby="confirm-save-message"
              className="w-full max-w-md border border-[#DCD6FF] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEEAFE] text-[#5145B5]">
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.75 3h14.9a2 2 0 0 0 1.75-3l-7.45-13.1a2 2 0 0 0-3.45 0Z"
                  />
                </svg>
              </div>

              <h2
                id="confirm-save-title"
                className="mt-5 text-center text-xl font-bold text-[#27205C]"
              >
                Save changes?
              </h2>

              <p
                id="confirm-save-message"
                className="mt-2 text-center text-sm leading-6 text-slate-600"
              >
                You are about to update INC-
                {String(selectedIncident.id).padStart(4, "0")}. Are you
                sure you want to save these changes?
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmSave(false)}
                  className="border border-[#D9D4EE] px-4 py-3 text-sm font-semibold text-[#5145B5] transition hover:bg-indigo-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setConfirmSave(false);
                    void saveEdit();
                  }}
                  className="bg-linear-to-r from-[#342992] to-[#5366C8] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                >
                  Yes, save changes
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
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
    "border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4";

  return (
    <div className="flex flex-col gap-2 border-t border-slate-300 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-8 sm:py-4">
      <p className="text-center text-sm text-slate-600 sm:text-left">
        Showing{" "}
        <span className="font-semibold text-slate-900">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-slate-900">{total}</span>
      </p>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={btn}
        >
          Previous
        </button>

        <span className="px-1 text-sm font-semibold text-slate-700 sm:px-3">
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