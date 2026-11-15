"use client";

import { useEffect, useState } from "react";

// Show the button once the visitor has scrolled this far down (in pixels).
const SHOW_AFTER = 400;

/**
 * Floating "Back to top" button, bottom right.
 * - Appears only after scrolling down, hides again at the top.
 * - Hidden from keyboard and screen readers while it is not visible.
 * - Respects "reduce motion": jumps instead of smooth scrolling.
 * - White with a navy border and arrow, so it stays visible on both the
 *   light page and the navy footer.
 * - 44px tap target, sits above the page but below the modals.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goToTop() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={goToTop}
      aria-label="Back to top"
      title="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-4 right-4 z-30 flex size-11 items-center justify-center rounded-none! border-2 border-[#123D73] bg-white text-[#123D73] shadow-lg transition-all duration-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123D73]/40 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
      style={{
        // Keeps the button clear of the phone's home bar.
        marginBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <svg
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}