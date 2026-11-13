"use client";

import type { ComponentProps, ReactNode } from "react";

import { useAlerts } from "./alert-provider";
import { Icon } from "./icons";

type AboutContentProps = {
  onNavigate: (section: "map") => void;
};

const informationPoints = [
  {
    title: "Barangay-Based Information",
    description:
      "Incident records identify the affected barangay or area whenever that information is available.",
  },
  {
    title: "Reported Incident Details",
    description:
      "Available records may include the issue, location, status, and estimated time of resolution.",
  },
  {
    title: "Based on Recorded Updates",
    description:
      "Information depends on the records entered into DistrictLens. Unreported issues and changes that have not yet been recorded may not appear.",
  },
];

// Same secondary button style used on the Dashboard, Analytics, and Create Report pages.
const smallButtonClass =
  "inline-flex w-fit items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

function IconTile({ name }: { name: ComponentProps<typeof Icon>["name"] }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-[#123D73]"
    >
      <Icon name={name} className="size-5" />
    </span>
  );
}

function Panel({
  headingId,
  sectionId,
  eyebrow,
  title,
  description,
  className = "",
  children,
}: {
  headingId: string;
  sectionId?: string;
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      className={`min-w-0 overflow-hidden border border-slate-300 bg-white ${className}`}
    >
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {eyebrow}
        </p>

        <h2 id={headingId} className="mt-1 text-lg font-bold text-[#123D73]">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {children}
    </section>
  );
}

export default function AboutContent({ onNavigate }: AboutContentProps) {
  const { openAlerts } = useAlerts();

  return (
    <main id="main-content" className="flex-1 bg-[#F4F6F9]">
      <div id="about-districtlens" className="anchor-target" />

      <div className="w-full px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
        <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:p-5">
          {/* PAGE BANNER */}
          <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-6">
            <p className="text-sm font-bold text-indigo-100">
              About the portal
            </p>

            <h1 className="mt-2 text-2xl font-bold text-white">
              About DistrictLens
            </h1>

            <p className="mt-2 max-w-3xl text-base text-indigo-100">
              A public-facing information portal for water-service incident
              records and updates made available for residents in Tanza.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.75fr_1.25fr]">
            {/* SIDEBAR */}
            <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <div className="border border-slate-300 bg-white p-5 sm:p-6">
                <IconTile name="shield" />

                <h2 className="mt-4 text-lg font-bold leading-snug text-[#123D73]">
                  Public Information, Clearly Presented
                </h2>

                <p className="mt-2.5 text-base leading-7 text-slate-600">
                  DistrictLens helps residents access recorded water-service
                  incident information and updates made available through the
                  portal.
                </p>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Important to know
                  </p>

                  <p className="mt-2.5 text-base leading-7 text-slate-600">
                    DistrictLens complements Tanza Water District&apos;s
                    existing processes. It does not automatically detect
                    incidents or directly synchronize with TWD&apos;s existing
                    systems.
                  </p>
                </div>

                <div className="mt-5 border border-slate-300 bg-slate-50 p-4">
                  <p className="text-base font-bold text-slate-800">
                    Need service updates?
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Check the public map or manage your barangay alerts.
                  </p>

                  <button
                    type="button"
                    onClick={() => onNavigate("map")}
                    className={`${smallButtonClass} mt-3`}
                  >
                    Open public map
                    <Icon name="chevron" className="size-4" />
                  </button>
                </div>
              </div>
            </aside>

            {/* MAIN INFORMATION */}
            <div className="min-w-0 space-y-5">
              <Panel
                headingId="about-what-it-is"
                eyebrow="What it is"
                title="A Clearer View of Water Service Information"
              >
                <div className="p-5 sm:p-6">
                  <p className="max-w-3xl text-base leading-7 text-slate-600">
                    DistrictLens is a public information portal that helps
                    residents view recorded water-service incidents, affected
                    areas, and available service updates in Tanza.
                  </p>
                </div>
              </Panel>

              {/* AVAILABLE FEATURES */}
              <Panel
                headingId="about-what-you-can-do"
                eyebrow="What you can do"
                title="Explore Public Portal Features"
                description="Access the information you need using the options below."
              >
                <div className="divide-y divide-slate-200">
                  <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                    <IconTile name="map" />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-800">
                        View the Public Map
                      </h3>

                      <p className="mt-1 text-base leading-7 text-slate-600">
                        Explore Tanza barangays and review available incident
                        information.
                      </p>

                      <button
                        type="button"
                        onClick={() => onNavigate("map")}
                        className={`${smallButtonClass} mt-3`}
                      >
                        View the map
                        <Icon name="chevron" className="size-4" />
                      </button>
                    </div>
                  </article>

                  <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                    <IconTile name="info" />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-800">
                        Check Incident Information
                      </h3>

                      <p className="mt-1 text-base leading-7 text-slate-600">
                        Review available details such as the reported issue,
                        affected area, current status, and estimated time of
                        resolution when provided.
                      </p>
                    </div>
                  </article>

                  <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                    <IconTile name="bell" />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-800">
                        Manage Barangay Alerts
                      </h3>

                      <p className="mt-1 text-base leading-7 text-slate-600">
                        Select a barangay and manage notification preferences
                        using the existing alert-management functionality.
                      </p>

                      <button
                        type="button"
                        onClick={openAlerts}
                        aria-haspopup="dialog"
                        aria-controls="alerts-modal"
                        className={`${smallButtonClass} mt-3`}
                      >
                        Manage alerts
                        <Icon name="chevron" className="size-4" />
                      </button>
                    </div>
                  </article>
                </div>
              </Panel>

              {/* INFORMATION GUIDE */}
              <Panel
                headingId="about-information-presented"
                eyebrow="How information is presented"
                title="Understand the Information Shown"
                description="The information displayed depends on the records and updates available in the portal."
              >
                <div className="divide-y divide-slate-200">
                  {informationPoints.map((point, index) => (
                    <article
                      key={point.title}
                      className="flex items-start gap-4 px-5 py-5 sm:px-6"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-sm font-bold text-[#123D73]">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-800">
                          {point.title}
                        </h3>

                        <p className="mt-1 text-base leading-7 text-slate-600">
                          {point.description}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>

              {/* TWD INFORMATION */}
              <Panel
                headingId="about-twd-heading"
                sectionId="mission-goals"
                eyebrow="For Tanza Water District"
                title="A Complementary Public Information Portal"
                className="anchor-target"
              >
                <div className="p-5 sm:p-6">
                  <p className="text-base leading-7 text-slate-600">
                    DistrictLens provides a public-facing view of water-service
                    incident information made available through the portal. It
                    complements Tanza Water District&apos;s existing Line
                    Rupture Tracking Process and does not replace it or
                    directly synchronize with TWD&apos;s existing systems.
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}