// app/routes/about.tsx
import { useLoaderData } from "react-router";
import type { MetaFunction } from "react-router";
import { getSettings } from "~/lib/settings.server";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { Link } from "react-router";
import { buttonVariants } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/card";

export const meta: MetaFunction = () => [
  { title: "About Us — Powerhouse Church" },
  {
    name: "description",
    content:
      "Learn about Powerhouse Church Christian Fellowship Intl. — our story, values, and the people who lead our community.",
  },
];

export async function loader() {
  return { settings: await getSettings() };
}

const VALUES = [
  {
    number: "01",
    title: "I am a True Disciple",
    body: "Focused on Christ-likeness and multiplying ministry.",
  },
  {
    number: "02",
    title: "Caught by the Vision",
    body: "Understanding, living, and transmitting the G12 vision.",
  },
  {
    number: "03",
    title: "Committed to Cell Life",
    body: "Prioritizing evangelism, leadership development, and multiplication.",
  },
  {
    number: "04",
    title: "Passionate Spiritually",
    body: "Devotion to prayer, fasting, and holiness.",
  },
  {
    number: "05",
    title: "Submission to Authority",
    body: "Loving, honoring, and respecting leaders.",
  },
  {
    number: "06",
    title: "Commitment to Time",
    body: "Managing and investing time for the Kingdom.",
  },
  {
    number: "07",
    title: "Lifelong Relationship",
    body: "Being accountable and responsible.",
  },
  {
    number: "08",
    title: "I Love Equipping and Training",
    body: 'Viewing training as "Happy Hour".',
  },
  {
    number: "09",
    title: "I am a Leader of 12 Disciples",
    body: "Born to multiply.",
  },
  {
    number: "10",
    title: "Accomplishing Church Goal Setting",
    body: "Supporting and fulfilling church goals.",
  },
  {
    number: "11",
    title: "I Want to See My Church Grow",
    body: "Praying, working, and paying.",
  },
  {
    number: "12",
    title: "The Importance of Young People",
    body: "Preparing the next generation.",
  },
];

const WCDS_STEPS = [
  {
    letter: "W",
    title: "Win",
    body: "Reaching new people through the preaching of the Gospel.",
  },
  {
    letter: "C",
    title: "Consolidate",
    body: "Taking care of the new believer until they affirm their decision for Jesus.",
  },
  {
    letter: "D",
    title: "Disciple",
    body: "Teaching a new disciple the basic principles of the Christian life.",
  },
  {
    letter: "S",
    title: "Send",
    body: "To equip a disciple in opening a cell group, win souls and become an influential leader.",
  },
];

