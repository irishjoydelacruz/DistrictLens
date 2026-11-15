"use client";

import Image from "next/image";
import Link from "next/link";
import { useAlerts } from "./alert-provider";
import { useSubmitReport } from "./submit-report-provider";
import { Icon } from "./icons";

// UI-only: all three header actions share the same size, shape, and icon size.
// Square buttons with the same hover lift as the buttons on the Home page.
// The buttons sit in an equal-width grid, so they always match the widest
// label and no label ever wraps.
const actionBase =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap border px-2 text-sm font-semibold text-white sm:px-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 motion-safe:hover:-translate-y-0.5 hover:shadow-md lg:px-5";
const reportAction = "border-red-600 bg-red-600 hover:border-red-700 hover:bg-red-700";
const alertsAction =
  "border-emerald-700 bg-emerald-700 hover:border-emerald-800 hover:bg-emerald-800";
const loginAction =
  "border-[#123D73] bg-[#123D73] hover:border-[#0D2F59] hover:bg-[#0D2F59]";

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

export default function Header() {
  const { openAlerts, alertsEnabled } = useAlerts();
  const { openSubmitReport } = useSubmitReport();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:min-h-22 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
            <Image
              src="/images/twd-logo.jpg"
              alt="Tanza Water District official logo"
              fill
              sizes="64px"
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
        </div>

        <div className="grid w-full grid-cols-3 items-center gap-2 sm:w-auto sm:shrink-0 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none sm:gap-3">
          <button
            type="button"
            onClick={openSubmitReport}
            aria-haspopup="dialog"
            aria-controls="submit-report-modal"
            className={`${actionBase} ${reportAction}`}
          >
            <PencilIcon />
            <span className="hidden lg:inline">Submit Report</span>
            <span className="lg:hidden">Report</span>
          </button>

          <button
            type="button"
            onClick={openAlerts}
            aria-haspopup="dialog"
            aria-controls="alerts-modal"
            className={`${actionBase} ${alertsAction}`}
          >
            <Icon name="bell" className="size-4" />
            <span className="hidden lg:inline">
              {alertsEnabled ? "Manage Alerts" : "Get Barangay Alerts"}
            </span>
            <span className="lg:hidden">Alerts</span>
          </button>

          <Link
            href="/login"
            className={`${actionBase} ${loginAction}`}
          >
            <Icon name="shield" className="size-4" />
            <span className="hidden lg:inline">Staff Login</span>
            <span className="lg:hidden">Login</span>
          </Link>
        </div>
      </div>
    </header>
  );
}