// app/routes/live.tsx
import { useLoaderData, isRouteErrorResponse, useRouteError } from "react-router";
import type { MetaFunction } from "react-router";
import { getSettings } from "~/lib/settings.server";
import { db } from "~/lib/db.server";

export const meta: MetaFunction = () => [
  { title: "Watch Live — Powerhouse Church" },
  {
    name: "description",
    content: "Watch Powerhouse Church live on Sunday mornings. Two services: 7:00 AM and 9:00 AM.",
  },
];

export async function loader() {
  const [settings, latestSermon] = await Promise.all([
    getSettings(),
    db.sermon.findFirst({
      where: { isPublished: true },
      orderBy: { date: "desc" },
      select: { id: true, title: true, speaker: true, videoUrl: true, date: true },
    }),
  ]);

  return {
    settings,
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

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const vid =
      u.searchParams.get("v") ||
      (u.hostname === "youtu.be" ? u.pathname.slice(1) : null);
    return vid ? `https://www.youtube.com/embed/${vid}?autoplay=1` : null;
  } catch {
    return null;
  }
}

export default function LivePage() {
  const { settings, latestSermon } = useLoaderData<typeof loader>();

  const liveUrl =
    settings["YOUTUBE_LIVESTREAM_URL"] ||
    settings["youtube.live"] ||
    process.env.YOUTUBE_LIVESTREAM_URL;

  const fbUrl =
    settings["FACEBOOK_LIVESTREAM_URL"] ||
    settings["facebook.live"];

  const embedUrl = liveUrl ? getYouTubeEmbedUrl(liveUrl) : null;

  const service1 = settings["service.sunday1"] ?? "7:00 AM";
  const service2 = settings["service.sunday2"] ?? "9:00 AM";

  return (
    <div className="pt-20 bg-gray-950 min-h-screen">
      {/* Live header */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600
                       text-white text-xs font-sans font-bold rounded-full
                       animate-pulse"
            aria-label="Live broadcast indicator"
          >
            <span
              className="w-2 h-2 rounded-full bg-white"
              aria-hidden="true"
            />
            LIVE
          </span>
          <p className="text-gray-400 text-sm font-sans">
            Sundays at {service1} &amp; {service2}
          </p>
        </div>

        <h1 className="font-serif text-3xl md:text-4xl font-bold text-white mb-2">
          Watch Live
        </h1>
        <p className="text-gray-400 font-sans text-base">
          Join us for worship and the Word, wherever you are.
        </p>
      </div>

      {/* Video embed */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div
          className="rounded-2xl overflow-hidden bg-gray-900 border border-gray-800"
          style={{ aspectRatio: "16/9" }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title="Powerhouse Church Live Stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media;
                     gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
              loading="lazy"
            />
          ) : (
            /* Not live — show last recorded sermon */
            latestSermon?.videoUrl && getYouTubeEmbedUrl(latestSermon.videoUrl) ? (
              <iframe
                src={getYouTubeEmbedUrl(latestSermon.videoUrl)!}
                title={`Watch: ${latestSermon.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media;
                       gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                loading="lazy"
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center
                           text-center px-8"
                role="status"
                aria-label="Stream not currently live"
              >
                <div
                  className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700
                             flex items-center justify-center mb-5"
                  aria-hidden="true"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                       stroke="#be123c" strokeWidth="1.5">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
                <p className="text-white font-serif text-xl font-bold mb-2">
                  Service Not Currently Live
                </p>
                <p className="text-gray-400 font-sans text-sm max-w-sm">
                  Join us on Sundays at {service1} or {service2}. Subscribe to
                  our YouTube channel to be notified when we go live.
                </p>
                {settings["social.youtube"] && (
                  <a
                    href={settings["social.youtube"]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 px-5 py-2.5 bg-red-700 text-white font-sans
                               font-bold text-sm rounded-lg hover:bg-red-600
                               transition-colors"
                  >
                    Subscribe on YouTube →
                  </a>
                )}
              </div>
            )
          )}
        </div>

        {/* Info strip below video */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-500 mb-2">
              Service Times
            </p>
            <p className="text-white font-serif text-lg font-bold">
              {service1} &amp; {service2}
            </p>
            <p className="text-gray-400 text-xs font-sans mt-1">Every Sunday</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-500 mb-2">
              Chat &amp; Interact
            </p>
            <p className="text-gray-300 text-sm font-sans">
              Join the conversation on our Facebook page during the live stream.
            </p>
            {settings["social.facebook"] && (
              <a
                href={settings["social.facebook"]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs font-bold text-red-400
                           hover:text-red-300 transition-colors"
              >
                Open Facebook →
              </a>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-500 mb-2">
              Watch Anytime
            </p>
            <p className="text-gray-300 text-sm font-sans">
              All past sermons are available in our archive.
            </p>
            <a
              href="/sermons"
              className="inline-block mt-3 text-xs font-bold text-red-400
                         hover:text-red-300 transition-colors"
            >
              Browse sermons →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-white mb-2">
          Live stream unavailable
        </h1>
        <p className="text-gray-400 text-sm">
          {isRouteErrorResponse(error) ? error.data : "Please try again."}
        </p>
      </div>
    </div>
  );
}