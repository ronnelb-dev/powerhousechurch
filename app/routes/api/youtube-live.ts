// app/routes/api/youtube-live.ts
// JSON endpoint polled by the live page every 60 seconds.
// Returns the current live status without a full page reload.
//
// Why a separate API route instead of using a fetcher + loader revalidation?
//   - Loader revalidation re-runs ALL loaders on the page (settings, latestSermon,
//     getLiveStream). We only want to re-check live status.
//   - A dedicated JSON endpoint is cheaper (one YouTube API call, no DB queries)
//     and keeps the polling logic explicit and testable.
//
// Usage:
//   GET /api/youtube-live
//   Response: { isLive: boolean, videoId: string | null, embedUrl: string | null }
//
// Cache-Control: private, no-store
//   We never want CDN/Vercel edge to cache this — it must always be fresh.
//   "private" prevents shared caches; "no-store" prevents any caching at all.

import type { LoaderFunctionArgs } from "react-router";
import { getLiveStream } from "~/lib/youtube.server";
import { buildEmbedUrl } from "~/lib/youtube";

export async function loader({ request }: LoaderFunctionArgs) {
  const result = await getLiveStream();

  const payload = {
    isLive:   result.isLive,
    videoId:  result.videoId,
    title:    result.title,
    embedUrl: result.videoId
      ? buildEmbedUrl(result.videoId, result.isLive) // autoplay only when live
      : null,
  };

  return new Response(JSON.stringify(payload), {
    status:  200,
    headers: {
      "Content-Type":  "application/json",
      // Never cache — live status changes moment to moment
      "Cache-Control": "private, no-store",
      // Allow the live page (same origin) to read this
      "Access-Control-Allow-Origin": new URL(request.url).origin,
    },
  });
}