export default function AboutPage() {
  useLoaderData<typeof loader>();

  return (
    <>
      <PageHero
        title="About Powerhouse Church"
        subtitle="A Spirit-filled community built on the Word, shaped by love, and sent into the world."
        scripture="Built on the foundation of the apostles and prophets, Christ Jesus himself being the cornerstone. — Ephesians 2:20"
      />

      <section className="shell section-gap">
        <SectionHeader eyebrow="Our Story" title="Who We Are" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 text-base leading-8">
            <p>
            Powerhouse Church Christian Fellowship International began as a small
            gathering of believers committed to one thing: experiencing the raw,
            unfiltered presence of God. What started in a living room has grown
            into a multigenerational congregation that spans cell groups across
            the city.
          </p>
          <p>
            We are charismatic and evangelical — we believe in the full authority
            of Scripture and the active work of the Holy Spirit. These are not
            contradictions; they are the two wings by which the church flies.
          </p>
          <p>
            Our vision is simple: to see every person in our city know Jesus,
            grow in community, and go with purpose. Everything we do — every
            Sunday service, every cell group, every devotion shared on Daily
            Bread — flows from that vision.
          </p>
          </div>
          <Card className="bg-[linear-gradient(160deg,rgba(255,250,245,0.95),rgba(239,226,210,0.72))]">
            <CardContent className="p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                What Shapes Us
              </p>
              <h3 className="mt-4 font-serif text-4xl font-semibold text-[var(--foreground)]">
                Word and Spirit, held together with humility.
              </h3>
              <div className="mt-8 space-y-4">
                {[
                  ["Spirit-filled worship", "We make room for reverence, joy, and the work of the Holy Spirit."],
                  ["Biblical teaching", "We want every sermon and every ministry to be anchored in Scripture."],
                  ["Relational discipleship", "Growth happens best in circles, not just rows."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/60 bg-white/70 p-4">
                    <h4 className="font-serif text-2xl font-semibold text-[var(--foreground)]">{title}</h4>
                    <p className="mt-2 text-sm leading-6">{body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section-gap">
        <div className="shell">
          <div className="overflow-hidden rounded-[28px] border border-[#eadfda] bg-white shadow-[0_18px_40px_rgba(35,23,21,0.08)]">
            <div className="bg-[#a00000] px-8 py-8 text-white sm:px-10 sm:py-9">
              <h2 className="font-serif text-4xl font-semibold text-white sm:text-5xl">
                Our Core Values
              </h2>
              <p className="mt-4 max-w-5xl text-base leading-8 text-white/90 sm:text-lg">
                G12 core values focus on building a committed, multiplying church
                through 12 foundational principles centered on discipleship, cell
                life, and leadership development. Key pillars include passion for
                God, submission to authority, evangelism, and preparing the next
                generation to fulfill the vision.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px bg-[#eadfda] sm:grid-cols-2 xl:grid-cols-4">
              {VALUES.map((value) => (
                <div key={value.number} className="min-h-[170px] bg-white px-6 py-7 sm:px-7">
                  <p className="text-lg font-semibold tracking-[0.18em] text-[#d88f8f]">
                    {value.number}
                  </p>
                  <h3 className="mt-4 text-2xl font-semibold leading-tight text-[var(--foreground)]">
                    {value.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
                    {value.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shell section-gap pt-0">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-4">
          {WCDS_STEPS.map((step) => (
            <div key={step.letter} className="mx-auto max-w-[240px] text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#a00000] text-4xl font-semibold text-white">
                {step.letter}
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-[var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-3 text-base leading-8 text-[var(--muted-foreground)]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell section-gap">
        <SectionHeader eyebrow="Doctrine" title="What We Believe" />
        <div className="mt-10 space-y-3">
          {[
            "We believe in the Trinity — one God eternally existing in three persons: Father, Son, and Holy Spirit.",
            "We believe the Bible is the inspired and infallible Word of God, the final authority in all matters of faith and conduct.",
            "We believe in salvation by grace alone, through faith alone, in Christ alone.",
            "We believe in water baptism by immersion as a public declaration of faith.",
            "We believe in the baptism of the Holy Spirit with the evidence of speaking in tongues.",
            "We believe in the gifts of the Holy Spirit for the building up of the body of Christ.",
            "We believe in the physical resurrection of Jesus Christ and in His literal, imminent return.",
          ].map((statement, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl border border-white/60 bg-white/70 px-5 py-4"
            >
              <div
                className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)]"
                aria-hidden="true"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                  <polyline points="1,4 3,6 7,2" strokeWidth="1.5"
                            stroke="white" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm leading-7">
                {statement}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell pb-24 text-center">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,#923034_0%,#231715_100%)] text-white">
          <CardContent className="p-10">
            <h2 className="font-serif text-4xl font-semibold text-white sm:text-5xl">
          Come and See
        </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#f1ddd4]">
          The best way to know who we are is to join us on a Sunday. Come hungry,
          come as you are, and come expecting.
        </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/new-here" className={buttonVariants({ variant: "secondary" })}>
                Plan My Visit
              </Link>
              <Link
                to="/contact"
                className={buttonVariants({
                  variant: "outline",
                  className: "border-white/20 bg-white/10 text-white hover:bg-white/15",
                })}
              >
                Get in Touch
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
