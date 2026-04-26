// app/components/church/EventCard.tsx
// Used on home page strip and /events archive.
// Date badge on the left, title + meta on the right.
// Countdown pill shows "Today!", "In N days", or "Past".
// Red top border accent on the card.

import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

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
  endDate: _endDate,
  imageUrl: _imageUrl,
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
    <Card className={cn("h-full overflow-hidden transition-transform duration-200 hover:-translate-y-1", isPast && "opacity-70")}>
      <CardContent className="p-5">
        <div className="flex gap-4">
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[1.25rem] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_18px_35px_-24px_rgba(146,48,52,0.85)]"
          aria-label={`Event date: ${month} ${day}`}
        >
          <span className="text-[0.6rem] font-semibold tracking-[0.24em] uppercase opacity-80">
            {month}
          </span>
          <span className="font-serif text-3xl font-semibold leading-none">
            {day}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <Badge
            className={cn(
              "mb-2",
              isToday
                ? "bg-emerald-100 text-emerald-900"
                : isPast
                ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                : "bg-[rgba(146,48,52,0.12)] text-[var(--primary)]",
            )}
          >
            {countdown}
          </Badge>

          <h3 className="line-clamp-2 font-serif text-2xl font-semibold leading-tight text-[var(--foreground)]">
            {title}
          </h3>

          <p className="mt-2 truncate text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {time} · {location}
          </p>
        </div>
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
        <Link
          to={`/events#${id}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)] transition-colors hover:text-[color-mix(in_oklab,var(--primary)_82%,black)]"
          aria-label={`View details for ${title}`}
        >
          View details
          <span aria-hidden="true">→</span>
        </Link>
        </div>
      </CardContent>
    </Card>
  );
}
