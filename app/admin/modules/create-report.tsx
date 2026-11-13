"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { CustomerReportPrefill } from "./customer-reports";

type Barangay = {
  name: string;
  code: string;
};

type Team = {
  id: string;
  name: string;
};

type PumpingStation = {
  id: number;
  name: string;
  location: string | null;
};

type StationBarangay = {
  pumping_station_id: number;
  barangay_code: string;
};

// One report in the list (form data only, nothing here changes the database).
type ReportDraft = {
  id: number;
  pumpingStationRelated: boolean;
  barangayCode: string;
  pumpingStationId: string;
  affectedBarangays: string[]; // barangay codes
  affectedArea: string;
  incidentType: string;
  status: string;
  etr: string; // YYYY-MM-DDTHH:mm
  description: string;
  deploy: boolean;
  teamId: string;
  // Row number in the uploaded CSV (only set for imported reports).
  csvRow?: number;
  // Set when this report was started from a customer report (public portal).
  customerReportId?: string;
  customerTracking?: string;
  // Only used to resume safely if a submit fails halfway.
  savedIncidentId?: number;
  savedBarangays?: boolean;
};

type FieldKey = "location" | "affected" | "area" | "type" | "status" | "etr" | "team";
type FieldErrors = Partial<Record<FieldKey, string>>;

type CsvWarning = { draftId: number; text: string };

const incidentTypes = [
  "Line Rupture",
  "Water Leakage",
  "Low Water Pressure",
  "No Water Supply",
  "Water Service Interruption",
  "Water Quality Issue",
];

const validStatuses = ["green", "yellow", "red"];

const draftKey = "districtlens-create-report-draft-v2";

function newDraft(id: number): ReportDraft {
  return {
    id,
    pumpingStationRelated: false,
    barangayCode: "",
    pumpingStationId: "",
    affectedBarangays: [],
    affectedArea: "",
    incidentType: "",
    status: "",
    etr: "",
    description: "",
    deploy: false,
    teamId: "",
  };
}

function isBlankDraft(d: ReportDraft) {
  return (
    !d.pumpingStationRelated &&
    !d.barangayCode &&
    !d.pumpingStationId &&
    d.affectedBarangays.length === 0 &&
    !d.affectedArea &&
    !d.incidentType &&
    !d.status &&
    !d.etr &&
    !d.description &&
    !d.deploy &&
    !d.teamId
  );
}

/* =========================================
   SHARED STYLES (same look as Dashboard / Analytics)
========================================= */

const sectionClass = "border border-slate-300 bg-white p-6 sm:p-8";

const labelClass = "block text-sm font-bold text-slate-800";

const fieldClass =
  "mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

const dropdownButtonClass =
  "flex w-full items-center justify-between border border-slate-300 bg-white px-4 py-3 text-left text-base text-slate-800 transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

const helperClass = "mt-2 text-sm text-slate-500";

const primaryButtonClass =
  "bg-[#123D73] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#0D2F59] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "inline-flex w-fit cursor-pointer items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:opacity-50";

