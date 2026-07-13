// app/routes/sitemap[.xml].tsx
// Auto-generated sitemap from Prisma data.
// Bracket notation produces the URL /sitemap.xml

import type { LoaderFunctionArgs } from "react-router";
import { db } from "../lib/db.server";

const STATIC_ROUTES = [
  { path: "/",               priority: "1.0", changefreq: "weekly"  },
  { path: "/about",          priority: "0.8", changefreq: "monthly" },
  { path: "/preaching",      priority: "0.9", changefreq: "weekly"  },
  { path: "/events",         priority: "0.8", changefreq: "weekly"  },
  { path: "/ministries",     priority: "0.7", changefreq: "monthly" },
  { path: "/give",           priority: "0.7", changefreq: "monthly" },
  { path: "/contact",        priority: "0.6", changefreq: "monthly" },
  { path: "/prayer-request", priority: "0.6", changefreq: "monthly" },
  { path: "/new-here",       priority: "0.8", changefreq: "monthly" },
  { path: "/live",           priority: "0.7", changefreq: "weekly"  },
  { path: "/cell-groups",    priority: "0.6", changefreq: "monthly" },
  { path: "/gallery",        priority: "0.5", changefreq: "monthly" },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const host = new URL(request.url).origin;
  const now  = new Date().toISOString().slice(0, 10);

  const sermons = await db.sermon.findMany({
    where: { isPublished: true },
    select: { id: true, updatedAt: true },
    orderBy: { date: "desc" },
  });

  const urls: string[] = [];

  // Static routes
  for (const route of STATIC_ROUTES) {
    urls.push(`
  <url>
    <loc>${escapeXml(host + route.path)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`);
  }

  // Preaching pages
  for (const sermon of sermons) {
    const lastmod = sermon.updatedAt instanceof Date
      ? sermon.updatedAt.toISOString().slice(0, 10)
      : String(sermon.updatedAt).slice(0, 10);
    urls.push(`
  <url>
    <loc>${escapeXml(`${host}/preaching/${sermon.id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600", // 1 hour
      "X-Robots-Tag": "noindex",               // sitemap itself doesn't need indexing
    },
  });
}
