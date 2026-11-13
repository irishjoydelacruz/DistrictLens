"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type IncidentDetailsProps = {
  deployment: any;
  onBack: () => void;
};

type Incident = {
  id: string;
  barangay_code: string | null;
  incident_type: string;
  description: string | null;
  status: string;
  reported_at: string;
  pumping_station_id: number | null;
  affected_area: string | null;
  etr: string | null;
};

type AffectedBarangay = {
  incident_id: string;
  barangay_code: string;
};

type Barangay = {
  name: string;
  code: string;
};

export default function IncidentDetails({
  deployment,
  onBack,
}: IncidentDetailsProps) {
  const supabase = createClient();

  // =========================
  // INITIAL INCIDENT
  // =========================

  const initialIncident =
    deployment?.incidents as Incident | null;

  // =========================
  // STATES
  // =========================

  const [incidentDetails, setIncidentDetails] =
    useState<Incident | null>(
      initialIncident || null
    );

  const [barangays, setBarangays] =
    useState<Barangay[]>([]);

  const [affectedBarangays, setAffectedBarangays] =
    useState<AffectedBarangay[]>([]);

  const [pumpingStationName, setPumpingStationName] =
    useState<string | null>(null);

  const [detailsLoading, setDetailsLoading] =
    useState(true);

  const [detailsError, setDetailsError] =
    useState("");

  const [currentStatus, setCurrentStatus] =
    useState(
      deployment?.status || "assigned"
    );

  const [startedAt, setStartedAt] =
    useState(
      deployment?.started_at || null
    );

  const [resolvedAt, setResolvedAt] =
    useState(
      deployment?.resolved_at || null
    );

  const [updating, setUpdating] =
    useState(false);

  const [updateMessage, setUpdateMessage] =
    useState("");

  // =========================
  // LOAD FULL INCIDENT DETAILS
  // =========================

  useEffect(() => {
    async function loadIncidentDetails() {
      if (!deployment?.incident_id) {
        setDetailsLoading(false);
        setDetailsError(
          "Incident ID is missing."
        );
        return;
      }

      setDetailsLoading(true);
      setDetailsError("");

      try {
        // =========================
        // GET INCIDENT
        // =========================

        const {
          data: incidentData,
          error: incidentError,
        } = await supabase
          .from("incidents")
          .select(
            "id, barangay_code, incident_type, description, status, reported_at, pumping_station_id, affected_area, etr"
          )
          .eq(
            "id",
            deployment.incident_id
          )
          .single();

        if (incidentError) {
          console.error(
            "Error loading incident details:",
            incidentError
          );

          setDetailsError(
            incidentError.message
          );

          return;
        }

        setIncidentDetails(
          incidentData
        );

        // If the admin already resolved this incident, the
        // assignment is finished too.
        if (incidentData?.status === "green") {
          setCurrentStatus("resolved");
        }

        // =========================
        // GET AFFECTED BARANGAYS
        // =========================

        const {
          data: affectedData,
          error: affectedError,
        } = await supabase
          .from("incident_barangays")
          .select(
            "incident_id, barangay_code"
          )
          .eq(
            "incident_id",
            deployment.incident_id
          );

        if (affectedError) {
          console.error(
            "Error loading affected barangays:",
            affectedError
          );

          setAffectedBarangays([]);
        } else {
          setAffectedBarangays(
            affectedData || []
          );
        }

        // =========================
        // GET PUMPING STATION
        // =========================

        if (
          incidentData?.pumping_station_id
        ) {
          const {
            data: stationData,
            error: stationError,
          } = await supabase
            .from("pumping_stations")
            .select("name")
            .eq(
              "id",
              incidentData.pumping_station_id
            )
            .single();

          if (stationError) {
            console.error(
              "Error loading pumping station:",
              stationError
            );

            setPumpingStationName(
              `Pumping Station #${incidentData.pumping_station_id}`
            );
          } else {
            setPumpingStationName(
              stationData?.name ||
                `Pumping Station #${incidentData.pumping_station_id}`
            );
          }
        } else {
          setPumpingStationName(null);
        }
      } catch (error) {
        console.error(
          "LOAD INCIDENT DETAILS ERROR:",
          error
        );

        setDetailsError(
          "Something went wrong while loading incident details."
        );
      } finally {
        setDetailsLoading(false);
      }
    }

    loadIncidentDetails();
  }, [deployment?.incident_id]);

  // =========================
  // LOAD BARANGAYS
  // =========================

  useEffect(() => {
    async function loadBarangays() {
      try {
        const response = await fetch(
          "/data/tanza-barangays.geojson"
        );

        const geojson =
          await response.json();

        const barangayList =
          geojson.features.map(
            (feature: any) => ({
              name:
                feature.properties.brgy_name,
              code:
                feature.properties.brgy_code,
            })
          );

        setBarangays(barangayList);
      } catch (error) {
        console.error(
          "Error loading barangays:",
          error
        );
      }
    }

    loadBarangays();
  }, []);

  // =========================
  // BARANGAY NAME
  // =========================

  function getBarangayName(
    code: string | null
  ) {
    if (!code) {
      return "Not specified";
    }

    const barangay =
      barangays.find(
        (item) =>
          item.code === code
      );

    return barangay
      ? barangay.name
      : code;
  }

  // =========================
  // INCIDENT STATUS
  // =========================

  function getIncidentStatus(
    status: string
  ) {
    if (status === "red") {
      return {
        label: "Active",
        className:
          "border-red-200 bg-red-50 text-red-800",
        dot: "bg-red-600",
      };
    }

    if (status === "yellow") {
      return {
        label: "Monitoring",
        className:
          "border-amber-200 bg-amber-50 text-amber-800",
        dot: "bg-amber-500",
      };
    }

    return {
      label: "Resolved",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800",
      dot: "bg-emerald-600",
    };
  }

  // =========================
  // ASSIGNMENT STATUS
  // =========================

  function getAssignmentStatus(
    status: string
  ) {
    if (
      status === "ongoing" ||
      status === "in_progress"
    ) {
      return {
        label: "Ongoing",
        className:
          "border-amber-200 bg-amber-50 text-amber-800",
        dot: "bg-amber-500",
      };
    }

    if (status === "resolved") {
      return {
        label: "Resolved",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        dot: "bg-emerald-600",
      };
    }

    return {
      label: "Assigned",
      className:
        "border-blue-200 bg-blue-50 text-blue-800",
      dot: "bg-blue-600",
    };
  }

  // =========================
  // FORMAT DATE
  // =========================

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "Waiting...";
    }

    return new Date(
      date
    ).toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // =========================
  // UPDATE STATUS
  // =========================

  async function updateStatus(
    newStatus: string
  ) {
    if (!deployment?.id) {
      setUpdateMessage(
        "Assignment ID is missing."
      );
      return;
    }

    setUpdating(true);
    setUpdateMessage("");

    try {
      // =========================
      // PREPARE DEPLOYMENT UPDATE
      // =========================

      const updateData: {
        status: string;
        started_at?: string | null;
        resolved_at?: string | null;
      } = {
        status: newStatus,
      };

      // =========================
      // START TASK
      // =========================

      if (newStatus === "ongoing") {
        const timestamp =
          new Date().toISOString();

        updateData.started_at =
          timestamp;

        updateData.resolved_at = null;

        setStartedAt(timestamp);
        setResolvedAt(null);
      }

      // =========================
      // RESOLVE TASK
      // =========================

      if (newStatus === "resolved") {
        const timestamp =
          new Date().toISOString();

        updateData.resolved_at =
          timestamp;

        setResolvedAt(timestamp);
      }

      // =========================
      // UPDATE DEPLOYMENT
      // =========================

      const {
        error: deploymentError,
      } = await supabase
        .from("deployments")
        .update(updateData)
        .eq(
          "id",
          deployment.id
        );

      if (deploymentError) {
        console.error(
          "DEPLOYMENT UPDATE ERROR:",
          deploymentError
        );

        setUpdateMessage(
          `Unable to update assignment: ${deploymentError.message}`
        );

        return;
      }

      console.log(
        "DEPLOYMENT UPDATED:",
        deployment.id,
        newStatus
      );

      // =========================
      // RESOLVED = INCIDENT NORMAL
      // =========================

      if (newStatus === "resolved") {
        console.log(
          "DEPLOYMENT OBJECT:",
          deployment
        );

        console.log(
          "INCIDENT ID FROM DEPLOYMENT:",
          deployment?.incident_id
        );

        // =========================
        // CHECK INCIDENT ID
        // =========================

        if (!deployment?.incident_id) {
          setUpdateMessage(
            "Assignment was resolved, but this deployment has no incident ID."
          );

          setCurrentStatus(
            newStatus
          );

          return;
        }

        // =========================
        // UPDATE INCIDENT TO GREEN
        // =========================

        const {
          data: incidentData,
          error: incidentError,
        } = await supabase
          .from("incidents")
          .update({
            status: "green",
          })
          .eq(
            "id",
            deployment.incident_id
          )
          .select("id, status");

        console.log(
          "INCIDENT UPDATE RESULT:",
          incidentData
        );

        console.log(
          "INCIDENT UPDATE ERROR:",
          incidentError
        );

        // =========================
        // INCIDENT UPDATE ERROR
        // =========================

        if (incidentError) {
          console.error(
            "INCIDENT STATUS UPDATE ERROR:",
            incidentError
          );

          setCurrentStatus(
            newStatus
          );

          setUpdateMessage(
            `Assignment resolved, but incident update failed: ${incidentError.message}`
          );

          return;
        }

        // =========================
        // NO MATCHING INCIDENT
        // =========================

        if (
          !incidentData ||
          incidentData.length === 0
        ) {
          console.error(
            "NO INCIDENT MATCHED:",
            deployment.incident_id
          );

          setCurrentStatus(
            newStatus
          );

          setUpdateMessage(
            `Assignment resolved, but no incident matched ID ${deployment.incident_id}.`
          );

          return;
        }

        // =========================
        // CHECK ACTUAL RESULT
        // =========================

        if (
          incidentData[0].status !==
          "green"
        ) {
          console.error(
            "INCIDENT WAS NOT CHANGED TO GREEN:",
            incidentData[0]
          );

          setCurrentStatus(
            newStatus
          );

          setUpdateMessage(
            "Assignment resolved, but incident was not changed to Normal."
          );

          return;
        }

        // =========================
        // UPDATE LOCAL INCIDENT
        // =========================

        setIncidentDetails(
          (current) =>
            current
              ? {
                  ...current,
                  status: "green",
                }
              : current
        );

        // =========================
        // SUCCESS
        // =========================

        console.log(
          "SUCCESS: INCIDENT IS NOW GREEN"
        );
      }

      // =========================
      // UPDATE LOCAL STATUS
      // =========================

      setCurrentStatus(
        newStatus
      );

      setUpdateMessage(
        "Status updated successfully."
      );
    } catch (error) {
      console.error(
        "UPDATE STATUS ERROR:",
        error
      );

      setUpdateMessage(
        "Something went wrong while updating the status."
      );
    } finally {
      setUpdating(false);
    }
  }

  // =========================
  // NO INCIDENT
  // =========================

  if (!incidentDetails) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 pb-6 pt-4 sm:px-6 sm:pt-6">

        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-5 text-sm font-semibold text-[#123D73] transition-colors hover:bg-slate-50"
        >
          ← Back to Assignments
        </button>

        <div className="border border-slate-300 bg-white p-8 text-center">

          {detailsLoading ? (
            <p className="text-base text-slate-600">
              Loading incident details...
            </p>
          ) : (
            <p className="text-base text-red-700">
              {detailsError ||
                "Incident details are unavailable."}
            </p>
          )}

        </div>

      </div>
    );
  }

  // =========================
  // INCIDENT DATA
  // =========================

  const incident =
    incidentDetails;

  const incidentStatus =
    getIncidentStatus(
      incident.status
    );

  const assignmentStatus =
    getAssignmentStatus(
      currentStatus
    );

  const isPumpingStationIncident =
    incident.pumping_station_id !==
    null;

  const isStarted =
    currentStatus === "ongoing" ||
    currentStatus === "in_progress" ||
    currentStatus === "resolved";

  const isResolved =
    currentStatus === "resolved";

  const labelClass =
    "text-sm font-bold text-slate-500";

  const valueClass =
    "mt-1.5 text-base leading-7 text-slate-800";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8">

      <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">

        {/* HEADER */}

        <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-8 sm:py-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">

              <p className="text-sm font-bold text-indigo-100">
                Assignments
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                Incident Details
              </h1>

              <p className="mt-2 text-base text-indigo-100">
                View the details of your assigned task.
              </p>

            </div>

            <button
              type="button"
              onClick={onBack}
              className="min-h-11 shrink-0 rounded-none border border-white/30 bg-white/10 px-5 py-2.5 text-base font-medium text-white transition-all duration-200 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 motion-safe:hover:-translate-y-0.5"
            >
              ← Back to Assignments
            </button>

          </div>

        </header>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">

          {/* INCIDENT CARD */}

          <section className="min-w-0 border border-slate-300 bg-white">

            <div className="border-b border-slate-200 px-4 py-4 sm:px-8 sm:py-5">
              <h2 className="text-lg font-bold text-[#123D73]">
                Incident Information
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Details of the incident assigned to your team
              </p>
            </div>

            <div className="space-y-6 p-4 sm:p-8">

              {/* INCIDENT TYPE */}

              <div>
                <p className={labelClass}>
                  Incident Type
                </p>

                <h3 className="mt-1.5 text-xl font-bold text-[#123D73]">
                  {incident.incident_type}
                </h3>
              </div>

              {/* PUMPING STATION */}

              {isPumpingStationIncident && (
                <div>
                  <p className={labelClass}>
                    Pumping Station
                  </p>

                  <p className={`${valueClass} font-semibold`}>
                    {pumpingStationName ||
                      `Pumping Station #${incident.pumping_station_id}`}
                  </p>
                </div>
              )}

              {/* BARANGAY / AFFECTED BARANGAYS */}

              <div>

                <p className={labelClass}>
                  {isPumpingStationIncident
                    ? "Affected Barangays"
                    : "Barangay"}
                </p>

                {!isPumpingStationIncident && (
                  <p className={valueClass}>
                    {getBarangayName(
                      incident.barangay_code
                    )}
                  </p>
                )}

                {isPumpingStationIncident && (
                  <>
                    {affectedBarangays.length >
                    0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {affectedBarangays.map(
                          (item) => (
                            <span
                              key={
                                item.barangay_code
                              }
                              className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                            >
                              {getBarangayName(
                                item.barangay_code
                              )}
                            </span>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-base text-slate-500">
                        No affected barangays recorded.
                      </p>
                    )}
                  </>
                )}

              </div>

              {/* AFFECTED AREA */}

              {incident.affected_area && (
                <div>
                  <p className={labelClass}>
                    Affected Area
                  </p>

                  <p className={valueClass}>
                    {incident.affected_area}
                  </p>
                </div>
              )}

              {/* ETR */}

              <div>
                <p className={labelClass}>
                  ETR
                </p>

                <p className={`${valueClass} font-medium`}>
                  {formatDate(
                    incident.etr
                  )}
                </p>
              </div>

              {/* DESCRIPTION */}

              <div>
                <p className={labelClass}>
                  Description
                </p>

                <p className={valueClass}>
                  {incident.description ||
                    "No description provided."}
                </p>
              </div>

              {/* STATUSES */}

              <div className="grid gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2">

                <div>
                  <p className={labelClass}>
                    Incident Status
                  </p>

                  <span
                    className={`mt-2 inline-flex w-36 items-center justify-center gap-2 border px-3 py-1.5 text-sm font-semibold ${incidentStatus.className}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${incidentStatus.dot}`}
                    />
                    {incidentStatus.label}
                  </span>
                </div>

                <div>
                  <p className={labelClass}>
                    Assignment Status
                  </p>

                  <span
                    className={`mt-2 inline-flex w-36 items-center justify-center gap-2 border px-3 py-1.5 text-sm font-semibold ${assignmentStatus.className}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${assignmentStatus.dot}`}
                    />
                    {assignmentStatus.label}
                  </span>
                </div>

              </div>

            </div>

          </section>

          <div className="min-w-0 space-y-5 sm:space-y-6">

            {/* PROGRESS TIMELINE */}

            <section className="border border-slate-300 bg-white">

              <div className="border-b border-slate-200 px-4 py-4 sm:px-8 sm:py-5">
                <h2 className="text-lg font-bold text-[#123D73]">
                  Assignment Progress
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Status history of this assignment
                </p>
              </div>

              <div className="p-4 sm:p-8">

                {/* ASSIGNED */}

                <div className="flex gap-4">

                  <div className="flex flex-col items-center">

                    <div className="flex h-9 w-9 items-center justify-center bg-[#123D73] text-sm font-bold text-white">
                      ✓
                    </div>

                    <div className="h-12 w-px bg-slate-300" />

                  </div>

                  <div className="pb-5">

                    <p className="text-base font-bold text-slate-900">
                      Assigned
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(
                        deployment.assigned_at
                      )}
                    </p>

                    <p className="mt-0.5 text-sm text-slate-500">
                      Assignment created
                    </p>

                  </div>

                </div>

                {/* ONGOING */}

                <div className="flex gap-4">

                  <div className="flex flex-col items-center">

                    <div
                      className={`flex h-9 w-9 items-center justify-center text-sm font-bold ${
                        isStarted
                          ? "bg-[#123D73] text-white"
                          : "border border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {isStarted ? "✓" : "2"}
                    </div>

                    <div className="h-12 w-px bg-slate-300" />

                  </div>

                  <div className="pb-5">

                    <p
                      className={`text-base font-bold ${
                        isStarted
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      Ongoing
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(
                        startedAt
                      )}
                    </p>

                    <p className="mt-0.5 text-sm text-slate-500">
                      Field worker started task
                    </p>

                  </div>

                </div>

                {/* RESOLVED */}

                <div className="flex gap-4">

                  <div>

                    <div
                      className={`flex h-9 w-9 items-center justify-center text-sm font-bold ${
                        isResolved
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {isResolved ? "✓" : "3"}
                    </div>

                  </div>

                  <div>

                    <p
                      className={`text-base font-bold ${
                        isResolved
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      Resolved
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(
                        resolvedAt
                      )}
                    </p>

                    <p className="mt-0.5 text-sm text-slate-500">
                      Assignment completed
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* UPDATE PROGRESS */}

            <section className="border border-slate-300 bg-white">

              <div className="border-b border-slate-200 px-4 py-4 sm:px-8 sm:py-5">
                <h2 className="text-lg font-bold text-[#123D73]">
                  Update Progress
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Update the status of this assigned task
                </p>
              </div>

              <div className="p-4 sm:p-8">

                {/* START TASK */}

                {currentStatus ===
                  "assigned" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateStatus(
                        "ongoing"
                      )
                    }
                    disabled={updating}
                    className="min-h-12 w-full rounded-none border border-[#123D73] bg-[#123D73] px-5 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-[#0D2F59] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
                  >
                    {updating
                      ? "Updating..."
                      : "Start Task"}
                  </button>
                )}

                {/* RESOLVE */}

                {(currentStatus ===
                  "ongoing" ||
                  currentStatus ===
                    "in_progress") && (
                  <button
                    type="button"
                    onClick={() =>
                      updateStatus(
                        "resolved"
                      )
                    }
                    disabled={updating}
                    className="min-h-12 w-full rounded-none border border-emerald-700 bg-emerald-700 px-5 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
                  >
                    {updating
                      ? "Updating..."
                      : "Mark as Resolved"}
                  </button>
                )}

                {/* COMPLETED */}

                {currentStatus ===
                  "resolved" && (
                  <div className="border border-emerald-200 bg-emerald-50 p-5 text-center">

                    <p className="text-base font-bold text-emerald-800">
                      ✓ Assignment Resolved
                    </p>

                    <p className="mt-1 text-sm text-emerald-700">
                      This task has been completed.
                    </p>

                  </div>
                )}

                {/* UPDATE MESSAGE */}

                {updateMessage && (
                  <p
                    role="status"
                    className={`mt-4 border px-4 py-3 text-center text-sm font-medium ${
                      updateMessage.includes(
                        "successfully"
                      )
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {updateMessage}
                  </p>
                )}

              </div>

            </section>

          </div>

        </div>

      </div>

    </div>
  );
}