// app/routes/new-here.tsx
import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";

export const meta: MetaFunction = () => [
  { title: "New Here? — Powerhouse Church" },
  {
    name: "description",
    content:
      "New to Powerhouse Church? Find out what to expect, where to go, and who to talk to on your first visit.",
  },
];

const STEPS = [
  {
    num: 1,
    title: "Arrive & Park",
    body: "Ushers greet you at the gate. Parking is free. Arrive 10 minutes early for the best seat and a relaxed first experience.",
  },
  {
    num: 2,
    title: "Welcome Desk",
    body: "Stop by our visitor desk just inside the entrance. Grab a welcome pack and meet someone from our hospitality team.",
  },
  {
    num: 3,
    title: "Worship Together",
    body: "We open with 30 minutes of Spirit-filled praise and worship. Sing along, lift your hands, or simply take it in — all are welcome.",
  },
  {
    num: 4,
    title: "Hear the Word",
    body: "Our pastor delivers a 40-minute message rooted in Scripture. We believe the Bible is alive and relevant for everyday life.",
  },
  {
    num: 5,
    title: "Connect Card",
    body: "Fill out a connect card at your seat. It's how our team follows up to say hello and help you find your place here.",
  },
  {
    num: 6,
    title: "Stay for Fellowship",
    body: "After service, stay for coffee and merienda. This is where friendships begin and community is built.",
  },
];

const FAQS = [
  {
    q: "Is this a charismatic church?",
    a: "Yes — we are a Spirit-filled, charismatic evangelical church. We believe in the gifts of the Holy Spirit, expressive worship, and the full authority of Scripture. You're welcome here regardless of your background.",
  },
  {
    q: "Do I need to dress formally?",
    a: "Not at all. Come as you are — casual, smart-casual, whatever feels comfortable. We care far more about your heart than your outfit.",
  },
  {
    q: "What about my kids?",
    a: "We have a fully staffed Kids' Ministry for ages 3–12, running at the same time as the main service. All our children's workers are trained and background-checked. Your kids will love it.",
  },
  {
    q: "I'm not a Christian — can I still attend?",
    a: "Absolutely. Many of our most faithful members came as curious seekers first. There is zero pressure. Come, observe, ask questions, and feel the welcome.",
  },
  {
    q: "How long is the service?",
    a: "Typically 90 minutes — 30 minutes of worship, a 40-minute message, and some time for response and connection. You're free to leave at any point.",
  },
  {
    q: "Will anyone pressure me to give money?",
    a: "Never. Offering is a part of our worship, but it's always voluntary. As a first-time guest, you are our guest — giving is for our members.",
  },
];

export default function NewHerePage() {
  return (
    <>
      <PageHero
        title="We're So Glad You Found Us"
        subtitle="You don't need to have it all together. You just need to show up."
        scripture="Come to me, all you who are weary and burdened, and I will give you rest. — Matthew 11:28"
      />

      {/* What to expect */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Your First Sunday"
          title="What to Expect"
          subtitle="A step-by-step look at what a Sunday morning at Powerhouse Church is like."
        />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="bg-white border border-gray-100 rounded-2xl p-6
                         hover:border-red-200 hover:shadow-sm transition-all"
            >
              <div
                className="w-10 h-10 rounded-full bg-red-700 text-white
                           flex items-center justify-center font-serif text-lg
                           font-bold mb-4"
                aria-hidden="true"
              >
                {step.num}
              </div>
              <h3 className="font-serif text-lg font-bold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 font-sans leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Service info band */}
      <section className="bg-red-900 py-14 px-6" aria-labelledby="service-info-heading">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-300 mb-2">
              Service Times
            </p>
            <p className="font-serif text-white text-2xl font-bold">7:00 AM</p>
            <p className="text-red-200 text-sm font-sans">First Service</p>
            <p className="font-serif text-white text-2xl font-bold mt-2">9:00 AM</p>
            <p className="text-red-200 text-sm font-sans">Second Service</p>
          </div>
          <div>
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-300 mb-2">
              Location
            </p>
            <p className="font-serif text-white text-xl font-bold leading-snug">
              Powerhouse Church
            </p>
            <p className="text-red-200 text-sm font-sans mt-1">
              Masbate City, Masbate
            </p>
          </div>
          <div>
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-300 mb-2">
              Questions?
            </p>
            <p className="text-red-200 text-sm font-sans leading-relaxed">
              Our team is happy to help before your visit.
            </p>
            <Link
              to="/contact"
              className="inline-block mt-3 px-5 py-2 border border-red-600
                         text-red-200 text-sm font-sans font-bold rounded-lg
                         hover:bg-red-800 transition-colors focus:outline-none
                         focus:ring-2 focus:ring-red-400"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Common Questions"
          title="You're Probably Wondering…"
        />
        <div className="mt-8 space-y-3">
          {FAQS.map((faq, i) => (
            <details
              key={i}
              className="group bg-white border border-gray-100 rounded-xl
                         overflow-hidden hover:border-red-200 transition-colors"
            >
              <summary
                className="flex items-center justify-between px-6 py-4
                           cursor-pointer list-none focus:outline-none
                           focus:ring-2 focus:ring-inset focus:ring-red-300"
              >
                <span className="font-sans font-bold text-sm text-gray-800 pr-4">
                  {faq.q}
                </span>
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full border border-gray-200
                             flex items-center justify-center text-gray-400
                             group-open:border-red-300 group-open:text-red-600
                             transition-all"
                  aria-hidden="true"
                >
                  <svg
                    width="10" height="10" viewBox="0 0 10 10"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    className="transition-transform group-open:rotate-180"
                  >
                    <polyline points="2,3 5,7 8,3"/>
                  </svg>
                </span>
              </summary>
              <div className="px-6 pb-5">
                <p className="text-sm text-gray-500 font-sans leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Plan visit CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div
          className="bg-red-700 rounded-2xl px-8 py-12 flex flex-col md:flex-row
                     items-center justify-between gap-6 text-center md:text-left"
        >
          <div>
            <h2 className="font-serif text-2xl font-bold text-white mb-2">
              Ready to visit?
            </h2>
            <p className="text-red-200 font-sans text-base">
              Let us know you're coming so we can roll out the welcome.
            </p>
          </div>
          <Link
            to="/contact?subject=First+Visit"
            className="flex-shrink-0 px-8 py-4 bg-yellow-400 text-red-900
                       font-sans font-bold text-sm tracking-wide rounded-lg
                       hover:bg-yellow-300 transition-colors focus:outline-none
                       focus:ring-2 focus:ring-yellow-200"
          >
            Plan My Visit →
          </Link>
        </div>
      </section>
    </>
  );
}