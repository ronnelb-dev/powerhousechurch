// app/routes/_public.tsx
// Layout shell for all public-facing pages.
// All public routes are nested under this via React Router's layout route.

import { Outlet, useRouteLoaderData, isRouteErrorResponse, useRouteError } from "react-router";
import { Navbar } from "~/components/layout/Navbar";
import { Footer } from "~/components/layout/Footer";

export default function PublicLayout() {
  const data = useRouteLoaderData("root") as { settings: Record<string, string> };
  const settings = data?.settings ?? {};

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,rgba(146,48,52,0.12),transparent_56%)]" />
        <div className="absolute right-0 top-[32rem] h-80 w-80 rounded-full bg-[rgba(214,162,76,0.12)] blur-3xl" />
        <div className="absolute left-0 top-[80rem] h-96 w-96 rounded-full bg-[rgba(34,73,59,0.08)] blur-3xl" />
      </div>
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer settings={settings} />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404
      ? "This page doesn't exist."
      : (error.data ?? message);
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100
                        flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="#be123c" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <a href="/"
           className="px-5 py-2.5 bg-red-700 text-white font-bold text-sm
                      rounded-lg hover:bg-red-800 transition-colors">
          Go home
        </a>
      </div>
    </div>
  );
}
