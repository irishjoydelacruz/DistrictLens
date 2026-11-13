"use client"

import Link from "next/link"

import { useAlerts } from "../components/alert-provider"
import Header from "../components/header"
import { Icon } from "../components/icons"
import { Button } from "../components/ui"
import { PageIntro } from "../components/page-intro"
import { SectionLabel } from "../components/section-label"

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
]

export default function AboutPage() {
  const { openAlerts } = useAlerts()

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <div id="about-districtlens" className="anchor-target" />
        <PageIntro
          eyebrow="About the portal"
          title="About DistrictLens"
          text="A public-facing information portal for water-service incident records and updates made available for residents in Tanza."
        />

        {/* The two-column content below intentionally leaves the existing hero untouched. */}
        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-12 lg:py-14">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-white to-blue-50 p-6 shadow-sm">
              <span className="flex size-11 items-center justify-center rounded-xl bg-blue-700 text-white">
                <Icon name="shield" />
              </span>

              <h2 className="mt-5 text-lg font-bold text-slate-950">
                Public Information, Clearly Presented
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                DistrictLens helps residents access recorded water service incident
                information and updates made available through the portal.
              </p>

              <p className="mt-4 border-t border-blue-100 pt-4 text-xs leading-5 text-slate-600 sm:text-sm">
                DistrictLens complements Tanza Water District&apos;s existing
                processes. It does not automatically detect incidents or directly
                synchronize with TWD&apos;s existing systems.
              </p>
            </div>
          </aside>

          <div className="min-w-0 space-y-9 sm:space-y-10">
            <section aria-labelledby="about-what-it-is">
              <SectionLabel>What it is</SectionLabel>
              <h2 id="about-what-it-is" className="mt-2 text-2xl font-bold text-slate-950">
                A Clearer View of Water Service Information
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                DistrictLens is a public information portal that helps residents
                view recorded water service incidents, affected areas, and
                available service updates in Tanza.
              </p>
            </section>

            <section aria-label="What you can do">
              <SectionLabel>What you can do</SectionLabel>
              <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <article className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700" aria-hidden="true">
                    <Icon name="map" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-950">View the Public Map</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Explore Tanza barangays and review available incident information.
                    </p>
                    <Link href="/public-map" className="contact-detail-link mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                      View the map <Icon name="chevron" className="size-4" />
                    </Link>
                  </div>
                </article>

                <article className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700" aria-hidden="true">
                    <Icon name="info" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-950">Check Incident Information</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Review available details such as the reported issue, affected
                      area, current status, and estimated time of resolution when provided.
                    </p>
                  </div>
                </article>

                <article className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700" aria-hidden="true">
                    <Icon name="bell" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-950">Manage Barangay Alerts</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Select a barangay and manage notification preferences using
                      the existing alert-management functionality.
                    </p>
                    <Button
                      variant="ghost"
                      onClick={openAlerts}
                      aria-haspopup="dialog"
                      aria-controls="alerts-modal"
                      className="mt-2 px-0!"
                    >
                      Manage alerts <Icon name="chevron" className="size-4" />
                    </Button>
                  </div>
                </article>
              </div>
            </section>

            <section aria-labelledby="about-information-presented">
              <SectionLabel>How information is presented</SectionLabel>
              <h2 id="about-information-presented" className="mt-2 text-2xl font-bold text-slate-950">
                Understand the Information Shown
              </h2>
              <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {informationPoints.map((point) => (
                  <article key={point.title} className="px-4 py-4 sm:px-5">
                    <h3 className="text-sm font-bold text-slate-950">{point.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {point.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section id="mission-goals" className="anchor-target rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-sky-100/70 p-5 text-slate-900 shadow-sm sm:p-7" aria-labelledby="about-twd-heading">
              <SectionLabel>For Tanza Water District</SectionLabel>
              <h2 id="about-twd-heading" className="mt-2 text-xl font-bold sm:text-2xl">
                A Complementary Public Information Portal
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                DistrictLens provides a public-facing view of water service
                incident information made available through the portal. It
                complements Tanza Water District&apos;s existing Line Rupture
                Tracking Process and does not replace it or directly synchronize
                with TWD&apos;s existing systems.
              </p>
            </section>
          </div>
        </section>
      </main>
    </>
  )
}