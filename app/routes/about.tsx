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
    title: "Scripture",
    body:  "The Bible is the inspired, authoritative Word of God. Every sermon, every decision, every ministry is anchored in Scripture.",
    icon:  "📖",
  },
  {
    title: "Prayer",
    body:  "We are a house of prayer. Corporate prayer is not a program — it is the breath of the church.",
    icon:  "🙏",
  },
  {
    title: "Community",
    body:  "We do life together. Cell groups are the heartbeat of our church — where discipleship happens in real time.",
    icon:  "🤝",
  },
  {
    title: "Mission",
    body:  "We are sent. Every member is a missionary — in their home, their workplace, and their community.",
    icon:  "✈️",
  },
  {
    title: "Excellence",
    body:  "We give God our best. In worship, in service, in administration — excellence is an act of reverence.",
    icon:  "⭐",
  },
  {
    title: "Generosity",
    body:  "We are a giving church. We give our time, our talents, and our treasure to see the kingdom advance.",
    icon:  "💛",
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

      <section className="border-y border-white/50 bg-white/40 py-16">
        <div className="shell">
          <SectionHeader
            eyebrow="What We Believe"
            title="Our Core Values"
            centered
          />
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value) => (
              <Card
                key={value.title}
                className="h-full bg-white/75 transition-all hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div
                  className="mb-4 text-2xl"
                  aria-hidden="true"
                  style={{ fontSize: "24px" }}
                >
                  {value.icon}
                  </div>
                  <h3 className="font-serif text-3xl font-semibold text-[var(--foreground)]">
                  {value.title}
                </h3>
                  <p className="mt-3 text-sm leading-6">
                  {value.body}
                </p>
                </CardContent>
              </Card>
            ))}
          </div>
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
