import type { Metadata } from "next"
import Link from "next/link"

import BackToTop from "../components/back-to-top"

export const metadata: Metadata = {
  title: "Terms and Conditions | DistrictLens",
  description:
    "The terms for using the DistrictLens public water-service incident portal for Tanza, Cavite.",
}

const LAST_UPDATED = "November 25, 2026"

const sections: { id: string; title: string; body: string[]; list?: string[] }[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of terms",
    body: [
      "By accessing or using DistrictLens, you agree to these Terms and Conditions. If you do not agree, please stop using the portal.",
    ],
  },
  {
    id: "about",
    title: "2. About DistrictLens",
    body: [
      "DistrictLens is a public-facing water-service information and incident monitoring portal that helps residents view published service incident updates across Tanza, Cavite.",
      "It is an academic software engineering project that complements Tanza Water District's (TWD) existing incident-reporting process. It is not an official TWD service and does not replace TWD's own channels.",
    ],
  },
  {
    id: "information-accuracy",
    title: "3. Accuracy of information",
    body: [
      "Information on the portal depends on records made available for public viewing and may change as updates are published. Status labels, affected areas, and restoration estimates reflect what was entered into DistrictLens. They do not indicate automatic detection or real-time monitoring.",
      "This prototype may use sample incident records that do not reflect current service conditions. For urgent concerns or confirmed service information, contact Tanza Water District directly.",
    ],
  },
  {
    id: "acceptable-use",
    title: "4. Acceptable use",
    body: ["When using the portal, you agree not to:"],
    list: [
      "Attempt to gain unauthorized access to the portal, its data, or its administration features.",
      "Interfere with or disrupt the portal, including by sending automated or excessive requests.",
      "Copy, scrape, or republish portal content in a way that misrepresents it as official TWD information.",
      "Use the portal for any unlawful purpose.",
    ],
  },
  {
    id: "barangay-alerts",
    title: "5. Barangay Alerts",
    body: [
      "Barangay Alerts are optional and depend on your browser, your device settings, and whether Web Push is configured and available on the portal. Delivery is not guaranteed, and alerts may be delayed or missed. You can manage or turn them off at any time.",
    ],
  },
  {
    id: "intellectual-property",
    title: "6. Seals, names, and content",
    body: [
      "The Municipality of Tanza and Tanza Water District seals and names belong to their respective owners and are shown to identify the service area and the organization the portal supports. The portal's own design and code are part of an academic project. Using them does not give you any right to represent yourself as TWD or the Municipality of Tanza.",
    ],
  },
  {
    id: "availability",
    title: "7. Availability",
    body: [
      "We try to keep the portal available, but we do not promise uninterrupted or error-free access. Features may change, be paused, or be removed without notice.",
    ],
  },
  {
    id: "liability",
    title: "8. Limitation of liability",
    body: [
      "The portal is provided on an \"as is\" and \"as available\" basis. To the extent allowed by law, the DistrictLens project team is not liable for losses or damages arising from your reliance on portal information, missed or delayed alerts, or temporary unavailability of the portal.",
    ],
  },
  {
    id: "privacy",
    title: "9. Privacy",
    body: [
      "How the portal handles information is described in the Privacy Policy, which forms part of these terms.",
    ],
  },
  {
    id: "changes",
    title: "10. Changes to these terms",
    body: [
      "We may update these terms as the portal changes. The date at the top of this page shows when they were last revised. Continued use of the portal after an update means you accept the revised terms.",
    ],
  },
  {
    id: "governing-law",
    title: "11. Governing law and contact",
    body: [
      "These terms are governed by the laws of the Republic of the Philippines. For questions about these terms, use the Contact section of the portal or reach out through the official Tanza Water District channels.",
    ],
  },
]

export default function TermsAndConditionsPage() {
  return (
    <main
      id="main-content"
      className="min-w-0 flex-1 bg-[#F4F6F9] text-slate-800"
    >
      {/* HEADER BANNER */}
      <section className="w-full border-b border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8]">
        <div className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
          <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-indigo-100 sm:text-lg">
            The rules for using the DistrictLens portal.
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
                href="/privacy-policy"
                className="text-sm font-semibold text-[#123D73] hover:underline"
              >
                Read the Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      <BackToTop />
    </main>
  )
}