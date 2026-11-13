"use client";

type SidebarProps = {
  activeSection: string;
  setActiveSection: (section: string) => void;
  userRole: string;
  // Number of customer reports waiting for review (shown as a badge).
  customerReportsPending?: number;
};

const menuItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
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
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "customer-reports",
    label: "Customer Reports",
    icon: (
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
      >
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    id: "create-report",
    label: "Create Report",
    icon: (
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
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M12 18v-6" />
        <path d="M9 15h6" />
      </svg>
    ),
  },
  {
    id: "submissions",
    label: "Submissions",
    icon: (
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
      >
        <rect x="4" y="4" width="16" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M8 11h8M8 15h5" />
      </svg>
    ),
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: (
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
      >
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
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
      >
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" rx="0.5" />
        <rect x="13" y="8" width="3" height="10" rx="0.5" />
        <rect x="19" y="4" width="3" height="14" rx="0.5" />
      </svg>
    ),
  },
  {
    id: "users",
    label: "User Management",
    superAdminOnly: true,
    icon: (
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
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 8v6M17 11h6" />
      </svg>
    ),
  },
];

export default function Sidebar({
  activeSection,
  setActiveSection,
  userRole,
  customerReportsPending = 0,
}: SidebarProps) {
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.superAdminOnly) {
      return userRole === "super_admin";
    }

    return true;
  });

  return (
    <nav className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {visibleMenuItems.map((item) => {
          const isActive = activeSection === item.id;
          const badge =
            item.id === "customer-reports" ? customerReportsPending : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={
                badge > 0
                  ? `${item.label}, ${badge} pending`
                  : undefined
              }
              className={`
                relative flex shrink-0 items-center justify-center
                gap-2 border-b-[3px] px-3 py-4 text-sm
                transition-colors duration-300 ease-in-out
                sm:px-4
                ${
                  isActive
                    ? "border-[#123D73] bg-slate-50 font-bold text-[#123D73]"
                    : "border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:font-bold hover:text-[#123D73]"
                }
              `}
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>

              {badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center bg-red-600 px-1.5 text-xs font-bold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}