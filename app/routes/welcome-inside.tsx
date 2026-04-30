import { Link, useLoaderData } from "react-router";
import type { MetaFunction } from "react-router";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { Card, CardContent } from "~/components/ui/card";
import { buttonVariants } from "~/components/ui/Button";
import { getServiceOptions } from "~/lib/public-submissions";
import { getSettings } from "~/lib/settings.server";
import { getMidweekServices } from "~/lib/service-times";

export const meta: MetaFunction = () => [
  { title: "Welcome Inside — Powerhouse Church" },
  {
    name: "description",
    content:
      "A simple first-timer guide for guests who are already inside Powerhouse Church and want to know what to do next.",
  },
];

const NEXT_STEPS = [
  {
    title: "Find the welcome team",
    body: "Let an usher or welcome team member know it is your first time. They can help with seats, kids check-in, restrooms, and any questions right away.",
  },
  {
    title: "Settle in without pressure",
    body: "You do not need to know every song or every church rhythm. You are free to observe, pray, sing, or simply take a breath and get comfortable.",
  },
  {
    title: "Ask for help when you need it",
    body: "If you came with kids, need prayer, or are unsure where to go after service, ask early. Our team would rather help than have you guess.",
  },
];

const TODAY_FLOW = [
  {
    num: 1,
    title: "Before service starts",
    body: "Introduce yourself to a welcome team member, ask any practical questions, and find a seat that feels comfortable.",
  },
  {
    num: 2,
    title: "During worship",
    body: "Expect expressive, Spirit-filled worship. Join in at your pace. There is no pressure to perform or already understand everything.",
  },
  {
    num: 3,
    title: "During the message",
    body: "You will hear Bible-based preaching centered on Jesus and practical life application.",
  },
  {
    num: 4,
    title: "After the service",
    body: "Take a moment to meet someone, ask about cell groups or ministries, and receive prayer if you would like it.",
  },
];

const QUICK_HELP = [
  "I need help with kids check-in",
  "I want someone to sit with",
  "I need prayer today",
  "I want to meet a pastor before I leave",
];

const BEFORE_YOU_LEAVE = [
  "Meet a pastor or leader and say hello.",
  "Ask which cell group or ministry is the best fit for you.",
  "Visit the welcome area if you want help taking a next step.",
  "Use the Plan Your Visit form later if you want follow-up after today.",
];

export async function loader() {
  const settings = await getSettings();

  return {
    address:
      settings["church.address"] ??
      "PowerHouse Church, 2nd Flr. Sundrel Business Center Bldg. #25, FB Bailon St, Corner National Road, Cabuyao City, Laguna",
    phone: settings["church.phone"] ?? "",
    email: settings["church.email"] ?? "",
    serviceOptions: getServiceOptions(settings).slice(0, 2),
    midweekServices: getMidweekServices(settings),
  };
}

