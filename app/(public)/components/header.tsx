"use client";

import Image from "next/image";
import Link from "next/link";
import { useAlerts } from "./alert-provider";
import { useSubmitReport } from "./submit-report-provider";
import { Button } from "./ui";
import { Icon } from "./icons";

export default function Header() {
  const { openAlerts, alertsEnabled } = useAlerts();
  const { openSubmitReport } = useSubmitReport();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-22 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button
            onClick={openSubmitReport}
            aria-haspopup="dialog"
            aria-controls="submit-report-modal"
            className="shrink-0 bg-red-600! hover:bg-red-700!"
          >
            <Icon name="map-pin" className="size-4" />
            <span className="hidden sm:inline">Submit Report</span>
            <span className="sm:hidden">Report</span>
          </Button>

          <Button
            onClick={openAlerts}
            aria-haspopup="dialog"
            aria-controls="alerts-modal"
            className="shrink-0"
          >
            <Icon name="bell" className="size-4" />
            <span className="hidden sm:inline">
              {alertsEnabled ? "Manage Alerts" : "Get Barangay Alerts"}
            </span>
            <span className="sm:hidden">Alerts</span>
          </Button>

          <Link
            href="/login"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#123D73] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D2F59] sm:px-4 sm:text-sm"
          >
            <span className="hidden sm:inline">Staff Login</span>
            <span className="sm:hidden">Login</span>
          </Link>
        </div>
      </div>
    </header>
  );
}