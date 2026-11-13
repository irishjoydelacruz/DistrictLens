"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Section =
  | "home"
  | "map"
  | "history"
  | "about"
  | "contact";

type PublicNavigationProps = {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
};

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const links: { id: Section; label: string; icon: ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <NavIcon>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </NavIcon>
    ),
  },
  {
    id: "map",
    label: "Public Map",
    icon: (
      <NavIcon>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </NavIcon>
    ),
  },
  {
    id: "history",
    label: "Incident History",
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </NavIcon>
    ),
  },
  {
    id: "about",
    label: "About Us",
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </NavIcon>
    ),
  },
  {
    id: "contact",
    label: "Contact",
    icon: (
      <NavIcon>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
      </NavIcon>
    ),
  },
];

export default function PublicNavigation({
  activeSection,
  setActiveSection,
}: PublicNavigationProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  const activeLink = links.find((link) => link.id === activeSection) ?? links[0];

  // Close the mobile menu on Escape or when clicking outside of it.
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open]);

  const select = (section: Section) => {
    setActiveSection(section);
    setOpen(false);
  };

  return (
    <nav
      ref={containerRef}
      aria-label="Public portal navigation"
      className="relative border-b border-slate-200 bg-white"
    >
      {/* Mobile: current page + hamburger */}
      <div className="mx-auto flex min-h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 md:hidden">
        <span className="flex items-center gap-2 text-sm font-bold text-[#123D73]">
          {activeLink.icon}
          {activeLink.label}
        </span>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex size-11 items-center justify-center border border-slate-300 bg-white text-[#123D73] transition-colors hover:bg-slate-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {open ? (
              <path d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div
          id="public-mobile-menu"
          className="absolute inset-x-0 top-full z-50 border-b border-slate-300 bg-white md:hidden"
        >
          <ul className="mx-auto max-w-[1600px] divide-y divide-slate-100">
            {links.map((link) => {
              const isActive = activeSection === link.id;

              return (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => select(link.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 border-l-[3px] px-5 text-left text-sm transition-colors ${
                      isActive
                        ? "border-[#123D73] bg-slate-50 font-bold text-[#123D73]"
                        : "border-transparent font-medium text-slate-700 hover:bg-slate-50 hover:text-[#123D73]"
                    }`}
                  >
                    <span className="shrink-0">{link.icon}</span>
                    {link.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Desktop / tablet: full links with icons */}
      <div className="mx-auto hidden max-w-[1600px] justify-center gap-1 px-4 sm:px-6 md:flex lg:px-8">
        {links.map((link) => {
          const isActive = activeSection === link.id;

          return (
            <button
              key={link.id}
              type="button"
              onClick={() => setActiveSection(link.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-14 shrink-0 items-center gap-2 border-b-[3px] px-4 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-[#123D73] bg-slate-50 text-[#123D73]"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-[#123D73]"
              }`}
            >
              <span className="shrink-0">{link.icon}</span>
              {link.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}