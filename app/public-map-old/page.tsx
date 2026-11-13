"use client";

import { useState } from "react";
import Link from "next/link";
import Map from "../components/map";

type Report = {
  barangay: string;
  status: "Active" | "Monitoring" | "Normal";
  title: string;
  description: string;
  time: string;
};

const reports: Report[] = [
  {
    barangay: "Mulawin",
    status: "Active",
    title: "Water Line Rupture",
    description:
      "A water line rupture has been reported in the area. Field personnel are currently responding to the incident.",
    time: "Today · 3:42 PM",
  },
  {
    barangay: "Bagtas",
    status: "Monitoring",
    title: "Water Pressure Monitoring",
    description:
      "Water pressure in the area is currently being monitored by Tanza Water District personnel.",
    time: "Today · 2:15 PM",
  },
  {
    barangay: "Julugan",
    status: "Normal",
    title: "Service Restored",
    description:
      "Water service has been restored and the area is currently operating normally.",
    time: "Today · 1:20 PM",
  },
  {
    barangay: "Amaya",
    status: "Monitoring",
    title: "Service Condition Monitoring",
    description:
      "The current service condition in the area is being monitored.",
    time: "Yesterday · 5:10 PM",
  },
];

export default function PublicMap() {
  const [selectedBarangay, setSelectedBarangay] =
    useState<string | null>(null);

  const selectedReport = reports.find(
    (report) => report.barangay === selectedBarangay
  );

  const getStatusStyles = (status?: string) => {
    switch (status) {
      case "Active":
        return {
          dot: "bg-red-500",
          bg: "bg-red-50",
          text: "text-red-600",
        };

      case "Monitoring":
        return {
          dot: "bg-yellow-400",
          bg: "bg-yellow-50",
          text: "text-yellow-700",
        };

      case "Normal":
        return {
          dot: "bg-green-500",
          bg: "bg-green-50",
          text: "text-green-700",
        };

      default:
        return {
          dot: "bg-slate-400",
          bg: "bg-slate-50",
          text: "text-slate-600",
        };
    }
  };

  const statusStyles = getStatusStyles(
    selectedReport?.status
  );

  return (
    <main className="min-h-screen bg-white text-slate-900">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between px-5 sm:px-8">

          {/* BRAND */}

          <Link href="/" className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white">
              💧
            </div>

            <div>

              <p className="text-sm font-extrabold tracking-wide text-blue-700">
                DISTRICTLENS
              </p>

              <p className="text-[10px] text-slate-400">
                Tanza Water District
              </p>

            </div>

          </Link>


          {/* NAVIGATION */}

          <nav className="hidden items-center gap-1 md:flex">

            <Link
              href="/"
              className="rounded-lg px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-blue-700"
            >
              Home
            </Link>

            <Link
              href="/public-map"
              className="rounded-lg bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700"
            >
              Public Map
            </Link>

            <Link
              href="/history"
              className="rounded-lg px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-blue-700"
            >
              History
            </Link>

            <Link
              href="/about"
              className="rounded-lg px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-blue-700"
            >
              About
            </Link>

          </nav>


          {/* NOTIFICATIONS */}

          <button
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <span className="text-sm">
              ◌
            </span>

            <span className="hidden sm:inline">
              Notifications
            </span>

          </button>

        </div>

      </header>


      {/* =====================================================
          MOBILE NAVIGATION
      ====================================================== */}

      <div className="border-b border-slate-100 bg-white md:hidden">

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2">

          <Link
            href="/"
            className="shrink-0 rounded-lg px-4 py-2.5 text-xs font-medium text-slate-600"
          >
            Home
          </Link>

          <Link
            href="/public-map"
            className="shrink-0 rounded-lg bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700"
          >
            Public Map
          </Link>

          <Link
            href="/history"
            className="shrink-0 rounded-lg px-4 py-2.5 text-xs font-medium text-slate-600"
          >
            History
          </Link>

          <Link
            href="/about"
            className="shrink-0 rounded-lg px-4 py-2.5 text-xs font-medium text-slate-600"
          >
            About
          </Link>

        </nav>

      </div>


      {/* =====================================================
          PAGE INTRO
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-5 pb-7 pt-10 sm:px-8">

        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
              Public Information
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Tanza Water Service Map
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              View current water service conditions and
              reported incidents across Tanza barangays.
            </p>

          </div>


          {/* STATUS LEGEND */}

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">

            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Status
            </span>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Active
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              Monitoring
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              Normal
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          HOW TO USE
          MOVED ABOVE MAP
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-5 pb-5 sm:px-8">

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-xs font-semibold text-slate-800">
                How to use the map
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                Select a barangay on the map to view its
                latest service reports and updates.
              </p>

            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-500">

              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-[8px] font-bold text-white">
                  1
                </span>
                Select
              </div>

              <span className="text-slate-300">
                →
              </span>

              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-[8px] font-bold text-white">
                  2
                </span>
                View
              </div>

              <span className="text-slate-300">
                →
              </span>

              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-[8px] font-bold text-white">
                  3
                </span>
                Check
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          MAP + RECENT REPORTS
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">


          {/* =================================================
              MAP CONTAINER
          ================================================== */}

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">

            {/* MAP HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

              <div>

                <h2 className="text-sm font-bold text-slate-900">
                  Barangay Service Map
                </h2>

                <p className="mt-0.5 text-[10px] text-slate-400">
                  Click a barangay to view its latest report
                </p>

              </div>

              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-500">
                Tanza, Cavite
              </span>

            </div>


            {/* MAP */}

            <div className="relative h-150 overflow-hidden bg-slate-100">

              <Map
                onBarangayClick={(barangayName) => {
                  setSelectedBarangay(barangayName);
                }}
              />


              {/* =================================================
                  BARANGAY POPUP / OVERLAY
              ================================================== */}

              {selectedBarangay && (

                <div className="absolute inset-0 z-1000 pointer-events-none">

                  {/* BACKDROP */}

                  <div
                    className="absolute inset-0 bg-slate-900/10 pointer-events-auto"
                    onClick={() => setSelectedBarangay(null)}
                  />


                  {/* POPUP CARD */}

                  <div className="absolute left-1/2 top-6 w-[calc(100%-32px)] max-w-117.5 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl pointer-events-auto">

                    {/* POPUP HEADER */}

                    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">

                      <div>

                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-700">
                          Barangay Report
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                          {selectedBarangay}
                        </h2>

                      </div>

                      <button
                        onClick={() =>
                          setSelectedBarangay(null)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        ✕
                      </button>

                    </div>


                    {selectedReport ? (

                      <>

                        {/* STATUS */}

                        <div className="border-b border-slate-100 px-5 py-4">

                          <div className="flex items-center justify-between">

                            <span className="text-xs font-medium text-slate-500">
                              Current Status
                            </span>

                            <span
                              className={`flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles.bg} ${statusStyles.text}`}
                            >

                              <span
                                className={`h-2 w-2 rounded-full ${statusStyles.dot}`}
                              />

                              {selectedReport.status}

                            </span>

                          </div>

                        </div>


                        {/* REPORT INFORMATION */}

                        <div className="px-5 py-5">

                          <div className="flex items-start gap-3">

                            <span
                              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusStyles.dot}`}
                            />

                            <div>

                              <h3 className="text-sm font-bold text-slate-900">
                                {selectedReport.title}
                              </h3>

                              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                {selectedReport.description}
                              </p>

                              <p className="mt-3 text-[10px] text-slate-400">
                                {selectedReport.time}
                              </p>

                            </div>

                          </div>

                        </div>


                        {/* REPORT PROGRESS */}

                        <div className="border-t border-slate-100 px-5 py-5">

                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Report Progress
                          </p>

                          <div className="mt-5 overflow-x-auto pb-1">

                            <div className="flex min-w-97.5 items-start">

                              {/* REPORTED */}

                              <div className="flex flex-1 items-start">

                                <div className="flex flex-col items-center">

                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
                                    ✓
                                  </div>

                                  <span className="mt-2 whitespace-nowrap text-[9px] font-semibold text-slate-600">
                                    Reported
                                  </span>

                                </div>

                                <div className="mt-3 h-0.5 flex-1 bg-blue-700" />

                              </div>


                              {/* ASSIGNED */}

                              <div className="flex flex-1 items-start">

                                <div className="flex flex-col items-center">

                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
                                    ✓
                                  </div>

                                  <span className="mt-2 whitespace-nowrap text-[9px] font-semibold text-slate-600">
                                    Assigned
                                  </span>

                                </div>

                                <div className="mt-3 h-0.5 flex-1 bg-blue-700" />

                              </div>


                              {/* RESPONDING */}

                              <div className="flex flex-1 items-start">

                                <div className="flex flex-col items-center">

                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
                                    •
                                  </div>

                                  <span className="mt-2 whitespace-nowrap text-[9px] font-semibold text-blue-700">
                                    Responding
                                  </span>

                                </div>

                                <div className="mt-3 h-0.5 flex-1 bg-slate-200" />

                              </div>


                              {/* RESOLVED */}

                              <div className="flex flex-col items-center">

                                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-300">
                                  4
                                </div>

                                <span className="mt-2 whitespace-nowrap text-[9px] font-medium text-slate-400">
                                  Resolved
                                </span>

                              </div>

                            </div>

                          </div>

                        </div>


                        {/* POPUP FOOTER */}

                        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">

                          <p className="text-[9px] text-slate-400">
                            Latest update from Tanza Water District
                          </p>

                          <Link
                            href="/history"
                            className="text-[10px] font-bold text-blue-700 hover:text-blue-900"
                          >
                            View History →
                          </Link>

                        </div>

                      </>

                    ) : (

                      /* NO REPORT */

                      <div className="px-5 py-8 text-center">

                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                          ✓
                        </div>

                        <h3 className="mt-3 text-sm font-bold text-slate-900">
                          No Recent Reports
                        </h3>

                        <p className="mt-2 text-[11px] leading-5 text-slate-400">
                          There are currently no reported
                          incidents for this barangay.
                        </p>

                      </div>

                    )}

                  </div>

                </div>

              )}

            </div>

          </div>


          {/* =================================================
              RECENT REPORTS
          ================================================== */}

          <aside className="flex min-h-150 flex-col rounded-xl border border-slate-200 bg-white">

            {/* HEADER */}

            <div className="border-b border-slate-100 px-5 py-4">

              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                Latest Updates
              </p>

              <h2 className="mt-1 text-sm font-bold text-slate-900">
                Recent Reports
              </h2>

              <p className="mt-1 text-[10px] leading-4 text-slate-400">
                Latest service reports across Tanza
              </p>

            </div>


            {/* REPORT LIST */}

            <div className="flex-1">

              {reports.map((report, index) => {

                const styles =
                  getStatusStyles(report.status);

                return (

                  <button
                    key={report.barangay}
                    onClick={() =>
                      setSelectedBarangay(
                        report.barangay
                      )
                    }
                    className={`block w-full text-left px-5 py-4 transition hover:bg-slate-50 ${
                      index !== reports.length - 1
                        ? "border-b border-slate-100"
                        : ""
                    }`}
                  >

                    <div className="flex gap-3">

                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
                      />

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center justify-between gap-2">

                          <p className="text-xs font-semibold text-slate-800">
                            {report.barangay}
                          </p>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${styles.bg} ${styles.text}`}
                          >
                            {report.status}
                          </span>

                        </div>

                        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                          {report.title}
                        </p>

                        <p className="mt-2 text-[9px] text-slate-400">
                          {report.time}
                        </p>

                      </div>

                    </div>

                  </button>

                );

              })}

            </div>


            {/* FOOTER */}

            <div className="border-t border-slate-100 px-5 py-4">

              <Link
                href="/history"
                className="text-xs font-semibold text-blue-700 transition hover:text-blue-900"
              >
                View All Reports →
              </Link>

            </div>

          </aside>

        </div>

      </section>


      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="bg-white">

        <div className="mx-auto max-w-7xl px-5 py-8 text-center sm:px-8">

          <p className="text-xs font-semibold text-slate-600">
            DISTRICTLENS
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Tanza Water District
          </p>

          <p className="mt-3 text-[10px] text-slate-400">
            Public information portal for water service
            conditions, incidents, and updates.
          </p>

        </div>

      </footer>

    </main>
  );
}