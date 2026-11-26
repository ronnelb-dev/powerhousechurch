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
    where: { id: params.preachingId, isPublished: true },
  });

  if (!sermon) {
    throw new Response("Preaching not found", { status: 404 });
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
  if (!data) return [{ title: "Preaching Not Found — Powerhouse Church" }];
  const { sermon } = data;
  return [
    { title: `${sermon.title} — Powerhouse Church` },
    { name: "description", content: `${sermon.title} by ${sermon.speaker}` },
    { property: "og:title", content: sermon.title },
    { property: "og:description", content: `A preaching message by ${sermon.speaker}` },
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
        <ol className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <li><Link to="/preaching" className="transition-colors hover:text-[var(--primary)]">Preaching</Link></li>
          <li aria-hidden="true">/</li>
          <li className="max-w-xs truncate text-[var(--foreground)]">{sermon.title}</li>
        </ol>
      </nav>

      {/* Series + tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {sermon.series && (
          <span className="rounded-full border border-[var(--primary)]/20 bg-[var(--muted)] px-3 py-1 text-xs font-sans font-bold uppercase tracking-widest text-[var(--primary)]">
            {sermon.series}
          </span>
        )}
        {sermon.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-sans font-bold text-[var(--muted-foreground)]"
          >
            {tag.trim()}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-[var(--foreground)]
                     leading-tight mb-4">
        {sermon.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] font-sans text-sm font-bold text-[var(--primary-foreground)]"
             aria-hidden="true">
          {sermon.speaker.split(" ").pop()?.[0] ?? "P"}
        </div>
        <div>
          <p className="text-sm font-sans font-bold text-[var(--foreground)]">{sermon.speaker}</p>
          <p className="text-xs font-sans text-[var(--muted-foreground)]">{formattedDate}</p>
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
          className="mb-8 flex items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--surface-inverse))]"
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
          className="mb-8 flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--surface-inverse))]"
          style={{ aspectRatio: "16/9" }}
          aria-hidden="true"
        >
          <span className="text-white/20 font-serif text-9xl font-bold">✝</span>
        </div>
      )}

      {/* Audio player */}
      {sermon.audioUrl && (
        <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5">
          <p className="mb-3 text-xs font-sans font-bold uppercase tracking-widest text-[var(--primary)]">
            Listen to the Preaching
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

      {/* Preaching notes */}
      {sermon.notes && (
        <div className="rich-text max-w-none">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-0.5 w-8 rounded-full bg-[var(--primary)]" aria-hidden="true" />
            <h2 className="m-0 font-serif text-xl font-bold text-[var(--foreground)]">
              Preaching Notes
            </h2>
          </div>
          <div
            className="font-sans text-base leading-relaxed text-[var(--foreground)]
                       whitespace-pre-wrap"
          >
            {sermon.notes}
          </div>
        </div>
      )}

      {(sermon.weeklyGuide || reflectionPrompts.length > 0 || sermon.scriptureFocus) && (
        <section
          id="weekly-guide"
          className="mt-10 rounded-3xl border border-[var(--border)] bg-[linear-gradient(135deg,var(--muted),var(--card),var(--background))] p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-0.5 w-8 rounded-full bg-[var(--primary)]" aria-hidden="true" />
            <h2 className="m-0 font-serif text-xl font-bold text-[var(--foreground)]">
              Weekly Guide
            </h2>
          </div>

          {sermon.scriptureFocus && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-sans font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
                Scripture Focus
              </p>
              <p className="text-base font-sans text-[var(--foreground)]">{sermon.scriptureFocus}</p>
            </div>
          )}

          {sermon.weeklyGuide && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-sans font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
                Weekly Guide
              </p>
              <div className="whitespace-pre-wrap text-sm font-sans leading-7 text-[var(--foreground)]">
                {sermon.weeklyGuide}
              </div>
            </div>
          )}

          {reflectionPrompts.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-sans font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
                Reflection Prompts
              </p>
              <ul className="space-y-3">
                {reflectionPrompts.map((prompt) => (
                  <li
                    key={prompt}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-sans text-[var(--foreground)] shadow-sm"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/prayer-request"
              className="inline-flex items-center rounded-full border border-[var(--primary)]/25 bg-[var(--card)] px-4 py-2 text-xs font-sans font-bold uppercase tracking-[0.16em] text-[var(--primary)] transition-colors hover:border-[var(--primary)]/45 hover:bg-[var(--muted)]"
            >
              Ask for Prayer
            </Link>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="mt-12 flex justify-between border-t border-[var(--border)] pt-8">
        <Link
          to="/preaching"
          className="text-sm font-sans font-bold text-[var(--primary)] hover:brightness-75
                     transition-colors focus:outline-none focus:underline"
        >
          ← Back to all preaching
        </Link>
        <Link
          to="/prayer-request"
          className="text-sm font-sans font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]
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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--primary)]/20 bg-[var(--muted)]"
             aria-hidden="true">
          <span className="font-serif text-2xl text-[var(--primary)]">✝</span>
        </div>
        <h1 className="mb-2 font-serif text-2xl font-bold text-[var(--foreground)]">
        {is404 ? "Preaching Not Found" : "Unable to Load Preaching"}
        </h1>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">
          {is404
            ? "This preaching message may have been removed or is not yet published."
            : "Please try again in a moment."}
        </p>
        <Link
          to="/preaching"
          className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] transition-colors hover:brightness-110"
        >
          Browse all preaching
        </Link>
      </div>
    </div>
  );
}
