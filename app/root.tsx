import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/root";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { RouteLoadingSkeleton } from "./components/ui/RouteLoadingSkeleton";
import { getRouteSkeletonPage, shouldShowRouteSkeleton } from "./lib/route-loading";
import { getSettings } from "./lib/settings.server";
import "react-toastify/dist/ReactToastify.css";
import "./app.css";

export const links: Route.LinksFunction = () => [
  {
      rel: "preconnect",
      href: "https://fonts.googleapis.com",
    },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap",
    },

];

export async function loader() {
  return { settings: await getSettings() };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only fixed left-4 top-4 z-[100] rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--primary-foreground)]"
        >
          Skip to content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  const location = useLocation();

  const navigationMethod = navigation.formMethod?.toLowerCase();
  const isContentNavigation =
    navigation.state !== "idle" &&
    (!navigationMethod || navigationMethod === "get");
  const isActionNavigation =
    navigation.state !== "idle" &&
    Boolean(navigationMethod && navigationMethod !== "get");
  const shouldShowSkeleton = shouldShowRouteSkeleton({
    navigationState: navigation.state,
    formMethod: navigationMethod,
    currentPath: location.pathname,
    nextPath: navigation.location?.pathname,
  });
  const shouldShowSpinner = isActionNavigation;
  const shouldShowOverlay = shouldShowSkeleton || shouldShowSpinner;
  const [isLoading, setIsLoading] = useState(false);
  const loadingPath = navigation.location?.pathname ?? location.pathname;
  const skeletonPage = getRouteSkeletonPage(loadingPath);

  useEffect(() => {
    if (!shouldShowOverlay) {
      setIsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldShowOverlay]);

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", isLoading);

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isLoading]);

  return (
    <>
      <Outlet />
      <RouteLoadingSkeleton
        isLoading={isLoading && shouldShowSkeleton}
        page={skeletonPage}
        label={isContentNavigation ? "Loading page" : "Loading content"}
      />
      <LoadingSpinner isLoading={isLoading && shouldShowSpinner} label="Processing" />
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar
        newestOnTop
        closeOnClick={false}
        pauseOnFocusLoss
        pauseOnHover
        draggable="touch"
        limit={3}
        theme="light"
        aria-label="Notifications"
        closeButton={({ closeToast }) => (
          <button
            type="button"
            onClick={closeToast}
            aria-label="Dismiss notification"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
