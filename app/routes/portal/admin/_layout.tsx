// app/routes/portal/admin/_layout.tsx
// Admin-only sub-layout nested inside /portal/_layout.tsx.
// Any non-ADMIN user hitting /portal/admin/* gets a 403.

import {
  Outlet,
  Link,
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

export default function AdminLayout() {
  return (
    <div className="min-h-full">
      {/* Admin page content */}
      <div className="mx-auto w-full max-w-8xl p-4 sm:p-6 md:p-8">
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
