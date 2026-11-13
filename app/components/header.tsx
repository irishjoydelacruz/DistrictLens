"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <>
      {/* =========================
          DESKTOP HEADER
      ========================== */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between px-5 sm:px-8">

          {/* BRAND */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
          >

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white">
              💧
            </div>

            <div>
              <p className="text-sm font-extrabold tracking-wide text-blue-700">
                DISTRICTLENS
              </p>

              <p className="text-[10px] text-slate-400">
                Tanza Water District
              </p>
            </div>

          </Link>


          {/* NAVIGATION */}
          <nav className="hidden items-center gap-1 md:flex">

            <Link
              href="/"
              className={`rounded-lg px-4 py-2.5 text-xs transition ${
                isActive("/")
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
              }`}
            >
              Home
            </Link>


            <Link
              href="/public-map"
              className={`rounded-lg px-4 py-2.5 text-xs transition ${
                isActive("/public-map")
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
              }`}
            >
              Public Map
            </Link>


            <Link
              href="/history"
              className={`rounded-lg px-4 py-2.5 text-xs transition ${
                isActive("/history")
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
              }`}
            >
              History
            </Link>


            <Link
              href="/about"
              className={`rounded-lg px-4 py-2.5 text-xs transition ${
                isActive("/about")
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
              }`}
            >
              About
            </Link>

          </nav>


          {/* NOTIFICATIONS */}
          <button
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <span className="text-sm">
              ◌
            </span>

            <span className="hidden sm:inline">
              Notifications
            </span>
          </button>

        </div>

      </header>


      {/* =========================
          MOBILE NAVIGATION
      ========================== */}

      <div className="border-b border-slate-100 bg-white md:hidden">

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2">

          <Link
            href="/"
            className={`shrink-0 rounded-lg px-4 py-2.5 text-xs ${
              isActive("/")
                ? "bg-blue-50 font-semibold text-blue-700"
                : "font-medium text-slate-600"
            }`}
          >
            Home
          </Link>


          <Link
            href="/public-map"
            className={`shrink-0 rounded-lg px-4 py-2.5 text-xs ${
              isActive("/public-map")
                ? "bg-blue-50 font-semibold text-blue-700"
                : "font-medium text-slate-600"
            }`}
          >
            Public Map
          </Link>


          <Link
            href="/history"
            className={`shrink-0 rounded-lg px-4 py-2.5 text-xs ${
              isActive("/history")
                ? "bg-blue-50 font-semibold text-blue-700"
                : "font-medium text-slate-600"
            }`}
          >
            History
          </Link>


          <Link
            href="/about"
            className={`shrink-0 rounded-lg px-4 py-2.5 text-xs ${
              isActive("/about")
                ? "bg-blue-50 font-semibold text-blue-700"
                : "font-medium text-slate-600"
            }`}
          >
            About
          </Link>

        </nav>

      </div>
    </>
  );
}