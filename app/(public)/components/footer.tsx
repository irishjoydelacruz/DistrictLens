"use client"

import type { MouseEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"

import { useAlerts } from "./alert-provider"
import { Icon } from "./icons"

type Section = "home" | "map" | "history" | "about" | "contact"

const quickLinks = [
  { section: "home" as const, label: "Home", icon: "home" as const },
  { section: "map" as const, label: "Map", icon: "map" as const },
  { section: "history" as const, label: "History", icon: "history" as const },
  { section: "about" as const, label: "About Us", icon: "info" as const },
]

// UI-only class tokens: solid portal blue (#123D73) so the footer stands apart
// from the white header.
const titleClass =
  "text-xs font-bold uppercase tracking-[0.12em] text-white"
const linkClass =
  "flex items-center gap-2.5 border border-transparent px-2.5 py-2 text-sm text-blue-100 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"

export function Footer() {
  const pathname = usePathname()
  const { alertsEnabled, openAlerts } = useAlerts()

  if (pathname === "/public-map") return null

  // The portal is a single page that switches sections. On "/" the footer
  // links change the section directly; from any other route they open "/".
  const sectionHref = (section: Section) =>
    section === "home" ? "/" : `/?section=${section}`

  const goToSection =
    (section: Section) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (pathname !== "/") return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return
      }
      event.preventDefault()
      window.dispatchEvent(
        new CustomEvent("portal:navigate", { detail: section }),
      )
    }

  return (
    <footer
      aria-label="Site footer"
      className="mt-auto border-t border-[#0D2F59] bg-[#123D73]"
    >
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.5fr] lg:px-8">
        <section aria-labelledby="footer-brand-title">
          <Link href="/" className="flex items-center gap-3">
            {/* Circular seal, same treatment as the Home hero logos. */}
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/images/twd-logo.jpg"
                alt="Tanza Water District seal"
                width={48}
                height={48}
                unoptimized
                className="size-full scale-[1.06] object-cover"
              />
            </span>
            <span>
              <span
                id="footer-brand-title"
                className="block text-base font-bold tracking-tight text-white"
              >
                DistrictLens
              </span>
              <span className="block text-xs text-blue-200">
                Tanza Water District
              </span>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">
            DistrictLens is a public-facing water-service information and incident monitoring portal designed to help residents access published service incident updates across Tanza, Cavite.
          </p>
        </section>

        <nav aria-labelledby="footer-links-title">
          <h2 id="footer-links-title" className={titleClass}>
            Quick Links
          </h2>
          <ul className="mt-3 space-y-1">
            {quickLinks.map((link) => (
              <li key={link.section}>
                <Link
                  href={sectionHref(link.section)}
                  onClick={goToSection(link.section)}
                  className={linkClass}
                >
                  <Icon name={link.icon} className="size-4 text-blue-200" />
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title" className={titleClass}>
            Public Assistance
          </h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link
                href={sectionHref("contact")}
                onClick={goToSection("contact")}
                className={linkClass}
              >
                <Icon name="phone" className="size-4 text-blue-200" />
                <span>Contact</span>
              </Link>
            </li>
            <li>
              <a
                href="https://tanzawaterdistrict.com/"
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                <Icon name="external" className="size-4 text-blue-200" />
                <span>TWD Official Website</span>
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={openAlerts}
                aria-haspopup="dialog"
                aria-controls="alerts-modal"
                className={`${linkClass} w-full text-left`}
              >
                <Icon name="bell" className="size-4 text-blue-200" />
                <span>
                  {alertsEnabled ? "Manage Barangay Alerts" : "Barangay Alerts"}
                </span>
              </button>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="footer-notice-title"
          className="flex gap-3 self-start border border-white/20 bg-white/5 p-4"
        >
          <span className="mt-0.5 shrink-0 text-blue-100">
            <Icon name="shield" className="size-5" />
          </span>
          <div>
            <h2 id="footer-notice-title" className="sr-only">
              System Notice
            </h2>
            <p className="text-xs leading-5 text-blue-100">
              This prototype uses sample incident records, which may not reflect current service conditions. DistrictLens is designed to complement Tanza Water District&apos;s existing incident-reporting process; information depends on records made available for public viewing and may change as updates are published.
            </p>
          </div>
        </section>
      </div>

      <div className="border-t border-white/15 bg-[#0D2F59]">
        <div className="mx-auto max-w-[1600px] px-4 py-4 text-xs text-blue-200 sm:px-6 lg:px-8">
          <span>
            © 2026 SerbisyON DistrictLens <span aria-hidden="true">·</span> Academic Software Engineering Project
          </span>
        </div>
      </div>
    </footer>
  )
}