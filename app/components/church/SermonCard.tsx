// app/components/church/SermonCard.tsx
// Used in sermon archive grid and home page "Latest Message" section.
// Entire card is a link for maximum tap area on mobile.
// Thumbnail has an aspect-ratio wrapper to prevent layout shift.
// Tags display max 3, extras truncated.

import { Link } from "react-router";

interface SermonCardProps {
  id:         string;
  title:      string;
  speaker:    string;
  series?:    string | null;
  date:       string; // ISO string
  thumbnail?: string | null;
  tags?:      string; // comma-separated
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

  return (
    <article className="group">
      <Link
        to={`/sermons/${id}`}
        className={[
          "block bg-white border border-gray-100 rounded-2xl overflow-hidden",
          "hover:border-red-200 hover:shadow-md hover:shadow-red-100",
          "active:scale-[0.99]",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2",
        ].join(" ")}
        aria-label={`Listen to sermon: ${title} by ${speaker}, ${formattedDate}`}
      >
        {/* Thumbnail — aspect-ratio wrapper prevents CLS */}
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover
                         group-hover:scale-[1.03] transition-transform duration-300"
            />
          ) : (
            <div
              className={`absolute inset-0 bg-linear-to-br ${gradient}
                          flex items-center justify-center`}
            >
              <span className="text-white/20 font-serif text-6xl font-bold" aria-hidden="true">
                ✝
              </span>
            </div>
          )}

          {/* Play overlay on hover */}
          <div
            className="absolute inset-0 flex items-center justify-center
                       bg-black/0 group-hover:bg-black/20 transition-all duration-200"
            aria-hidden="true"
          >
            <div
              className="w-12 h-12 rounded-full border-2
                         border-transparent group-hover:border-white/70
                         flex items-center justify-center
                         transition-all duration-200"
            >
              <svg
                width="20" height="20" viewBox="0 0 20 20" fill="white"
                className="translate-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <polygon points="5,3 17,10 5,17"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5">
          {series && (
            <p className="font-sans font-bold text-red-600 tracking-[0.12em]
                          uppercase text-[0.65rem] mb-2 truncate">
              {series}
            </p>
          )}

          <h3
            className="font-serif font-bold text-gray-900 leading-snug mb-2
                       line-clamp-2 group-hover:text-red-800 transition-colors"
            style={{ fontSize: "clamp(1rem, 1.5vw + 0.5rem, 1.2rem)" }}
          >
            {title}
          </h3>

          <p className="font-sans text-sm text-gray-400 mb-3">
            {speaker} · {formattedDate}
          </p>

          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Tags">
              {tagList.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="font-sans font-bold text-red-700 bg-red-50
                             border border-red-100 text-xs px-2.5 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}