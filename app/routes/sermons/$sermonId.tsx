// app/routes/sermons/$sermonId.tsx
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  Link,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const sermon = await db.sermon.findFirst({
    where: { id: params.sermonId, isPublished: true },
  });

  if (!sermon) {
    throw new Response("Sermon not found", { status: 404 });
  }

  return {
    sermon: {
      ...sermon,
      date: sermon.date instanceof Date ? sermon.date.toISOString() : sermon.date,
      tags: sermon.tags.split(",").filter(Boolean),
    },
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Sermon Not Found — Powerhouse Church" }];
  const { sermon } = data;
  return [
    { title: `${sermon.title} — Powerhouse Church` },
    { name: "description", content: `${sermon.title} by ${sermon.speaker}` },
    { property: "og:title", content: sermon.title },
    { property: "og:description", content: `A sermon by ${sermon.speaker}` },
    ...(sermon.thumbnail
      ? [{ property: "og:image", content: sermon.thumbnail }]
      : []),
  ];
};

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const vid =
      u.searchParams.get("v") ||
      (u.hostname === "youtu.be" ? u.pathname.slice(1) : null);
    return vid ? `https://www.youtube.com/embed/${vid}` : null;
  } catch {
    return null;
  }
}

export default function SermonDetailPage() {
  const { sermon } = useLoaderData<typeof loader>();
  const embedUrl = sermon.videoUrl ? getYouTubeEmbedUrl(sermon.videoUrl) : null;
  const reflectionPrompts = sermon.reflectionPrompts
    ? sermon.reflectionPrompts.split(/\r?\n/).map((prompt) => prompt.trim()).filter(Boolean)
    : [];

  const formattedDate = new Date(sermon.date).toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="pt-24 pb-20 max-w-4xl mx-auto px-6">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm font-sans" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-gray-400">
          <li><Link to="/sermons" className="hover:text-red-700 transition-colors">Sermons</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-600 truncate max-w-xs">{sermon.title}</li>
        </ol>
      </nav>

      {/* Series + tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {sermon.series && (
          <span className="text-xs font-sans font-bold tracking-widest uppercase
                           text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
            {sermon.series}
          </span>
        )}
        {sermon.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-sans font-bold text-gray-500
                       bg-gray-100 border border-gray-200 px-3 py-1 rounded-full"
          >
            {tag.trim()}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-gray-900
                     leading-tight mb-4">
        {sermon.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-red-700 flex items-center
                        justify-center text-white font-bold font-sans text-sm"
             aria-hidden="true">
          {sermon.speaker.split(" ").pop()?.[0] ?? "P"}
        </div>
        <div>
          <p className="text-sm font-sans font-bold text-gray-800">{sermon.speaker}</p>
          <p className="text-xs text-gray-400 font-sans">{formattedDate}</p>
        </div>
      </div>

      {/* Video embed */}
      {embedUrl ? (
        <div
          className="rounded-2xl overflow-hidden bg-black mb-8"
          style={{ aspectRatio: "16/9" }}
        >
          <iframe
            src={embedUrl}
            title={`Watch: ${sermon.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
          />
        </div>
      ) : sermon.thumbnail ? (
        <div
          className="rounded-2xl overflow-hidden bg-gradient-to-br from-red-700
                     to-red-900 mb-8 flex items-center justify-center"
          style={{ aspectRatio: "16/9" }}
        >
          <img
            src={sermon.thumbnail}
            alt={`${sermon.title} thumbnail`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="rounded-2xl bg-gradient-to-br from-red-700 to-red-900
                     mb-8 flex items-center justify-center"
          style={{ aspectRatio: "16/9" }}
          aria-hidden="true"
        >
          <span className="text-white/20 font-serif text-9xl font-bold">✝</span>
        </div>
      )}

      {/* Audio player */}
      {sermon.audioUrl && (
        <div className="mb-8 p-5 bg-primary-50 border border-primary-200 rounded-xl">
          <p className="text-xs font-sans font-bold tracking-widest uppercase
                        text-red-600 mb-3">
            Listen to the Sermon
          </p>
          <audio
            controls
            className="w-full"
            aria-label={`Audio recording: ${sermon.title}`}
          >
            <source src={sermon.audioUrl} type="audio/mpeg" />
            Your browser does not support audio playback.
          </audio>
        </div>
      )}

      {/* Sermon notes */}
      {sermon.notes && (
        <div className="rich-text max-w-none">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-0.5 bg-red-700 rounded-full" aria-hidden="true" />
            <h2 className="font-serif text-xl font-bold text-gray-800 m-0">
              Sermon Notes
            </h2>
          </div>
          <div
            className="text-gray-700 font-sans text-base leading-relaxed
                       whitespace-pre-wrap"
          >
            {sermon.notes}
          </div>
        </div>
      )}

      {(sermon.weeklyGuide || reflectionPrompts.length > 0 || sermon.scriptureFocus) && (
        <section className="mt-10 rounded-3xl border border-red-100 bg-linear-to-br from-red-50 via-white to-amber-50 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-0.5 bg-red-700 rounded-full" aria-hidden="true" />
            <h2 className="font-serif text-xl font-bold text-gray-900 m-0">
                    Community Tie-In
            </h2>
          </div>

          {sermon.scriptureFocus && (
            <div className="mb-5">
              <p className="text-xs font-sans font-bold uppercase tracking-[0.2em] text-red-700 mb-2">
                Scripture Focus
              </p>
              <p className="text-base font-sans text-gray-800">{sermon.scriptureFocus}</p>
            </div>
          )}

          {sermon.weeklyGuide && (
            <div className="mb-5">
              <p className="text-xs font-sans font-bold uppercase tracking-[0.2em] text-red-700 mb-2">
                Weekly Guide
              </p>
              <div className="whitespace-pre-wrap text-sm font-sans leading-7 text-gray-700">
                {sermon.weeklyGuide}
              </div>
            </div>
          )}

          {reflectionPrompts.length > 0 && (
            <div>
              <p className="text-xs font-sans font-bold uppercase tracking-[0.2em] text-red-700 mb-3">
                Reflection Prompts
              </p>
              <ul className="space-y-3">
                {reflectionPrompts.map((prompt) => (
                  <li
                    key={prompt}
                    className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm font-sans text-gray-700 shadow-sm"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/portal/community"
              className="inline-flex items-center rounded-full bg-red-700 px-4 py-2 text-xs font-sans font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-red-800"
            >
                  Reflect in Community
            </Link>
            <Link
              to="/prayer-request"
              className="inline-flex items-center rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-sans font-bold uppercase tracking-[0.16em] text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
            >
              Ask for Prayer
            </Link>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between">
        <Link
          to="/sermons"
          className="text-sm font-sans font-bold text-red-700 hover:text-red-900
                     transition-colors focus:outline-none focus:underline"
        >
          ← Back to all sermons
        </Link>
        <Link
          to="/prayer-request"
          className="text-sm font-sans font-bold text-gray-500 hover:text-gray-700
                     transition-colors focus:outline-none focus:underline"
        >
          Submit a prayer request →
        </Link>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100
                        flex items-center justify-center mx-auto mb-4"
             aria-hidden="true">
          <span className="font-serif text-2xl text-red-700">✝</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          {is404 ? "Sermon Not Found" : "Unable to Load Sermon"}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {is404
            ? "This sermon may have been removed or is not yet published."
            : "Please try again in a moment."}
        </p>
        <Link
          to="/sermons"
          className="px-5 py-2.5 bg-red-700 text-white font-bold text-sm
                     rounded-lg hover:bg-red-800 transition-colors"
        >
          Browse all sermons
        </Link>
      </div>
    </div>
  );
}
