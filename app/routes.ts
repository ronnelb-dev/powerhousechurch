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

  // Standalone social hub
  route("linktree", "routes/linktree.tsx"),

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

    // Preaching
    ...prefix("preaching", [
      index("routes/sermons/_index.tsx"),
      route(":preachingId", "routes/sermons/$sermonId.tsx"),
    ]),

    // Legacy Sermons URLs redirect to the new preaching routes
    route("sermons", "routes/sermons.tsx"),
    route("sermons/:sermonId", "routes/sermon-redirect.tsx"),

    // Blog
    ...prefix("blog", [
      index("routes/blog/_index.tsx"),
      route(":slug", "routes/blog/$slug.tsx"),
      route("rss.xml", "routes/blog/rss[.xml].tsx"),
    ]),
  ]),

] satisfies RouteConfig;
