// app/routes/events.tsx
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { PageHero } from "~/components/ui/PageHero";
import { EventCard } from "~/components/church/EventCard";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Events — Powerhouse Church" },
  {
    name: "description",
    content:
      "Upcoming services, celebrations, and gatherings at Powerhouse Church.",
  },
];

export async function loader() {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db.event.findMany({
      where: { isPublished: true, startDate: { gt: now } },
      orderBy: { startDate: "asc" },
    }),
    db.event.findMany({
      where: { isPublished: true, startDate: { lte: now } },
      orderBy: { startDate: "desc" },
      take: 6,
    }),
  ]);

  const serialize = (e: typeof upcoming[0]) => ({
    ...e,
    startDate: e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate,
    endDate:   e.endDate instanceof Date ? e.endDate.toISOString() : (e.endDate ?? null),
  });

  return {
    upcoming: upcoming.map(serialize),
    past:     past.map(serialize),
  };
}

export default function EventsPage() {
  const { upcoming, past } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHero
        title="Events & Gatherings"
        subtitle="Come and be part of what God is doing in our community."
        scripture="Let us not give up meeting together — Hebrews 10:25"
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Upcoming */}
        <SectionHeader
          eyebrow="What's Next"
          title="Upcoming Events"
        />
        {upcoming.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcoming.map((event) => (
              <div key={event.id} id={event.id}>
                <EventCard
                  id={event.id}
                  title={event.title}
                  location={event.location}
                  startDate={event.startDate}
                  endDate={event.endDate}
                  imageUrl={event.imageUrl}
                />
                {/* Full description shown on events page */}
                <div className="mt-3 px-1">
                  <p className="text-sm text-gray-500 font-sans leading-relaxed">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="events"
            title="No upcoming events"
            message="Check back soon — we're always planning something."
          />
        )}

        {/* Past events */}
        {past.length > 0 && (
          <div className="mt-20">
            <details className="group">
              <summary
                className="flex items-center justify-between cursor-pointer
                           list-none focus:outline-none"
              >
                <SectionHeader eyebrow="Recently Past" title="Past Events" />
                <span
                  className="text-sm font-sans font-bold text-red-600
                             group-open:hidden"
                >
                  Show →
                </span>
                <span
                  className="text-sm font-sans font-bold text-red-600
                             hidden group-open:inline"
                >
                  Hide ↑
                </span>
              </summary>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {past.map((event) => (
                  <div
                    key={event.id}
                    className="opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <EventCard
                      id={event.id}
                      title={event.title}
                      location={event.location}
                      startDate={event.startDate}
                      endDate={event.endDate}
                      imageUrl={event.imageUrl}
                    />
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="events"
      title="Could not load events"
      message={
        isRouteErrorResponse(error) ? error.data : "Please refresh and try again."
      }
      action={{ label: "Go home", to: "/" }}
    />
  );
}