// Swaps the normal border/focus colors for red when a field has an error.
function withError(base: string, invalid?: boolean) {
  if (!invalid) return base;
  return base
    .replaceAll("border-slate-300", "border-red-500")
    .replaceAll("hover:border-[#123D73]", "hover:border-red-600")
    .replaceAll("focus:border-[#123D73]", "focus:border-red-600")
    .replaceAll("focus:ring-[#123D73]/20", "focus:ring-red-500/20");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

function toggleClass(active: boolean) {
  return `border px-5 py-3 text-base font-medium transition-colors ${
    active
      ? "border-[#123D73] bg-[#123D73] text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;
}

function formatEtr(value: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function nowTimeString() {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

// True when the ETR is earlier than the current minute.
function isPastEtr(value: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Math.floor(Date.now() / 60000) * 60000;
}

// Converts CSV date text into the YYYY-MM-DDTHH:mm format used by the picker.
function normalizeEtr(raw: string) {
  const text = raw.trim();
  if (!text) return "";

  const withTime = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00` : text;
  const date = new Date(withTime);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getStatusLabel(value: string) {
  if (value === "red") return "Active";
  if (value === "yellow") return "Monitoring";
  if (value === "green") return "Resolved";
  return "—";
}

function Banner({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-6 py-6 sm:px-8">
      <p className="text-sm font-bold text-indigo-100">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
      <p className="mt-2 text-base text-indigo-100">{description}</p>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 wrap-break-word text-base font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

/* =========================================
   REUSABLE SEARCHABLE SELECT
========================================= */

type SelectOption = { value: string; label: string };

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}

function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
  className = "",
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  ariaLabel: string;
  className?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? "";
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  function toggle() {
    if (open) {
      setOpen(false);
      setSearch("");
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = rect.width;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    // Always open below the field; shrink the list if there is little room.
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxHeight = Math.min(300, Math.max(spaceBelow, 200));

    setPos({ left, width, top: rect.bottom + 4, maxHeight });
    setSearch("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
      setSearch("");
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    function onScroll(event: Event) {
      if (listRef.current?.contains(event.target as Node)) return;
      close();
    }

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
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className={`relative mt-2 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={withError(dropdownButtonClass, invalid)}
      >
        <span className={`truncate ${display ? "font-medium text-slate-900" : "text-slate-500"}`}>
          {display || placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
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
            className="z-100 flex flex-col overflow-hidden border border-slate-300 bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-2">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="min-w-0 flex-1 border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
              />
              <button
                type="button"
                aria-label="Close list"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>

            <div role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto p-1">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => pick("")}
                className={`w-full px-3 py-2.5 text-left text-base ${!value ? "bg-blue-50 font-semibold text-[#123D73]" : "text-slate-600 hover:bg-slate-50"}`}
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
                  className={`w-full px-3 py-2.5 text-left text-base transition-colors ${option.value === value ? "bg-blue-50 font-semibold text-[#123D73]" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {option.label}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500">{emptyText}</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/* =========================================
   REUSABLE ETR DATE / TIME PICKER
========================================= */

function EtrPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function openPicker() {
    const current = value ? new Date(value) : new Date();
    if (!Number.isNaN(current.getTime())) {
      setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    }
    setOpen(true);
  }

  const selectedDate = value.split("T")[0];
  const selectedTime = value.split("T")[1] || "";

  return (
    <div className="relative mt-2">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
        className={withError(dropdownButtonClass, invalid)}
      >
        <span className={`truncate ${value ? "font-medium text-slate-900" : "text-slate-500"}`}>
          {value ? formatEtr(value) : "Select date and time"}
        </span>
        <svg className="h-5 w-5 shrink-0 text-[#123D73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="1.5" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/50 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div role="dialog" aria-modal="true" aria-label="Choose ETR date and time" className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto border border-slate-300 bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                <p className="text-base font-bold text-[#123D73]">Select ETR date and time</p>
                <button
                  type="button"
                  aria-label="Close calendar"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={month.getFullYear() * 12 + month.getMonth() <= new Date().getFullYear() * 12 + new Date().getMonth()}
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <p className="text-sm font-bold text-slate-900">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50" aria-label="Next month">›</button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }, (_, index) => (
                  <span key={`empty-${index}`} />
                ))}

                {Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => {
                  const day = index + 1;
                  const dateValue = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isSelected = selectedDate === dateValue;
                  const isToday = todayString() === dateValue;
                  const isPast = dateValue < todayString();

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        // Today: never default to a time that already passed.
                        let time = selectedTime || "12:00";
                        if (isToday && time < nowTimeString()) time = nowTimeString();
                        onChange(`${dateValue}T${time}`);
                      }}
                      className={`h-9 text-sm transition-colors ${
                        isPast
                          ? "cursor-not-allowed text-slate-300"
                          : isSelected
                            ? "bg-[#123D73] font-semibold text-white"
                            : isToday
                              ? "border border-[#123D73] text-[#123D73] hover:bg-slate-100"
                              : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <label className="block text-sm font-bold text-slate-800">Repair time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => {
                    const dateValue = selectedDate || todayString();
                    onChange(`${dateValue}T${e.target.value}`);
                  }}
                  min={(selectedDate || todayString()) === todayString() ? nowTimeString() : undefined}
                  className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
                />
              </div>

              <div className="mt-4 flex justify-between gap-3">
                <button type="button" onClick={() => onChange("")} className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Clear
                </button>
                <button type="button" onClick={() => setOpen(false)} className="bg-[#123D73] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D2F59]">
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/* =========================================
   ONE REPORT CARD
========================================= */

function ReportCard({
  draft,
  index,
  canRemove,
  errors,
  barangays,
  teams,
  pumpingStations,
  stationBarangays,
  onChange,
  onRemove,
  onClear,
}: {
  draft: ReportDraft;
  index: number;
  canRemove: boolean;
  errors: FieldErrors;
  barangays: Barangay[];
  teams: Team[];
  pumpingStations: PumpingStation[];
  stationBarangays: StationBarangay[];
  onChange: (patch: Partial<ReportDraft>) => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  // ONLY the barangays connected to the selected pumping station.
  const connectedCodes = draft.pumpingStationId
    ? stationBarangays
        .filter((item) => String(item.pumping_station_id) === draft.pumpingStationId)
        .map((item) => item.barangay_code)
    : [];
  const connectedBarangays = barangays.filter((b) => connectedCodes.includes(b.code));
  const hasErrors = Object.keys(errors).length > 0;

  function toggleBarangay(code: string, checked: boolean) {
    onChange({
      affectedBarangays: checked
        ? [...draft.affectedBarangays, code]
        : draft.affectedBarangays.filter((item) => item !== code),
    });
  }

  return (
    <article className={`border bg-white ${hasErrors ? "border-red-300" : "border-slate-300"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <h4 className="text-base font-bold text-[#123D73]">
          Report {index + 1}
          {draft.csvRow ? (
            <span className="ml-2 text-sm font-normal text-slate-500">(CSV row {draft.csvRow})</span>
          ) : null}
          {draft.customerTracking ? (
            <span className="ml-2 text-sm font-normal text-slate-500">
              (Customer report {draft.customerTracking})
            </span>
          ) : null}
        </h4>

        <div className="flex flex-wrap gap-2">
          {!draft.savedIncidentId && (
            <button
              type="button"
              onClick={onClear}
              disabled={isBlankDraft(draft)}
              className={smallButtonClass}
            >
              Clear
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {hasErrors && (
        <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm leading-6 text-red-700 sm:px-6">
          Please complete the fields marked in red.
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:p-6 md:grid-cols-2">
        {/* PUMPING STATION RELATED */}
        <div className="md:col-span-2">
          <label className={labelClass}>Is this a pumping station-related issue?</label>
          <div className="mt-3 grid max-w-xs grid-cols-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  pumpingStationRelated: false,
                  pumpingStationId: "",
                  affectedBarangays: [],
                })
              }
              className={toggleClass(!draft.pumpingStationRelated)}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => onChange({ pumpingStationRelated: true, barangayCode: "" })}
              className={`${toggleClass(draft.pumpingStationRelated)} -ml-px`}
            >
              Yes
            </button>
          </div>
        </div>

        {/* LOCATION */}
        {!draft.pumpingStationRelated ? (
          <div className="md:col-span-2">
            <label className={labelClass}>Barangay</label>
            <SearchSelect
              value={draft.barangayCode}
              ariaLabel="Barangays"
              placeholder="Select Barangay"
              searchPlaceholder="Search barangay..."
              emptyText="No barangays found."
              invalid={!!errors.location}
              options={barangays.map((item) => ({ value: item.code, label: item.name }))}
              onChange={(code) => onChange({ barangayCode: code })}
            />
            <FieldError message={errors.location} />
          </div>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className={labelClass}>Pumping Station</label>
              <SearchSelect
                value={draft.pumpingStationId}
                ariaLabel="Pumping stations"
                placeholder="Select Pumping Station"
                searchPlaceholder="Search pumping station..."
                emptyText="No pumping stations found."
                invalid={!!errors.location}
                options={pumpingStations.map((station) => ({
                  value: String(station.id),
                  label: `${station.name}${station.location ? ` — ${station.location}` : ""}`,
                }))}
                onChange={(stationId) => {
                  // Pre-select every barangay connected to this station.
                  const codes = stationId
                    ? stationBarangays
                        .filter((item) => String(item.pumping_station_id) === stationId)
                        .map((item) => item.barangay_code)
                    : [];
                  onChange({ pumpingStationId: stationId, affectedBarangays: codes });
                }}
              />
              <FieldError message={errors.location} />
            </div>

            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className={labelClass}>Affected Barangays</label>

                {connectedBarangays.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onChange({ affectedBarangays: connectedBarangays.map((b) => b.code) })}
                      className="text-sm font-semibold text-[#123D73] hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ affectedBarangays: [] })}
                      className="text-sm font-semibold text-slate-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {!draft.pumpingStationId ? (
                <p className={helperClass}>
                  Select a pumping station first. Only the barangays connected to it will be shown.
                </p>
              ) : connectedBarangays.length === 0 ? (
                <p className={helperClass}>No barangays are connected to this pumping station.</p>
              ) : (
                <>
                  <p className={helperClass}>
                    Showing only the barangays connected to this pumping station. Untick the ones not affected.
                  </p>

                  <div className={`mt-3 max-h-56 space-y-1 overflow-y-auto border p-2 ${errors.affected ? "border-red-500" : "border-slate-300"}`}>
                    {connectedBarangays.map((barangay) => (
                      <label
                        key={barangay.code}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={draft.affectedBarangays.includes(barangay.code)}
                          onChange={(e) => toggleBarangay(barangay.code, e.target.checked)}
                          className="h-4 w-4 accent-[#123D73]"
                        />
                        <span className="text-base text-slate-700">{barangay.name}</span>
                      </label>
                    ))}
                  </div>

                  <p className={helperClass}>
                    {draft.affectedBarangays.length} of {connectedBarangays.length} barangay
                    {connectedBarangays.length === 1 ? "" : "s"} selected
                  </p>
                </>
              )}
              <FieldError message={errors.affected} />
            </div>
          </>
        )}

        {/* AFFECTED AREA */}
        <div className="md:col-span-2">
          <label className={labelClass}>Affected Area</label>
          <input
            type="text"
            value={draft.affectedArea}
            onChange={(e) => onChange({ affectedArea: e.target.value })}
            placeholder="e.g. Purok 3, Phase 2, or entire affected area"
            className={withError(fieldClass, !!errors.area)}
          />
          <FieldError message={errors.area} />
        </div>

        {/* INCIDENT TYPE */}
        <div>
          <label className={labelClass}>Type of Incident</label>
          <SearchSelect
            value={draft.incidentType}
            ariaLabel="Incident types"
            placeholder="Select Incident Type"
            searchPlaceholder="Search incident type..."
            emptyText="No incident types found."
            invalid={!!errors.type}
            options={incidentTypes.map((type) => ({ value: type, label: type }))}
            onChange={(type) => onChange({ incidentType: type })}
          />
          <FieldError message={errors.type} />
        </div>

        {/* STATUS */}
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={draft.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className={withError(fieldClass, !!errors.status)}
          >
            <option value="">Select Status</option>
            <option value="green">Resolved</option>
            <option value="yellow">Monitoring</option>
            <option value="red">Active</option>
          </select>
          <FieldError message={errors.status} />
        </div>

        {/* ETR */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            ETR <span className="font-normal text-slate-500">(Estimated Time of Restoration)</span>
          </label>
          <EtrPicker
            value={draft.etr}
            invalid={!!errors.etr}
            onChange={(next) => onChange({ etr: next })}
          />
          <FieldError message={errors.etr} />
        </div>

        {/* DESCRIPTION */}
        <div className="md:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Describe the incident..."
            rows={3}
            className={fieldClass}
          />
        </div>

        {/* DEPLOYMENT */}
        <div className="border-t border-slate-200 pt-5 md:col-span-2">
          <label className={labelClass}>Does this incident require Field Worker deployment?</label>

          <div className="mt-3 grid max-w-xs grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ deploy: false, teamId: "" })}
              className={toggleClass(!draft.deploy)}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => onChange({ deploy: true })}
              className={`${toggleClass(draft.deploy)} -ml-px`}
            >
              Yes
            </button>
          </div>

          {draft.deploy && (
            <div className="mt-4">
              <label className={labelClass}>Field Worker Team</label>
              <select
                value={draft.teamId}
                onChange={(e) => onChange({ teamId: e.target.value })}
                className={withError(fieldClass, !!errors.team)}
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.team} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* =========================================
   PAGE
========================================= */

export default function CreateReport({
  prefill,
  onPrefillConsumed,
}: {
  prefill?: CustomerReportPrefill | null;
  onPrefillConsumed?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [drafts, setDrafts] = useState<ReportDraft[]>(() => [newDraft(1)]);
  const nextId = useRef(2);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restored, setRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pumpingStations, setPumpingStations] = useState<PumpingStation[]>([]);
  const [stationBarangays, setStationBarangays] = useState<StationBarangay[]>([]);

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [csvWarnings, setCsvWarnings] = useState<CsvWarning[]>([]);
  // Ids of the reports that came from the last CSV upload (so they can be removed together).
  const [csvImportedIds, setCsvImportedIds] = useState<number[]>([]);

  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  function askConfirmation(
    title: string,
    text: string,
    confirmLabel: string,
    onConfirm: () => void
  ) {
    setConfirmation({ title, message: text, confirmLabel, onConfirm });
  }

  /* -------------------------
     DRAFT HELPERS
  ------------------------- */

  function addDraft(base?: Partial<ReportDraft>) {
    const draft: ReportDraft = { ...newDraft(0), ...base, id: nextId.current++ };
    setDrafts((current) => [...current, draft]);
    goToPage(drafts.length);
  }

  function goToPage(index: number) {
    setCurrentIndex(index);
  }

  function updateDraft(id: number, patch: Partial<ReportDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
    );
    setMessage("");
  }

  function removeDraft(id: number) {
    if (drafts.length === 1) return;
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    setCurrentIndex((index) => Math.max(0, Math.min(index, drafts.length - 2)));
  }

  // Empties every field of one report (the report itself stays in the list).
  function clearDraft(id: number) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? newDraft(id) : draft))
    );
    setMessage("");
  }

  function connectedCodesOf(stationId: string) {
    return stationBarangays
      .filter((item) => String(item.pumping_station_id) === stationId)
      .map((item) => item.barangay_code);
  }

  // Affected barangays that really belong to the chosen pumping station.
  function validAffected(draft: ReportDraft) {
    const allowed = connectedCodesOf(draft.pumpingStationId);
    return draft.affectedBarangays.filter((code) => allowed.includes(code));
  }

  function getBarangayName(code: string) {
    return barangays.find((barangay) => barangay.code === code)?.name || code;
  }

  // Field-by-field problems, so the exact field can be marked in red.
  function getFieldErrors(draft: ReportDraft): FieldErrors {
    const errors: FieldErrors = {};

    if (draft.pumpingStationRelated) {
      if (!draft.pumpingStationId) errors.location = "Please select a pumping station.";
      else if (validAffected(draft).length === 0)
        errors.affected = "Please select at least one affected barangay.";
    } else if (!draft.barangayCode) {
      errors.location = "Please select a barangay.";
    }

    if (!draft.affectedArea.trim()) errors.area = "Please enter the affected area.";
    if (!draft.incidentType) errors.type = "Please select the type of incident.";
    if (!draft.status) errors.status = "Please select a status.";

    if (draft.etr && Number.isNaN(new Date(draft.etr).getTime()))
      errors.etr = "Invalid ETR date/time. Please choose it again.";
    else if (isPastEtr(draft.etr))
      errors.etr = "ETR cannot be in the past. Please choose a later date and time.";

    if (draft.deploy && !draft.teamId) errors.team = "Please select a field worker team.";

    return errors;
  }

  function validateDraft(draft: ReportDraft) {
    return Object.values(getFieldErrors(draft))[0] || "";
  }

  /* -------------------------
     RESTORE + AUTO-SAVE DRAFTS (this browser only)
  ------------------------- */

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.drafts) && saved.drafts.length > 0) {
          const restoredDrafts = saved.drafts.map(
            (item: Partial<ReportDraft>, index: number) => ({
              ...newDraft(index + 1),
              ...item,
              id: index + 1,
            })
          ) as ReportDraft[];
          setDrafts(restoredDrafts);
          nextId.current = restoredDrafts.length + 1;
        }
      }
    } catch (error) {
      console.warn("Could not restore report draft:", error);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;

    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ drafts }));
        setDraftSaved(true);
      } catch (error) {
        console.warn("Could not auto-save report draft:", error);
        setDraftSaved(false);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [drafts, restored]);

  /* -------------------------
     LOAD DATA (same sources as before)
  ------------------------- */

  useEffect(() => {
    async function loadBarangays() {
      try {
        const response = await fetch("/data/tanza-barangays.geojson");
        if (!response.ok) throw new Error("GeoJSON could not be loaded.");

        const data = await response.json();

        const list = data.features.map((feature: any) => ({
          name:
            feature.properties?.brgy_name ||
            feature.properties?.barangay ||
            feature.properties?.Barangay ||
            feature.properties?.name ||
            "Barangay",
          code: feature.properties?.brgy_code || "",
        }));

        setBarangays(list);
      } catch (error) {
        console.error("Error loading barangays:", error);
      }
    }

    async function loadTeams() {
      const supabase = createClient();
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) {
        console.error("Error loading teams:", error);
        return;
      }
      setTeams(data || []);
    }

    async function loadPumpingStations() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pumping_stations")
        .select("id, name, location");
      if (error) {
        console.error("Error loading pumping stations:", error);
        return;
      }

      // Sort by the station number in the name (Station 2 before Station 10).
      const sorted = [...((data ?? []) as PumpingStation[])].sort((a, b) => {
        const numberA = Number(a.name.match(/\d+/)?.[0] ?? 0);
        const numberB = Number(b.name.match(/\d+/)?.[0] ?? 0);
        return numberA - numberB;
      });

      setPumpingStations(sorted);
    }

    async function loadStationBarangays() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pumping_station_barangays")
        .select("pumping_station_id, barangay_code");
      if (error) {
        console.error("Error loading pumping station barangays:", error);
        return;
      }
      setStationBarangays(data || []);
    }

    loadBarangays();
    loadTeams();
    loadPumpingStations();
    loadStationBarangays();
  }, []);

  /* -------------------------
     PRE-FILL FROM A CUSTOMER REPORT
  ------------------------- */

  const appliedPrefill = useRef<string | null>(null);

  useEffect(() => {
    // Wait until saved drafts are restored and the barangay list has loaded.
    if (!prefill || !restored || barangays.length === 0) return;
    if (appliedPrefill.current === prefill.customerReportId) return;
    appliedPrefill.current = prefill.customerReportId;

    // Already opened before (saved draft)? Just go to it.
    const existing = drafts.findIndex(
      (item) => item.customerReportId === prefill.customerReportId
    );

    if (existing !== -1) {
      setCurrentIndex(existing);
    } else {
      const barangay = barangays.find(
        (item) =>
          item.name.trim().toLowerCase() === prefill.barangay.trim().toLowerCase()
      );
      const incidentType =
        incidentTypes.find(
          (type) => type.toLowerCase() === prefill.incidentType.toLowerCase()
        ) ?? "";

      const draft: ReportDraft = {
        ...newDraft(nextId.current++),
        barangayCode: barangay?.code ?? "",
        affectedArea: prefill.address,
        incidentType,
        description: prefill.description,
        customerReportId: prefill.customerReportId,
        customerTracking: prefill.trackingNumber,
      };

      // Drop the untouched blank starter report, then add this one.
      const kept = drafts.filter((item) => !isBlankDraft(item));
      setDrafts([...kept, draft]);
      setCurrentIndex(kept.length);
    }

    setStep(1);
    setShowErrors(false);
    onPrefillConsumed?.();
  }, [prefill, restored, barangays, drafts, onPrefillConsumed]);

  /* -------------------------
     SOUND
  ------------------------- */

  function playSuccessSound() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.34);
      oscillator.onended = () => void audioContext.close();
    } catch {
      // Sound is optional.
    }
  }

  /* =========================================
     CSV IMPORT (fills the same report cards)
  ========================================= */

  function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        cell += '"';
        i++;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        row.push(cell.trim());
        cell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") i++;

        row.push(cell.trim());
        cell = "";

        if (row.some((value) => value.length > 0)) rows.push(row);
        row = [];
        continue;
      }

      cell += char;
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
    }

    return rows;
  }

  function findBarangayByName(name: string) {
    const normalized = name.trim().toLowerCase();
    return barangays.find((barangay) => barangay.name.trim().toLowerCase() === normalized);
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setCsvError("");
    setCsvWarnings([]);
    setCsvFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Please upload a CSV file.");
      input.value = "";
      return;
    }

    if (barangays.length === 0 || pumpingStations.length === 0) {
      setCsvError("Barangay and pumping station data are still loading. Please try again in a moment.");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => processCSV(String(event.target?.result || ""));
    reader.onerror = () => setCsvError("Unable to read the CSV file.");
    reader.readAsText(file);

    // Allow choosing the same file again later.
    input.value = "";
  }

  function processCSV(text: string) {
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setCsvError("The CSV file does not contain any report rows.");
      return;
    }

    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const requiredHeaders = [
      "barangay",
      "pumping_station",
      "incident_type",
      "status",
      "affected_area",
      "etr",
      "description",
      "team",
    ];
    const missing = requiredHeaders.filter((header) => !headers.includes(header));
    if (missing.length) {
      setCsvError(`Missing CSV column(s): ${missing.join(", ")}`);
      return;
    }

    // Only notes that validation cannot catch later (e.g. a barangay that was skipped).
    // Everything else is flagged live in red on the report itself.
    const warnings: CsvWarning[] = [];
    const imported: ReportDraft[] = [];

    rows.slice(1).forEach((values, index) => {
      const rowLabel = `CSV row ${index + 2}`;
      const get = (header: string) => {
        const headerIndex = headers.indexOf(header);
        return headerIndex === -1 ? "" : (values[headerIndex] || "").trim();
      };

      const draft = newDraft(nextId.current++);
      draft.csvRow = index + 2;
      const note = (text: string) => warnings.push({ draftId: draft.id, text });

      // A filled pumping_station cell makes it a pumping station report automatically.
      // report_type is optional and only used as a fallback when that cell is empty.
      const stationCell = get("pumping_station");
      const rawType = get("report_type").toLowerCase().replace(/[ -]/g, "_");
      draft.pumpingStationRelated = stationCell !== "" || rawType === "pumping_station";

      if (draft.pumpingStationRelated) {
        const stationName = get("pumping_station");
        const station = pumpingStations.find(
          (item) => item.name.trim().toLowerCase() === stationName.toLowerCase()
        );

        if (!station) {
          note(`Pumping station "${stationName}" was not found.`);
        } else {
          draft.pumpingStationId = String(station.id);
          const allowed = connectedCodesOf(draft.pumpingStationId);
          const requested = get("affected_barangays")
            .split(/[;,]/)
            .map((name) => name.trim())
            .filter(Boolean);

          if (requested.length === 0) {
            // No list given: use every barangay connected to the station.
            draft.affectedBarangays = allowed;
          } else {
            requested.forEach((name) => {
              const found = findBarangayByName(name);
              if (!found) {
                note(`Barangay "${name}" was not found, so it was skipped.`);
              } else if (!allowed.includes(found.code)) {
                note(`"${name}" is not connected to ${station.name}, so it was skipped.`);
              } else if (!draft.affectedBarangays.includes(found.code)) {
                draft.affectedBarangays.push(found.code);
              }
            });
          }
        }
      } else {
        const name = get("barangay");
        const found = findBarangayByName(name);
        if (found) draft.barangayCode = found.code;
        else note(`Barangay "${name}" was not found.`);
      }

      draft.affectedArea = get("affected_area");

      const typeText = get("incident_type");
      const matchedType = incidentTypes.find(
        (type) => type.toLowerCase() === typeText.toLowerCase()
      );
      if (matchedType) draft.incidentType = matchedType;
      else note(`Incident type "${typeText}" is not valid.`);

      const statusText = (get("status") || "green").toLowerCase();
      if (validStatuses.includes(statusText)) draft.status = statusText;
      else note(`Status "${statusText}" is not valid (use green, yellow, or red).`);

      // Keep the ETR even when it is wrong, so the field shows up red instead of silently going blank.
      const rawEtr = get("etr");
      const etr = normalizeEtr(rawEtr);
      draft.etr = etr === null ? rawEtr : etr;

      draft.description = get("description");

      const teamName = get("team");
      if (teamName) {
        const team = teams.find(
          (item) => item.name.trim().toLowerCase() === teamName.toLowerCase()
        );
        draft.deploy = true;
        if (team) draft.teamId = team.id;
        else note(`Team "${teamName}" was not found.`);
      }

      imported.push(draft);
    });

    // Add to the list; drop the untouched blank starter report.
    const kept = drafts.filter((item) => !isBlankDraft(item));
    setDrafts([...kept, ...imported]);
    setCsvImportedIds((current) => [...current, ...imported.map((item) => item.id)]);
    setCsvWarnings(warnings);

    // Jump to the first imported report that has a problem (or the first imported one).
    const firstProblem = imported.findIndex((item) => validateDraft(item));
    setCurrentIndex(kept.length + Math.max(firstProblem, 0));
    setShowErrors(firstProblem !== -1);
  }

  // Removes every report that came from an uploaded CSV, keeping the ones typed by hand.
  function removeImportedReports() {
    const ids = new Set(csvImportedIds);
    const remaining = drafts.filter((item) => !ids.has(item.id));

    setDrafts(remaining.length > 0 ? remaining : [newDraft(nextId.current++)]);
    setCurrentIndex(0);
    setCsvImportedIds([]);
    setCsvWarnings([]);
    setCsvFileName("");
    setCsvError("");
    setShowErrors(false);
    setMessage("");
  }

  // Sample ETR for the template: always a future date (days from today), e.g. 2026-11-03T14:00:00.
  function sampleEtr(daysFromNow: number, hour: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(hour)}:00:00`;
  }

  function downloadCSVTemplate() {
    const csv = [
      "barangay,pumping_station,incident_type,status,affected_area,etr,description,team,affected_barangays",
      `Mulawin,,Line Rupture,red,Purok 3,${sampleEtr(1, 14)},Main water line rupture,Team Alpha,`,
      `,Pumping Station 1,Water Leakage,yellow,"Poblacion and nearby areas",${sampleEtr(2, 16)},Station-related issue,Team Bravo,"Poblacion;Mulawin"`,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "districtlens-report-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* =========================================
     STEP 1 → STEP 2
  ========================================= */

  function handleReview() {
    setMessage("");
    setShowErrors(true);

    const firstInvalid = drafts.findIndex((draft) => validateDraft(draft));
    if (firstInvalid !== -1) {
      goToPage(firstInvalid);
      setMessage(
        `Report ${firstInvalid + 1} needs attention. Please fix the highlighted report(s) first.`
      );
      return;
    }

    setShowErrors(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================================
     SUBMIT ALL (same tables and columns as before)
  ========================================= */

  function handleSubmitClick() {
    const withTeam = drafts.filter((draft) => draft.deploy).length;
    const without = drafts.length - withTeam;

    askConfirmation(
      "Submit all reports?",
      `You are about to submit ${drafts.length} report${drafts.length === 1 ? "" : "s"}. ${withTeam} with field worker deployment and ${without} without deployment (no team will be assigned to those).`,
      "Yes, submit",
      () => void performSubmit()
    );
  }

  async function performSubmit() {
    setSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const finished = new Set<number>();
    const progress = new Map<number, Partial<ReportDraft>>();
    let failure = "";

    try {
      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i];
        const label = `Report ${i + 1}`;
        let incidentId = draft.savedIncidentId;

        /* INCIDENT */
        if (!incidentId) {
          const { data: incident, error } = await supabase
            .from("incidents")
            .insert({
              barangay_code: draft.pumpingStationRelated ? null : draft.barangayCode,
              incident_type: draft.incidentType,
              status: draft.status,
              etr: draft.etr ? new Date(draft.etr).toISOString() : null,
              description: draft.description || null,
              pumping_station_id: draft.pumpingStationRelated
                ? Number(draft.pumpingStationId)
                : null,
              affected_area: draft.affectedArea.trim(),
            })
            .select("id")
            .single();

          if (error) throw new Error(`${label}: ${error.message}`);

          incidentId = incident.id as number;
          progress.set(draft.id, { savedIncidentId: incidentId });
        }

        /* LINK BACK TO THE CUSTOMER REPORT */
        if (draft.customerReportId) {
          const { error } = await supabase
            .from("customer_reports")
            .update({ incident_id: incidentId })
            .eq("id", draft.customerReportId);

          if (error)
            throw new Error(
              `${label}: Incident was created, but it could not be linked to the customer report: ${error.message}`
            );
        }

        /* AFFECTED BARANGAYS (pumping station incidents) */
        if (draft.pumpingStationRelated && !draft.savedBarangays) {
          const { error } = await supabase.from("incident_barangays").insert(
            validAffected(draft).map((code) => ({
              incident_id: incidentId,
              barangay_code: code,
            }))
          );

          if (error)
            throw new Error(
              `${label}: Incident was created, but affected barangays could not be saved: ${error.message}`
            );

          progress.set(draft.id, {
            ...progress.get(draft.id),
            savedIncidentId: incidentId,
            savedBarangays: true,
          });
        }

        /* DEPLOYMENT */
        if (draft.deploy && draft.teamId) {
          const { error } = await supabase.from("deployments").insert({
            incident_id: incidentId,
            team_id: draft.teamId,
            status: "assigned",
          });

          if (error)
            throw new Error(
              `${label}: Incident was created, but team deployment failed: ${error.message}`
            );
        }

        finished.add(draft.id);
      }
    } catch (error) {
      console.error("Submit error:", error);
      failure = error instanceof Error ? error.message : "Submission failed.";
    }

    if (failure) {
      // Keep only the reports not yet done, so retrying never creates duplicates.
      setDrafts((current) =>
        current
          .filter((draft) => !finished.has(draft.id))
          .map((draft) => ({ ...draft, ...progress.get(draft.id) }))
      );
      setMessage(
        `${finished.size} of ${drafts.length} report${drafts.length === 1 ? "" : "s"} submitted. ${failure} The remaining reports are still here, you can try again.`
      );
      setSubmitting(false);
      return;
    }

    try {
      window.localStorage.removeItem(draftKey);
    } catch {}

    setSuccessMessage(
      `${finished.size} incident report${finished.size === 1 ? "" : "s"} successfully submitted.`
    );
    setShowSuccess(true);
    playSuccessSound();
    setDrafts([newDraft(nextId.current++)]);
    setCurrentIndex(0);
    setCsvFileName("");
    setCsvWarnings([]);
    setCsvError("");
    setDraftSaved(false);
    setSubmitting(false);
  }

  function locationOf(draft: ReportDraft) {
    if (draft.pumpingStationRelated) {
      const station = pumpingStations.find((item) => String(item.id) === draft.pumpingStationId);
      const names = validAffected(draft).map((code) => getBarangayName(code)).join(", ");
      return `${station?.name || "No station"}${names ? ` (${names})` : ""}`;
    }
    return getBarangayName(draft.barangayCode) || "—";
  }

  const deployedCount = drafts.filter((draft) => draft.deploy).length;

  // Imported reports that still have a problem. Updates live as the user fixes fields.
  const importedIds = new Set(csvImportedIds);
  const importedPresent = drafts.filter((draft) => importedIds.has(draft.id)).length;
  const csvIssues = drafts
    .map((draft, index) => {
      if (!importedIds.has(draft.id)) return null;
      const notes = csvWarnings.filter((w) => w.draftId === draft.id).map((w) => w.text);
      const errors = Object.values(getFieldErrors(draft));
      const messages = [...notes, ...errors];
      return messages.length > 0 ? { index, draft, messages } : null;
    })
    .filter((item): item is { index: number; draft: ReportDraft; messages: string[] } => item !== null);
  const safeIndex = Math.min(currentIndex, drafts.length - 1);
  const currentDraft = drafts[safeIndex];

  /* =========================================
     RETURN
  ========================================= */

  return (
    <>
      <style jsx>{`
        @keyframes successPop { 0% { opacity: 0; transform: scale(.72); } 70% { opacity: 1; transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
        .success-pop { animation: successPop 420ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes confirmPop { from { opacity: 0; transform: scale(.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .confirm-pop { animation: confirmPop 180ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .success-pop, .confirm-pop { animation: none; }
        }
      `}</style>

      {/* CONFIRMATION DIALOG */}
      {confirmation && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
          <div
            className="confirm-pop w-full max-w-md border border-slate-300 bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#123D73]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.75 3h14.9a2 2 0 0 0 1.75-3l-7.45-13.1a2 2 0 0 0-3.45 0Z" />
              </svg>
            </div>

            <h2 id="confirm-dialog-title" className="mt-5 text-center text-xl font-bold text-[#123D73]">
              {confirmation.title}
            </h2>

            <p id="confirm-dialog-message" className="mt-2 text-center text-base leading-6 text-slate-600">
              {confirmation.message}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmation(null)} className={`${secondaryButtonClass} px-4`}>
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const action = confirmation.onConfirm;
                  setConfirmation(null);
                  action();
                }}
                className={`${primaryButtonClass} px-4`}
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS DIALOG */}
      {showSuccess && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-success-title"
        >
          <div className="success-pop w-full max-w-md border border-slate-300 bg-white p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg className="h-12 w-12" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5" />
                <path d="m13 24 7 7 15-16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h2 id="report-success-title" className="mt-5 text-2xl font-bold text-[#123D73]">
              Submission Complete
            </h2>

            <p className="mt-2 text-base leading-6 text-slate-600">{successMessage}</p>

            <button
              type="button"
              onClick={() => {
                setShowSuccess(false);
                setSuccessMessage("");
                setMessage("");
                setShowErrors(false);
                setStep(1);
              }}
              className={`${primaryButtonClass} mt-6 w-full`}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8 border border-[#4438A8] bg-white p-6 text-slate-900 sm:p-8">
        {/* PROGRESS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>
              {draftSaved
                ? "Draft auto-saved in this browser"
                : "Your draft will auto-save as you enter details"}
            </span>
            <span className={`shrink-0 font-semibold ${draftSaved ? "text-emerald-700" : "text-slate-500"}`}>
              {draftSaved ? "Saved" : "Auto-save on"}
            </span>
          </div>

          <div className="flex items-center gap-3" aria-label={`Step ${step} of 2`}>
            {[1, 2].map((item) => (
              <div key={item} className={`h-2 flex-1 ${step >= item ? "bg-[#123D73]" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>

        {/* =====================================
            STEP 1: FILL IN REPORTS
        ===================================== */}
        {step === 1 && (
          <div className="space-y-8">
            <Banner
              eyebrow="Step 1 of 2"
              title="Create Incident Reports"
              description="Add one or more incident reports. You can also upload a CSV to fill them in automatically, then edit anything before submitting."
            />

            {/* ACTIONS */}
            <div className={`${sectionClass} space-y-4`}>
              <div className="flex flex-wrap items-center gap-3">
                <label className={smallButtonClass}>
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="text-sm font-semibold text-[#123D73] underline underline-offset-4 hover:text-[#0D2F59]"
                >
                  Download CSV template
                </button>
              </div>

              <p className="text-sm text-slate-500">
                ETR format: YYYY-MM-DDTHH:mm (e.g. {sampleEtr(1, 14).slice(0, 16)}). It must be a future date and time.
              </p>

              {csvImportedIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-300 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-700">
                    {csvFileName && (
                      <>
                        <span className="font-semibold text-slate-900">{csvFileName}</span>
                        {" — "}
                      </>
                    )}
                    {importedPresent} imported report{importedPresent === 1 ? "" : "s"}
                    {csvIssues.length > 0
                      ? `, ${csvIssues.length} need${csvIssues.length === 1 ? "s" : ""} attention`
                      : ", no issues"}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      askConfirmation(
                        "Remove imported reports?",
                        `This removes the ${importedPresent} report${importedPresent === 1 ? "" : "s"} that came from the CSV upload, including any edits you made to them. Reports you added manually are kept.`,
                        "Yes, remove",
                        removeImportedReports
                      )
                    }
                    className="border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    Remove imported reports
                  </button>
                </div>
              )}

              {csvError && (
                <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {csvError}
                </div>
              )}

              {csvIssues.length > 0 && (
                <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-semibold">
                    Fix these before reviewing. The fields to correct are marked in red on each report.
                  </p>
                  <ul className="mt-3 divide-y divide-red-200">
                    {csvIssues.map((issue) => (
                      <li key={issue.draft.id} className="flex flex-wrap items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            Report {issue.index + 1}
                            {issue.draft.csvRow ? ` (CSV row ${issue.draft.csvRow})` : ""}
                          </p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            {issue.messages.map((text, i) => (
                              <li key={i}>{text}</li>
                            ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowErrors(true);
                            goToPage(issue.index);
                          }}
                          className="shrink-0 border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          Go to report
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* REPORT PAGES */}
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Reports">
              {drafts.map((draft, index) => {
                const active = index === safeIndex;
                const hasError = showErrors && !!validateDraft(draft);

                return (
                  <button
                    key={draft.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Report ${index + 1}`}
                    onClick={() => goToPage(index)}
                    className={`min-w-11 border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[#123D73] bg-[#123D73] text-white"
                        : hasError
                          ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label="Previous report"
                onClick={() => goToPage(safeIndex - 1)}
                disabled={safeIndex === 0}
                className="sticky top-[45vh] flex h-12 w-10 shrink-0 items-center justify-center border border-slate-300 bg-white text-2xl text-[#123D73] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-12"
              >
                ‹
              </button>

              <div className="min-w-0 flex-1">
                <ReportCard
                  key={currentDraft.id}
                  draft={currentDraft}
                  index={safeIndex}
                  canRemove={drafts.length > 1}
                  errors={showErrors ? getFieldErrors(currentDraft) : {}}
                  barangays={barangays}
                  teams={teams}
                  pumpingStations={pumpingStations}
                  stationBarangays={stationBarangays}
                  onChange={(patch) => updateDraft(currentDraft.id, patch)}
                  onRemove={() => removeDraft(currentDraft.id)}
                  onClear={() =>
                    askConfirmation(
                      "Clear this report?",
                      `All details entered in Report ${safeIndex + 1} will be erased. The report itself stays in the list.`,
                      "Yes, clear",
                      () => clearDraft(currentDraft.id)
                    )
                  }
                />
              </div>

              <button
                type="button"
                aria-label="Next report"
                onClick={() => goToPage(safeIndex + 1)}
                disabled={safeIndex === drafts.length - 1}
                className="sticky top-[45vh] flex h-12 w-10 shrink-0 items-center justify-center border border-slate-300 bg-white text-2xl text-[#123D73] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-12"
              >
                ›
              </button>
            </div>

            {message && (
              <div role="alert" className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {message}
              </div>
            )}

            {/* ADD / REVIEW */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => addDraft()} className={`${secondaryButtonClass} flex-1`}>
                + Add another report
              </button>

              <button type="button" onClick={handleReview} className={`${primaryButtonClass} flex-1`}>
                Review {drafts.length} Report{drafts.length === 1 ? "" : "s"} →
              </button>
            </div>
          </div>
        )}

        {/* =====================================
            STEP 2: REVIEW AND SUBMIT
        ===================================== */}
        {step === 2 && (
          <div className="space-y-8">
            <Banner
              eyebrow="Step 2 of 2"
              title="Verify and Submit"
              description="Verify the incident summary and deployment summary below. Nothing is saved until you confirm the submission."
            />

            {/* OVERVIEW */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border border-slate-300 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total reports</p>
                <p className="mt-2 text-3xl font-bold text-[#123D73]">{drafts.length}</p>
              </div>
              <div className="border border-slate-300 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">With deployment</p>
                <p className="mt-2 text-3xl font-bold text-[#123D73]">{deployedCount}</p>
              </div>
              <div className="border border-slate-300 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Without deployment</p>
                <p className="mt-2 text-3xl font-bold text-[#123D73]">{drafts.length - deployedCount}</p>
              </div>
            </div>

            {/* INCIDENT SUMMARY */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#123D73]">Incident Summary</h3>

              {drafts.map((draft, index) => {
                const station = pumpingStations.find(
                  (item) => String(item.id) === draft.pumpingStationId
                );

                return (
                  <section key={draft.id} className="border border-slate-300 bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
                      <h4 className="text-base font-bold text-[#123D73]">Report {index + 1}</h4>
                      <span className="border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
                        {draft.pumpingStationRelated ? "Pumping Station" : "Barangay"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-6 bg-slate-50 p-6 sm:grid-cols-2 sm:p-8">
                      {draft.pumpingStationRelated ? (
                        <>
                          <ReviewItem label="Pumping Station" value={station?.name || "Not selected"} />
                          <ReviewItem
                            label="Affected Barangays"
                            value={validAffected(draft).map((code) => getBarangayName(code)).join(", ") || "—"}
                          />
                        </>
                      ) : (
                        <ReviewItem label="Barangay" value={getBarangayName(draft.barangayCode)} wide />
                      )}

                      <ReviewItem label="Affected Area" value={draft.affectedArea || "—"} wide />
                      <ReviewItem label="Incident Type" value={draft.incidentType || "—"} />
                      <ReviewItem label="Status" value={getStatusLabel(draft.status)} />
                      <ReviewItem label="ETR" value={formatEtr(draft.etr)} />
                      <ReviewItem label="Description" value={draft.description || "No description provided."} wide />
                    </div>
                  </section>
                );
              })}
            </div>

            {/* DEPLOYMENT SUMMARY */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#123D73]">Deployment Summary</h3>

              <div className="overflow-hidden border border-slate-300 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-160 text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Report</th>
                        <th className="px-5 py-3">Location</th>
                        <th className="px-5 py-3">Incident</th>
                        <th className="px-5 py-3">Field Worker Team</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {drafts.map((draft, index) => (
                        <tr key={draft.id} className="align-top">
                          <td className="px-5 py-3 font-semibold text-[#123D73]">Report {index + 1}</td>
                          <td className="px-5 py-3 text-slate-700">{locationOf(draft)}</td>
                          <td className="px-5 py-3 text-slate-700">{draft.incidentType || "—"}</td>
                          <td className="px-5 py-3">
                            {draft.deploy ? (
                              <span className="border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                                {teams.find((team) => team.id === draft.teamId)?.name || "—"}
                              </span>
                            ) : (
                              <span className="border border-slate-300 bg-slate-50 px-3 py-1 font-medium text-slate-600">
                                No deployment
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-sm text-slate-500">
                Reports with a team will create a deployment with the status "assigned". Reports without a team will not be assigned to anyone.
              </p>
            </div>

            {message && (
              <div role="alert" className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setMessage("");
                }}
                disabled={submitting}
                className={`${secondaryButtonClass} flex-1`}
              >
                ← Back to Reports
              </button>

              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={submitting || drafts.length === 0}
                className={`${primaryButtonClass} flex-1`}
              >
                {submitting
                  ? "Submitting..."
                  : `Submit ${drafts.length} Report${drafts.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}