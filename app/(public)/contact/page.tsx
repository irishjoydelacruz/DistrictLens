"use client"

import { useState } from "react"

import Header from "../components/header"
import { Icon } from "../components/icons"
import { PageIntro } from "../components/page-intro"
import { SectionLabel } from "../components/section-label"

const officialWebsite = "https://www.tanzawaterdistrict.com"
const officialFacebook = "https://www.facebook.com/tanzawaterdistrict/"

const faqs = [
  {
    question: "What is DistrictLens?",
    answer:
      "DistrictLens is a public-facing portal for viewing water-service incident information and updates made available for Tanza. This version is a prototype and includes sample incident records, which may not reflect current service conditions.",
  },
  {
    question: "How can I check water service updates in my barangay?",
    answer:
      "Open the Public Map to search for or select a barangay and see the information available for it. You can also review published records on the Incident History page.",
  },
  {
    question: "What do Active, Monitoring, and Normal mean?",
    answer:
      "Active means an incident is shown as currently active. Monitoring means the reported condition is being monitored. Normal means no active service incident is currently shown for that area. These labels describe the records available in the portal.",
  },
  {
    question: "Does DistrictLens cover every barangay in Tanza?",
    answer:
      "The Public Map shows barangay boundaries from the included Tanza map data. Incident records depend on the information available for public viewing, so a barangay may have no incident record to display.",
  },
  {
    question: "Does DistrictLens provide real-time updates?",
    answer:
      "No. Information depends on records made available for public viewing and may change when records are updated. The portal does not claim live synchronization with Tanza Water District systems.",
  },
  {
    question: "Can I receive alerts for my barangay?",
    answer:
      "If Web Push is available, choose a barangay and allow notifications in your browser. You can change your barangay or turn alerts off from Manage Alerts. Availability and delivery depend on the portal’s configured alert service.",
  },
  {
    question: "Where can I report a water service problem?",
    answer:
      "This portal does not currently provide a public incident-reporting form. Visit Tanza Water District’s official website to find its current, verified contact and reporting channels.",
  },
  {
    question: "Where can I find the estimated restoration time?",
    answer:
      "When an estimate is available in a record, it appears in the incident card on the Public Map and in that incident’s details on the Incident History page. An estimate may change as updates become available.",
  },
]

const phoneNumbers = [
  { label: "(046) 484 1813", href: "tel:+63464841813" },
  { label: "(046) 505 2906", href: "tel:+63465052906" },
]

