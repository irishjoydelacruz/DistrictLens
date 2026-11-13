"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

import Authentication from "./authentication";

import Home from "./modules/home";
import Assignments from "./modules/assignments";
import IncidentDetails from "./modules/incident-details";
import Notifications from "./modules/notifications";
import Team from "./modules/team";

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

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return;
    }

    // Reload so <Authentication> shows the sign-in screen again.
    window.location.reload();
  }

  return (
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
                    onClick={handleLogout}
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
  );
}

/* =========================================
   PAGE
========================================= */

export default function WorkerPage() {
  const [activeSection, setActiveSection] =
    useState("home");

  const [selectedDeployment, setSelectedDeployment] =
    useState<any>(null);

  // Used to tell each module:
  // "refresh your data"
  const [refreshKey, setRefreshKey] =
    useState(0);

  function changeSection(section: string) {
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

  function backToAssignments() {
    setSelectedDeployment(null);
    changeSection("assignments");
  }

  // Incident details belongs to the Assignments tab.
  const activeTab =
    activeSection === "incident-details"
      ? "assignments"
      : activeSection;

  return (
    <Authentication>
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
              />
            )}

            {/* ASSIGNMENTS */}
            {activeSection === "assignments" && (
              <Assignments
                refreshKey={refreshKey}
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
              <Notifications />
            )}

            {/* TEAM */}
            {activeSection === "team" && (
              <Team />
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
                  className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 border-t-2 px-2 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[#123D73] bg-blue-50 text-[#123D73]"
                      : "border-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <NavIcon path={item.path} />

                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

      </div>
    </Authentication>
  );
}