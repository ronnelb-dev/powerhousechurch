// app/lib/youtube.server.ts
// YouTube Data API v3 utility — server-side only.
//
// Two exported functions:
//   getLiveStream()   → checks if the church channel is currently live
//   getLatestVideo()  → fetches the most recently uploaded video (fallback)
//
// API key is read from:
//   1. The DB Setting row "youtube.apiKey"  (runtime, changeable without deploy)
//   2. process.env.YOUTUBE_API_KEY          (deploy-time fallback)
//
// Channel ID is read from:
//   1. The DB Setting row "youtube.channelId"
//   2. process.env.YOUTUBE_CHANNEL_ID
//
// How live detection works:
//   YouTube Data API search.list accepts eventType=live + type=video + channelId.
//   It returns matching videos whose liveBroadcastContent === "live".
//   A result with items.length > 0 means the channel is currently streaming.
//   Cost: 100 quota units per call (daily free quota = 10,000 units).
//   At 100 units/call, you get 100 calls/day before hitting the quota.
//   With 60-second client polling only during the live page visit, this is fine
//   for a church that streams 2x/Sunday. Caching below further reduces calls.
//
// Caching:
//   In-memory cache (30-second TTL) prevents quota exhaustion when multiple
//   visitors have the live page open simultaneously.
//   Vercel Serverless Functions share memory within a single instance, so
//   this cache is best-effort — it WILL help but doesn't guarantee deduplication
//   across cold starts. For production scale, replace with Vercel KV or Redis.

import { db } from "~/lib/db.server";
import { buildEmbedUrl, parseVideoId } from "~/lib/youtube";

// ── Types ─────────────────────────────────────────────────────────────────

export interface LiveStreamResult {
  isLive:   boolean;
  videoId:  string | null;
  title:    string | null;
  viewers?: number | null;
}

export interface VideoResult {
  videoId: string | null;
  title:   string | null;
}

// ── In-memory cache ───────────────────────────────────────────────────────

interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}

const liveCache: CacheEntry<LiveStreamResult> | null = null;
let   liveCacheEntry: CacheEntry<LiveStreamResult> | null = null;

const CACHE_TTL_MS = 30_000; // 30 seconds

function getCached<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.data;
}

// ── Config helpers ────────────────────────────────────────────────────────

async function getYouTubeConfig(): Promise<{ apiKey: string; channelId: string } | null> {
  // Load from DB first (allows runtime changes without redeploy)
  let apiKey     = process.env.YOUTUBE_API_KEY     ?? "";
  let channelId  = process.env.YOUTUBE_CHANNEL_ID  ?? "";

  try {
    const rows = await db.setting.findMany({
      where: { key: { in: ["youtube.apiKey", "youtube.channelId"] } },
    });
    for (const row of rows) {
      if (row.key === "youtube.apiKey"   && row.value) apiKey    = row.value;
      if (row.key === "youtube.channelId" && row.value) channelId = row.value;
    }
  } catch {
    // DB unavailable — fall back to env vars
  }

  if (!apiKey || !channelId) {
    console.warn(
      "[youtube.server] Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID. " +
      "Set them in .env or in the Admin Settings panel."
    );
    return null;
  }

  return { apiKey, channelId };
}

// ── YouTube API fetch helpers ─────────────────────────────────────────────

const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  id:      { videoId?: string };
  snippet: {
    title:              string;
    liveBroadcastContent: "live" | "upcoming" | "none";
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: { message: string; code: number };
}

async function fetchFromYouTube(endpoint: string, params: Record<string, string>): Promise<YouTubeSearchResponse> {
  const url = new URL(`${YT_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    // 8-second timeout — don't let a slow YouTube API stall the loader
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<YouTubeSearchResponse>;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Checks if the church's YouTube channel is currently live.
 * Returns the live video ID and title if streaming, null otherwise.
 *
 * Uses a 30-second in-memory cache to avoid hammering the quota
 * when multiple visitors load the live page simultaneously.
 */
export async function getLiveStream(): Promise<LiveStreamResult> {
  // Return cached result if still fresh
  const cached = getCached(liveCacheEntry);
  if (cached) return cached;

  const notLive: LiveStreamResult = { isLive: false, videoId: null, title: null };

  const config = await getYouTubeConfig();
  if (!config) {
    return notLive;
  }

  try {
    const data = await fetchFromYouTube("search", {
      part:       "snippet",
      channelId:  config.channelId,
      eventType:  "live",          // only return currently-live videos
      type:       "video",
      maxResults: "1",
      key:        config.apiKey,
    });

    if (data.error) {
      console.error("[youtube.server] API error:", data.error.message);
      return notLive;
    }

    const item = data.items?.[0];

    const result: LiveStreamResult =
      item?.snippet.liveBroadcastContent === "live" && item.id.videoId
        ? { isLive: true,  videoId: item.id.videoId, title: item.snippet.title ?? null, viewers: null }
        : notLive;

    // Cache the result
    liveCacheEntry = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };

    return result;
  } catch (err) {
    console.error("[youtube.server] getLiveStream failed:", err);
    return notLive;
  }
}

/**
 * Returns the most recently uploaded video from the channel.
 * Used as a fallback when not live — shows the latest content
 * instead of the "not currently live" empty state.
 *
 * Cached for 10 minutes — recent uploads don't change that fast.
 */
let latestVideoCache: CacheEntry<VideoResult> | null = null;
const LATEST_CACHE_TTL_MS = 10 * 60_000; // 10 minutes

export async function getLatestVideo(): Promise<VideoResult> {
  const cached = getCached(latestVideoCache);
  if (cached) return cached;

  const empty: VideoResult = { videoId: null, title: null };

  const config = await getYouTubeConfig();
  if (!config) return empty;

  try {
    const data = await fetchFromYouTube("search", {
      part:       "snippet",
      channelId:  config.channelId,
      order:      "date",          // most recent first
      type:       "video",
      maxResults: "1",
      key:        config.apiKey,
    });

    if (data.error) {
      console.error("[youtube.server] API error:", data.error.message);
      return empty;
    }

    const item = data.items?.[0];
    const result: VideoResult = item?.id.videoId
      ? { videoId: item.id.videoId, title: item.snippet.title ?? null }
      : empty;

    latestVideoCache = { data: result, expiresAt: Date.now() + LATEST_CACHE_TTL_MS };
    return result;
  } catch (err) {
    console.error("[youtube.server] getLatestVideo failed:", err);
    return empty;
  }
}

export { buildEmbedUrl, parseVideoId } from "~/lib/youtube";
