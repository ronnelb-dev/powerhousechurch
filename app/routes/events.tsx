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
import { Card, CardContent } from "~/components/ui/card";

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

      <div className="shell section-gap">
        <SectionHeader
          eyebrow="What's Next"
          title="Upcoming Events"
          subtitle="Mark your calendar for gatherings designed to strengthen faith and deepen friendship."
        />
        {upcoming.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                <div className="mt-3 px-1">
                  <p className="text-sm leading-6">
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

        {past.length > 0 && (
          <div className="mt-20">
            <details className="group">
              <summary
                className="list-none cursor-pointer rounded-[var(--radius)] border border-white/60 bg-white/70 px-6 py-5 focus:outline-none"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">Recently Past</p>
                    <h2 className="font-serif text-4xl font-semibold text-[var(--foreground)]">Past Events</h2>
                  </div>
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)] group-open:hidden">
                    Show →
                  </span>
                  <span className="hidden text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)] group-open:inline">
                    Hide ↑
                  </span>
                </div>
              </summary>
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <div
                    key={event.id}
                    className="opacity-75 transition-opacity hover:opacity-100"
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

        <div className="mt-20">
          <Card className="bg-[linear-gradient(135deg,rgba(255,250,245,0.92),rgba(239,226,210,0.78))]">
            <CardContent className="grid gap-6 p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">Need Prayer?</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold text-[var(--foreground)]">
                  Let us stand with you before the next gathering.
                </h2>
              </div>
              <Link to="/prayer-request" className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                Submit a prayer request →
              </Link>
            </CardContent>
          </Card>
        </div>
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
