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
import {
  SERMON_PLAYLISTS,
  type SermonPlaylistKey,
} from "~/lib/sermon-playlists";

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

export interface PlaylistVideoResult {
  id: string;
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string | null;
  playlistId: string;
  playlistKey: SermonPlaylistKey;
  playlistLabel: string;
  playlistDescription: string;
  speaker: string;
  url: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────

interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}

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

async function getYouTubeApiKey(): Promise<string | null> {
  let apiKey = process.env.YOUTUBE_API_KEY ?? "";

  try {
    const row = await db.setting.findUnique({
      where: { key: "youtube.apiKey" },
    });
    if (row?.value) apiKey = row.value;
  } catch {
    // DB unavailable — fall back to env var
  }

  if (!apiKey) {
    console.warn(
      "[youtube.server] Missing YOUTUBE_API_KEY. " +
      "Set it in .env or in the Admin Settings panel."
    );
    return null;
  }

  return apiKey;
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

interface YouTubePlaylistItem {
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: {
      maxres?: { url?: string };
      standard?: { url?: string };
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
  status?: {
    privacyStatus?: string;
  };
}

interface YouTubePlaylistResponse {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
  error?: { message: string; code: number };
}

async function fetchPlaylistPage(
  apiKey: string,
  playlistId: string,
  pageToken?: string,
): Promise<YouTubePlaylistResponse> {
  const url = new URL(`${YT_BASE}/playlistItems`);
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("playlistId", playlistId);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", apiKey);
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<YouTubePlaylistResponse>;
}

function inferSpeaker(title: string, description: string): string {
  const patterns = [
    /(?:speaker|preacher|message(?:\s+by)?|with)[:\s-]+([A-Za-z][A-Za-z.' -]{2,60})/i,
    /\b(?:Ps|Ptr|Pst|Pastor|Bro|Sis)\.?\s+([A-Za-z][A-Za-z.' -]{1,50})/i,
  ];

  for (const pattern of patterns) {
    const match = `${title}\n${description}`.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return "Powerhouse Church";
}

function pickThumbnail(item: YouTubePlaylistItem): string | null {
  const thumbs = item.snippet?.thumbnails;
  return (
    thumbs?.maxres?.url ??
    thumbs?.standard?.url ??
    thumbs?.high?.url ??
    thumbs?.medium?.url ??
    thumbs?.default?.url ??
    null
  );
}

let playlistVideosCache: CacheEntry<PlaylistVideoResult[]> | null = null;
const PLAYLIST_CACHE_TTL_MS = 10 * 60_000; // 10 minutes

export async function getSermonPlaylistVideos(): Promise<PlaylistVideoResult[]> {
  const cached = getCached(playlistVideosCache);
  if (cached) return cached;

  const apiKey = await getYouTubeApiKey();
  if (!apiKey) return [];

  const allVideos = await Promise.all(
    Object.entries(SERMON_PLAYLISTS).map(async ([playlistKey, playlist]) => {
      const videos: PlaylistVideoResult[] = [];
      let pageToken: string | undefined;

      do {
        const data = await fetchPlaylistPage(apiKey, playlist.id, pageToken);
        if (data.error) {
          throw new Error(data.error.message);
        }

        for (const item of data.items ?? []) {
          const videoId = item.contentDetails?.videoId;
          const title = item.snippet?.title?.trim() ?? "";

          if (
            !videoId ||
            !title ||
            title === "Private video" ||
            title === "Deleted video" ||
            item.status?.privacyStatus === "private"
          ) {
            continue;
          }

          const description = item.snippet?.description?.trim() ?? "";

          videos.push({
            id: videoId,
            videoId,
            title,
            description,
            publishedAt:
              item.contentDetails?.videoPublishedAt ??
              item.snippet?.publishedAt ??
              new Date(0).toISOString(),
            thumbnail: pickThumbnail(item),
            playlistId: playlist.id,
            playlistKey: playlistKey as SermonPlaylistKey,
            playlistLabel: playlist.label,
            playlistDescription: playlist.description,
            speaker: inferSpeaker(title, description),
            url: `https://www.youtube.com/watch?v=${videoId}`,
          });
        }

        pageToken = data.nextPageToken;
      } while (pageToken);

      return videos;
    }),
  );

  const deduped = Array.from(
    new Map(
      allVideos
        .flat()
        .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
        .map((video) => [video.videoId, video]),
    ).values(),
  );

  playlistVideosCache = {
    data: deduped,
    expiresAt: Date.now() + PLAYLIST_CACHE_TTL_MS,
  };

  return deduped;
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
