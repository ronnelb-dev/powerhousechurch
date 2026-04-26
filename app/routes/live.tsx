// app/routes/live.tsx
// Livestream page with automatic YouTube live detection.
//
// Architecture:
//   Server (loader):
//     1. Calls getLiveStream() → checks YouTube API for an active broadcast
//     2. If not live, calls getLatestVideo() → fetches most recent upload
//     3. Falls back to DB sermon record if YouTube API is unavailable
//
//   Client (component):
//     1. Renders immediately with server-detected state (no flicker)
//     2. Polls /api/youtube-live every 60 seconds via useEffect
//     3. Updates the embed URL in-place when status changes
//        (stream goes live while visitor is on the page)
//     4. Stops polling when the component unmounts or tab loses focus
//
//   The "LIVE" badge is shown ONLY when the YouTube API confirms a live stream.
//   Previously it showed always — which was misleading outside service hours.

import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import type { MetaFunction } from "react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSettings } from "~/lib/settings.server";
import {
  getLiveStream,
  getLatestVideo,
  buildEmbedUrl,
  parseVideoId,
} from "~/lib/youtube.server";
import { db } from "~/lib/db.server";

export const meta: MetaFunction = () => [
  { title: "Watch Live — Powerhouse Church" },
  {
    name: "description",
    content: "Watch Powerhouse Church live on Sunday mornings. Two services: 7:00 AM and 9:00 AM.",
  },
];

export async function loader() {
  const [settings, liveResult, latestYouTubeVideo, latestSermon] = await Promise.all([
    getSettings(),
    getLiveStream(),
    getLatestVideo(),
    db.sermon.findFirst({
      where:   { isPublished: true },
      orderBy: { date: "desc" },
      select:  { id: true, title: true, speaker: true, videoUrl: true, date: true },
    }),
  ]);

  const service1 = settings["service.sunday1"]  ?? "7:00 AM";
  const service2 = settings["service.sunday2"]  ?? "9:00 AM";

  // Determine initial embed source (priority order):
  //   1. YouTube API confirmed live stream
  //   2. Latest YouTube video from the channel
  //   3. Latest sermon video URL from the DB
  //   4. Manual override from Settings table (legacy fallback)
  let initialVideoId:  string | null = null;
  let initialIsLive:   boolean       = false;
  let initialTitle:    string | null = null;

  if (liveResult.isLive && liveResult.videoId) {
    // Currently live — use the live stream
    initialVideoId = liveResult.videoId;
    initialIsLive  = true;
    initialTitle   = liveResult.title;
  } else if (latestYouTubeVideo.videoId) {
    // Not live — show most recent upload from the channel
    initialVideoId = latestYouTubeVideo.videoId;
    initialIsLive  = false;
    initialTitle   = latestYouTubeVideo.title;
  } else if (latestSermon?.videoUrl) {
    // YouTube API unavailable — fall back to DB sermon record
    const parsed = parseVideoId(latestSermon.videoUrl);
    if (parsed) {
      initialVideoId = parsed;
      initialIsLive  = false;
      initialTitle   = latestSermon.title;
    }
  } else {
    // Final fallback — manual URL from settings (legacy)
    const manualUrl =
      settings["youtube.live"] ||
      settings["YOUTUBE_LIVESTREAM_URL"];
    if (manualUrl) {
      const parsed = parseVideoId(manualUrl);
      if (parsed) {
        initialVideoId = parsed;
        initialIsLive  = true; // manual URL = deliberately set = assume live
        initialTitle   = null;
      }
    }
  }

  return {
    settings,
    service1,
    service2,
    initialVideoId,
    initialIsLive,
    initialTitle,
    latestSermon: latestSermon
      ? {
          ...latestSermon,
          date: latestSermon.date instanceof Date
            ? latestSermon.date.toISOString()
            : latestSermon.date,
        }
      : null,
  };
}

// ── Poll response type from /api/youtube-live ─────────────────────────────
interface PollResult {
  isLive:   boolean;
  videoId:  string | null;
  title:    string | null;
  embedUrl: string | null;
}

const POLL_INTERVAL_MS = 60_000; // 60 seconds

// ── Component ─────────────────────────────────────────────────────────────