export default function WelcomeInsidePage() {
  const { address, phone, email, serviceOptions, midweekServices } =
    useLoaderData<typeof loader>();

  return (
    <>
      <PageHero
        title="You're Here. Welcome Home."
        subtitle="If this is your first time inside Powerhouse Church, here is the easiest way to settle in, know what to expect, and take a next step before you leave."
        scripture="So then you are no longer strangers and aliens, but fellow citizens with the saints. — Ephesians 2:19"
      >
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:text-left">
          <Card className="border-white/10 bg-white/8 text-white">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f1d2a4]">
                Start Here
              </p>
              <div className="mt-5 grid gap-3">
                {NEXT_STEPS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 text-left"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f3cf8e]">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#f7ebe4]">{item.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <div className="rounded-[1.7rem] border border-white/12 bg-white/10 px-5 py-5 text-left">
              <p className="text-xs uppercase tracking-[0.24em] text-[#f1d2a4]">Right Now</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-white">
                Tell an usher it is your first time.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#f7ebe4]">
                That one sentence will usually get you everything you need faster than trying to figure it out alone.
              </p>
            </div>

            <div className="rounded-[1.7rem] border border-white/12 bg-white/10 px-5 py-5 text-left">
              <p className="text-xs uppercase tracking-[0.24em] text-[#f1d2a4]">Today's Services</p>
              <div className="mt-3 space-y-3">
                {serviceOptions.map((option) => (
                  <div key={option.value}>
                    <p className="font-serif text-2xl font-semibold text-white">{option.label}</p>
                    <p className="text-sm text-[#f7ebe4]">{option.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
          <Link
            to="/contact"
            className={buttonVariants({
              size: "lg",
              variant: "secondary",
              className: "w-full justify-center sm:w-auto",
            })}
          >
            Ask for Help
          </Link>
          <Link
            to="/new-here"
            className={buttonVariants({
              size: "lg",
              variant: "outline",
              className: "w-full justify-center border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto",
            })}
          >
            Plan Another Visit
          </Link>
        </div>
      </PageHero>

      <section className="shell section-gap">
        <SectionHeader
          eyebrow="What To Do"
          title="Your first 10 minutes can be simple."
          subtitle="You do not need to decode the room. Use these cues and let the team carry some of the load for you."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {TODAY_FLOW.map((step) => (
            <div
              key={step.num}
              className="rounded-[1.7rem] border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--ring)]"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] font-serif text-lg font-bold text-white"
                aria-hidden="true"
              >
                {step.num}
              </div>
              <h3 className="font-serif text-xl font-semibold text-[var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell pb-6">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden bg-[linear-gradient(140deg,#fff7f0_0%,#fff0dc_100%)]">
            <CardContent className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                Quick Help
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
                If any of these are true, ask someone immediately.
              </h2>
              <div className="mt-6 grid gap-3">
                {QUICK_HELP.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.3rem] border border-[var(--border)] bg-white/85 px-4 py-4"
                  >
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                    <p className="text-sm leading-6 text-[var(--foreground)]">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-[linear-gradient(135deg,#214437_0%,#2b1815_100%)] text-white">
            <CardContent className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d6a24c]">
                Families & Contact
              </p>
              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="font-serif text-2xl font-semibold text-white">With kids today?</h3>
                  <p className="mt-2 text-sm leading-6 text-[#d8ded7]">
                    Ask the welcome team to point you to the kids check-in area first so you can settle your family before service begins.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/7 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#d6a24c]">Location</p>
                  <p className="mt-2 text-sm leading-7 text-[#f5ede7]">{address}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/7 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#d6a24c]">Need to reach someone?</p>
                  <div className="mt-2 space-y-2 text-sm text-[#f5ede7]">
                    {phone ? <p>{phone}</p> : null}
                    {email ? <p>{email}</p> : null}
                    {!phone && !email ? <p>Use the contact page and our team will respond.</p> : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="shell section-gap">
        <Card className="overflow-hidden bg-[rgba(255,250,245,0.92)]">
          <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                Before You Leave
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-[var(--foreground)] sm:text-5xl">
                Leave with one clear next step.
              </h2>
              <div className="mt-6 grid gap-3">
                {BEFORE_YOU_LEAVE.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.3rem] border border-[var(--border)] bg-white px-4 py-4"
                  >
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                    <p className="text-sm leading-6 text-[var(--foreground)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[var(--border)] bg-white p-5 lg:w-[22rem]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                Midweek Life
              </p>
              <h3 className="mt-3 font-serif text-2xl font-semibold text-[var(--foreground)]">
                Community keeps going after Sunday.
              </h3>
              <div className="mt-4 space-y-3">
                {midweekServices.map((service) => (
                  <div key={service} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{service}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <Link to="/cell-groups" className={buttonVariants({ className: "w-full justify-center" })}>
                  Explore Cell Groups
                </Link>
                <Link
                  to="/contact"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full justify-center",
                  })}
                >
                  Request Prayer
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
