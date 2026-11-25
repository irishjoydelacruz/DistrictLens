import type { Metadata } from "next"
import Link from "next/link"

import BackToTop from "../components/back-to-top"

export const metadata: Metadata = {
  title: "Privacy Policy | DistrictLens",
  description:
    "How DistrictLens handles information in its public water-service incident portal for Tanza, Cavite.",
}

const LAST_UPDATED = "November 25, 2026"

const sections: { id: string; title: string; body: string[]; list?: string[] }[] = [
  {
    id: "overview",
    title: "1. Overview",
    body: [
      "DistrictLens is a public-facing water-service information and incident monitoring portal for Tanza, Cavite. This Privacy Policy explains what information the portal handles, why, and the choices available to you.",
      "DistrictLens is an academic software engineering project that complements Tanza Water District's (TWD) existing incident-reporting process. It is not an official TWD system, and it does not replace TWD's own channels.",
    ],
  },
  {
    id: "information-we-handle",
    title: "2. Information we handle",
    body: [
      "You can view the Home page, Public Map, Incident History, and About Us without creating an account or giving us personal details. The portal handles the following only when you use the related feature:",
    ],
    list: [
      "Barangay Alerts: the barangay you choose and the browser push subscription created when you turn on notifications.",
      "Preferences stored in your browser, such as whether alerts are enabled on this device.",
      "Basic technical data that web servers normally record, such as browser type, device type, and request time, used to keep the portal working.",
    ],
  },
  {
    id: "incident-records",
    title: "3. Incident records shown on the portal",
    body: [
      "Incident records (type, affected areas, status, dates, and restoration estimates) are service information made available for public viewing. They describe water service conditions in barangays and are not meant to identify individual residents.",
      "This prototype may use sample incident records that do not reflect current service conditions.",
    ],
  },
  {
    id: "how-we-use",
    title: "4. How we use information",
    body: ["Information is used only for the purposes below."],
    list: [
      "To send the barangay alerts you subscribed to.",
      "To remember your alert settings on your device.",
      "To maintain, secure, and improve the portal.",
    ],
  },
  {
    id: "sharing",
    title: "5. Sharing and disclosure",
    body: [
      "We do not sell your information. Push notifications are delivered through your browser's push service (for example, those operated by browser vendors), which receives the technical subscription data needed to deliver a message. We may also disclose information when required by law.",
    ],
  },
  {
    id: "retention",
    title: "6. Retention and security",
    body: [
      "Alert subscription data is kept only as long as your subscription is active or needed for the portal to work. We use reasonable organizational and technical measures to protect it, but no online system can be guaranteed to be completely secure.",
    ],
  },
  {
    id: "your-rights",
    title: "7. Your choices and rights",
    body: [
      "Under the Data Privacy Act of 2012 (Republic Act No. 10173), you have rights over your personal information, including the right to be informed, to access, to correct, to object, and to request erasure or blocking where applicable.",
    ],
    list: [
      "Manage or turn off Barangay Alerts at any time from the Barangay Alerts option on the portal.",
      "Block notifications for this site in your browser settings.",
      "Clear site data in your browser to remove locally stored preferences.",
    ],
  },
  {
    id: "children",
    title: "8. Children",
    body: [
      "DistrictLens is a general public information portal and is not directed at children. We do not knowingly collect personal information from children.",
    ],
  },
  {
    id: "changes",
    title: "9. Changes to this policy",
    body: [
      "We may update this policy as the portal changes. The date at the top of this page shows when it was last revised. Continued use of the portal after an update means you accept the revised policy.",
    ],
  },
  {
    id: "contact",
    title: "10. Contact",
    body: [
      "For privacy questions or requests, use the Contact section of the portal or reach out through the official Tanza Water District channels.",
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main
      id="main-content"
      className="min-w-0 flex-1 bg-[#F4F6F9] text-slate-800"
    >
      {/* HEADER BANNER */}
      <section className="w-full border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
        <div className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
          <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-indigo-100 sm:text-lg">
            How DistrictLens handles information when you use the portal.
          </p>
          <p className="mt-4 text-sm text-indigo-100">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-8 xl:px-10">
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:gap-12">
          {/* Table of contents */}
          <nav
            aria-label="On this page"
            className="self-start border border-slate-300 bg-white p-5 lg:sticky lg:top-6"
          >
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
              On this page
            </p>
            <ul className="mt-3 space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block px-2 py-1.5 text-sm text-[#123D73] transition-colors hover:bg-[#E8EEF6] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73]/50"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sections */}
          <div className="min-w-0 space-y-5">
            {sections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-6 border border-slate-300 bg-white p-6 sm:p-7 lg:p-8"
              >
                <h2 className="text-xl font-bold tracking-tight text-[#123D73] sm:text-2xl">
                  {section.title}
                </h2>
                <div className="mt-3 max-w-3xl space-y-3">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-base leading-7 text-slate-600"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.list && (
                    <ul className="list-disc space-y-2 pl-5 text-base leading-7 text-slate-600 marker:text-[#123D73]">
                      {section.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-5 text-sm font-semibold text-[#123D73] transition-all duration-200 hover:border-[#123D73] hover:bg-[#E8EEF6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73]/50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back to Home
              </Link>
              <Link
                href="/terms-and-conditions"
                className="text-sm font-semibold text-[#123D73] hover:underline"
              >
                Read the Terms and Conditions
              </Link>
            </div>
          </div>
        </div>
      </section>

      <BackToTop />
    </main>
  )
}