// app/routes/_index.tsx
import { Link, useLoaderData, isRouteErrorResponse, useRouteError } from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { getSettings } from "~/lib/settings.server";
import { getSermonPlaylistVideos } from "~/lib/youtube.server";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { SermonCard } from "~/components/church/SermonCard";
import { EventCard } from "~/components/church/EventCard";
import { ServiceTimesBar } from "~/components/ui/ServiceTimesBar";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/card";
import { getMidweekServices } from "~/lib/service-times";

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
  const [latestSermon, upcomingEvents, settings, playlistVideos] = await Promise.all([
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
    getSermonPlaylistVideos(),
  ]);

  const latestCellCelebrationMessage =
    playlistVideos.find((video) => video.playlistKey === "CELL_CELEBRATION") ?? null;

  return {
    latestCellCelebrationMessage,
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
  const { latestCellCelebrationMessage, latestSermon, upcomingEvents, settings } = useLoaderData<typeof loader>();
  const midweekServices = getMidweekServices(settings);

  const serviceTimes = [
    {
      label: "Sunday Service",
      time: settings["service.sunday1"] ?? "7:00 AM",
      detail: "First Service",
    },
    {
      label: "Sunday Service",
      time: settings["service.sunday2"] ?? "9:00 AM",
      detail: "Youth Service",
    },
    {
      label: "Midweek Service",
      lines: midweekServices,
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-32 lg:pt-36" aria-labelledby="hero-heading">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#241816_0%,#572527_42%,#8a3a36_100%)]" aria-hidden="true" />
        <div className="hero-glow absolute inset-0 opacity-90" aria-hidden="true" />
        <div className="warm-grid absolute inset-0 opacity-10" aria-hidden="true" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full border border-white/10 bg-white/5 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-10 bottom-8 h-64 w-64 rounded-full bg-[rgba(214,162,76,0.16)] blur-3xl" aria-hidden="true" />

        <div className="shell relative">
          
          <div className="mt-6 grid items-end gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="max-w-3xl">
              <h1 id="hero-heading" className="text-balance font-serif text-[clamp(3.4rem,15vw,6rem)] font-semibold leading-[0.92] text-white sm:text-[clamp(4.6rem,11vw,7rem)] lg:text-[5.4rem]">
                A church home with warmth, conviction, and room to grow.
          </h1>
              <p className="mt-5 max-w-2xl text-balance text-base leading-7 text-[#f1ddd4] sm:mt-6 sm:text-xl sm:leading-8">
                Join a Spirit-filled community rooted in Scripture, alive in worship, and committed to walking with people through every season of life.
              </p>
              <p className="mt-4 max-w-2xl font-serif text-xl leading-8 italic text-[#f1d2a4] sm:mt-5 sm:text-2xl">
            "You are no longer strangers and foreigners, but fellow citizens with
            the saints…" — Ephesians 2:19
          </p>
              <div className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
            <Link
              to="/new-here"
                  className={buttonVariants({ size: "lg", variant: "secondary" })}
            >
                  Plan Your Sunday
            </Link>
            <Link
              to="/live"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className: "border-white/20 bg-white/10 text-white hover:bg-white/15",
                  })}
            >
              Watch Live
            </Link>
              </div>
            </div>

            <Card className="border-white/10 bg-white/8 text-white shadow-[0_30px_80px_-40px_rgba(10,5,5,0.75)]">
              <CardContent className="p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-[#f1d2a4]">Sunday Experience</p>
                <h2 className="mt-4 font-serif text-3xl font-semibold text-white sm:text-4xl">
                  Come expectant. Leave strengthened.
                </h2>
                <div className="mt-6 grid gap-4 sm:mt-8">
                  {[
                    "Passionate worship and practical preaching",
                    "Prayer support and meaningful community",
                    "Clear next steps for kids, youth, and families",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#f1d2a4]" />
                      <p className="text-sm leading-6 text-[#f7ebe4]">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#f1d2a4]">This week</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                     { settings["service.sunday1"] ?? "9:00 AM"}
                    </p>
                  </div>
                  <Link to="/contact" className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f7e3bf]">
                    Get Directions
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="shell relative z-10 -mt-8 sm:-mt-10">
        <ServiceTimesBar times={serviceTimes} />
      </div>

      <section className="shell section-gap">
        <SectionHeader
          eyebrow="From the Pulpit"
          title="Latest Preaching"
          subtitle="Watch the newest preaching from Powerhouse Cell Celebration and carry the Word with you into the week ahead."
        />
        {latestCellCelebrationMessage ? (
          <div className="mt-10">
            <SermonCard
              id={latestCellCelebrationMessage.id}
              title={latestCellCelebrationMessage.title}
              speaker={latestCellCelebrationMessage.speaker}
              series={latestCellCelebrationMessage.playlistLabel}
              date={latestCellCelebrationMessage.publishedAt}
              thumbnail={latestCellCelebrationMessage.thumbnail}
              href={latestCellCelebrationMessage.url}
              external
            />
          </div>
        ) : latestSermon ? (
          <div className="mt-10">
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
            No messages published yet.
          </p>
        )}
        <div className="mt-8">
          <Link to="/preaching" className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
            Browse all preaching →
          </Link>
        </div>
      </section>

      <section className="shell pb-10" aria-labelledby="mission-heading">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,#214437_0%,#2b1815_100%)] text-white">
          <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d6a24c]">
            Our Mission
          </p>
          <h2
            id="mission-heading"
                className="mt-4 font-serif text-[clamp(2.4rem,8vw,3.7rem)] font-semibold leading-[0.95] text-white"
          >
                Making disciples, building community, and declaring His excellence.
          </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#d8ded7]">
            Powerhouse Church exists to see every person know Jesus, grow in
            community, and go with purpose. We are a Spirit-filled congregation
            anchored in the Word and sent into the world.
          </p>
              <Link to="/about" className={buttonVariants({ variant: "secondary", className: "mt-8" })}>
                Learn More
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Know Jesus", "Encounter Christ through Scripture, worship, and prayer."],
                ["Find Family", "Move from attending services to belonging in community."],
                ["Live Sent", "Serve your city with compassion, courage, and conviction."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[1.4rem] border border-white/10 bg-white/7 p-5">
                  <h3 className="font-serif text-2xl font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#d8ded7]">{body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="shell section-gap">
        <SectionHeader
          eyebrow="What's Coming"
          title="Upcoming Events"
          subtitle="Plan ahead for the moments we’ll worship, celebrate, and grow together."
        />
        {upcomingEvents.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                title={event.title}
                location={event.location}
                startDate={event.startDate}
                endDate={event.endDate}
                imageUrl={event.imageUrl}
                detailsHref={`/events#${event.id}-details`}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 font-sans text-sm mt-6">
            No upcoming events at this time. Check back soon!
          </p>
        )}
        <div className="mt-8">
          <Link to="/events" className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
            See all events →
          </Link>
        </div>
      </section>

      <section className="shell pb-20 sm:pb-24">
        <Card className="overflow-hidden bg-[rgba(255,250,245,0.92)]">
          <CardContent className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">First Time Here?</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-[var(--foreground)] sm:text-5xl">
            New to Powerhouse?
          </h2>
              <p className="mt-4 max-w-2xl text-base leading-7">
            We'd love to meet you. Find out what to expect on your first Sunday
            visit — no surprises, just a warm welcome.
          </p>
            </div>
            <Link to="/new-here" className={buttonVariants({ size: "lg" })}>
              Plan My First Visit
            </Link>
          </CardContent>
        </Card>
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
