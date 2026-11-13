"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

import Sidebar from "./modules/sidebar";
import Dashboard from "./modules/dashboard";
import CreateReport from "./modules/create-report";
import Submissions from "./modules/submissions";
import CustomerReports, {
  type CustomerReportPrefill,
} from "./modules/customer-reports";
import FrequentIncidents from "./modules/frequent-incidents";
import Deployment from "./modules/deployment";
import UserManagement from "./modules/user-management";

type ResetRequest = { id: string; fullName: string };

/* NOTIFICATION BELL (Super Admin only)
   Shows users who used "Forgot password" and are waiting for a new
   temporary password. Uses the existing /api/admin/users endpoint. */

function NotificationBell({
  enabled,
  refreshKey,
  onOpenUsers,
}: {
  enabled: boolean;
  refreshKey: string;
  onOpenUsers: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<ResetRequest[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = await response.json();

      setRequests(
        ((data.users ?? []) as {
          id: string;
          fullName: string | null;
          resetRequested?: boolean;
        }[])
          .filter((user) => user.resetRequested)
          .map((user) => ({
            id: user.id,
            fullName: user.fullName || "Unknown user",
          }))
      );
    } catch (error) {
      console.error("Unable to load notifications:", error);
    }
  }, []);

  // Check on load, when the admin changes pages, and every 30 seconds.
  useEffect(() => {
    if (!enabled) return;

    void load();

    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [enabled, load, refreshKey]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          void load();
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          requests.length > 0
            ? `Notifications, ${requests.length} pending`
            : "Notifications"
        }
        className="relative flex h-13 w-13 items-center justify-center border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path
            d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19a2 2 0 0 0 4 0"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {requests.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center bg-red-600 px-1 text-xs font-bold text-white">
            {requests.length > 9 ? "9+" : requests.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-1001 cursor-default"
          />

          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-1002 w-[min(22rem,calc(100vw-2rem))] border border-slate-200 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <p className="text-base font-bold text-[#123D73]">
                Notifications
              </p>

              {requests.length > 0 && (
                <span className="bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700">
                  {requests.length} pending
                </span>
              )}
            </div>

            {requests.length === 0 ? (
              <p className="px-5 py-8 text-center text-base text-slate-500">
                No pending password requests.
              </p>
            ) : (
              <>
                <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto">
                  {requests.map((request) => (
                    <li key={request.id} className="px-5 py-4">
                      <p className="wrap-break-word text-base font-semibold text-slate-900">
                        {request.fullName}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Requested a new temporary password.
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenUsers();
                    }}
                    className="w-full bg-[#123D73] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[#0D2F59]"
                  >
                    Open User Management
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [userName, setUserName] = useState("Administrator");
  const [userRole, setUserRole] = useState("Admin");
  const [userRoleKey, setUserRoleKey] = useState("");
  const [initials, setInitials] = useState("AD");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [pendingCustomerReports, setPendingCustomerReports] = useState(0);
  // Customer report waiting to be turned into an incident report.
  const [reportPrefill, setReportPrefill] =
    useState<CustomerReportPrefill | null>(null);
  const clearReportPrefill = useCallback(() => setReportPrefill(null), []);

  /* LOAD CURRENT USER */

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (isMounted) {
            window.location.href = "/login";
          }
          return;
        }

        const metadataName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name;

        if (isMounted) {
          setUserName(metadataName || user.email || "Administrator");
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", user.id)
            .single();

        if (profileError) {
          console.error("Profile loading error:", profileError);
          return;
        }

        if (!isMounted || !profile) return;

        if (profile.full_name) {
          setUserName(profile.full_name);
        }

        if (profile.role) {
          setUserRoleKey(profile.role);

          const formattedRole =
            profile.role === "super_admin"
              ? "Super Admin"
              : profile.role === "customer_service"
                ? "Customer Service"
                : profile.role === "field_team"
                  ? "Field Team"
                  : profile.role;

          setUserRole(formattedRole);

          if (profile.role !== "super_admin") {
            setActiveSection((current) =>
              current === "users" ? "dashboard" : current
            );
          }
        }
      } catch (error) {
        console.error("Unable to load current user:", error);
      } finally {
        if (isMounted) {
          setIsLoadingUser(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  /* GENERATE USER INITIALS */

  useEffect(() => {
    const generatedInitials = userName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    setInitials(generatedInitials || "AD");
  }, [userName]);

  /* PENDING CUSTOMER REPORTS (badge on the navigation) */

  useEffect(() => {
    let isMounted = true;

    async function loadPendingCount() {
      try {
        const supabase = createClient();

        const { count, error } = await supabase
          .from("customer_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (!error && isMounted) {
          setPendingCustomerReports(count ?? 0);
        }
      } catch (error) {
        console.error("Unable to load pending customer reports:", error);
      }
    }

    void loadPendingCount();

    const timer = window.setInterval(() => void loadPendingCount(), 30000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  /* SECTION CHANGE */

  function handleSectionChange(section: string) {
    if (section === "users" && userRoleKey !== "super_admin") {
      return;
    }

    setActiveSection(section);
    setIsUserMenuOpen(false);
  }

  /* LOGOUT */

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return;
    }

    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9] text-slate-800">
      {/* HEADER */}

      <header className="sticky top-0 z-1000 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-22 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* OFFICIAL TWD LOGO AND BRAND */}

          <button
            type="button"
            onClick={() => handleSectionChange("dashboard")}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Go to Dashboard"
          >
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
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

              <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight text-[#123D73] sm:text-xl">
                DistrictLens
              </h1>

              <p className="hidden text-[11px] text-slate-500 sm:block">
                Incident Monitoring and Operations Portal
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-3">
          {/* NOTIFICATIONS */}

          <NotificationBell
            enabled={userRoleKey === "super_admin"}
            refreshKey={activeSection}
            onOpenUsers={() => handleSectionChange("users")}
          />

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
                  {isLoadingUser ? "Loading account..." : userRole}
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
                      {userRole}
                    </p>

                    <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">
                      DistrictLens Admin Portal
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
        </div>
      </header>

      {/* HORIZONTAL NAVIGATION */}

      <Sidebar
        activeSection={activeSection}
        setActiveSection={handleSectionChange}
        userRole={userRoleKey}
        customerReportsPending={pendingCustomerReports}
      />

      {/* MAIN CONTENT */}

      <main className="mx-auto min-h-[calc(100vh-200px)] w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* EXISTING PAGE COMPONENTS */}

        {activeSection === "dashboard" && <Dashboard />}

        {activeSection === "create-report" && (
          <CreateReport
            prefill={reportPrefill}
            onPrefillConsumed={clearReportPrefill}
          />
        )}

        {activeSection === "customer-reports" && (
          <CustomerReports
            onPendingChange={setPendingCustomerReports}
            onCreateReport={(prefill) => {
              setReportPrefill(prefill);
              handleSectionChange("create-report");
            }}
          />
        )}

        {activeSection === "submissions" && <Submissions />}

        {activeSection === "assignments" && <Deployment />}

        {activeSection === "analytics" && <FrequentIncidents />}

        {activeSection === "users" &&
          userRoleKey === "super_admin" && <UserManagement />}

        {/* UNAVAILABLE SECTION FALLBACK */}

        {![
          "dashboard",
          "create-report",
          "customer-reports",
          "submissions",
          "assignments",
          "analytics",
          "users",
        ].includes(activeSection) && (
          <section className="border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-[#123D73]">
              Section unavailable
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This section has not been connected to a page component yet.
            </p>

            <button
              type="button"
              onClick={() => handleSectionChange("dashboard")}
              className="mt-4 border border-[#123D73] bg-[#123D73] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D2F59]"
            >
              Return to Dashboard
            </button>
          </section>
        )}
      </main>

      {/* FOOTER */}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold text-[#123D73]">
              DistrictLens Admin Portal
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
  );
}