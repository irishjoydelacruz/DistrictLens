"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import Header from "./components/header";
import PublicNavigation from "./components/public-navigation";
import HomeContent from "./components/home-content";
import PublicMapContent from "./components/public-map-content";
import HistoryContent from "./components/history-content";
import AboutContent from "./components/about-content";
import ContactContent from "./components/contact-content";

type Section = "home" | "map" | "history" | "about" | "contact";

const sections: Section[] = ["home", "map", "history", "about", "contact"];

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function parseSection(value: string | null): Section {
  return sections.includes(value as Section) ? (value as Section) : "home";
}

function parseReportId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Keep the address bar in sync with the open section, so reloading the page
// (or sharing the link) opens the same section. Home keeps a clean "/" URL.
function updateUrl(section: Section, reportId: number | null) {
  const params = new URLSearchParams();
  if (section !== "home") params.set("section", section);
  if (section === "history" && reportId !== null) {
    params.set("report", String(reportId));
  }

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;

  if (url === `${window.location.pathname}${window.location.search}`) return;
  window.history.pushState(null, "", url);
}

function PublicPortal() {
  // Opened by URL, e.g. /?section=about from the footer, or after a reload.
  // History can also carry an incident: /?section=history&report=12
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const requestedReport = searchParams.get("report");

  const [activeSection, setActiveSection] = useState<Section>(
    parseSection(requestedSection),
  );
  const [selectedReportId, setSelectedReportId] = useState<number | null>(
    parseSection(requestedSection) === "history"
      ? parseReportId(requestedReport)
      : null,
  );

  // Switch section, clear any selected incident, and start at the top of the
  // new page. Used by the nav bar and by the Home, About, and Contact buttons.
  const handleSectionChange = (section: Section) => {
    setSelectedReportId(null);
    setActiveSection(section);
    updateUrl(section, null);
    scrollToTop();
  };

  // Open History and automatically show the selected incident.
  // Used by both the Map page and the Home page.
  const handleHistoryNavigate = (
    section: "history",
    reportId?: number,
  ) => {
    setSelectedReportId(reportId ?? null);
    setActiveSection(section);
    updateUrl(section, reportId ?? null);
    scrollToTop();
  };

  // Home: "history" can carry a reportId, "map" is a normal section change.
  const handleHomeNavigate = (
    section: "map" | "history",
    reportId?: number,
  ) => {
    if (section === "history") {
      handleHistoryNavigate("history", reportId);
      return;
    }

    handleSectionChange(section);
  };

  // The URL changed from outside this component (for example a footer link
  // opened from another page), so show the section it asks for.
  useEffect(() => {
    const section = parseSection(requestedSection);

    setActiveSection(section);
    setSelectedReportId(
      section === "history" ? parseReportId(requestedReport) : null,
    );
  }, [requestedSection, requestedReport]);

  // Browser Back and Forward buttons.
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const section = parseSection(params.get("section"));

      setActiveSection(section);
      setSelectedReportId(
        section === "history" ? parseReportId(params.get("report")) : null,
      );
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Footer links while this page is already open.
  useEffect(() => {
    const onPortalNavigate = (event: Event) => {
      const section = (event as CustomEvent<Section>).detail;
      if (!sections.includes(section)) return;

      setSelectedReportId(null);
      setActiveSection(section);
      updateUrl(section, null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("portal:navigate", onPortalNavigate);
    return () =>
      window.removeEventListener("portal:navigate", onPortalNavigate);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F9]">
      <Header />

      <PublicNavigation
        activeSection={activeSection}
        setActiveSection={handleSectionChange}
      />

      <div className="flex-1">
        {activeSection === "home" && (
          <HomeContent onNavigate={handleHomeNavigate} />
        )}

        {activeSection === "map" && (
          <PublicMapContent onNavigate={handleHistoryNavigate} />
        )}

        {activeSection === "history" && (
          <HistoryContent selectedReportId={selectedReportId} />
        )}

        {activeSection === "about" && (
          <AboutContent onNavigate={handleSectionChange} />
        )}

        {activeSection === "contact" && (
          <ContactContent onNavigate={handleSectionChange} />
        )}
      </div>
    </div>
  );
}

export default function PublicPortalPage() {
  return (
    <Suspense fallback={null}>
      <PublicPortal />
    </Suspense>
  );
}