// app/routes/portal/_layout.tsx
// Auth-gated layout for all /portal/* routes.
// Every nested portal route gets requireUser for free via this loader.

import {
  Outlet,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  Link,
  type LoaderFunctionArgs,
} from "react-router";
import { requireUser } from "~/lib/auth.server";
import { PortalSidebar } from "~/components/layout/PortalSidebar";

export async function loader({ request }: LoaderFunctionArgs) {
  // This is the single auth gate. All portal child loaders can call
  // requireUser independently, but this ensures the layout never renders
  // for unauthenticated users.
  const { user } = await requireUser(request);
  return {
    userId:    user.id,
    firstName: user.firstName,
    lastName:  user.lastName,
    role:      user.role as "ADMIN" | "CELL_LEADER" | "MEMBER",
    email:     user.email,
  };
}

export default function PortalLayout() {
  const user = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-dvh bg-gray-50 md:h-dvh md:overflow-hidden">
      <PortalSidebar
        userRole={user.role}
        userName={`${user.firstName} ${user.lastName}`}
      />
      <div className="flex-1 md:overflow-y-auto">
        <main id="main-content" className="min-h-full pt-18 md:pt-0">
          <Outlet context={user} />
        </main>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is403 = isRouteErrorResponse(error) && error.status === 403;
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full bg-red-50 border border-red-100
                     flex items-center justify-center mx-auto mb-4"
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="#be123c" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          {is403 ? "Access Denied" : "Portal Unavailable"}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {is403
            ? "You don't have permission to view this page."
            : isRouteErrorResponse(error)
            ? error.data
            : "Something went wrong. Please try again."}
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            to="/auth/login"
            className="px-5 py-2.5 bg-red-700 text-white font-bold text-sm
                       rounded-lg hover:bg-red-800 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 border border-gray-200 text-gray-600
                       font-bold text-sm rounded-lg hover:border-gray-300
                       transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
