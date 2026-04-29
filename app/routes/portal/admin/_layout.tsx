// app/routes/portal/admin/_layout.tsx
// Admin-only sub-layout nested inside /portal/_layout.tsx.
// Any non-ADMIN user hitting /portal/admin/* gets a 403.

import {
  Outlet,
  Link,
  useLocation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect, useState } from "react";
import { requireAdmin } from "~/lib/auth.server";
import { Sheet } from "~/components/ui/sheet";

export async function loader({ request }: LoaderFunctionArgs) {
  // requireAdmin throws 403 for non-admins, redirects to /auth/login for guests
  await requireAdmin(request);
  return null;
}

const ADMIN_NAV = [
  { to: "/portal/care", label: "Care Queue"   },
  { to: "/portal/admin/cell-groups", label: "Cell Groups"   },
  { to: "/portal/admin/kids-ministry", label: "Kids Ministry" },
  { to: "/portal/admin/communications", label: "Communications" },
  { to: "/portal/admin/email-queue", label: "Email Queue" },
  { to: "/portal/admin/members",  label: "Members"       },
  { to: "/portal/admin/ministries", label: "Ministries"    },
  { to: "/portal/admin/sermons",  label: "Sermons"       },
  { to: "/portal/admin/events",   label: "Events"        },
  { to: "/portal/admin/visit-plans", label: "Visit Plans" },
  { to: "/portal/admin/posts",    label: "Community"   },
  { to: "/portal/admin/reports",  label: "Reports"       },
  { to: "/portal/admin/settings", label: "Settings"      },
];

export default function AdminLayout() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isActive = (to: string) => location.pathname.startsWith(to);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-full">
      {/* Admin sub-header */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-yellow-400">
              Admin Panel
            </p>
            <p className="mt-1 truncate font-sans text-sm text-gray-300">
              {ADMIN_NAV.find(({ to }) => isActive(to))?.label ?? "Overview"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/portal/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg border border-gray-700 px-3 py-2 text-xs font-sans font-bold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              Portal
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-nav"
              aria-label="Open admin navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="hidden items-center justify-between gap-4 px-6 py-3 lg:flex">
          <div className="flex items-center gap-3">
            <span className="text-xs font-sans font-bold tracking-widest uppercase text-yellow-400">
              Admin Panel
            </span>
            <span className="text-gray-600" aria-hidden="true">|</span>
            <nav className="flex items-center gap-1" aria-label="Admin navigation">
              {ADMIN_NAV.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-sans font-bold transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-yellow-400",
                    isActive(to)
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white",
                  ].join(" ")}
                  aria-current={isActive(to) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            to="/portal/dashboard"
            className="text-xs font-sans text-gray-500 transition-colors hover:text-gray-300"
          >
            ← Back to portal
          </Link>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <div
          id="admin-mobile-nav"
          className="absolute right-0 top-0 h-full w-full max-w-[min(22rem,92vw)] overflow-y-auto border-l border-gray-800 bg-gray-950 p-5 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-yellow-400">
                Admin Panel
              </p>
              <p className="mt-2 text-sm font-sans text-gray-400">
                Choose a section to manage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-800 text-gray-300 transition-colors hover:bg-gray-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Close admin navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav className="mt-6 space-y-2" aria-label="Admin navigation">
            {ADMIN_NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={[
                  "flex min-h-12 items-center rounded-xl px-4 py-3 text-sm font-sans font-bold transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-yellow-400",
                  isActive(to)
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-900 hover:text-white",
                ].join(" ")}
                aria-current={isActive(to) ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-gray-800 pt-5">
            <Link
              to="/portal/dashboard"
              className="inline-flex min-h-11 items-center rounded-lg border border-gray-800 px-4 py-2 text-sm font-sans font-bold text-gray-300 transition-colors hover:bg-gray-900 hover:text-white"
            >
              ← Back to portal
            </Link>
          </div>
        </div>
      </Sheet>

      {/* Admin page content */}
      <div className="max-w-6xl p-4 sm:p-6 md:p-8">
        <Outlet />
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is403 = isRouteErrorResponse(error) && error.status === 403;
  return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100
                      flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="#be123c" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
        {is403 ? "Admin Access Required" : "Admin Panel Unavailable"}
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        {is403
          ? "You need administrator privileges to access this section."
          : "Please refresh the page."}
      </p>
      <Link
        to="/portal/dashboard"
        className="px-5 py-2.5 bg-red-700 text-white font-bold text-sm
                   rounded-lg hover:bg-red-800 transition-colors"
      >
        Return to portal
      </Link>
    </div>
  );
}
