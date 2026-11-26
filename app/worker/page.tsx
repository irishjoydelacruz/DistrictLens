"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity-log";

import Authentication from "./authentication";

import Home from "./modules/home";
import Assignments, { type Filter } from "./modules/assignments";
import IncidentDetails from "./modules/incident-details";
import Notifications from "./modules/notifications";
import Team from "./modules/team";
import {
  useNotifications,
  type NotificationItem,
} from "./modules/use-notifications";

/* =========================================
   NAVIGATION ITEMS
========================================= */

const navItems = [
  {
    key: "home",
    label: "Home",
    path: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  },
  {
    key: "assignments",
    label: "Assignments",
    path: "M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 12h6 M9 16h4",
  },
  {
    key: "notifications",
    label: "Alerts",
    path: "M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z M10 19a2 2 0 0 0 4 0",
  },
  {
    key: "team",
    label: "Team",
    path: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M21 20v-1a4 4 0 0 0-3-3.87 M16 4.13a3.5 3.5 0 0 1 0 6.74",
  },
];

function NavIcon({
  path,
  className = "h-6 w-6",
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

// Same red square badge as the admin sidebar.
function Badge({
  count,
  small = false,
  className = "",
}: {
  count: number;
  small?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center bg-red-600 font-bold text-white ${
        small
          ? "h-4 min-w-4 px-1 text-[10px]"
          : "h-5 min-w-5 px-1.5 text-xs"
      } ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* =========================================
   HEADER (same look as the admin portal)
   Lives inside <Authentication> so it only
   loads the profile once the user is signed in.
========================================= */

function WorkerHeader({
  onGoHome,
}: {
  onGoHome: () => void;
}) {
  const [userName, setUserName] =
    useState("Field Worker");

  const [isUserMenuOpen, setIsUserMenuOpen] =
    useState(false);

  // Logout popups: confirmation first, then the success message.
  const [logoutStep, setLogoutStep] = useState<
    "closed" | "confirm" | "success"
  >("closed");

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !isMounted) return;

        const metadataName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name;

        if (metadataName) {
          setUserName(metadataName);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (isMounted && profile?.full_name) {
          setUserName(profile.full_name);
        }
      } catch (error) {
        console.error(
          "Unable to load current user:",
          error
        );
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const generated = userName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    return generated || "FW";
  }, [userName]);

  /* LOGOUT SUCCESS: BACK TO SIGN-IN AFTER A MOMENT */

  // Reload so <Authentication> shows the sign-in screen again.
  useEffect(() => {
    if (logoutStep !== "success") return;

    const timer = window.setTimeout(() => {
      window.location.reload();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [logoutStep]);

  /* LOGOUT */

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const supabase = createClient();

    // Log first: after signOut there is no session,
    // so RLS would block it. A failed log must not
    // stop the person from logging out.
    try {
      await logActivity({
        action: "auth.logout",
        details: "logged out.",
      });
    } catch (error) {
      console.error("Unable to log activity:", error);
    }

    const { error } = await supabase.auth.signOut();
    setIsLoggingOut(false);

    if (error) {
      console.error("Logout error:", error);
      setLogoutStep("closed");
      return;
    }

    setLogoutStep("success");
  }

  return (
    <>
      <header className="sticky top-0 z-1000 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-18 max-w-[1600px] items-center justify-between gap-3 px-3 py-2 sm:min-h-22 sm:gap-4 sm:px-6 sm:py-3 lg:px-8">

          {/* LOGO AND BRAND */}

          <button
            type="button"
            onClick={onGoHome}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Go to Home"
          >
            <div className="relative h-12 w-12 shrink-0 sm:h-16 sm:w-16">
              <Image
                src="/images/twd-logo.jpg"
                alt="Tanza Water District official logo"
                fill
                sizes="64px"
                className="object-contain"
                priority
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
                Tanza Water District
              </p>

              <p className="mt-0.5 truncate text-lg font-bold tracking-tight text-[#123D73] sm:text-xl">
                DistrictLens
              </p>

              <p className="hidden text-[11px] text-slate-500 sm:block">
                Field Worker Portal
              </p>
            </div>
          </button>

          {/* USER PROFILE MENU */}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() =>
                setIsUserMenuOpen((current) => !current)
              }
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 border border-slate-200 bg-white px-2 py-2 transition-colors hover:bg-slate-50 sm:gap-3 sm:px-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#E8EEF6] text-xs font-bold text-[#123D73]">
                {initials}
              </div>

              <div className="hidden min-w-0 text-left sm:block">
                <p className="max-w-45 truncate text-xs font-semibold text-slate-800">
                  {userName}
                </p>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  Field Worker
                </p>
              </div>

              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className={`h-4 w-4 text-slate-500 transition-transform ${
                  isUserMenuOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                <path
                  d="m6 9 6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isUserMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close user menu"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="fixed inset-0 z-1001 cursor-default"
                />

                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] z-1002 w-64 border border-slate-200 bg-white shadow-lg"
                >
                  <div className="border-b border-slate-200 px-4 py-4">
                    <p className="wrap-break-word text-sm font-semibold text-slate-800">
                      {userName}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Field Worker
                    </p>

                    <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">
                      DistrictLens Field Portal
                    </p>
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setLogoutStep("confirm");
                      }}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 17l5-5-5-5M15 12H3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </header>

      {/* LOGOUT POPUPS */}

      {logoutStep !== "closed" && (
        <div
          className="fixed inset-0 z-1100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-message"
            className="w-full max-w-md border border-[#DCD6FF] bg-white p-6 shadow-2xl sm:p-8"
          >
            {logoutStep === "confirm" ? (
              <>
                {/* Big question mark */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEEAFE] text-[#5145B5]">
                  <span
                    aria-hidden="true"
                    className="text-4xl font-bold leading-none"
                  >
                    ?
                  </span>
                </div>

                <h2
                  id="logout-title"
                  className="mt-5 text-center text-xl font-bold text-[#27205C]"
                >
                  Log out?
                </h2>

                <p
                  id="logout-message"
                  className="mt-2 text-center text-sm leading-6 text-slate-600"
                >
                  Are you sure you want to log out of DistrictLens?
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLogoutStep("closed")}
                    disabled={isLoggingOut}
                    className="border border-[#D9D4EE] px-4 py-3 text-sm font-semibold text-[#5145B5] transition hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="bg-linear-to-r from-[#342992] to-[#5366C8] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    {isLoggingOut ? "Logging out..." : "Yes, log out"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Check mark */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEEAFE] text-[#5145B5]">
                  <svg
                    className="h-9 w-9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m5 12.5 4.5 4.5L19 7.5"
                    />
                  </svg>
                </div>

                <h2
                  id="logout-title"
                  className="mt-5 text-center text-xl font-bold text-[#27205C]"
                >
                  Logged out successfully
                </h2>

                <p
                  id="logout-message"
                  className="mt-2 text-center text-sm leading-6 text-slate-600"
                >
                  You have been logged out. Redirecting to the login page...
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full bg-linear-to-r from-[#342992] to-[#5366C8] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  >
                    Go to Login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================
   SHELL
   Everything below the sign-in lives here, so the notifications
   (and the badge) only load after the person is signed in.
========================================= */

function WorkerShell() {
  const [activeSection, setActiveSection] =
    useState("home");

  const [selectedDeployment, setSelectedDeployment] =
    useState<any>(null);

  // Filter that the Assignments tab opens with
  // (e.g. "resolved" when coming from the Team tab).
  const [assignmentsFilter, setAssignmentsFilter] =
    useState<Filter>("todo");

  // Used to tell each module:
  // "refresh your data"
  const [refreshKey, setRefreshKey] =
    useState(0);

  // Notifications live here so the badge is always up to date.
  const notifs = useNotifications(refreshKey);

  // Always start at the top when the section changes
  // (also runs when the same tab is tapped again,
  // because refreshKey changes every time).
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
  }, [activeSection, refreshKey]);

  // The filter resets to "todo" (work that still needs doing)
  // unless one is passed in.
  function changeSection(
    section: string,
    filter: Filter = "todo"
  ) {
    setAssignmentsFilter(filter);
    setActiveSection(section);

    // Trigger a refresh when changing section
    setRefreshKey((previous) => previous + 1);
  }

  function openIncidentDetails(
    deployment: any
  ) {
    setSelectedDeployment(deployment);
    setActiveSection("incident-details");
  }

  // Going back from Incident Details keeps the current filter.
  function backToAssignments() {
    setSelectedDeployment(null);
    setActiveSection("assignments");
    setRefreshKey((previous) => previous + 1);
  }

  // Tapping a notification: it is marked as read (removed from the
  // list and the badge) and Assignments opens on the matching filter.
  function openNotification(
    notification: NotificationItem
  ) {
    notifs.markRead([notification.id]);

    const filter: Filter =
      notification.type === "resolved"
        ? "resolved"
        : notification.type === "update"
          ? "ongoing"
          : "assigned";

    changeSection("assignments", filter);
  }

  // Incident details belongs to the Assignments tab.
  const activeTab =
    activeSection === "incident-details"
      ? "assignments"
      : activeSection;

  // Badge number for each nav item (only Alerts has one).
  function badgeFor(key: string) {
    return key === "notifications"
      ? notifs.unreadCount
      : 0;
  }

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9] text-slate-800">

      {/* HEADER */}
      <WorkerHeader
        onGoHome={() => changeSection("home")}
      />

      {/* TOP NAVIGATION (tablet and desktop) */}
      <nav
        aria-label="Main navigation"
        className="hidden border-b border-slate-200 bg-white md:block"
      >
        <div className="mx-auto flex max-w-[1600px] justify-center gap-1 px-4 sm:px-6 lg:px-8">
          {navItems.map((item) => {
            const active = activeTab === item.key;
            const badge = badgeFor(item.key);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  changeSection(item.key)
                }
                aria-current={
                  active ? "page" : undefined
                }
                aria-label={
                  badge > 0
                    ? `${item.label}, ${badge} new`
                    : undefined
                }
                className={`flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[#123D73] text-[#123D73]"
                    : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-[#123D73]"
                }`}
              >
                <NavIcon
                  path={item.path}
                  className="h-5 w-5"
                />

                {item.label}

                <Badge count={badge} />
              </button>
            );
          })}
        </div>
      </nav>

      {/* CONTENT + FOOTER (extra space on phones for the bottom bar) */}
      <div className="pb-20 md:pb-0">

        {/* MAIN CONTENT */}
        <main
          id="main-content"
          className="min-h-[calc(100vh-14rem)]"
        >

          {/* HOME */}
          {activeSection === "home" && (
            <Home
              refreshKey={refreshKey}
              onOpenAssignments={() =>
                changeSection("assignments")
              }
              onSelectAssignment={
                openIncidentDetails
              }
            />
          )}

          {/* ASSIGNMENTS */}
          {activeSection === "assignments" && (
            <Assignments
              refreshKey={refreshKey}
              initialFilter={assignmentsFilter}
              onSelectAssignment={
                openIncidentDetails
              }
            />
          )}

          {/* INCIDENT DETAILS */}
          {activeSection === "incident-details" && (
            <IncidentDetails
              deployment={selectedDeployment}
              onBack={backToAssignments}
            />
          )}

          {/* NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <Notifications
              notifications={notifs.notifications}
              readNotifications={notifs.readNotifications}
              loading={notifs.loading}
              refreshing={notifs.refreshing}
              errorMessage={notifs.errorMessage}
              onRefresh={notifs.reload}
              onOpen={openNotification}
              onMarkRead={notifs.markRead}
              onMarkUnread={notifs.markUnread}
              onDelete={notifs.deleteNotifications}
              actionError={notifs.actionError}
              onDismissActionError={notifs.clearActionError}
            />
          )}

          {/* TEAM */}
          {activeSection === "team" && (
            <Team
              onOpenAssignments={(filter) =>
                changeSection(
                  "assignments",
                  filter ?? "todo"
                )
              }
            />
          )}

        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold text-[#123D73]">
                DistrictLens Field Portal
              </p>

              <p className="mt-1 text-[11px] text-slate-500">
                Tanza Water District
              </p>
            </div>

            <p className="text-[11px] text-slate-500">
              Authorized personnel only
            </p>
          </div>
        </footer>

      </div>

      {/* BOTTOM NAVIGATION (phones only) */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-900 border-t border-slate-200 bg-white md:hidden"
      >
        <div className="mx-auto flex max-w-xl justify-around">
          {navItems.map((item) => {
            const active = activeTab === item.key;
            const badge = badgeFor(item.key);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  changeSection(item.key)
                }
                aria-current={
                  active ? "page" : undefined
                }
                aria-label={
                  badge > 0
                    ? `${item.label}, ${badge} new`
                    : undefined
                }
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 border-t-2 px-2 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[#123D73] bg-blue-50 text-[#123D73]"
                    : "border-transparent text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className="relative">
                  <NavIcon path={item.path} />

                  <Badge
                    count={badge}
                    small
                    className="absolute -right-3 -top-2"
                  />
                </span>

                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}

/* =========================================
   PAGE
========================================= */

export default function WorkerPage() {
  return (
    <Authentication>
      <WorkerShell />
    </Authentication>
  );
}