export default function ContactPage() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <PageIntro
          eyebrow="Contact and assistance"
          title="We’re Here to Help"
          text="Contact Tanza Water District for inquiries and assistance. Find the official contact details and channels below."
        />

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <section aria-labelledby="contact-details-heading">
            <SectionLabel>Get in touch</SectionLabel>
            <h2 id="contact-details-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Contact Information
            </h2>

            <div className="portal-card mt-5 divide-y divide-slate-200 overflow-hidden">
              <div className="grid gap-2 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:px-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <Icon name="phone" className="size-4 text-blue-700" />
                  <span>Telephone</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold text-blue-800">
                  {phoneNumbers.map((phone) => (
                    <a key={phone.href} className="contact-detail-link" href={phone.href}>
                      {phone.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:px-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <Icon name="mail" className="size-4 text-blue-700" />
                  <span>Email</span>
                </div>
                <a className="contact-detail-link break-all text-sm font-semibold text-blue-800" href="mailto:tanza_wd@yahoo.com">
                  tanza_wd@yahoo.com
                </a>
              </div>

              <div className="grid gap-2 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:px-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <Icon name="globe" className="size-4 text-blue-700" />
                  <span>Official Website</span>
                </div>
                <a className="contact-detail-link break-all text-sm font-semibold text-blue-800" href={officialWebsite} target="_blank" rel="noopener noreferrer">
                  www.tanzawaterdistrict.com <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </div>
          </section>

          <section className="mt-9 sm:mt-10" aria-labelledby="official-channels-heading">
            <SectionLabel>Connect with TWD</SectionLabel>
            <h2 id="official-channels-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Official TWD Channels
            </h2>

            <div className="portal-card mt-5 divide-y divide-slate-200 overflow-hidden md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
              <article className="flex items-start gap-4 p-4 sm:p-5">
                <span className="portal-icon-tile size-10 shrink-0" aria-hidden="true">
                  <Icon name="globe" className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-950">Tanza Water District Website</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                    Visit the official website of Tanza Water District for its published information and announcements.
                  </p>
                  <a className="contact-detail-link mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700" href={officialWebsite} target="_blank" rel="noopener noreferrer">
                    Visit Website <Icon name="external" className="size-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </article>

              <article className="flex items-start gap-4 p-4 sm:p-5">
                <span className="portal-icon-tile size-10 shrink-0" aria-hidden="true">
                  <Icon name="facebook" className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-950">Tanza Water District Facebook Page</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                    Visit the official Facebook page of Tanza Water District for its published posts and announcements.
                  </p>
                  <a className="contact-detail-link mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700" href={officialFacebook} target="_blank" rel="noopener noreferrer">
                    Visit Facebook Page <Icon name="external" className="size-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </article>
            </div>
          </section>

          <section className="mt-9 sm:mt-10" aria-labelledby="office-info-heading">
            <SectionLabel>Plan your visit</SectionLabel>
            <h2 id="office-info-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Office Location &amp; Business Hours
            </h2>

            <div className="portal-card mt-5 divide-y divide-slate-200 overflow-hidden md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
              <article className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                <span className="portal-icon-tile size-10 shrink-0" aria-hidden="true">
                  <Icon name="map-pin" className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-950">Office Location</h3>
                  <address className="mt-1 not-italic text-sm leading-6 text-slate-600">
                    A. Soriano Highway, Tanza, Cavite
                  </address>
                </div>
              </article>

              <article className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                <span className="portal-icon-tile size-10 shrink-0" aria-hidden="true">
                  <Icon name="clock" className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-950">Business Hours</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Monday to Friday, 8:00 AM to 5:00 PM
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className="mt-10 sm:mt-12" aria-labelledby="faq-heading">
            <div className="grid gap-7 lg:grid-cols-[minmax(230px,.72fr)_minmax(0,1.28fr)] lg:gap-10">
              <div className="max-w-lg lg:sticky lg:top-28 lg:self-start">
                <SectionLabel>Help and information</SectionLabel>
                <h2 id="faq-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Frequently Asked Questions
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Answers about DistrictLens, incident statuses, and water-service updates.
                </p>
              </div>

              <div className="contact-faq-list grid min-w-0 gap-3">
                {faqs.map(({ question, answer }, index) => {
                  const expanded = openQuestion === question
                  const answerId = `faq-answer-${index}`
                  const questionId = `faq-question-${index}`

                  return (
                    <article key={question} className="contact-faq-item portal-card overflow-hidden">
                      <h3 id={questionId}>
                        <button
                          type="button"
                          className="contact-faq-question flex min-h-16 w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-slate-900 transition hover:bg-blue-50/70 focus-visible:bg-blue-50 sm:px-5 sm:text-base"
                          aria-expanded={expanded}
                          aria-controls={answerId}
                          onClick={() => setOpenQuestion(expanded ? null : question)}
                        >
                          <span>{question}</span>
                          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg leading-none text-slate-600">
                            {expanded ? "−" : "+"}
                          </span>
                        </button>
                      </h3>
                      <div
                        id={answerId}
                        role="region"
                        aria-labelledby={questionId}
                        aria-hidden={!expanded}
                        inert={!expanded}
                        className={`contact-faq-answer-grid ${expanded ? "is-open" : ""}`}
                      >
                        <div>
                          <p className="px-4 pb-5 pr-14 text-sm leading-6 text-slate-600 sm:px-5 sm:pr-16">
                            {answer}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}