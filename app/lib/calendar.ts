const CALENDAR_DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

type CalendarEventInput = {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  url?: string | null;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function formatCalendarTimestamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildCalendarDetails({
  description,
  url,
}: Pick<CalendarEventInput, "description" | "url">) {
  return [description?.trim(), url ? `Event details: ${url}` : null]
    .filter(Boolean)
    .join("\n\n");
}

export function getEventCalendarPath(eventId: string) {
  return `/events/${eventId}/calendar.ics`;
}

export function buildEventCalendarUrl(origin: string, eventId: string) {
  return `${origin}${getEventCalendarPath(eventId)}`;
}

export function getCalendarEndDate(
  startDate: Date | string,
  endDate?: Date | string | null,
) {
  const start = toDate(startDate);
  if (endDate) {
    const parsedEnd = toDate(endDate);
    if (parsedEnd.getTime() > start.getTime()) {
      return parsedEnd;
    }
  }

  return new Date(start.getTime() + CALENDAR_DEFAULT_DURATION_MS);
}

export function buildGoogleCalendarUrl(input: CalendarEventInput) {
  const start = toDate(input.startDate);
  const end = getCalendarEndDate(start, input.endDate);
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", input.title);
  url.searchParams.set(
    "details",
    buildCalendarDetails({ description: input.description, url: input.url }),
  );
  url.searchParams.set("location", input.location ?? "");
  url.searchParams.set(
    "dates",
    `${formatCalendarTimestamp(start)}/${formatCalendarTimestamp(end)}`,
  );

  return url.toString();
}

export function getEventCalendarFilename(input: Pick<CalendarEventInput, "title" | "startDate">) {
  const start = toDate(input.startDate);
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "event"}-${start.toISOString().slice(0, 10)}.ics`;
}

export function createEventCalendarIcs(input: CalendarEventInput) {
  const start = toDate(input.startDate);
  const end = getCalendarEndDate(start, input.endDate);
  const summary = escapeIcsText(input.title);
  const description = escapeIcsText(
    buildCalendarDetails({ description: input.description, url: input.url }),
  );
  const location = escapeIcsText(input.location ?? "");
  const uid = input.id
    ? `event-${input.id}@powerhousechurch.ph`
    : `event-${start.getTime()}@powerhousechurch.ph`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Powerhouse Church//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatCalendarTimestamp(new Date())}`,
    `DTSTART:${formatCalendarTimestamp(start)}`,
    `DTEND:${formatCalendarTimestamp(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    input.url ? `URL:${input.url}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\r\n");
}
