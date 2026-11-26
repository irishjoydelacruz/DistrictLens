"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw,
  Search,
  ChevronDown,
  AlertCircle,
  X,
  History,
  LogIn,
  LogOut,
  FileText,
  Users,
  ClipboardList,
  UserCog,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LogRow = {
  id: string;
  actor_name: string | null;
  actor_role: string | null;
  actor_team: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

// action prefix -> module name
const MODULES: Record<string, string> = {
  auth: "Authentication",
  report: "Incident Reports",
  customer_report: "Customer Reports",
  assignment: "Assignments",
  submission: "Submissions",
  user: "User Management",
};

// Module badge colors (same style as the role badges in User Management)
const moduleColors: Record<string, string> = {
  auth: "border-slate-300 bg-slate-100 text-slate-700",
  report: "border-indigo-200 bg-indigo-50 text-indigo-800",
  customer_report: "border-sky-200 bg-sky-50 text-sky-800",
  assignment: "border-amber-200 bg-amber-50 text-amber-800",
  submission: "border-emerald-200 bg-emerald-50 text-emerald-800",
  user: "border-purple-200 bg-purple-50 text-purple-800",
};

const roleColors: Record<string, string> = {
  super_admin: "border-indigo-200 bg-indigo-50 text-indigo-800",
  customer_service: "border-sky-200 bg-sky-50 text-sky-800",
  field_worker: "border-amber-200 bg-amber-50 text-amber-800",
};

const PAGE_SIZE = 10;
const REFRESH_MS = 30_000; // auto refresh every 30 seconds

// UI-only class tokens (same look as User Management).
const inputBase =
  "w-full rounded-none border border-slate-300 bg-white text-sm text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";
const labelClass = "mb-1.5 block text-sm font-bold text-slate-800";
const badgeBase =
  "inline-flex h-8 w-fit items-center justify-center gap-1.5 whitespace-nowrap border px-3 text-sm font-medium";

function prefixOf(action: string) {
  return action.split(".")[0];
}

function moduleOf(action: string) {
  return MODULES[prefixOf(action)] ?? "General";
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "Super Admin";
  if (role === "customer_service") return "Customer Service";
  if (role === "field_worker") return "Field Team";
  return role ?? "";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ModuleIcon({ action }: { action: string }) {
  const prefix = prefixOf(action);
  const size = 15;

  if (action === "auth.login") return <LogIn size={size} />;
  if (action === "auth.logout") return <LogOut size={size} />;
  if (prefix === "user") return <UserCog size={size} />;
  if (prefix === "assignment") return <ClipboardList size={size} />;
  if (prefix === "customer_report") return <Users size={size} />;

  return <FileText size={size} />;
}

function activityText(log: LogRow) {
  return `${log.actor_name ?? "Unknown"} from ${
    log.actor_team ?? roleLabel(log.actor_role)
  } ${log.details ?? log.action}`;
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Wait a moment after typing before searching
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  // Back to page 1 when the search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, moduleFilter]);

  // `silent` = background refresh: no skeleton, no error banner,
  // keeps the current list if the request fails.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const supabase = createClient();
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("activity_logs")
        .select(
          "id, actor_name, actor_role, actor_team, action, details, created_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (moduleFilter !== "all") {
        query = query.like("action", `${moduleFilter}.%`);
      }

      const term = debouncedSearch.trim().replace(/[,()%]/g, "");
      if (term) {
        query = query.or(
          `actor_name.ilike.%${term}%,details.ilike.%${term}%`
        );
      }

      const { data, count, error: queryError } = await query;

      if (queryError) {
        console.error("Activity log load error:", queryError);
        if (!silent) setError("Unable to load activity log.");
      } else {
        setLogs(data ?? []);
        setTotal(count ?? 0);
      }

      if (!silent) setLoading(false);
    },
    [page, moduleFilter, debouncedSearch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Auto refresh
  useAutoRefresh(() => void load(true));

  const moduleOptions = [
    { value: "all", label: "All Modules" },
    ...Object.entries(MODULES).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="space-y-4 border border-[#4438A8] bg-white p-3 text-slate-900 sm:space-y-8 sm:p-8">
      {/* Page Header */}
      <div className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold text-indigo-100 sm:text-sm">
              DistrictLens / Administration
            </p>

            <h2 className="mt-1 text-xl font-bold text-white sm:mt-2 sm:text-2xl">
              Activity Log
            </h2>

            <p className="mt-2 hidden text-base text-indigo-100 sm:block">
              Record of actions performed by users in the portal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 sm:px-4 sm:py-2.5"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p>{error}</p>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error message"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Search + Filter */}
      <section className="border border-slate-300 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="log-search" className={labelClass}>
              Search
            </label>

            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="log-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user or activity"
                className={`${inputBase} py-2.5 pl-10 pr-3`}
              />
            </div>
          </div>

          <div className="min-w-0 lg:w-56">
            <label htmlFor="module-filter" className={labelClass}>
              Module
            </label>

            <Dropdown
              id="module-filter"
              value={moduleFilter}
              onChange={setModuleFilter}
              options={moduleOptions}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500">
          <span>
            {total} {total === 1 ? "record" : "records"} shown
          </span>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setModuleFilter("all");
            }}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* Activity records */}
      <section className="overflow-hidden border border-[#4438A8] bg-white">
        {/* Desktop table (laptops and wider) */}
        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-r [&_th]:border-white/20 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
            <colgroup>
              <col className="w-64" />
              <col className="w-56" />
              <col className="w-52" />
              <col />
            </colgroup>

            <thead className="border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
              <tr className="text-xs uppercase tracking-wide text-indigo-50">
                <th className="px-6 py-3.5 text-left font-semibold">
                  Date &amp; Time
                </th>
                <th className="px-6 py-3.5 text-left font-semibold">
                  User
                </th>
                <th className="px-6 py-3.5 text-left font-semibold">
                  Module
                </th>
                <th className="px-6 py-3.5 text-left font-semibold">
                  Activity
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3.5">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-6 py-3.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="mt-2 h-3 w-24" />
                    </td>
                    <td className="px-6 py-3.5">
                      <Skeleton className="h-8 w-36" />
                    </td>
                    <td className="px-6 py-3.5">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center">
                    <History
                      size={30}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-900">
                      No activity recorded
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filter.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="align-middle transition hover:bg-slate-50"
                  >
                    {/* Date */}
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm text-slate-700">
                      {formatDate(log.created_at)}
                    </td>

                    {/* User */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-slate-100 font-bold text-[#123D73]">
                          {(log.actor_name || "?").charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-5 text-slate-900">
                            {log.actor_name ?? "Unknown"}
                          </p>
                          <p className="text-xs leading-5 text-slate-500">
                            {roleLabel(log.actor_role)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Module */}
                    <td className="px-6 py-3.5">
                      <span
                        className={`${badgeBase} ${
                          moduleColors[prefixOf(log.action)] ??
                          "border-slate-300 bg-slate-100 text-slate-700"
                        }`}
                      >
                        <ModuleIcon action={log.action} />
                        {moduleOf(log.action)}
                      </span>
                    </td>

                    {/* Activity */}
                    <td className="px-6 py-3.5 text-sm leading-5 text-slate-700">
                      {activityText(log)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card list for phones AND tablets (replaces the table below lg) */}
        <div className="divide-y divide-slate-300 lg:hidden">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <History size={30} className="mx-auto text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-900">
                No activity recorded
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or filter.
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <article key={log.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-slate-100 font-bold text-[#123D73]">
                    {(log.actor_name || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-slate-900">
                      {log.actor_name ?? "Unknown"}
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      {roleLabel(log.actor_role)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`${badgeBase} ${
                      moduleColors[prefixOf(log.action)] ??
                      "border-slate-300 bg-slate-100 text-slate-700"
                    }`}
                  >
                    <ModuleIcon action={log.action} />
                    {moduleOf(log.action)}
                  </span>

                  <span className="text-xs text-slate-500">
                    {formatDate(log.created_at)}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-5 text-slate-700">
                  {activityText(log)}
                </p>
              </article>
            ))
          )}
        </div>

        {!loading && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  );
}

/* Custom dropdown (same as User Management). The list renders in a portal
   so it is never clipped, and always opens downward. */
function Dropdown({
  id,
  value,
  onChange,
  options,
  placeholder = "Select",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

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

  return (
    <>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-800 shadow-sm transition-colors hover:border-[#123D73] focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
      >
        <span
          className={
            selected
              ? "truncate font-medium text-slate-900"
              : "truncate text-slate-500"
          }
        >
          {selected?.label ?? placeholder}
        </span>

        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
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
            <div
              role="listbox"
              className="min-h-0 max-h-56 flex-1 overflow-y-auto p-1"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                    option.value === value
                      ? "bg-blue-50 font-semibold text-[#123D73]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* -------------------------
   SHARED HELPERS
   (auto refresh, skeleton, pagination)
------------------------- */

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