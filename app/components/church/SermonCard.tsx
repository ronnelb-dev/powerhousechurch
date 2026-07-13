// app/components/church/SermonCard.tsx
// Used in preaching archive grid and home page "Latest Message" section.
// Entire card is a link for maximum tap area on mobile.
// Thumbnail has an aspect-ratio wrapper to prevent layout shift.
// Tags display max 3, extras truncated.

import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

interface SermonCardProps {
  id:         string;
  title:      string;
  speaker:    string;
  series?:    string | null;
  date:       string; // ISO string
  thumbnail?: string | null;
  tags?:      string; // comma-separated
  href?:      string;
  external?:  boolean;
}

const SERIES_GRADIENTS = [
  "from-red-700 to-red-950",
  "from-rose-700 to-red-900",
  "from-red-800 to-rose-950",
  "from-red-600 to-red-900",
] as const;

export function SermonCard({
  id,
  title,
  speaker,
  series,
  date,
  thumbnail,
  tags,
  href,
  external = false,
}: SermonCardProps) {
  const tagList = tags
    ? tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const formattedDate = new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });

  // Cycle gradient by hashing the id
  const gradientIndex =
    id.charCodeAt(id.length - 1) % SERIES_GRADIENTS.length;
  const gradient = SERIES_GRADIENTS[gradientIndex];
  const cardLabel = `Listen to preaching: ${title} by ${speaker}, ${formattedDate}`;
  const cardContent = (
    <Card className="overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_28px_70px_-38px_rgba(53,25,16,0.5)]">
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={`absolute inset-0 bg-linear-to-br ${gradient}
                        flex items-center justify-center`}
          >
            <span className="font-serif text-6xl font-semibold text-white/20" aria-hidden="true">
              ✝
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#1f1614]/75 via-transparent to-transparent" aria-hidden="true" />
        <div className="absolute bottom-4 left-4">
          {series && <Badge>{series}</Badge>}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-300 group-hover:bg-black/15"
          aria-hidden="true"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-white/20 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/25"
          >
            <svg
              width="20" height="20" viewBox="0 0 20 20" fill="white"
              className="translate-x-0.5 opacity-100"
            >
              <polygon points="5,3 17,10 5,17"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="p-5">
        <h3 className="line-clamp-2 font-serif text-2xl font-semibold leading-tight text-[var(--foreground)] transition-colors group-hover:text-[var(--primary)]">
          {title}
        </h3>

        <p className="mt-3 text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {speaker} · {formattedDate}
        </p>

        {tagList.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
            {tagList.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="bg-white/75">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <article className="group">
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          className="block rounded-[var(--radius)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          aria-label={cardLabel}
        >
          {cardContent}
        </a>
      ) : (
        <Link
          to={`/preaching/${id}`}
          className="block rounded-[var(--radius)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          aria-label={cardLabel}
        >
          {cardContent}
        </Link>
      )}
    </article>
  );
}
