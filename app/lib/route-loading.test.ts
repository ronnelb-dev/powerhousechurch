import { describe, expect, it } from "vitest";
import { getRouteSkeletonPage, shouldShowRouteSkeleton } from "./route-loading";

describe("getRouteSkeletonPage", () => {
  it.each([
    ["/", "home"],
    ["/about", "about"],
    ["/events", "events"],
    ["/blog", "blog-index"],
    ["/blog/serving-our-community", "blog-post"],
    ["/linktree", "linktree"],
    ["/auth/login", "login"],
    ["/auth/register", "register"],
    ["/portal", "dashboard"],
    ["/portal/directory", "directory"],
    ["/portal/attendance-entry", "attendance-entry"],
    ["/portal/admin", "admin-dashboard"],
    ["/portal/admin/events", "admin-events"],
    ["/preaching/message-123", "legacy-content"],
    ["/sermons/message-123", "legacy-content"],
  ] as const)("maps %s to the %s skeleton", (pathname, expected) => {
    expect(getRouteSkeletonPage(pathname)).toBe(expected);
  });

  it("normalizes a trailing slash and falls back for unrecognized routes", () => {
    expect(getRouteSkeletonPage("/portal/directory/")).toBe("directory");
    expect(getRouteSkeletonPage("/unknown/page")).toBe("fallback");
  });

  it("shows a full-page skeleton only for navigation to another route", () => {
    expect(shouldShowRouteSkeleton({ navigationState: "loading", currentPath: "/about", nextPath: "/events" })).toBe(true);
    expect(shouldShowRouteSkeleton({ navigationState: "loading", currentPath: "/portal/directory", nextPath: "/portal/directory" })).toBe(false);
    expect(shouldShowRouteSkeleton({ navigationState: "submitting", formMethod: "post", currentPath: "/portal/profile", nextPath: "/portal/profile" })).toBe(false);
    expect(shouldShowRouteSkeleton({ navigationState: "idle", currentPath: "/about", nextPath: "/events" })).toBe(false);
  });
});
