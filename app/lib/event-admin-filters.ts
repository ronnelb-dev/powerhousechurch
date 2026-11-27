export type AdminEventFilter = "all" | "upcoming" | "past" | "drafts";

export type AdminEventSearchItem = {
  title: string;
  description: string;
  location: string;
  startDate: string | Date;
  isPublished: boolean;
};

export function matchesAdminEventFilter(
  event: AdminEventSearchItem,
  filter: AdminEventFilter,
  query = "",
  now = new Date(),
) {
  const startsAt = new Date(event.startDate);
  const isPast = startsAt < now;

  if (filter === "upcoming" && isPast) return false;
  if (filter === "past" && !isPast) return false;
  if (filter === "drafts" && event.isPublished) return false;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [event.title, event.location, event.description].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}
