export const CHURCH_TIME_ZONE = "Asia/Manila";

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function calendarParts(value: string) {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isCalendarDate(value: string): boolean {
  return calendarParts(value) !== null;
}

export function calendarDateToUtc(value: string): Date {
  const parts = calendarParts(value);
  if (!parts) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function utcDateToCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getChurchCalendarDate(reference = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(reference)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addCalendarDays(value: string, days: number): string {
  const date = calendarDateToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToCalendarDate(date);
}

export function getMostRecentSundayDate(
  referenceDate = getChurchCalendarDate(),
): string {
  const date = calendarDateToUtc(referenceDate);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return utcDateToCalendarDate(date);
}

export function getRecentSundayDates(
  count: number,
  referenceDate = getChurchCalendarDate(),
): string[] {
  const mostRecent = getMostRecentSundayDate(referenceDate);
  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(mostRecent, -7 * index),
  );
}

