import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { to: "/portal/dashboard",  label: "Dashboard",  icon: "grid"    },
  { to: "/portal/attendance", label: "Attendance", icon: "check"   },
  { to: "/portal/directory",  label: "Directory",  icon: "users"   },
  { to: "/portal/community",  label: "Daily Bread", icon: "book"   },
  { to: "/portal/profile",    label: "My Profile", icon: "person"  },
];

interface PortalSidebarProps {
  userRole: "ADMIN" | "CELL_LEADER" | "MEMBER";
  userName: string;
}

export function PortalSidebar({ userRole, userName }: PortalSidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isActive = (to: string) => location.pathname === to;

  const sidebar = (
    <div className="flex flex-col h-full bg-red-900 text-white">
      {/* Church wordmark */}
      <div className="px-5 py-6 border-b border-red-800">
        <p className="font-serif text-white font-bold text-base leading-tight mb-0.5">
          Powerhouse Church
        </p>
        <p className="text-red-300 text-xs tracking-widest uppercase font-sans">
          Members Portal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Portal navigation">
        <ul role="list">
          {NAV_ITEMS.map(({ to, label }) => (
            <li key={to}>
              <Link
                to={to}
                className={[
                  "flex items-center gap-3 px-5 py-3 text-sm font-sans font-bold",
                  "border-l-4 transition-all duration-150",
                  "focus:outline-none focus:bg-white/10",
                  isActive(to)
                    ? "border-yellow-400 bg-white/10 text-white"
                    : "border-transparent text-red-200 hover:bg-white/8 hover:text-white",
                ].join(" ")}
                aria-current={isActive(to) ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="px-5 py-4 border-t border-red-800">
        <p className="text-xs text-red-300 font-sans font-bold tracking-wide mb-1">
          {userRole.replace("_", " ")}
        </p>
        <p className="text-sm text-white font-sans font-bold truncate mb-3">
          {userName}
        </p>
        <Link
          to="/auth/logout"
          className="text-xs text-red-300 hover:text-white font-sans
                     transition-colors focus:outline-none focus:underline"
        >
          Sign out →
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex w-56 flex-shrink-0 h-screen sticky top-0">
        {sidebar}
      </div>

      {/* Mobile: hamburger + drawer */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 w-10 h-10 rounded-lg bg-red-800
                     flex items-center justify-center shadow-lg
                     focus:outline-none focus:ring-2 focus:ring-yellow-400"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="portal-mobile-menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="white" aria-hidden="true">
            <rect y="3" width="18" height="2" rx="1"/>
            <rect y="8" width="18" height="2" rx="1"/>
            <rect y="13" width="18" height="2" rx="1"/>
          </svg>
        </button>

        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div
              id="portal-mobile-menu"
              className="fixed top-0 left-0 z-50 w-64 h-full shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Portal navigation"
            >
              {sidebar}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default PortalSidebar;