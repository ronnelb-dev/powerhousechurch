// app/components/layout/PortalSidebar.tsx
// Mobile: slide-in drawer from left with backdrop and focus trap
// Desktop: sticky sidebar, full height, min-h-dvh for correct mobile chrome
// All nav items ≥52px touch targets
// Active state: yellow left border accent

import { Link, useLocation } from "react-router";
import { useState, useEffect, useRef } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const DashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="1"
      y="1"
      width="7"
      height="7"
      rx="1.5"
      fill="currentColor"
      opacity="0.9"
    />
    <rect
      x="10"
      y="1"
      width="7"
      height="7"
      rx="1.5"
      fill="currentColor"
      opacity="0.9"
    />
    <rect
      x="1"
      y="10"
      width="7"
      height="7"
      rx="1.5"
      fill="currentColor"
      opacity="0.9"
    />
    <rect
      x="10"
      y="10"
      width="7"
      height="7"
      rx="1.5"
      fill="currentColor"
      opacity="0.9"
    />
  </svg>
);
const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="1"
      y="3"
      width="16"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 9l3 3 5-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const UsersIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M1 16c0-3.3 2.7-6 6-6s6 2.7 6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13 4a3 3 0 0 1 0 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M16 16a5 5 0 0 0-3-4.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
const BookIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M7 6h4M7 9h4M7 12h2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
const SparkIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M9 1.5 10.7 6l4.8 1.3-4.8 1.3L9 13.1 7.3 8.6 2.5 7.3 7.3 6 9 1.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 11.5 15.3 13.5l2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8 0.8-2Z"
      fill="currentColor"
    />
  </svg>
);
const CareIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M9 15.2 2.6 8.9a3.9 3.9 0 0 1 5.5-5.5L9 4.3l0.9-0.9a3.9 3.9 0 1 1 5.5 5.5L9 15.2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);
const PersonIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M1.5 16c0-4 3.4-7 7.5-7s7.5 3 7.5 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: "/portal/dashboard", label: "Dashboard", icon: <DashIcon /> },
  { to: "/portal/attendance", label: "Attendance", icon: <CheckIcon /> },
  { to: "/portal/directory", label: "Directory", icon: <UsersIcon /> },
  { to: "/portal/community", label: "Community", icon: <BookIcon /> },
  { to: "/portal/engagement", label: "Engage", icon: <SparkIcon /> },
  { to: "/portal/profile", label: "My Profile", icon: <PersonIcon /> },
];

interface PortalSidebarProps {
  userRole: "ADMIN" | "CELL_LEADER" | "MEMBER";
  userName: string;
}

