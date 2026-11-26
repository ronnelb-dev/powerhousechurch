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
import { buttonVariants } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/card";
import { getServiceSchedule } from "~/lib/service-times";

const MISSION_STEPS = [
  {
    number: "01",
    title: "Know Jesus",
    body: "Encounter Christ through Scripture, worship, and prayer.",
  },
  {
    number: "02",
    title: "Find Family",
    body: "Move from attending services to belonging in community.",
  },
  {
    number: "03",
    title: "Live Sent",
    body: "Serve your city with compassion, courage, and conviction.",
  },
] as const;

export const meta: MetaFunction = () => [
  { title: "Powerhouse Church Christian Fellowship Intl. — Where Faith Meets Community" },
  {
    name: "description",
    content:
      "A Spirit-filled church in Cabuyao City committed to making disciples, building community, and declaring the excellencies of Christ.",
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
  const serviceSchedule = getServiceSchedule(settings);

  const serviceTimes = [
    ...serviceSchedule.sunday,
    {
      label: "Midweek Service",
      lines: serviceSchedule.midweek,
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-28 lg:pb-28 lg:pt-32" aria-labelledby="hero-heading">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#241816_0%,#572527_42%,#8a3a36_100%)]" aria-hidden="true" />
        <div className="hero-glow absolute inset-0 opacity-90" aria-hidden="true" />
        <div className="warm-grid absolute inset-0 opacity-10" aria-hidden="true" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full border border-white/10 bg-white/5 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-10 bottom-8 h-64 w-64 rounded-full bg-[rgba(214,162,76,0.16)] blur-3xl" aria-hidden="true" />

        <div className="shell relative">
          <div className="mt-4 grid items-center gap-8 sm:mt-6 sm:gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-3xl">
              <h1 id="hero-heading" className="text-balance font-serif text-[clamp(2.8rem,13vw,4rem)] font-semibold leading-[0.94] text-[var(--inverse)] sm:text-[clamp(4rem,9vw,6rem)] lg:text-[5rem]">
                A church home with warmth, conviction, and room to grow.
              </h1>
              <p className="mt-4 max-w-2xl text-balance text-base leading-7 text-[var(--inverse-muted)] sm:mt-6 sm:text-xl sm:leading-8">
                Find a church family rooted in Scripture, alive in worship, and ready to walk with you through every season.
              </p>
              <p className="mt-5 hidden max-w-2xl font-serif text-2xl leading-8 italic text-[var(--inverse-accent)] sm:block">
                "You are no longer strangers and foreigners, but fellow citizens
                with the saints…" — Ephesians 2:19
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
                <Link
                  to="/new-here"
                  className={buttonVariants({
                    size: "lg",
                    variant: "secondary",
                    className: "w-full sm:w-auto",
                  })}
                >
                  Plan Your Sunday
                </Link>
                <Link
                  to="/live"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className: "w-full border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto",
                  })}
                >
                  Watch Live
                </Link>
              </div>
            </div>

            <Card className="relative overflow-hidden border-white/15 bg-[var(--surface-inverse)] shadow-[0_30px_80px_-40px_rgba(10,5,5,0.75)]">
              <div className="relative aspect-[16/10] min-h-52 w-full lg:aspect-auto lg:h-[34rem]">
                <img
                  src="/bg-img.jpg"
                  alt="Powerhouse Church congregation worshipping together"
                  className="absolute inset-0 size-full object-cover object-center"
                  loading="eager"
                  fetchPriority="high"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#1b100f] via-[#1b100f]/10 to-transparent"
                  aria-hidden="true"
                />
              </div>
              <CardContent className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                <div className="flex items-end justify-between gap-2 rounded-2xl border border-white/15 bg-[#1b100f]/80 p-3 backdrop-blur-md sm:gap-3 sm:p-4">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--inverse-accent)] sm:text-xs sm:tracking-[0.22em]">
                      <span className="sm:hidden">Sunday</span>
                      <span className="hidden sm:inline">Join us Sunday</span>
                    </p>
                    <h2 className="mt-1 whitespace-nowrap font-serif text-lg font-semibold text-[var(--inverse)] sm:text-3xl">
                      {serviceSchedule.sunday
                        .map((service) => service.time)
                        .join(" · ")}
                    </h2>
                    <p className="mt-1 hidden text-sm text-[var(--inverse-muted)] sm:block">
                      Worship, practical preaching, and a place to belong.
                    </p>
                  </div>
                  <Link
                    to="/contact"
                    className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-[var(--inverse-accent)] sm:text-sm sm:tracking-[0.12em]"
                  >
                    <span className="sm:hidden">Directions →</span>
                    <span className="hidden sm:inline">Get Directions</span>
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
          <div className="mx-auto mt-10 max-w-6xl">
            <SermonCard
              id={latestCellCelebrationMessage.id}
              title={latestCellCelebrationMessage.title}
              speaker={latestCellCelebrationMessage.speaker}
              series={latestCellCelebrationMessage.playlistLabel}
              date={latestCellCelebrationMessage.publishedAt}
              thumbnail={latestCellCelebrationMessage.thumbnail}
              href={latestCellCelebrationMessage.url}
              external
              featured
            />
          </div>
        ) : latestSermon ? (
          <div className="mx-auto mt-10 max-w-6xl">
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
              featured
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
          <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:p-12">
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
            <ol className="grid gap-3" aria-label="How we live our mission">
              {MISSION_STEPS.map((step) => (
                <li
                  key={step.number}
                  className="grid grid-cols-[auto_1fr] items-start gap-4 rounded-[1.4rem] border border-white/10 bg-white/7 p-4"
                >
                  <span
                    className="font-serif text-2xl font-semibold leading-none text-[#d6a24c]"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-serif text-2xl font-semibold leading-tight text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-5 text-[#d8ded7]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
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
