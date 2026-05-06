// app/components/church/EventCard.tsx
// Used on home page strip and /events archive.

import { useState } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface EventCardProps {
  title: string;
  location: string;
  startDate: string;
  endDate?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  statusLabel?: string | null;
  detailsHref?: string | null;
  children?: React.ReactNode;
}

function getCountdown(startDate: Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return "Past";
  if (diff === 0) return "Today!";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

function formatEventTime(start: Date, end: Date | null): string {
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const startTime = start.toLocaleTimeString("en-PH", timeOptions);

  if (!end) return startTime;

  const endTime = end.toLocaleTimeString("en-PH", timeOptions);
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) return `${startTime} - ${endTime}`;

  const endDate = end.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });

  return `${startTime} - ${endDate}, ${endTime}`;
}

export function EventCard({
  title,
  location,
  startDate,
  endDate,
  imageUrl,
  description,
  statusLabel,
  detailsHref,
  children,
}: EventCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const month = start
    .toLocaleDateString("en-PH", { month: "short" })
    .toUpperCase();
  const day = start.getDate();
  const time = formatEventTime(start, end);
  const countdown = getCountdown(start);
  const isPast = countdown === "Past";
  const isToday = countdown === "Today!";
  const showImage = Boolean(imageUrl && !imageFailed);

  return (
    <Card
      className={cn(
        "h-full overflow-hidden transition-transform duration-200 hover:-translate-y-1",
        isPast && "opacity-75",
      )}
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex gap-4">
          <div
            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[1.25rem] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_18px_35px_-24px_rgba(146,48,52,0.85)] sm:h-20 sm:w-20"
            aria-label={`Event date: ${month} ${day}`}
          >
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] opacity-80">
              {month}
            </span>
            <span className="font-serif text-3xl font-semibold leading-none sm:text-4xl">
              {day}
            </span>
          </div>

          {showImage ? (
            <div className="hidden h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-[var(--muted)] sm:block">
              <img
                src={imageUrl ?? undefined}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge
                className={cn(
                  isToday
                    ? "bg-emerald-100 text-emerald-900"
                    : isPast
                      ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      : "bg-[rgba(146,48,52,0.12)] text-[var(--primary)]",
                )}
              >
                {countdown}
              </Badge>
              {statusLabel ? (
                <Badge className="bg-[rgba(34,73,59,0.12)] text-[var(--secondary)]">
                  {statusLabel}
                </Badge>
              ) : null}
            </div>

            <h3 className="line-clamp-2 font-serif text-2xl font-semibold leading-tight text-[var(--foreground)] sm:text-3xl">
              {title}
            </h3>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {time}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {location}
            </p>
          </div>
        </div>

        {description ? (
          <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)] sm:text-base sm:leading-7">
            {description}
          </p>
        ) : null}

        {children || detailsHref ? (
          <div className="mt-5 border-t border-[var(--border)] pt-5">
            {detailsHref ? (
              <Link
                to={detailsHref}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)] transition-colors hover:text-[color-mix(in_oklab,var(--primary)_82%,black)]"
                aria-label={`View details for ${title}`}
              >
                View details
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
            {children}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
