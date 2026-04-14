import { Link } from "react-router";

interface EventCardProps {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate?: string | null;
  imageUrl?: string | null;
}

export function EventCard({ id, title, location, startDate, endDate, imageUrl }: EventCardProps) {
  const start = new Date(startDate);
  const month = start.toLocaleDateString("en-PH", { month: "short" }).toUpperCase();
  const day   = start.getDate();
  const time  = start.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

  // Countdown
  const now  = new Date();
  const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const countdown =
    diff > 0  ? `In ${diff} day${diff !== 1 ? "s" : ""}` :
    diff === 0 ? "Today!" : "Past";

  return (
    <article
      className="bg-white border-t-4 border-red-700 border-x border-b border-gray-100
                 rounded-2xl p-5 hover:shadow-md transition-all duration-200"
    >
      <div className="flex gap-4">
        {/* Date badge */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center
                     bg-red-700 text-white rounded-xl w-14 h-14"
          aria-label={`Event date: ${month} ${day}`}
        >
          <span className="text-xs font-sans font-bold tracking-wider opacity-80">
            {month}
          </span>
          <span className="font-serif text-2xl font-bold leading-none">
            {day}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-sans font-bold text-red-500 mb-1">
            {countdown}
          </p>
          <h3 className="font-serif text-base font-bold text-gray-900
                         leading-snug mb-1 line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-gray-500 font-sans truncate">
            {time} · {location}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <Link
          to={`/events#${id}`}
          className="text-xs font-sans font-bold text-red-700
                     hover:text-red-900 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
        >
          View details →
        </Link>
      </div>
    </article>
  );
}