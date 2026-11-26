// app/routes/robots[.txt].tsx
// Bracket notation tells React Router to treat this as a literal filename,
// not a route segment — resulting in the URL /robots.txt

import type { LoaderFunctionArgs } from "react-router";

export function loader({ request }: LoaderFunctionArgs) {
  const host = new URL(request.url).origin;

  const content = `User-agent: *
Allow: /
Disallow: /portal/
Disallow: /auth/

Sitemap: ${host}/sitemap.xml
`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400", // 24 hours
    },
  });
}