export default function LivePage() {
  const {
    settings,
    service1,
    service2,
    initialVideoId,
    initialIsLive,
    initialTitle,
  } = useLoaderData<typeof loader>();

  // Client state — updated by polling
  const [videoId, setVideoId]   = useState<string | null>(initialVideoId);
  const [isLive,  setIsLive]    = useState<boolean>(initialIsLive);
  const [title,   setTitle]     = useState<string | null>(initialTitle);

  // Track whether we've been live before so we can show a "stream ended" state
  const wasLive = useRef(initialIsLive);

  // Poll /api/youtube-live on a 60-second interval
  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/youtube-live", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;

      const data: PollResult = await res.json();

      setIsLive(data.isLive);

      if (data.videoId) {
        setVideoId(data.videoId);
        setTitle(data.title);
      }

      if (data.isLive) {
        wasLive.current = true;
      }
    } catch {
      // Network error — silently ignore, keep showing current state
    }
  }, []);

  useEffect(() => {
    // Poll immediately on mount (catches streams that started after SSR)
    poll();

    const timer = setInterval(poll, POLL_INTERVAL_MS);

    // Pause polling when tab is hidden — resumes on focus
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        poll(); // immediate check on return
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [poll]);

  const embedUrl = videoId
    ? buildEmbedUrl(videoId, isLive)
    : null;

  return (
    <div className="bg-gray-950" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* LIVE badge — only shown when confirmed live by the API */}
          {isLive ? (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5
                         bg-red-600 text-white text-sm font-sans font-bold
                         rounded-full animate-pulse"
              aria-label="Currently streaming live"
            >
              <span className="w-2 h-2 rounded-full bg-white" aria-hidden="true" />
              LIVE
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5
                         bg-gray-700 text-gray-300 text-sm font-sans font-bold
                         rounded-full"
              aria-label="Not currently live"
            >
              <span className="w-2 h-2 rounded-full bg-gray-500" aria-hidden="true" />
              RECORDED
            </span>
          )}
          <p className="text-gray-400 text-base font-sans">
            Sundays at {service1} &amp; {service2}
          </p>
        </div>

        <h1
          className="font-serif font-bold text-white mb-2"
          style={{ fontSize: "clamp(1.75rem, 4vw + 0.75rem, 2.75rem)" }}
        >
          {isLive ? "We're Live Now" : "Watch Powerhouse"}
        </h1>
        {title && (
          <p className="text-gray-300 font-sans text-base mb-1 line-clamp-1">
            {title}
          </p>
        )}
        <p className="text-gray-400 font-sans text-base">
          {isLive
            ? "Join us for worship and the Word, wherever you are."
            : "Catch up on our latest message."}
        </p>
      </div>

      {/* Video embed */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div
          className="rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 w-full"
          style={{ aspectRatio: "16/9" }}
        >
          {embedUrl ? (
            /*
              key={videoId} forces the iframe to fully remount when the
              video changes. Without this, changing src on a mounted iframe
              sometimes doesn't update the video on iOS Safari.
            */
            <iframe
              key={videoId}
              src={embedUrl}
              title={isLive ? "Powerhouse Church Live Stream" : (title ?? "Powerhouse Church")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
              loading="lazy"
            />
          ) : (
            /* No video available — church hasn't uploaded anything yet */
            <NotLiveState
              service1={service1}
              service2={service2}
              youtubeUrl={settings["social.youtube"]}
            />
          )}
        </div>

        {/* Live viewer count — only shown during live stream */}
        {isLive && (
          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <p className="text-gray-400 text-sm font-sans">Live now — refresh for viewer count</p>
          </div>
        )}

        {/* Info strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard label="Service Times">
            <p className="text-white font-serif text-lg font-bold">
              {service1} &amp; {service2}
            </p>
            <p className="text-gray-400 text-sm font-sans mt-1">Every Sunday</p>
          </InfoCard>

          <InfoCard label="Chat & Interact">
            <p className="text-gray-300 text-base font-sans">
              Join the conversation on our Facebook page during the live stream.
            </p>
            {settings["social.facebook"] && (
              <a
                href={settings["social.facebook"]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center min-h-[44px] text-base font-bold
                           text-red-400 hover:text-red-300 transition-colors"
              >
                Open Facebook →
              </a>
            )}
          </InfoCard>

          <InfoCard label="Watch Anytime">
            <p className="text-gray-300 text-base font-sans">
              All past sermons are available in our archive.
            </p>
            <a
              href="/sermons"
              className="inline-flex items-center min-h-[44px] text-base font-bold
                         text-red-400 hover:text-red-300 transition-colors"
            >
              Browse sermons →
            </a>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="font-sans font-bold tracking-[0.15em] uppercase text-red-500 text-xs mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function NotLiveState({
  service1,
  service2,
  youtubeUrl,
}: {
  service1:   string;
  service2:   string;
  youtubeUrl?: string;
}) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center
                 text-center px-6"
      role="status"
      aria-label="Stream not currently live"
    >
      <div
        className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700
                   flex items-center justify-center mb-5"
        aria-hidden="true"
      >
        <svg
          width="32" height="32" viewBox="0 0 24 24"
          fill="none" stroke="#be123c" strokeWidth="1.5"
        >
          <polygon points="5,3 19,12 5,21"/>
        </svg>
      </div>
      <p className="text-white font-serif text-xl font-bold mb-3">
        Service Not Currently Live
      </p>
      <p className="text-gray-400 font-sans text-base max-w-sm leading-relaxed">
        Join us on Sundays at {service1} or {service2}. Subscribe to our
        YouTube channel to be notified when we go live.
      </p>
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center
                     min-h-[48px] px-6 py-2 rounded-xl
                     bg-red-700 text-white font-sans font-bold text-base
                     hover:bg-red-600 transition-colors touch-manipulation"
        >
          Subscribe on YouTube →
        </a>
      )}
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-white mb-2">
          Live stream unavailable
        </h1>
        <p className="text-gray-400 text-base">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
      </div>
    </div>
  );
}
