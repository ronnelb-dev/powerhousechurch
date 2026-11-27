const STATIC_ROUTE_PAGES = {
  "/": "home",
  "/about": "about",
  "/ministries": "ministries",
  "/cell-groups": "cell-groups",
  "/events": "events",
  "/new-here": "new-here",
  "/welcome-inside": "welcome-inside",
  "/give": "give",
  "/live": "live",
  "/contact": "contact",
  "/prayer-request": "prayer-request",
  "/gallery": "gallery",
  "/preaching": "preaching",
  "/sermons": "sermons",
  "/blog": "blog-index",
  "/linktree": "linktree",
  "/auth/login": "login",
  "/auth/register": "register",
  "/auth/forgot-password": "forgot-password",
  "/auth/reset-password": "reset-password",
  "/portal": "dashboard",
  "/portal/dashboard": "dashboard",
  "/portal/profile": "profile",
  "/portal/directory": "directory",
  "/portal/community": "community",
  "/portal/care": "care",
  "/portal/engagement": "engagement",
  "/portal/attendance": "attendance",
  "/portal/attendance-entry": "attendance-entry",
  "/portal/admin": "admin-dashboard",
  "/portal/admin/cell-groups": "admin-cell-groups",
  "/portal/admin/email-queue": "admin-email-queue",
  "/portal/admin/reports": "admin-reports",
  "/portal/admin/members": "admin-members",
  "/portal/admin/attendees": "admin-attendees",
  "/portal/admin/ministries": "admin-ministries",
  "/portal/admin/events": "admin-events",
  "/portal/admin/visit-plans": "admin-visit-plans",
  "/portal/admin/posts": "admin-posts",
  "/portal/admin/prayers": "admin-prayers",
  "/portal/admin/settings": "admin-settings",
} as const;

export type RouteSkeletonPage =
  | (typeof STATIC_ROUTE_PAGES)[keyof typeof STATIC_ROUTE_PAGES]
  | "blog-post"
  | "legacy-content"
  | "fallback";

export function getRouteSkeletonPage(pathname: string): RouteSkeletonPage {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const staticPage = STATIC_ROUTE_PAGES[normalizedPath as keyof typeof STATIC_ROUTE_PAGES];
  if (staticPage) return staticPage;

  if (/^\/blog\/[^/]+$/.test(normalizedPath)) return "blog-post";
  if (/^\/preaching\/[^/]+$/.test(normalizedPath) || /^\/sermons\/[^/]+$/.test(normalizedPath)) {
    return "legacy-content";
  }

  return "fallback";
}

export function shouldShowRouteSkeleton({
  navigationState,
  formMethod,
  currentPath,
  nextPath,
}: {
  navigationState: string;
  formMethod?: string;
  currentPath: string;
  nextPath?: string;
}) {
  const method = formMethod?.toLowerCase();
  const isContentNavigation = navigationState !== "idle" && (!method || method === "get");
  return isContentNavigation && Boolean(nextPath) && nextPath !== currentPath;
}
