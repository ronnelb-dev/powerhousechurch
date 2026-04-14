// app/routes/about.tsx
import { useLoaderData } from "react-router";
import type { MetaFunction } from "react-router";
import { getSettings } from "~/lib/settings.server";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { Link } from "react-router";

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
  const { settings } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHero
        title="About Powerhouse Church"
        subtitle="A Spirit-filled community built on the Word, shaped by love, and sent into the world."
        scripture="Built on the foundation of the apostles and prophets, Christ Jesus himself being the cornerstone. — Ephesians 2:20"
      />

      {/* Story */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <SectionHeader eyebrow="Our Story" title="Who We Are" />
        <div className="mt-6 space-y-4 text-gray-600 font-sans text-base leading-relaxed">
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
      </section>

      {/* Values */}
      <section className="bg-primary-50 border-y border-primary-100 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow="What We Believe"
            title="Our Core Values"
            centered
          />
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="bg-white border border-gray-100 rounded-2xl p-6
                           hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div
                  className="text-2xl mb-4"
                  aria-hidden="true"
                  style={{ fontSize: "24px" }}
                >
                  {value.icon}
                </div>
                <h3 className="font-serif text-lg font-bold text-gray-900 mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-gray-500 font-sans leading-relaxed">
                  {value.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statement of faith */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <SectionHeader eyebrow="Doctrine" title="What We Believe" />
        <div className="mt-6 space-y-3">
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
              className="flex gap-3 items-start py-3 border-b border-gray-100 last:border-0"
            >
              <div
                className="w-5 h-5 rounded-full bg-red-700 flex-shrink-0 mt-0.5
                           flex items-center justify-center"
                aria-hidden="true"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                  <polyline points="1,4 3,6 7,2" strokeWidth="1.5"
                            stroke="white" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm text-gray-600 font-sans leading-relaxed">
                {statement}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-red-900 py-16 px-6 text-center">
        <h2 className="font-serif text-3xl font-bold text-white mb-4">
          Come and See
        </h2>
        <p className="text-red-200 font-sans text-base max-w-md mx-auto mb-8">
          The best way to know who we are is to join us on a Sunday. Come hungry,
          come as you are, and come expecting.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/new-here"
            className="px-8 py-4 bg-yellow-400 text-red-900 font-sans font-bold
                       text-sm tracking-wide rounded-lg hover:bg-yellow-300
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-yellow-200"
          >
            Plan My Visit →
          </Link>
          <Link
            to="/contact"
            className="px-8 py-4 border-2 border-red-600 text-red-200
                       font-sans font-bold text-sm rounded-lg hover:bg-red-800
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-red-400"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}