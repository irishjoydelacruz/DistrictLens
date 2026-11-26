"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* =========================================
   TYPES
========================================= */

export type NotificationType = "assignment" | "update" | "resolved";

export type NotificationItem = {
  // Changes when the deployment status changes, so a new status
  // shows up as a brand new notification.
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  affectedBarangays: string[];
  affectedArea: string | null;
  etr: string | null;
  time: string;
};

type Incident = {
  id: string;
  barangay_code: string | null;
  incident_type: string;
  status: string;
  reported_at: string;
  pumping_station_id: number | null;
  affected_area: string | null;
  etr: string | null;
  description: string | null;
};

type Deployment = {
  id: string;
  incident_id: string;
  team_id: string;
  status: string;
  assigned_at: string;
  resolved_at: string | null;
  incidents: Incident | null;
};

type AffectedBarangay = {
  incident_id: string;
  barangay_code: string;
};

type Barangay = {
  name: string;
  code: string;
};

const REFRESH_MS = 30_000; // check for new notifications every 30 seconds

/* =========================================
   READ / DELETED STATE (saved per user in Supabase)
   Table: notification_states (user_id, notification_key, state)
   - no row     = unread
   - "read"     = shown in the Read tab
   - "deleted"  = hidden from this person's list
   It follows the account, so it is the same on every device.
========================================= */

type NotificationState = "read" | "deleted";

const STATE_TABLE = "notification_states";
const CHUNK_SIZE = 100;

function chunk<T>(list: T[], size = CHUNK_SIZE): T[][] {
  const groups: T[][] = [];

  for (let i = 0; i < list.length; i += size) {
    groups.push(list.slice(i, i + size));
  }

  return groups;
}

/* =========================================
   HELPERS
========================================= */

