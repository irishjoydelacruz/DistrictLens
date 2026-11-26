"use client";

import { useRef, useState } from "react";
import type {
  NotificationItem,
  NotificationType,
} from "./use-notifications";

// =========================
// SKELETON LOADING
// (square corners and slate colors, same as the admin Dashboard)
// =========================

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-slate-200 motion-safe:animate-pulse ${className}`}
    />
  );
}

// Screen readers hear this while the skeleton is shown.
function LoadingStatus({ label = "Loading..." }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

type FilterKey = "all" | NotificationType;
type ViewKey = "unread" | "read";

const PAGE_SIZE = 8;

type NotificationsProps = {
  // Not read yet (these are in the badge).
  notifications: NotificationItem[];
  // Already read. Kept here so a misclick can be undone.
  readNotifications: NotificationItem[];
  loading: boolean;
  refreshing: boolean;
  errorMessage: string;
  onRefresh: () => void;
  // Clicking a notification: the page marks it as read
  // and opens Assignments.
  onOpen: (notification: NotificationItem) => void;
  onMarkRead: (ids: string[]) => void;
  onMarkUnread: (ids: string[]) => void;
  // Removes notifications from this person's list for good.
  onDelete: (ids: string[]) => void;
  // Shown when a change could not be saved.
  actionError?: string;
  onDismissActionError?: () => void;
};

// Same panel structure as the admin portal.
function Panel({
  title,
  description,
  rightLabel,
  children,
}: {
  title: string;
  description: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden border border-slate-300 bg-white">
      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#123D73]">{title}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{description}</p>
        </div>

        {rightLabel && (
          <span className="w-fit shrink-0 border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
            {rightLabel}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

// Loading version of one notification row.
function NotificationSkeleton() {
  return (
    <div className="border-l-4 border-l-slate-200 px-4 py-5 sm:px-8">
      <div className="flex gap-4">
        <Skeleton className="h-11 w-11 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-32" />
          </div>

          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />
        </div>
      </div>
    </div>
  );
}

// =========================
// FORMAT ETR
// =========================

function formatETR(date: string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// =========================
// ICON
// (UI only: SVG icons and admin status colors, no emoji)
// =========================

function getIcon(type: NotificationType) {
  if (type === "assignment") {
    return {
      path: "M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 12h6 M9 16h4",
      tile: "border-blue-100 bg-blue-50 text-blue-800",
      border: "border-l-blue-600",
    };
  }

  if (type === "update") {
    return {
      path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
      tile: "border-amber-100 bg-amber-50 text-amber-800",
      border: "border-l-amber-500",
    };
  }

  return {
    path: "M20 6 9 17l-5-5",
    tile: "border-emerald-100 bg-emerald-50 text-emerald-800",
    border: "border-l-emerald-600",
  };
}

export default function Notifications({
  notifications,
  readNotifications,
  loading,
  refreshing,
  errorMessage,
  onRefresh,
  onOpen,
  onMarkRead,
  onMarkUnread,
  onDelete,
  actionError,
  onDismissActionError,
}: NotificationsProps) {
  const [view, setView] = useState<ViewKey>("unread");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);

  // Ids waiting for the delete confirmation.
  const [confirmDelete, setConfirmDelete] = useState<
    string[] | null
  >(null);

  const listTopRef = useRef<HTMLDivElement>(null);

  // Skeleton only on the first load. Later refreshes keep the old
  // list visible with the "Updating" indicator.
  const showSkeleton =
    loading &&
    notifications.length === 0 &&
    readNotifications.length === 0;

  const isUnreadView = view === "unread";

  // The list for the selected tab (Unread or Read).
  const source = isUnreadView ? notifications : readNotifications;

  // =========================
  // COUNTS (the cards are also the filters)
  // =========================

  const countOf = (type: NotificationType) =>
    source.filter((item) => item.type === type).length;

  const filterCards: {
    key: FilterKey;
    label: string;
    count: number;
    accent: string;
  }[] = [
    {
      key: "all",
      label: isUnreadView ? "All unread" : "All read",
      count: source.length,
      accent: "bg-[#123D73]",
    },
    {
      key: "assignment",
      label: "New assignments",
      count: countOf("assignment"),
      accent: "bg-blue-600",
    },
    {
      key: "update",
      label: "In progress",
      count: countOf("update"),
      accent: "bg-amber-500",
    },
    {
      key: "resolved",
      label: "Resolved",
      count: countOf("resolved"),
      accent: "bg-emerald-600",
    },
  ];

  const filtered =
    filter === "all"
      ? source
      : source.filter((item) => item.type === filter);

  // =========================
  // PAGINATION (8 per page)
  // =========================

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const pagedNotifications = filtered.slice(
    pageStart,
    pageStart + PAGE_SIZE
  );

  function goToPage(next: number) {
    setPage(next);

    listTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function changeView(next: ViewKey) {
    setView(next);
    setFilter("all");
    setPage(1);
  }

  function changeFilter(next: FilterKey) {
    setFilter(next);
    setPage(1);
  }

  // =========================
  // ERROR
  // =========================

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-md px-3 pt-4">
        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-5"
        >
          <h2 className="text-base font-bold text-red-800">
            Unable to load notifications
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 min-h-11 rounded-none border border-red-700 bg-red-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700/30"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // MAIN UI
  // =========================

  return (
    <div
      className="mx-auto w-full max-w-[1600px] px-3 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8"
      aria-busy={showSkeleton}
    >
      {showSkeleton && (
        <LoadingStatus label="Loading notifications..." />
      )}

      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">

        {/* HEADER */}

        <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-indigo-100">
                Alerts
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                Notifications
              </h1>

              <p className="mt-2 text-base text-indigo-100">
                Tap a notification to open it in Assignments.
                Opened notifications move to Read.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
              {/* SUBTLE REFRESH INDICATOR (only when refreshing) */}

              {refreshing && (
                <div
                  className="flex items-center gap-2 text-xs font-medium text-indigo-100"
                  aria-live="polite"
                >
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const ids = filtered.map((item) => item.id);

                  if (isUnreadView) {
                    onMarkRead(ids);
                  } else {
                    onMarkUnread(ids);
                  }
                }}
                disabled={filtered.length === 0}
                className="min-h-11 rounded-none border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50"
              >
                {isUnreadView
                  ? "Mark all as read"
                  : "Mark all as unread"}
              </button>

              {!isUnreadView && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete(
                      filtered.map((item) => item.id)
                    )
                  }
                  disabled={filtered.length === 0}
                  className="min-h-11 rounded-none border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50"
                >
                  Delete all
                </button>
              )}

              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="min-h-11 rounded-none border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* SAVE ERROR */}

        {actionError && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p>{actionError}</p>

            {onDismissActionError && (
              <button
                type="button"
                onClick={onDismissActionError}
                className="ml-auto font-semibold"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* UNREAD / READ TABS */}

        <div
          role="tablist"
          aria-label="Notification status"
          className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2"
        >
          {(
            [
              {
                key: "unread" as ViewKey,
                label: "Unread",
                count: notifications.length,
              },
              {
                key: "read" as ViewKey,
                label: "Read",
                count: readNotifications.length,
              },
            ]
          ).map((tab) => {
            const active = view === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeView(tab.key)}
                className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap border px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-6 ${
                  active
                    ? "border-[#123D73] bg-[#123D73] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}

                <span
                  className={`min-w-5 px-1.5 py-0.5 text-center text-xs font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : tab.key === "unread" && tab.count > 0
                        ? "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {showSkeleton ? "–" : tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* FILTER CARDS */}

        <div
          role="group"
          aria-label="Filter notifications"
          className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4"
        >
          {filterCards.map((card) => {
            const active = filter === card.key;

            return (
              <button
                key={card.key}
                type="button"
                aria-pressed={active}
                onClick={() => changeFilter(card.key)}
                className={`relative min-w-0 rounded-none border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 sm:p-6 ${
                  active
                    ? "border-[#123D73] bg-blue-50"
                    : "border-slate-300 bg-white hover:bg-slate-50"
                }`}
              >
                <div
                  className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`}
                />

                <p className="text-sm font-bold text-slate-800">
                  {card.label}
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900 sm:mt-3 sm:text-4xl">
                  {showSkeleton ? (
                    <Skeleton className="h-9 w-14 sm:h-10" />
                  ) : (
                    card.count
                  )}
                </p>
              </button>
            );
          })}
        </div>

        {/* NOTIFICATION LIST */}

        <Panel
          title={isUnreadView ? "Unread Updates" : "Read Updates"}
          description={
            isUnreadView
              ? "Newest first. Opened notifications move to Read."
              : "Already read. Mark as unread to bring one back."
          }
          rightLabel={
            showSkeleton
              ? "Loading..."
              : filtered.length === 0
                ? "0 notifications"
                : `${pageStart + 1}–${
                    pageStart + pagedNotifications.length
                  } of ${filtered.length}`
          }
        >
          <div ref={listTopRef} className="scroll-mt-28">

            {/* LOADING */}

            {showSkeleton && (
              <div className="divide-y divide-slate-200">
                <NotificationSkeleton />
                <NotificationSkeleton />
                <NotificationSkeleton />
              </div>
            )}

            {/* EMPTY */}

            {!showSkeleton && filtered.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="text-base font-bold text-slate-800">
                  {source.length === 0
                    ? isUnreadView
                      ? "You're all caught up"
                      : "Nothing read yet"
                    : "No notifications in this filter"}
                </p>

                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {source.length === 0
                    ? isUnreadView
                      ? "New assignments and updates for your team will appear here."
                      : "Notifications you open or mark as read will appear here."
                    : "Try choosing a different filter."}
                </p>

                {source.length > 0 && (
                  <button
                    type="button"
                    onClick={() => changeFilter("all")}
                    className="mt-5 min-h-11 rounded-none border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
                  >
                    Show all
                  </button>
                )}
              </div>
            )}

            {/* LIST */}

            {!showSkeleton && pagedNotifications.length > 0 && (
              <div className="divide-y divide-slate-200">
                {pagedNotifications.map((notification) => {
                  const icon = getIcon(notification.type);

                  const hasDetails =
                    notification.affectedBarangays.length > 0 ||
                    !!notification.affectedArea ||
                    !!notification.etr;

                  return (
                    <article
                      key={notification.id}
                      className={`flex border-l-4 ${icon.border} ${
                        isUnreadView
                          ? "bg-white"
                          : "bg-slate-50/60"
                      }`}
                    >
                      {/* Clicking opens Assignments */}

                      <button
                        type="button"
                        onClick={() => onOpen(notification)}
                        className="flex min-w-0 flex-1 gap-4 px-4 py-5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#123D73] sm:px-8"
                      >
                        {/* ICON */}

                        <span
                          aria-hidden="true"
                          className={`flex h-11 w-11 shrink-0 items-center justify-center border ${icon.tile}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                          >
                            <path d={icon.path} />
                          </svg>
                        </span>

                        {/* CONTENT */}

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="text-base font-bold text-[#123D73]">
                                {notification.title}
                              </span>

                              {isUnreadView && (
                                <span className="inline-flex items-center border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                  New
                                </span>
                              )}
                            </span>

                            <span className="text-sm text-slate-500">
                              {notification.time}
                            </span>
                          </span>

                          <span className="mt-1.5 block wrap-break-word text-base leading-7 text-slate-700">
                            {notification.message}
                          </span>

                          {/* DETAILS */}

                          {hasDetails && (
                            <span className="mt-4 grid gap-4 border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                              {notification.affectedBarangays
                                .length > 0 && (
                                <span className="block min-w-0">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {notification
                                      .affectedBarangays.length > 1
                                      ? "Affected barangays"
                                      : "Affected barangay"}
                                  </span>

                                  <span className="mt-1.5 block wrap-break-word text-sm leading-6 text-slate-800">
                                    {notification.affectedBarangays.join(
                                      ", "
                                    )}
                                  </span>
                                </span>
                              )}

                              {notification.affectedArea && (
                                <span className="block min-w-0">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Affected area
                                  </span>

                                  <span className="mt-1.5 block wrap-break-word text-sm leading-6 text-slate-800">
                                    {notification.affectedArea}
                                  </span>
                                </span>
                              )}

                              {notification.etr && (
                                <span className="block min-w-0">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Estimated restoration
                                  </span>

                                  <span className="mt-1.5 block text-sm leading-6 text-slate-800">
                                    {formatETR(notification.etr)}
                                  </span>
                                </span>
                              )}
                            </span>
                          )}

                          <span className="mt-3 inline-block text-sm font-semibold text-[#123D73]">
                            View in Assignments →
                          </span>
                        </span>
                      </button>

                      {/* Mark as read / unread without opening */}

                      <div className="flex items-start gap-1 py-4 pr-3 sm:pr-6">
                        <button
                          type="button"
                          onClick={() =>
                            isUnreadView
                              ? onMarkRead([notification.id])
                              : onMarkUnread([notification.id])
                          }
                          aria-label={`${
                            isUnreadView
                              ? "Mark as read"
                              : "Mark as unread"
                          }: ${notification.title}`}
                          title={
                            isUnreadView
                              ? "Mark as read"
                              : "Mark as unread"
                          }
                          className="p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            {isUnreadView ? (
                              <path d="M20 6 9 17l-5-5" />
                            ) : (
                              <>
                                <circle cx="12" cy="12" r="9" />
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="3"
                                  fill="currentColor"
                                />
                              </>
                            )}
                          </svg>
                        </button>

                        {!isUnreadView && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete([notification.id])
                            }
                            aria-label={`Delete: ${notification.title}`}
                            title="Delete"
                            className="p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* PAGINATION */}

            {!showSkeleton && totalPages > 1 && (
              <nav
                aria-label="Notification pages"
                className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-8"
              >
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="min-h-11 rounded-none border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                >
                  Previous
                </button>

                <p
                  className="text-sm font-medium text-slate-600"
                  aria-live="polite"
                >
                  Page {currentPage} of {totalPages}
                </p>

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="min-h-11 rounded-none border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </Panel>
      </div>

      {/* DELETE CONFIRMATION */}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-1100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-notification-title"
            aria-describedby="delete-notification-message"
            className="w-full max-w-md border border-[#DCD6FF] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
              </svg>
            </div>

            <h2
              id="delete-notification-title"
              className="mt-5 text-center text-xl font-bold text-[#27205C]"
            >
              {confirmDelete.length === 1
                ? "Delete this notification?"
                : `Delete ${confirmDelete.length} notifications?`}
            </h2>

            <p
              id="delete-notification-message"
              className="mt-2 text-center text-sm leading-6 text-slate-600"
            >
              They are removed from your list only. Your
              teammates and the assignments are not affected.
              This cannot be undone.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="border border-[#D9D4EE] px-4 py-3 text-sm font-semibold text-[#5145B5] transition hover:bg-indigo-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const ids = confirmDelete;
                  setConfirmDelete(null);
                  onDelete(ids);
                }}
                className="bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}