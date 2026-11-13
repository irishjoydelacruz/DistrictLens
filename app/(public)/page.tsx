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

function PublicPortal() {
  // Opened from the footer on another page, e.g. /?section=about
  const requested = useSearchParams().get("section");

  const [activeSection, setActiveSection] = useState<Section>(
    sections.includes(requested as Section) ? (requested as Section) : "home",
  );
  const [selectedReportId, setSelectedReportId] = useState<number | null>(
    null,
  );

  // Switch section, clear any selected incident, and start at the top of the
  // new page. Used by the nav bar and by the Home, About, and Contact buttons.
  const handleSectionChange = (section: Section) => {
    setSelectedReportId(null);
    setActiveSection(section);
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

  // Footer links while this page is already open.
  useEffect(() => {
    const onPortalNavigate = (event: Event) => {
      const section = (event as CustomEvent<Section>).detail;
      if (!sections.includes(section)) return;

      setSelectedReportId(null);
      setActiveSection(section);
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