function formatTime(date: string | null) {
  if (!date) {
    return "Recently";
  }

  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getBarangayName(
  code: string | null,
  list: Barangay[]
) {
  if (!code) {
    return "";
  }

  const barangay = list.find((item) => item.code === code);

  return barangay ? barangay.name : code;
}

function getIncidentLabel(incident: Incident) {
  if (incident.pumping_station_id) {
    return `Pumping Station #${incident.pumping_station_id} – ${incident.incident_type}`;
  }

  return incident.incident_type;
}

function buildNotifications(
  deployments: Deployment[],
  affectedBarangayList: AffectedBarangay[],
  barangayList: Barangay[]
): NotificationItem[] {
  const list: NotificationItem[] = [];

  deployments.forEach((deployment) => {
    const incident = deployment.incidents;

    if (!incident) {
      return;
    }

    const incidentLabel = getIncidentLabel(incident);

    // Barangays: pumping station incidents use the affected list,
    // other incidents use their own barangay.
    const affectedNames = affectedBarangayList
      .filter(
        (item) =>
          String(item.incident_id) === String(incident.id)
      )
      .map((item) =>
        getBarangayName(item.barangay_code, barangayList)
      )
      .filter((name) => name !== "");

    const normalNames = incident.barangay_code
      ? [
          getBarangayName(
            incident.barangay_code,
            barangayList
          ),
        ].filter((name) => name !== "")
      : [];

    const affectedBarangays = incident.pumping_station_id
      ? affectedNames
      : normalNames;

    const shared = {
      affectedBarangays,
      affectedArea: incident.affected_area,
      etr: incident.etr,
    };

    if (deployment.status === "resolved") {
      list.push({
        id: `resolved-${deployment.id}`,
        type: "resolved",
        title: "Incident Resolved",
        message: `${incidentLabel} has been resolved.`,
        time: formatTime(deployment.resolved_at),
        ...shared,
      });

      return;
    }

    if (
      deployment.status === "ongoing" ||
      deployment.status === "in_progress"
    ) {
      list.push({
        id: `update-${deployment.id}`,
        type: "update",
        title: "Incident Update",
        message: `${incidentLabel} is currently being handled by your team.`,
        time: formatTime(deployment.assigned_at),
        ...shared,
      });

      return;
    }

    list.push({
      id: `assignment-${deployment.id}`,
      type: "assignment",
      title: "New Incident Assigned",
      message: `${incidentLabel} has been assigned to your team.`,
      time: formatTime(deployment.assigned_at),
      ...shared,
    });
  });

  return list;
}

/* =========================================
   HOOK
   Lives in the page (not in the Alerts tab) so the badge on the
   navigation stays up to date on every tab.
========================================= */

export function useNotifications(refreshKey: number) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [states, setStates] = useState<
    Map<string, NotificationState>
  >(() => new Map());

  // true only for the very first load (shows the skeleton)
  const [loading, setLoading] = useState(true);
  // true while the Refresh button is working
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Shown when a read / delete change could not be saved.
  const [actionError, setActionError] = useState("");

  const userIdRef = useRef<string | null>(null);
  const barangaysRef = useRef<Barangay[] | null>(null);
  const inFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);
  // Number of saves still running (a refresh must not overwrite them).
  const pendingRef = useRef(0);
  // Always the latest states, so a failed save can be undone.
  const statesRef = useRef(states);
  statesRef.current = states;

  const load = useCallback(
    async (mode: "initial" | "background" | "manual") => {
      // Do not stack background checks on top of each other.
      if (mode === "background" && inFlightRef.current) return;

      inFlightRef.current = true;

      if (mode === "manual") setRefreshing(true);

      const supabase = createClient();

      try {
        // Logged-in user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("You are not logged in.");
        }

        // Profile (role and team)
        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, role, team_id")
            .eq("id", user.id)
            .single();

        if (profileError) {
          throw new Error(
            `Unable to load profile: ${profileError.message}`
          );
        }

        if (profile.role !== "field_worker") {
          throw new Error(
            "This account is not a Field Worker account."
          );
        }

        if (!profile.team_id) {
          throw new Error(
            "This Field Worker account has no assigned team."
          );
        }

        // Deployments of the team
        const { data: deployments, error: deploymentError } =
          await supabase
            .from("deployments")
            .select(`
              id,
              incident_id,
              team_id,
              status,
              assigned_at,
              resolved_at,
              incidents (
                id,
                barangay_code,
                incident_type,
                status,
                reported_at,
                pumping_station_id,
                affected_area,
                etr,
                description
              )
            `)
            .eq("team_id", profile.team_id)
            .order("assigned_at", { ascending: false });

        if (deploymentError) {
          throw new Error(
            `Unable to load notifications: ${deploymentError.message}`
          );
        }

        const deploymentList =
          (deployments as unknown as Deployment[]) || [];

        // Affected barangays (only pumping station incidents need them)
        const pumpingIncidentIds = deploymentList
          .filter((item) => item.incidents?.pumping_station_id)
          .map((item) => item.incidents!.id);

        let affectedList: AffectedBarangay[] = [];

        if (pumpingIncidentIds.length > 0) {
          const { data, error } = await supabase
            .from("incident_barangays")
            .select("incident_id, barangay_code")
            .in("incident_id", pumpingIncidentIds);

          if (error) {
            console.error(
              "Affected barangay loading error:",
              error
            );
          } else {
            affectedList = (data || []) as AffectedBarangay[];
          }
        }

        // Barangay names (loaded once, then reused)
        if (!barangaysRef.current) {
          try {
            const response = await fetch(
              "/data/tanza-barangays.geojson"
            );
            const geojson = await response.json();

            barangaysRef.current = geojson.features.map(
              (feature: any) => ({
                name: feature.properties.brgy_name,
                code: feature.properties.brgy_code,
              })
            );
          } catch (error) {
            console.error("Error loading barangays:", error);
          }
        }

        const nextItems = buildNotifications(
          deploymentList,
          affectedList,
          barangaysRef.current ?? []
        );

        userIdRef.current = user.id;

        // What this person already read or deleted.
        const { data: stateRows, error: stateError } =
          await supabase
            .from(STATE_TABLE)
            .select("notification_key, state")
            .eq("user_id", user.id);

        if (stateError) {
          throw new Error(
            `Unable to load read status: ${stateError.message}`
          );
        }

        setItems(nextItems);

        // Skip while a save is still running, so it is not undone.
        if (pendingRef.current === 0) {
          const next = new Map<string, NotificationState>();

          (
            (stateRows ?? []) as {
              notification_key: string;
              state: string;
            }[]
          ).forEach((row) => {
            if (row.state === "read" || row.state === "deleted") {
              next.set(row.notification_key, row.state);
            }
          });

          setStates(next);
        }

        setErrorMessage("");
      } catch (error) {
        if (mode === "background") {
          // Keep showing the last known list.
          console.error("Background refresh failed:", error);
        } else {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load notifications."
          );
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Load on open, and again whenever the page asks for a refresh
  // (every time the person switches tabs).
  useEffect(() => {
    void load(hasLoadedRef.current ? "background" : "initial");
    hasLoadedRef.current = true;
  }, [refreshKey, load]);

  // Check again every 30 seconds while the tab is visible,
  // and once more when the person comes back to the tab.
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") {
        void load("background");
      }
    };

    const id = window.setInterval(run, REFRESH_MS);
    document.addEventListener("visibilitychange", run);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [load]);

  // Saves a change for the signed-in person. The screen updates right
  // away. If saving fails, the change is undone and an error is shown.
  const change = useCallback(
    async (ids: string[], next: NotificationState | "unread") => {
      const userId = userIdRef.current;

      if (!userId || ids.length === 0) return;

      const supabase = createClient();

      const previous = statesRef.current;
      const updated = new Map(previous);

      ids.forEach((id) => {
        if (next === "unread") {
          updated.delete(id);
        } else {
          updated.set(id, next);
        }
      });

      statesRef.current = updated;
      setStates(updated);
      setActionError("");
      pendingRef.current += 1;

      try {
        for (const group of chunk(ids)) {
          if (next === "unread") {
            const { error } = await supabase
              .from(STATE_TABLE)
              .delete()
              .eq("user_id", userId)
              .in("notification_key", group);

            if (error) throw error;
          } else {
            const { error } = await supabase
              .from(STATE_TABLE)
              .upsert(
                group.map((key) => ({
                  user_id: userId,
                  notification_key: key,
                  state: next,
                  updated_at: new Date().toISOString(),
                })),
                { onConflict: "user_id,notification_key" }
              );

            if (error) throw error;
          }
        }
      } catch (error) {
        console.error("Unable to save notification change:", error);
        statesRef.current = previous;
        setStates(previous);
        setActionError(
          "Unable to save your change. Please try again."
        );
      } finally {
        pendingRef.current -= 1;
      }
    },
    []
  );

  // Opened or marked as read: moves to the Read tab.
  const markRead = useCallback(
    (ids: string[]) => change(ids, "read"),
    [change]
  );

  // Back to unread (undo for a misclick).
  const markUnread = useCallback(
    (ids: string[]) => change(ids, "unread"),
    [change]
  );

  // Removed from this person's list only (cannot be undone).
  const deleteNotifications = useCallback(
    (ids: string[]) => change(ids, "deleted"),
    [change]
  );

  const clearActionError = useCallback(
    () => setActionError(""),
    []
  );

  const reload = useCallback(() => load("manual"), [load]);

  // Not read yet (these count in the badge).
  const notifications = items.filter(
    (item) => !states.has(item.id)
  );

  // Already read (kept so a misclick can be undone).
  // Deleted ones are not shown anywhere.
  const readNotifications = items.filter(
    (item) => states.get(item.id) === "read"
  );

  return {
    notifications,
    readNotifications,
    unreadCount: notifications.length,
    loading,
    refreshing,
    errorMessage,
    reload,
    markRead,
    markUnread,
    deleteNotifications,
    actionError,
    clearActionError,
  };
}