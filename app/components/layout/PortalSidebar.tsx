import { useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router";

import { Sheet, SheetContent } from "~/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const DashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="10" y="1" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="1" y="10" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="10" y="10" width="7" height="7" rx="1.5" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="1" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="m5 9 3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1 16c0-3.3 2.7-6 6-6s6 2.7 6 6M13 4a3 3 0 0 1 0 6m3 6a5 5 0 0 0-3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const QuoteBubbleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3 3h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 15 13H8l-4.5 3v-3.5A1.5 1.5 0 0 1 2 11V4.5A1.5 1.5 0 0 1 3.5 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6 6.5h2v2H6.7c.1.8.5 1.2 1.3 1.3V11c-1.6-.1-2.5-1-2.5-2.6V6.5Zm4.5 0h2v2h-1.3c.1.8.5 1.2 1.3 1.3V11c-1.6-.1-2.5-1-2.5-2.6V6.5Z" fill="currentColor" />
  </svg>
);

const SparkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="m9 1.5 1.7 4.5 4.8 1.3-4.8 1.3L9 13.1 7.3 8.6 2.5 7.3 7.3 6 9 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m14.5 11.5.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" fill="currentColor" />
  </svg>
);

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1.5 16c0-4 3.4-7 7.5-7s7.5 3 7.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PrayerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M5 2.5v4l2 2V5.5L5 2.5Zm8 0v4l-2 2V5.5l2-3Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m7 8.5 2 2 2-2 2 2.5-4 5-4-5L7 8.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="1.5" y="3" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="m2.5 5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MinistryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2 16h14M3.5 16V6.5L9 3l5.5 3.5V16M7 16v-4h4v4M6 8h.01M9 8h.01M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2" y="3.5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5.5 2v3M12.5 2v3M2 7h14M5.5 10h.01M9 10h.01M12.5 10h.01M5.5 13h.01M9 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ClipboardCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M6 3H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 16h10a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 14 3h-2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="6" y="1.5" width="6" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="m6 10 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.5 3v-3.2A1.5 1.5 0 0 1 2 9.5v-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6 14.5h5l3.5 2v-3.2a1.5 1.5 0 0 0 1.5-1.5v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2 16h14M3.5 14V9M8 14V4M12.5 14V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="m7.5 2 .3 1.4a5.8 5.8 0 0 0-1.2.7l-1.3-.6-1.5 1.5.6 1.3a5.8 5.8 0 0 0-.5 1.3L2.5 8v2l1.4.4a5.8 5.8 0 0 0 .5 1.3l-.6 1.3 1.5 1.5 1.3-.6a5.8 5.8 0 0 0 1.2.7L7.5 16h2l.3-1.4a5.8 5.8 0 0 0 1.2-.7l1.3.6 1.5-1.5-.6-1.3a5.8 5.8 0 0 0 .5-1.3l1.3-.4V8l-1.3-.4a5.8 5.8 0 0 0-.5-1.3l.6-1.3-1.5-1.5-1.3.6a5.8 5.8 0 0 0-1.2-.7L9.5 2h-2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: "/portal/dashboard", label: "Dashboard", icon: <DashIcon /> },
  { to: "/portal/attendance", label: "Attendance", icon: <CheckIcon /> },
  { to: "/portal/directory", label: "Directory", icon: <UsersIcon /> },
  { to: "/portal/community", label: "Shared Reflections", icon: <QuoteBubbleIcon /> },
  { to: "/portal/engagement", label: "Engage", icon: <SparkIcon /> },
  { to: "/portal/profile", label: "My Profile", icon: <PersonIcon /> },
];

const ADMIN_NAV = [
  { to: "/portal/admin/prayers", label: "Prayer Requests", icon: <PrayerIcon /> },
  { to: "/portal/admin/cell-groups", label: "Cell Groups", icon: <UsersIcon /> },
  { to: "/portal/admin/email-queue", label: "Email Queue", icon: <MailIcon /> },
  { to: "/portal/admin/members", label: "Members", icon: <PersonIcon /> },
  { to: "/portal/admin/attendees", label: "Attendee Profiles", icon: <UsersIcon /> },
  { to: "/portal/admin/ministries", label: "Ministries", icon: <MinistryIcon /> },
  { to: "/portal/admin/events", label: "Events", icon: <CalendarIcon /> },
  { to: "/portal/admin/visit-plans", label: "Visit Plans", icon: <ClipboardCheckIcon /> },
  { to: "/portal/admin/posts", label: "Reflection Review", icon: <ChatIcon /> },
  { to: "/portal/admin/reports", label: "Reports", icon: <ChartIcon /> },
  { to: "/portal/admin/settings", label: "Settings", icon: <SettingsIcon /> },
];

interface PortalSidebarProps {
  userRole: "ADMIN" | "CELL_LEADER" | "USHER" | "MEMBER" | "ATTENDEE";
  userName: string;
}

