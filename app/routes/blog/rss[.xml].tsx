// app/routes/blog/rss[.xml].tsx
// Generates a valid RSS 2.0 feed from all published blog posts.
// Bracket syntax produces the URL /blog/rss.xml

import type { LoaderFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { getSettings } from "~/lib/settings.server";

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

  const [posts, settings] = await Promise.all([
    db.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        title: true, slug: true, excerpt: true,
        content: true, category: true, publishedAt: true,
      },
    }),
    getSettings(),
  ]);

  const churchName = settings["church.name"] ?? "Powerhouse Church";

  const items = posts
    .map((post) => {
      const link     = `${host}/blog/${post.slug}`;
      const pubDate  = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date().toUTCString();
      const desc     = escapeXml(post.excerpt ?? post.content.slice(0, 200));

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${desc}</description>
      <category>${escapeXml(post.category)}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(churchName)} — Blog</title>
    <link>${host}/blog</link>
    <description>Devotionals, announcements, and testimonies from ${escapeXml(churchName)}.</description>
    <language>en-ph</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${host}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type":  "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}