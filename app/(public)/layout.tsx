import type { ReactNode } from "react";
import { AlertProvider } from "./components/alert-provider";
import { SubmitReportProvider } from "./components/submit-report-provider";
import { Footer } from "./components/footer";
import "./portal.css";

export default function PublicPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AlertProvider>
      <SubmitReportProvider>
        <div className="public-portal-root flex min-h-screen flex-col">
          {children}
          <Footer />
        </div>
      </SubmitReportProvider>
    </AlertProvider>
  );
}