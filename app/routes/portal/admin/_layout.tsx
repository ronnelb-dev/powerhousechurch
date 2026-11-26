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
import { requireAdmin } from "~/lib/auth.server";

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
  { to: "/portal/admin/sermons",  label: "Preaching"     },
  { to: "/portal/admin/events",   label: "Events"        },
  { to: "/portal/admin/visit-plans", label: "Visit Plans" },
  { to: "/portal/admin/posts",    label: "Community"   },
  { to: "/portal/admin/reports",  label: "Reports"       },
  { to: "/portal/admin/settings", label: "Settings"      },
];

export default function AdminLayout() {
  const location = useLocation();
  const isActive = (to: string) => location.pathname.startsWith(to);
  const currentSection = ADMIN_NAV.find(({ to }) => isActive(to))?.label ?? "Overview";

  return (
    <div className="min-h-full">
      {/* Admin sub-header */}
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-yellow-400">
              Admin Panel
            </p>
            <p className="mt-1 truncate font-sans text-sm text-gray-300">
              {currentSection}
            </p>
          </div>

          <Link
            to="/portal/dashboard"
            className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-gray-700 px-3 py-2 text-xs font-sans font-bold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            Portal
          </Link>
        </div>
      </div>

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
