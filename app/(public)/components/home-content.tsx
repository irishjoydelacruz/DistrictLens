"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";

import { useAlerts } from "./alert-provider";
import { Icon } from "./icons";
import {
  barangays,
  formatRestorationEstimate,
  getBarangayStatus,
  getReportAffectedAreas,
  getReportAffectedLabel,
  getReportSourceDisplay,
  getReportSourceLocation,
  type Report,
  type Status,
} from "../data/mock-data";
import { useIncidents } from "../data/use-incidents";

type HomeContentProps = {
  // Pass a reportId to open History directly on that incident.
  onNavigate: (section: "map" | "history", reportId?: number) => void;
};

function reportTimestamp(report: Report) {
  const timestamp = Date.parse(`${report.date} ${report.time}`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// Same status colors as the admin portal.
const statusTone: Record<
  Status,
  { badge: string; bar: string; dot: string }
> = {
  Active: {
    badge: "border-red-200 bg-red-50 text-red-800",
    bar: "bg-red-600",
    dot: "bg-red-600",
  },
  Monitoring: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  Normal: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bar: "bg-emerald-600",
    dot: "bg-emerald-600",
  },
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex w-32 items-center justify-center gap-2 border px-3 py-1.5 text-sm font-semibold ${statusTone[status].badge}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${statusTone[status].dot}`}
      />
      {status}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </p>
  );
}

const outlineButton =
  "inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-5 text-sm font-semibold text-[#123D73] transition-all duration-200 hover:border-[#123D73] hover:bg-[#E8EEF6] motion-safe:hover:-translate-y-0.5";

const textButton =
  "inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#123D73] transition-all duration-200 hover:gap-2.5 hover:text-[#0B2A4F] hover:underline";

const statusGuide: { status: Status; description: string }[] = [
  {
    status: "Active",
    description:
      "A critical water service incident has been reported and requires urgent attention.",
  },
  {
    status: "Monitoring",
    description:
      "A minor issue has been reported and is being monitored.",
  },
  {
    status: "Normal",
    description:
      "No current issue is recorded for the barangay, or the reported incident has been resolved.",
  },
];

export default function HomeContent({
  onNavigate,
}: HomeContentProps) {
  const { openAlerts, alertsEnabled } = useAlerts();
  const { reports } = useIncidents(); // live data from the database

  const latestReports = [...reports]
    .sort((a, b) => (b.updatedAt ?? reportTimestamp(b)) - (a.updatedAt ?? reportTimestamp(a)))
    .slice(0, 3);

  const activeIncidentCount = reports.filter(
    (report) => report.status === "Active",
  ).length;

  const monitoringIncidentCount = reports.filter(
    (report) => report.status === "Monitoring",
  ).length;

  const normalBarangayCount = barangays.filter(
    (barangay) => getBarangayStatus(barangay) === "Normal",
  ).length;

  const statusCards = [
    { label: "Active Incidents", value: activeIncidentCount, note: "Active incident reports", bar: "bg-red-600" },
    { label: "Under Monitoring", value: monitoringIncidentCount, note: "Incidents being monitored", bar: "bg-amber-500" },
    { label: "Normal Barangays", value: normalBarangayCount, note: "No active or monitored record listed", bar: "bg-emerald-600" },
    { label: "Barangays Covered", value: barangays.length, note: "Barangays in the portal map data", bar: "bg-[#123D73]" },
  ] as const;
  const mainRef = useRef<HTMLElement | null>(null);

  const alertActionLabel = alertsEnabled
    ? "Manage Alerts"
    : "Get Barangay Alerts";

  useEffect(() => {
    const main = mainRef.current;

    if (
      !main ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const sections = Array.from(
      main.querySelectorAll(":scope > section"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px -4% 0px" },
    );

    sections.forEach((section) => {
      section.classList.add("home-scroll-reveal");
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <main
      ref={mainRef}
      id="main-content"
      className="min-w-0 flex-1 bg-[#F4F6F9] text-slate-800"
    >
      {/* HERO BANNER */}
      <section className="w-full border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
        <div className="w-full max-w-none">
          <div className="grid gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16 lg:px-12 lg:py-24 xl:px-16">
            <div className="max-w-5xl">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Water Service Updates for Tanza, in One Place.
              </h1>

              <p className="mt-6 max-w-4xl text-base leading-7 text-indigo-100 sm:text-xl sm:leading-9">
                DistrictLens helps residents view reported service incidents,
                check affected areas on the public map, and follow updates
                made available for Tanza barangays.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onNavigate("map")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-6 text-base font-semibold text-[#123D73] transition-all duration-200 hover:bg-[#E8EEF6] motion-safe:hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Icon name="map" className="size-5" />
                  View Public Map
                  <Icon name="chevron" className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={openAlerts}
                  aria-haspopup="dialog"
                  aria-controls="alerts-modal"
                  className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/40 bg-transparent px-6 text-base font-semibold text-white transition-all duration-200 hover:border-white hover:bg-white/10 motion-safe:hover:-translate-y-0.5"
                >
                  <Icon name="bell" className="size-5" />
                  {alertActionLabel}
                </button>
              </div>

              <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-indigo-100">
                <Icon name="shield" className="mt-0.5 size-4 shrink-0" />
                DistrictLens complements TWD&apos;s existing incident-reporting
                process. Information depends on records made available here.
              </p>
            </div>

            <div
              className="flex items-center gap-5 lg:gap-6"
              aria-label="Municipality of Tanza and Tanza Water District seals"
            >
              <div className="size-24 shrink-0 overflow-hidden rounded-full sm:size-32 lg:size-36 xl:size-40">
                <Image
                  src="/images/tanza-logo.jpe"
                  alt="Municipality of Tanza seal"
                  width={116}
                  height={116}
                  priority
                  unoptimized
                  className="h-full w-full scale-[1.06] object-cover"
                />
              </div>

              <div className="size-24 shrink-0 overflow-hidden rounded-full sm:size-32 lg:size-36 xl:size-40">
                <Image
                  src="/images/twd-logo.jpg"
                  alt="Tanza Water District seal"
                  width={116}
                  height={116}
                  priority
                  unoptimized
                  className="h-full w-full scale-[1.06] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CURRENT SERVICE STATUS */}
      <section className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-8 xl:px-10">
        <div className="max-w-3xl">
          <Eyebrow>Current Service Status</Eyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#123D73] sm:text-3xl">
            A quick view of the portal records
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Counts update from the incident records and barangay list shown
            in this portal.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((card) => (
            <article
              key={card.label}
              className="relative group border border-slate-300 bg-white p-6 transition-all duration-200 ease-out hover:border-[#123D73] hover:bg-white hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-7 lg:p-8"
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 transition-all duration-200 group-hover:h-1.5 ${card.bar}`}
              />

              <p className="text-base font-bold text-slate-700">
                {card.label}
              </p>
              <p className="mt-4 text-4xl font-bold text-slate-900">
                {card.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {card.note}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* SERVICE STATUS GUIDE */}
      <section className="w-full border-y border-slate-200 bg-white">
        <div className="grid w-full gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 xl:gap-20 xl:px-10">
          <div>
            <Eyebrow>Service Status Guide</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#123D73] sm:text-3xl">
              Understand the Service Status Indicators
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Each status represents the reported water service condition in
              a barangay, helping residents understand the information at a
              glance.
            </p>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-500">
              These labels describe different recorded conditions, not stages
              every incident passes through. They reflect information entered
              into DistrictLens and do not indicate automatic detection or
              real-time monitoring.
            </p>
          </div>

          <div className="space-y-4">
            {statusGuide.map(({ status, description }) => (
              <article
                key={status}
                className="relative group border border-slate-300 bg-white p-5 pl-7 transition-all duration-200 ease-out hover:border-[#123D73] hover:bg-white hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-6 sm:pl-8"
              >
                <div
                  className={`absolute inset-y-0 left-0 w-1 transition-all duration-200 group-hover:w-2 ${statusTone[status].bar}`}
                />

                <StatusPill status={status} />

                <p className="mt-3 text-base leading-7 text-slate-600">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST INCIDENT RECORDS */}
      <section className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 xl:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Latest Service Updates</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#123D73] sm:text-3xl">
              Recent incident records
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              A short list of the most recent records available in the portal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("history")}
            className={`${outlineButton} hidden sm:inline-flex`}
          >
            View incident history <Icon name="chevron" className="size-4" />
          </button>
        </div>

        {latestReports.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {latestReports.map((report) => (
              <article
                key={report.id}
                className="relative flex min-h-72 flex-col group border border-slate-300 bg-white p-6 transition-all duration-200 ease-out hover:border-[#123D73] hover:bg-white hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-7 lg:p-8"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-0.5 transition-all duration-200 group-hover:h-1.5 ${statusTone[report.status].bar}`}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <Icon name="map" className="size-4" />
                    {getReportSourceDisplay(report)}
                  </span>
                  <StatusPill status={report.status} />
                </div>

                <h3 className="mt-6 text-xl font-bold leading-snug text-[#123D73]">
                  {report.type}
                </h3>
                <p className="mt-2 line-clamp-2 text-base leading-7 text-slate-600">
                  {report.title}
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {getReportAffectedLabel(report)}:
                  </span>{" "}
                  {getReportAffectedAreas(report).join(", ")}
                </p>

                <div className="mt-auto pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="clock" className="size-4" />
                      {report.date} · {report.time}
                    </span>

                    {report.restoration && (
                      <span className="min-w-0 wrap-break-word text-right">
                        Estimated restoration:{" "}
                        <strong className="text-slate-800">
                          {formatRestorationEstimate(report)}
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Opens History directly on this incident. */}
                  <button
                    type="button"
                    onClick={() => onNavigate("history", report.id)}
                    className={`${textButton} mt-4`}
                    aria-label={`Review details for ${getReportSourceLocation(report)}: ${report.title}`}
                  >
                    Review incident details
                    <Icon name="chevron" className="size-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Icon name="info" className="mx-auto size-8 text-[#123D73]" />
            <h3 className="mt-3 text-lg font-bold text-[#123D73]">
              No service updates available
            </h3>
            <p className="mt-2 text-base text-slate-600">
              There are no incident records available to display right now.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate("history")}
          className={`${outlineButton} mt-6 sm:hidden`}
        >
          View incident history <Icon name="chevron" className="size-4" />
        </button>
      </section>

      {/* HOW DISTRICTLENS WORKS */}
      <section className="w-full border-y border-slate-200 bg-white">
        <div className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 xl:px-10">
          <div className="max-w-3xl">
            <Eyebrow>How DistrictLens Works</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#123D73] sm:text-3xl">
              Find the public information you need
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              DistrictLens presents records made available for public viewing
              and complements TWD&apos;s existing Line Rupture Tracking Process.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <article className="group border border-slate-300 bg-white p-6 transition-all duration-200 ease-out hover:border-[#123D73] hover:bg-white hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-7 lg:p-8">
              <span className="inline-flex size-11 items-center justify-center bg-[#123D73] text-base font-bold text-white transition-colors duration-200 group-hover:bg-[#0B2A4F]">
                01
              </span>
              <h3 className="mt-5 text-xl font-bold text-[#123D73]">
                Explore the map
              </h3>
              <p className="mt-3 min-h-14 text-base leading-7 text-slate-600">
                Choose a Tanza barangay to see the service information
                available for its area.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("map")}
                className={`${textButton} mt-4`}
              >
                Open Public Map <Icon name="chevron" className="size-4" />
              </button>
            </article>

            <article className="group border border-slate-300 bg-white p-6 transition-all duration-200 ease-out hover:border-[#123D73] hover:bg-white hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-7 lg:p-8">
              <span className="inline-flex size-11 items-center justify-center bg-[#123D73] text-base font-bold text-white transition-colors duration-200 group-hover:bg-[#0B2A4F]">
                02
              </span>
              <h3 className="mt-5 text-xl font-bold text-[#123D73]">
                Review incident details
              </h3>
              <p className="mt-3 min-h-14 text-base leading-7 text-slate-600">
                Check the reported incident, its current status, affected
                area, and any restoration estimate provided in the record.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("history")}
                className={`${textButton} mt-4`}
              >
                Browse incident history{" "}
                <Icon name="chevron" className="size-4" />
              </button>
            </article>

            <article className="group border border-slate-300 bg-white p-6 transition-all duration-200 ease-out hover:border-[#123D73] hover:bg-white hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-7 lg:p-8">
              <span className="inline-flex size-11 items-center justify-center bg-[#123D73] text-base font-bold text-white transition-colors duration-200 group-hover:bg-[#0B2A4F]">
                03
              </span>
              <h3 className="mt-5 text-xl font-bold text-[#123D73]">
                Follow barangay updates
              </h3>
              <p className="mt-3 min-h-14 text-base leading-7 text-slate-600">
                Choose your barangay and subscribe when Web Push is
                configured and available on this portal.
              </p>
              <button
                type="button"
                onClick={openAlerts}
                aria-haspopup="dialog"
                aria-controls="alerts-modal"
                className={`${textButton} mt-4 text-left`}
              >
                {alertActionLabel} <Icon name="chevron" className="size-4" />
              </button>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}