function SidebarContent({
  userRole,
  userName,
  onNavigate,
  onClose,
}: PortalSidebarProps & { onNavigate?: () => void; onClose?: () => void }) {
  const location = useLocation();
  const isPortalActive = (to: string) => location.pathname === to;
  const isAdminActive = (to: string) => location.pathname.startsWith(to);

  const roleLabel =
    userRole === "ADMIN"
      ? "Administrator"
      : userRole === "CELL_LEADER"
        ? "Cell Leader"
        : userRole === "USHER"
          ? "Usher"
          : userRole === "ATTENDEE"
            ? "Attendee"
            : "Member";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const isMemberPortalRole = userRole === "MEMBER" || userRole === "ATTENDEE";
  const attendanceNavItem =
    userRole === "CELL_LEADER"
      ? NAV_ITEMS[1]!
      : { ...NAV_ITEMS[1]!, to: "/portal/attendance-entry", label: "Attendance & Check-in" };
  const primaryNavItems = [
    NAV_ITEMS[0]!,
    ...(isMemberPortalRole ? NAV_ITEMS.slice(2) : [attendanceNavItem, ...NAV_ITEMS.slice(2)]),
  ];

  const navLinkClass = (active: boolean) =>
    [
      "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
      active
        ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-bold shadow-sm"
        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
    ].join(" ");

  const sectionLabelClass =
    "mb-2 px-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--card)] text-[var(--foreground)]">
      <div className="safe-top" />
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 pb-5 pt-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          aria-label="Powerhouse Church home"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 p-1 shadow-sm">
            <img src="/logo_red.webp" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block font-serif text-base font-semibold leading-tight text-[var(--foreground)] transition-colors group-hover:text-[var(--primary)]">
              Powerhouse Church
            </span>
            <span className="mt-1 block font-sans text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Members Portal
            </span>
          </span>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Close portal navigation"
            data-sheet-autofocus
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
        aria-label="Portal navigation"
      >
        <section aria-labelledby="portal-nav-heading">
          <h2 id="portal-nav-heading" className={sectionLabelClass}>
            Your space
          </h2>
          <ul className="space-y-1" role="list">
            {primaryNavItems.map(({ to, label, icon }) => {
              const active = isPortalActive(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={onNavigate}
                    className={navLinkClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className={active ? "text-[var(--inverse-accent)]" : "text-[var(--primary)]"}>
                      {icon}
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {userRole === "ADMIN" ? (
          <section className="mt-7 border-t border-[var(--border)] pt-5" aria-labelledby="admin-nav-heading">
            <h2 id="admin-nav-heading" className={sectionLabelClass}>
              Admin
            </h2>
            <ul className="space-y-1" role="list">
              {ADMIN_NAV.map(({ to, label, icon }) => {
                const active = isAdminActive(to);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      onClick={onNavigate}
                      className={[navLinkClass(active), "pl-4"].join(" ")}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className={active ? "text-[var(--inverse-accent)]" : "text-[var(--primary)]"}>
                        {icon}
                      </span>
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </nav>

      <div className="border-t border-[var(--border)] px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--muted)] font-sans text-sm font-bold text-[var(--primary)]"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-sm font-bold text-[var(--foreground)]">
              {userName}
            </p>
            <p className="font-sans text-xs text-[var(--muted-foreground)]">{roleLabel}</p>
          </div>
        </div>
        <Link
          to="/auth/logout"
          onClick={onNavigate}
          className="mt-3 inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
        >
          Sign out <span className="ml-2" aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="safe-bottom" />
    </div>
  );
}

export function PortalSidebar({ userRole, userName }: PortalSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const mobileMenuTitleId = useId();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const activeItem = [...NAV_ITEMS, ...ADMIN_NAV].find(({ to }) =>
    to.startsWith("/portal/admin/")
      ? location.pathname.startsWith(to)
      : location.pathname === to,
  );
  const mobileTitle = activeItem?.label ?? "Portal";

  return (
    <>
      <aside
        className="sticky top-0 hidden h-dvh w-56 shrink-0 border-r border-[var(--border)] shadow-[8px_0_30px_-28px_rgba(53,25,16,0.45)] md:flex"
        aria-label="Portal sidebar"
      >
        <SidebarContent userRole={userRole} userName={userName} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)]/95 px-3 shadow-sm backdrop-blur-xl md:hidden">
        <div className="safe-top" />
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--primary)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="portal-mobile-menu"
          aria-label={mobileOpen ? "Close portal navigation" : "Open portal navigation"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="min-w-0 truncate font-serif text-lg font-semibold text-[var(--foreground)]">
          {mobileTitle}
        </span>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id="portal-mobile-menu"
          labelledBy={mobileMenuTitleId}
          className="left-0 right-auto! max-w-[min(20rem,88vw)]! border-l-0 border-r border-[var(--border)] bg-[var(--card)] p-0"
        >
          <h2 id={mobileMenuTitleId} className="sr-only">
            Portal navigation
          </h2>
          <SidebarContent
            userRole={userRole}
            userName={userName}
            onNavigate={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
