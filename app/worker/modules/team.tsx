"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
// =========================
// SKELETON LOADING
// (square corners and slate colors, same as the admin Dashboard)
// =========================

function Skeleton({
  className = "",
  tone = "light",
}: {
  className?: string;
  // "dark" is for skeletons placed on the purple banner.
  tone?: "light" | "dark";
}) {
  return (
    <span
      aria-hidden="true"
      className={`block motion-safe:animate-pulse ${
        tone === "dark" ? "bg-white/25" : "bg-slate-200"
      } ${className}`}
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

type TeamInfo = {
  id: string | number;
  name: string;
};

type Member = {
  id: string;
  full_name: string | null;
};

type Counts = {
  assigned: number;
  ongoing: number;
  resolved: number;
};

// Same values as the filter cards in the Assignments tab.
type AssignmentFilter =
  | "all"
  | "todo"
  | "assigned"
  | "ongoing"
  | "resolved"
  | "red"
  | "yellow";

type TeamProps = {
  // Opens the Assignments tab, optionally with a filter preselected.
  onOpenAssignments?: (filter?: AssignmentFilter) => void;
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

// Loading version of a team member card.
function MemberCardSkeleton() {
  return (
    <div className="flex items-center gap-4 border border-slate-300 bg-white p-5">
      <Skeleton className="h-12 w-12 shrink-0" />

      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-32 max-w-full" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    </div>
  );
}

export default function Team({ onOpenAssignments }: TeamProps) {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [accountName, setAccountName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [counts, setCounts] = useState<Counts>({
    assigned: 0,
    ongoing: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTeam() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("You are not logged in.");
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, full_name, role, team_id")
            .eq("id", user.id)
            .single();

        if (profileError) {
          throw new Error(
            `Unable to load profile: ${profileError.message}`
          );
        }

        if (!profile.team_id) {
          throw new Error(
            "This Field Worker account has no assigned team."
          );
        }

        const [teamResult, memberResult, deploymentResult] =
          await Promise.all([
            supabase
              .from("teams")
              .select("id, name")
              .eq("id", profile.team_id)
              .single(),

            supabase
              .from("profiles")
              .select("id, full_name")
              .eq("team_id", profile.team_id)
              .eq("role", "field_worker")
              .order("full_name", { ascending: true }),

            supabase
              .from("deployments")
              .select("status")
              .eq("team_id", profile.team_id),
          ]);

        if (!isMounted) return;

        setCurrentUserId(profile.id);
        setAccountName(profile.full_name ?? "");

        setTeam(
          teamResult.error || !teamResult.data
            ? {
                id: profile.team_id,
                name: profile.full_name ?? "Field Team",
              }
            : (teamResult.data as TeamInfo)
        );

        if (!memberResult.error) {
          setMembers((memberResult.data ?? []) as Member[]);
        }

        if (!deploymentResult.error) {
          const rows = (deploymentResult.data ?? []) as {
            status: string;
          }[];

          setCounts({
            assigned: rows.filter(
              (row) =>
                row.status !== "ongoing" &&
                row.status !== "in_progress" &&
                row.status !== "resolved"
            ).length,
            ongoing: rows.filter(
              (row) =>
                row.status === "ongoing" ||
                row.status === "in_progress"
            ).length,
            resolved: rows.filter(
              (row) => row.status === "resolved"
            ).length,
          });
        }
      } catch (error) {
        if (!isMounted) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load team information."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTeam();

    return () => {
      isMounted = false;
    };
  }, []);

  // The team's own login account is the "device"; other
  // field-worker profiles on the same team are listed as members.
  const otherMembers = members.filter(
    (member) => member.id !== currentUserId
  );

  const teamName = team?.name ?? "Team";

  // Each summary card opens Assignments with its matching filter.
  const summaryCards: {
    label: string;
    value: number;
    filter: AssignmentFilter;
  }[] = [
    { label: "Assigned", value: counts.assigned, filter: "assigned" },
    { label: "Ongoing", value: counts.ongoing, filter: "ongoing" },
    { label: "Resolved", value: counts.resolved, filter: "resolved" },
  ];

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-md px-3 pt-4">
        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-5"
        >
          <h2 className="text-base font-bold text-red-800">
            Unable to load team
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-[1600px] px-3 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8"
      aria-busy={loading}
    >

      {loading && <LoadingStatus />}

      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">

        {/* HEADER */}
        <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-sm font-bold text-indigo-100">
            Team
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white">
            {loading ? (
              <Skeleton tone="dark" className="h-8 w-48 max-w-full" />
            ) : (
              teamName
            )}
          </h1>

          <p className="mt-2 text-base text-indigo-100">
            Information about your field team and its members.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">

          {/* TEAM CARD */}
          <Panel
            title="Team Information"
            description="Your assigned field team"
          >
            <div className="flex items-center gap-5 p-4 sm:p-8">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-[#E8EEF6] text-[#123D73]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8"
                >
                  <path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
                  <path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                  <path d="M21 20v-1a4 4 0 0 0-3-3.87" />
                  <path d="M16 4.13a3.5 3.5 0 0 1 0 6.74" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-500">
                  Field Team
                </p>

                {loading ? (
                  <>
                    <Skeleton className="mt-2 h-6 w-40 max-w-full" />
                    <Skeleton className="mt-3 h-8 w-28" />
                  </>
                ) : (
                  <>
                    <h3 className="mt-1 text-xl font-bold text-[#123D73]">
                      {teamName}
                    </h3>

                    <span className="mt-2 inline-flex w-28 items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-emerald-600"
                      />
                      Active
                    </span>
                  </>
                )}
              </div>

            </div>
          </Panel>

          {/* DEVICE */}
          <Panel
            title="Team Device"
            description="The device used by your team"
          >
            <div className="flex items-center gap-5 p-4 sm:p-8">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-slate-100 text-slate-600">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8"
                >
                  <rect x="7" y="2" width="10" height="20" rx="1" />
                  <path d="M11 18h2" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                {loading ? (
                  <>
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="mt-3 h-4 w-56 max-w-full" />
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold text-slate-900">
                      {accountName || teamName}
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      This account is assigned to {teamName}.
                    </p>
                  </>
                )}
              </div>

            </div>
          </Panel>

        </div>

        {/* ASSIGNMENT SUMMARY (click to open Assignments with a filter) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
          {summaryCards.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onOpenAssignments?.(item.filter)}
              aria-label={`${item.label}: ${
                loading ? "loading" : item.value
              }. Open assignments`}
              className="border border-slate-300 bg-white p-5 text-left transition-colors hover:border-[#123D73] hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 sm:p-6"
            >
              <p className="text-sm font-bold text-slate-600">
                {item.label}
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {loading ? (
                  <Skeleton className="h-9 w-12" />
                ) : (
                  item.value
                )}
              </p>

              <p className="mt-3 text-sm font-semibold text-[#123D73]">
                View assignments →
              </p>
            </button>
          ))}
        </div>

        {/* MEMBERS */}
        <Panel
          title="Team Members"
          description="Field worker accounts assigned to this team"
          rightLabel={
            loading
              ? "Loading..."
              : `${otherMembers.length} ${
                  otherMembers.length === 1 ? "member" : "members"
                }`
          }
        >
          {loading ? (
            <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
              <MemberCardSkeleton />
              <MemberCardSkeleton />
              <MemberCardSkeleton />
            </div>
          ) : otherMembers.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base font-bold text-slate-800">
                No other members listed
              </p>

              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                This team currently uses a single shared account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
              {otherMembers.map((member) => {
                const name = member.full_name ?? "Unnamed member";

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 border border-slate-300 bg-white p-5 transition-all duration-200 hover:border-[#123D73] hover:shadow-md motion-safe:hover:-translate-y-0.5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#123D73] text-base font-bold text-white">
                      {name
                        .split(" ")
                        .filter(Boolean)
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-bold text-slate-900">
                        {name}
                      </p>

                      <p className="mt-0.5 text-sm text-slate-600">
                        Field Worker
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

      </div>

    </div>
  );
}