"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAlerts } from "./alert-provider";
import { useSubmitReport } from "./submit-report-provider";
import { Icon } from "./icons";

// UI-only: the three header actions share the same height, shape, and icon
// size, but have three levels of emphasis:
//   1. Submit Report  = solid red (the main action)
//   2. Alerts         = soft yellow tint + border (secondary)
//   3. Staff Login    = ghost (no border or fill until hovered)
// Phone: three equal columns, 44px tall so they are easy to tap.
// Tablet and up: each button takes its own natural width, 40px tall.
// Full labels show on large screens (lg); shorter ones below that.
// "group" lets the label bold itself when the button is hovered or focused.
const actionBase =
  "group inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap border px-2 text-sm font-semibold sm:min-h-10 sm:w-auto sm:px-4 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 motion-safe:hover:-translate-y-0.5";

// Solid
const reportAction =
  "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:shadow-md";

// Soft tint + border
const alertsAction =
  "border-amber-500 bg-amber-50 text-amber-700 hover:border-amber-600 hover:bg-amber-100 hover:text-amber-800";

// Ghost: transparent at rest, soft grey fill on hover. A thin divider on the
// left (tablet and up) separates it from the other two actions.
const loginAction =
  "relative border-transparent bg-transparent text-slate-700 hover:bg-slate-100 hover:text-[#123D73] sm:before:absolute sm:before:-left-[5px] sm:before:top-1/2 sm:before:h-7 sm:before:w-px sm:before:-translate-y-1/2 sm:before:bg-slate-200 sm:before:content-['']";

function PencilIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function LockIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// Bolds the label on hover/focus like the admin tabs, without changing the
// button width: an invisible bold copy reserves the wider size.
function HoverBold({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={className}>
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 font-bold"
      >
        {children}
      </span>
      <span className="col-start-1 row-start-1 text-center group-hover:font-bold group-focus-visible:font-bold">
        {children}
      </span>
    </span>
  );
}

export default function Header() {
  const { openAlerts, alertsEnabled } = useAlerts();
  const { openSubmitReport } = useSubmitReport();

  const alertsLabel = alertsEnabled ? "Manage Alerts" : "Get Barangay Alerts";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:min-h-18 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        {/* Logo and title: click to go back to the Home page */}
        <Link
          href="/"
          aria-label="DistrictLens home"
          className="flex min-w-0 items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73]/30"
        >
          <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
            <Image
              src="/images/twd-logo.jpg"
              alt="Tanza Water District official logo"
              fill
              sizes="56px"
              className="object-contain"
              priority
              loading="eager"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
              Tanza Water District
            </p>

            <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight text-[#123D73] sm:text-xl">
              DistrictLens
            </h1>

            <p className="hidden text-[11px] text-slate-500 sm:block">
              Public Information Portal
            </p>
          </div>
        </Link>

        <div className="grid w-full grid-cols-3 items-center gap-2 sm:flex sm:w-auto sm:shrink-0 sm:gap-2">
          <button
            type="button"
            onClick={openSubmitReport}
            aria-haspopup="dialog"
            aria-controls="submit-report-modal"
            className={`${actionBase} ${reportAction}`}
          >
            <PencilIcon />
            <HoverBold className="hidden lg:inline-grid">
              Submit Report
            </HoverBold>
            <HoverBold className="inline-grid lg:hidden">Report</HoverBold>
          </button>

          <button
            type="button"
            onClick={openAlerts}
            aria-haspopup="dialog"
            aria-controls="alerts-modal"
            className={`${actionBase} ${alertsAction}`}
          >
            <Icon name="bell" className="size-4" />
            <HoverBold className="hidden lg:inline-grid">
              {alertsLabel}
            </HoverBold>
            <HoverBold className="inline-grid lg:hidden">Alerts</HoverBold>
          </button>

          <Link href="/login" className={`${actionBase} ${loginAction}`}>
            <LockIcon />
            <HoverBold className="hidden lg:inline-grid">Staff Login</HoverBold>
            <HoverBold className="inline-grid lg:hidden">Login</HoverBold>
          </Link>
        </div>
      </div>
    </header>
  );
}