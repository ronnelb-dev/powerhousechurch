// app/components/church/EventCard.tsx
// Used on home page strip and /events archive.
// Date badge on the left, title + meta on the right.
// Countdown pill shows "Today!", "In N days", or "Past".
// Red top border accent on the card.

import { Link } from "react-router";

interface EventCardProps {
  id:        string;
  title:     string;
  location:  string;
  startDate: string; // ISO string
  endDate?:  string | null;
  imageUrl?: string | null;
}

function getCountdown(startDate: Date): string {
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0)  return "Past";
  if (diff === 0) return "Today!";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

export function EventCard({
  id,
  title,
  location,
  startDate,
  endDate,
  imageUrl,
}: EventCardProps) {
  const start    = new Date(startDate);
  const month    = start.toLocaleDateString("en-PH", { month: "short" }).toUpperCase();
  const day      = start.getDate();
  const time     = start.toLocaleTimeString("en-PH", {
    hour:   "numeric",
    minute: "2-digit",
  });
  const countdown = getCountdown(start);
  const isPast    = countdown === "Past";
  const isToday   = countdown === "Today!";

  return (
    <article
      className={[
        "bg-white border-t-4 border-red-700 border-x border-b ",
        "rounded-2xl p-4 sm:p-5",
        "hover:shadow-md hover:shadow-red-100 hover:border-t-red-600",
        "transition-all duration-200",
        isPast ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex gap-4">
        {/* Date badge */}
        <div
          className="shrink-0 flex flex-col items-center justify-center
                     bg-red-700 text-white rounded-xl w-14 h-14 sm:w-16 sm:h-16"
          aria-label={`Event date: ${month} ${day}`}
        >
          <span className="font-sans text-[0.6rem] font-bold tracking-wider uppercase opacity-80">
            {month}
          </span>
          <span className="font-serif text-2xl sm:text-3xl font-bold leading-none">
            {day}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Countdown pill */}
          <span
            className={[
              "inline-block font-sans font-bold text-xs rounded-full px-2.5 py-0.5 mb-1.5",
              isToday
                ? "bg-green-100 text-green-700 border border-green-200"
                : isPast
                ? "bg-gray-100 text-gray-500 border border-gray-200"
                : "bg-red-50 text-red-600 border border-red-100",
            ].join(" ")}
          >
            {countdown}
          </span>

          <h3
            className="font-serif font-bold text-gray-900 leading-snug line-clamp-2 mb-1"
            style={{ fontSize: "clamp(0.9rem, 1.5vw + 0.4rem, 1.1rem)" }}
          >
            {title}
          </h3>

          <p className="font-sans text-sm text-gray-400 truncate">
            {time} · {location}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <Link
          to={`/events#${id}`}
          className="inline-flex items-center gap-1 font-sans font-bold text-sm
                     text-red-700 hover:text-red-900 transition-colors
                     min-h-11
                     focus:outline-none focus:underline"
          aria-label={`View details for ${title}`}
        >
          View details →
        </Link>
      </div>
    </article>
  );
}