function SidebarContent({
  userRole,
  userName,
  onClose,
}: PortalSidebarProps & { onClose?: () => void }) {
  const location = useLocation();
  const isActive = (to: string) => location.pathname === to;

  const roleLabel =
    userRole === "ADMIN"
      ? "Administrator"
      : userRole === "CELL_LEADER"
        ? "Cell Leader"
        : "Member";

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const primaryNavItems: NavItem[] = [
    NAV_ITEMS[0]!,
    ...(userRole === "CELL_LEADER"
      ? [{ to: "/portal/care", label: "Care Queue", icon: <CareIcon /> }]
      : []),
    ...(userRole === "MEMBER"
      ? NAV_ITEMS.slice(2)
      : NAV_ITEMS.slice(1)),
  ];

  return (
    <div className="flex flex-col h-full bg-red-900 text-white">
      {/* Header */}
      <div className="safe-top" />
      <div className="flex items-start justify-between gap-3 border-b border-red-800/60 px-4 pb-4 pt-5">
        <Link
          to="/"
          className="block group focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
          onClick={onClose}
        >
          <p
            className="font-serif text-white font-bold text-base leading-tight
                        group-hover:text-yellow-300 transition-colors"
          >
            Powerhouse Church
          </p>
          <p className="font-sans text-red-300 text-xs tracking-wider uppercase mt-0.5">
            Members Portal
          </p>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-800 text-red-200 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
            aria-label="Close navigation"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto py-3 px-2"
        aria-label="Portal navigation"
      >
        <ul role="list" className="space-y-0.5">
          {primaryNavItems.map(({ to, label, icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={onClose}
                className={[
                  "flex items-center gap-3 px-3 min-h-13 rounded-xl",
                  "font-sans font-bold text-sm transition-all duration-150",
                  "border-l-4 focus:outline-none focus:ring-2 focus:ring-yellow-400/50",
                  isActive(to)
                    ? "border-yellow-400 bg-white/15 text-white"
                    : "border-transparent text-red-200 hover:bg-white/10 hover:text-white",
                ].join(" ")}
                aria-current={isActive(to) ? "page" : undefined}
              >
                <span
                  className={isActive(to) ? "text-yellow-300" : "text-red-300"}
                >
                  {icon}
                </span>
                {label}
              </Link>
            </li>
          ))}

          {/* Admin sub-nav */}
          {userRole === "ADMIN" && (
            <>
              <li>
                <div className="px-3 py-2">
                  <p className="text-xs font-bold tracking-[0.15em] uppercase text-red-400">
                    Admin
                  </p>
                </div>
              </li>
              {[
                { to: "/portal/care", label: "Care Queue" },
                { to: "/portal/admin/cell-groups", label: "Cell Groups" },
                { to: "/portal/admin/kids-ministry", label: "Kids Ministry" },
                { to: "/portal/admin/communications", label: "Communications" },
                { to: "/portal/admin/email-queue", label: "Email Queue" },
                { to: "/portal/admin/members", label: "Members" },
                { to: "/portal/admin/ministries", label: "Ministries" },
                { to: "/portal/admin/sermons", label: "Preaching" },
                { to: "/portal/admin/events", label: "Events" },
                { to: "/portal/admin/visit-plans", label: "Visit Plans" },
                { to: "/portal/admin/posts", label: "Community" },
                { to: "/portal/admin/reports", label: "Reports" },
                { to: "/portal/admin/settings", label: "Settings" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={onClose}
                    className={[
                      "flex items-center px-3 min-h-11 rounded-xl ml-4",
                      "font-sans text-sm transition-all duration-150 border-l-4",
                      "focus:outline-none focus:ring-2 focus:ring-yellow-400/50",
                      location.pathname.startsWith(to)
                        ? "border-yellow-400 bg-white/15 text-white font-bold"
                        : "border-transparent text-red-300 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                    aria-current={
                      location.pathname.startsWith(to) ? "page" : undefined
                    }
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-red-800/60 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full bg-red-700 border border-red-600
                       flex items-center justify-center text-sm font-bold
                       text-white font-sans shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white font-sans truncate">
              {userName}
            </p>
            <p className="text-xs text-red-300 font-sans">{roleLabel}</p>
          </div>
        </div>
        <Link
          to="/auth/logout"
          className="inline-flex items-center min-h-11 text-xs font-sans
                     text-red-300 hover:text-white transition-colors
                     focus:outline-none focus:text-white"
        >
          Sign out →
        </Link>
      </div>
      <div className="safe-bottom" />
    </div>
  );
}

export function PortalSidebar({ userRole, userName }: PortalSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasMobileOpenRef = useRef(false);

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent scroll when open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Trap focus inside the mobile drawer while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpenRef.current = true;
      window.setTimeout(() => {
        const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }, 0);
      return;
    }

    if (wasMobileOpenRef.current) {
      wasMobileOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 sticky top-0"
        style={{ height: "100dvh" }}
        aria-label="Portal sidebar"
      >
        <SidebarContent userRole={userRole} userName={userName} />
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-red-900 flex items-center px-4 shadow-lg">
        <div className="safe-top" />
        <button
          ref={menuButtonRef}
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="portal-mobile-menu"
          aria-label="Open navigation"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 5h16M2 10h16M2 15h10"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <span className="ml-3 font-serif text-white font-bold text-base">
          Portal
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id="portal-mobile-menu"
            className="fixed top-0 left-0 z-50 w-[min(280px,85vw)] md:hidden"
            style={{ height: "100dvh" }}
            role="dialog"
            aria-modal="true"
            aria-label="Portal navigation"
          >
            <SidebarContent
              userRole={userRole}
              userName={userName}
              onClose={closeMobileMenu}
            />
          </div>
        </>
      )}
    </>
  );
}
