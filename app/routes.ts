import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // Resource Routes
  route("robots.txt", "routes/robots[.txt].tsx"),
  route("sitemap.xml", "routes/sitemap[.xml].tsx"),

  // Public Site Layout
  layout("routes/_public.tsx", [
    index("routes/_index.tsx"),
    route("about", "routes/about.tsx"),
    route("ministries", "routes/ministries.tsx"),
    route("cell-groups", "routes/cell-groups.tsx"),
    route("events", "routes/events.tsx"),
    route("new-here", "routes/new-here.tsx"),
    route("give", "routes/give.tsx"),
    route("live", "routes/live.tsx"),
    route("contact", "routes/contact.tsx"),
    route("prayer-request", "routes/prayer-request.tsx"),
    route("gallery", "routes/gallery.tsx"),

    // Sermons
    ...prefix("sermons", [
      index("routes/sermons/_index.tsx"),
      route(":sermonId", "routes/sermons/$sermonId.tsx"),
    ]),

    // Blog
    ...prefix("blog", [
      index("routes/blog/_index.tsx"),
      route(":slug", "routes/blog/$slug.tsx"),
      route("rss.xml", "routes/blog/rss[.xml].tsx"),
    ]),
  ]),

  // Auth
  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    route("register", "routes/auth/register.tsx"),
    route("logout", "routes/auth/logout.tsx"),
  ]),

  // Portal Layout
  layout("routes/portal/_layout.tsx", [
    ...prefix("portal", [
      index("routes/portal/dashboard.tsx"),
      route("profile", "routes/portal/profile.tsx"),
      route("directory", "routes/portal/directory.tsx"),
      route("community", "routes/portal/community.tsx"),
      route("attendance", "routes/portal/attendance.tsx"),

      // Admin sub-layout (nested)
      layout("routes/portal/admin/_layout.tsx", [
        ...prefix("admin", [
          index("routes/portal/admin/reports.tsx"),
          route("members", "routes/portal/admin/members.tsx"),
          route("sermons", "routes/portal/admin/sermons.tsx"),
          route("events", "routes/portal/admin/events.tsx"),
          route("posts", "routes/portal/admin/posts.tsx"),
          route("prayers", "routes/portal/admin/prayers.tsx"),
          route("settings", "routes/portal/admin/settings.tsx"),
        ]),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
