import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetchers,
  useLocation,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/root";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { RouteLoadingSkeleton } from "./components/ui/RouteLoadingSkeleton";
import { ToastProvider } from "./components/ui/ToastProvider";
import { getSettings } from "./lib/settings.server";
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
  const fetchers = useFetchers();
  const location = useLocation();

  const navigationMethod = navigation.formMethod?.toLowerCase();
  const isContentNavigation =
    navigation.state !== "idle" &&
    (!navigationMethod || navigationMethod === "get");
  const isActionNavigation =
    navigation.state !== "idle" &&
    Boolean(navigationMethod && navigationMethod !== "get");
  const isFetcherLoading = fetchers.some((fetcher) => {
    if (fetcher.state === "idle") {
      return false;
    }

    const method = fetcher.formMethod?.toLowerCase();
    return !method || method === "get";
  });
  const shouldShowSkeleton = isContentNavigation || isFetcherLoading;
  const shouldShowSpinner = isActionNavigation;
  const shouldShowOverlay = shouldShowSkeleton || shouldShowSpinner;
  const [isLoading, setIsLoading] = useState(false);
  const loadingPath = navigation.location?.pathname ?? location.pathname;
  const skeletonVariant = loadingPath.startsWith("/portal/admin")
    ? "admin"
    : loadingPath.startsWith("/portal")
      ? "portal"
      : "public";

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
    <ToastProvider>
      <Outlet />
      <RouteLoadingSkeleton
        isLoading={isLoading && shouldShowSkeleton}
        variant={skeletonVariant}
        label={isContentNavigation ? "Loading page" : "Loading content"}
      />
      <LoadingSpinner isLoading={isLoading && shouldShowSpinner} label="Processing" />
    </ToastProvider>
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
