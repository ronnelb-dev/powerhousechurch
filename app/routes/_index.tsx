// app/routes/_index.tsx
import { Link, useLoaderData, isRouteErrorResponse, useRouteError } from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { getSettings } from "~/lib/settings.server";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { SermonCard } from "~/components/church/SermonCard";
import { EventCard } from "~/components/church/EventCard";
import { ServiceTimesBar } from "~/components/ui/ServiceTimesBar";

export const meta: MetaFunction = () => [
  { title: "Powerhouse Church Christian Fellowship Intl. — Where Faith Meets Community" },
  {
    name: "description",
    content:
      "A Spirit-filled church in Masbate City committed to making disciples, building community, and declaring the excellencies of Christ.",
  },
  { property: "og:title", content: "Powerhouse Church Christian Fellowship Intl." },
  { property: "og:description", content: "Where Faith Meets Community — Join us every Sunday." },
];

export async function loader() {
  const [latestSermon, upcomingEvents, settings] = await Promise.all([
    db.sermon.findFirst({
      where: { isPublished: true },
      orderBy: { date: "desc" },
      select: {
        id: true, title: true, speaker: true,
        series: true, date: true, thumbnail: true,
        videoUrl: true, tags: true,
      },
    }),
    db.event.findMany({
      where: { isPublished: true, startDate: { gt: new Date() } },
      orderBy: { startDate: "asc" },
      take: 3,
      select: {
        id: true, title: true, location: true,
        startDate: true, endDate: true, imageUrl: true,
      },
    }),
    getSettings(),
  ]);

  return {
    latestSermon,
    upcomingEvents: upcomingEvents.map((e) => ({
      ...e,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate?.toISOString() ?? null,
    })),
    settings,
  };
}

export default function HomePage() {
  const { latestSermon, upcomingEvents, settings } = useLoaderData<typeof loader>();

  const serviceTimes = [
    {
      label: "Sunday Service",
      time: settings["service.sunday1"] ?? "7:00 AM",
      detail: "First Service",
    },
    {
      label: "Sunday Service",
      time: settings["service.sunday2"] ?? "9:00 AM",
      detail: "Second Service",
    },
    {
      label: "Cell Groups",
      time: settings["service.cellGroupDays"] ?? "Fri–Sat",
      detail: "Various Locations",
    },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="relative pt-24 pb-24 px-6 overflow-hidden"
        aria-labelledby="hero-heading"
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-800 to-red-900"
          aria-hidden="true"
        />
        {/* Decorative circles */}
        <div
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/5 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] rounded-full bg-white/[0.03] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-xs font-sans font-bold tracking-widest uppercase text-red-300 mb-4">
            {settings["church.name"] ?? "Powerhouse Church Christian Fellowship Intl."}
          </p>
          <h1
            id="hero-heading"
            className="font-serif text-white text-5xl md:text-6xl lg:text-7xl
                       font-bold leading-tight mb-5 max-w-3xl"
          >
            Where Faith<br />Meets Community
          </h1>
          <p className="font-serif italic text-red-200 text-lg md:text-xl max-w-xl mb-10">
            "You are no longer strangers and foreigners, but fellow citizens with
            the saints…" — Ephesians 2:19
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/new-here"
              className="px-7 py-4 bg-yellow-400 text-red-900 font-sans font-bold
                         text-sm tracking-wide rounded-lg hover:bg-yellow-300
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-yellow-200"
            >
              Join Us Sunday →
            </Link>
            <Link
              to="/live"
              className="px-7 py-4 bg-white/10 text-white border border-white/30
                         font-sans font-bold text-sm tracking-wide rounded-lg
                         hover:bg-white/20 transition-colors focus:outline-none
                         focus:ring-2 focus:ring-white/40"
            >
              Watch Live
            </Link>
          </div>
        </div>
      </section>

      {/* ── Service Times ─────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 -mt-8 relative z-10">
        <ServiceTimesBar times={serviceTimes} />
      </div>

      {/* ── Latest Sermon ─────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="From the Pulpit"
          title="Latest Message"
          subtitle="Catch up on our most recent Sunday sermon."
        />
        {latestSermon ? (
          <div className="mt-8">
            <SermonCard
              id={latestSermon.id}
              title={latestSermon.title}
              speaker={latestSermon.speaker}
              series={latestSermon.series}
              date={latestSermon.date instanceof Date
                ? latestSermon.date.toISOString()
                : latestSermon.date}
              thumbnail={latestSermon.thumbnail}
              tags={latestSermon.tags}
            />
          </div>
        ) : (
          <p className="text-gray-400 font-sans text-sm mt-6">
            No sermons published yet.
          </p>
        )}
        <div className="mt-8">
          <Link
            to="/sermons"
            className="inline-flex items-center gap-2 text-red-700 font-sans
                       font-bold text-sm hover:text-red-900 transition-colors
                       focus:outline-none focus:underline"
          >
            Browse all sermons →
          </Link>
        </div>
      </section>

      {/* ── Mission Statement ─────────────────────────────── */}
      <section className="bg-red-900 py-20 px-6" aria-labelledby="mission-heading">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-sans font-bold tracking-widest uppercase
                        text-red-300 mb-4">
            Our Mission
          </p>
          <h2
            id="mission-heading"
            className="font-serif text-white text-3xl md:text-4xl font-bold
                       leading-tight mb-6"
          >
            Making Disciples. Building Community.<br />
            Declaring His Excellence.
          </h2>
          <p className="text-red-200 font-sans text-base leading-relaxed mb-8">
            Powerhouse Church exists to see every person know Jesus, grow in
            community, and go with purpose. We are a Spirit-filled congregation
            anchored in the Word and sent into the world.
          </p>
          <Link
            to="/about"
            className="inline-block px-6 py-3 border-2 border-yellow-400
                       text-yellow-300 font-sans font-bold text-sm rounded-lg
                       hover:bg-yellow-400 hover:text-red-900 transition-all
                       focus:outline-none focus:ring-2 focus:ring-yellow-200"
          >
            Learn more about us
          </Link>
        </div>
      </section>

      {/* ── Upcoming Events ───────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="What's Coming"
          title="Upcoming Events"
          subtitle="Join us for these upcoming gatherings and celebrations."
        />
        {upcomingEvents.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                id={event.id}
                title={event.title}
                location={event.location}
                startDate={event.startDate}
                endDate={event.endDate}
                imageUrl={event.imageUrl}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 font-sans text-sm mt-6">
            No upcoming events at this time. Check back soon!
          </p>
        )}
        <div className="mt-8">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-red-700 font-sans
                       font-bold text-sm hover:text-red-900 transition-colors
                       focus:outline-none focus:underline"
          >
            See all events →
          </Link>
        </div>
      </section>

      {/* ── New Here CTA ──────────────────────────────────── */}
      <section className="bg-primary-50 border-y border-primary-200 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold text-gray-900 mb-3">
            New to Powerhouse?
          </h2>
          <p className="text-gray-500 font-sans text-base mb-8 max-w-md mx-auto">
            We'd love to meet you. Find out what to expect on your first Sunday
            visit — no surprises, just a warm welcome.
          </p>
          <Link
            to="/new-here"
            className="inline-block px-8 py-4 bg-red-700 text-white font-sans
                       font-bold text-sm tracking-wide rounded-lg hover:bg-red-800
                       transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Plan My First Visit →
          </Link>
        </div>
      </section>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
          Unable to load home page
        </h1>
        <p className="text-gray-500 text-sm">
          {isRouteErrorResponse(error)
            ? error.data
            : "Please refresh the page."}
        </p>
      </div>
    </div>
  );
}