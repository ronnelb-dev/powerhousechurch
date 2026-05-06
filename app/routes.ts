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
  route("events/:eventId/calendar.ics", "routes/events.$eventId.calendar.ts"),

  // Public Site Layout
  layout("routes/_public.tsx", [
    index("routes/_index.tsx"),
    route("about", "routes/about.tsx"),
    route("ministries", "routes/ministries.tsx"),
    route("cell-groups", "routes/cell-groups.tsx"),
    route("events", "routes/events.tsx"),
    route("new-here", "routes/new-here.tsx"),
    route("welcome-inside", "routes/welcome-inside.tsx"),
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
    route("verify-email", "routes/auth/verify-email.tsx"),
    route("forgot-password", "routes/auth/forgot-password.tsx"),
    route("reset-password", "routes/auth/reset-password.tsx"),
    route("logout", "routes/auth/logout.tsx"),
  ]),

  // Portal Layout
  layout("routes/portal/_layout.tsx", [
    ...prefix("portal", [
      index("routes/portal/_index.tsx"),
      route("dashboard", "routes/portal/dashboard.tsx"),
      route("profile", "routes/portal/profile.tsx"),
      route("directory", "routes/portal/directory.tsx"),
      route("community", "routes/portal/community.tsx"),
      route("care", "routes/portal/care.tsx"),
      route("engagement", "routes/portal/engagement.tsx"),
      route("attendance", "routes/portal/attendance.tsx"),

      // Admin sub-layout (nested)
      layout("routes/portal/admin/_layout.tsx", [
        ...prefix("admin", [
          index("routes/portal/admin/_index.tsx"),
          route("cell-groups", "routes/portal/admin/cell-groups.tsx"),
          route("kids-ministry", "routes/portal/admin/kids-ministry.tsx"),
          route("communications", "routes/portal/admin/communications.tsx"),
          route("email-queue", "routes/portal/admin/email-queue.tsx"),
          route("reports", "routes/portal/admin/reports.tsx"),
          route("members", "routes/portal/admin/members.tsx"),
          route("ministries", "routes/portal/admin/ministries.tsx"),
          route("sermons", "routes/portal/admin/sermons.tsx"),
          route("events", "routes/portal/admin/events.tsx"),
          route("visit-plans", "routes/portal/admin/visit-plans.tsx"),
          route("posts", "routes/portal/admin/posts.tsx"),
          route("prayers", "routes/portal/admin/prayers.tsx"),
          route("settings", "routes/portal/admin/settings.tsx"),
        ]),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
