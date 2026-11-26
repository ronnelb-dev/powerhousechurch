import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebookF,
  faInstagram,
  faYoutube,
  faTiktok,
} from "@fortawesome/free-brands-svg-icons";
import type { MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";

import { buttonVariants } from "~/components/ui/Button";
import { getSettings } from "~/lib/settings.server";
import { getSocialLink, SOCIAL_DEFAULTS } from "~/lib/social-links";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "Connect With Us — Powerhouse Church" },
  {
    name: "description",
    content:
      "Follow Powerhouse Church on Facebook, Instagram, YouTube, and TikTok. A mobile-friendly social hub for quick access to our community online.",
  },
];

export async function loader() {
  return { settings: await getSettings() };
}

const SOCIALS = [
  {
    key: "social.facebook",
    icon: faFacebookF,
    label: "Facebook",
    description: "Messages, updates, and community moments",
    href: SOCIAL_DEFAULTS["social.facebook"],
  },
  {
    key: "social.instagram",
    icon: faInstagram,
    label: "Instagram",
    description: "Stories, photos, and highlights",
    href: SOCIAL_DEFAULTS["social.instagram"],
  },
  {
    key: "social.youtube",
    icon: faYoutube,
    label: "YouTube",
    description: "Preaching, worship, and live content",
    href: SOCIAL_DEFAULTS["social.youtube"],
  },
  {
    key: "social.tiktok",
    icon: faTiktok,
    label: "TikTok",
    description: "Short videos and quick encouragement",
    href: SOCIAL_DEFAULTS["social.tiktok"],
  },
] as const;

export default function LinktreePage() {
  const { settings } = useLoaderData<typeof loader>();

  const churchName = settings["church.name"] ?? "Powerhouse Church";
  const churchSubtitle =
    settings["church.tagline"] ??
    "Stay connected with our church family online.";

  const socials = [
    { ...SOCIALS[0], href: getSocialLink(settings, "social.facebook") },
    { ...SOCIALS[1], href: getSocialLink(settings, "social.instagram") },
    { ...SOCIALS[2], href: getSocialLink(settings, "social.youtube") },
    { ...SOCIALS[3], href: getSocialLink(settings, "social.tiktok") },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#241715_0%,#4b2224_38%,#f6eee6_38%,#fbf7f2_100%)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[24rem] bg-[radial-gradient(circle_at_top,rgba(231,192,125,0.18),transparent_58%)] sm:h-[32rem]" />
        <div className="absolute left-1/2 top-44 h-56 w-56 -translate-x-1/2 rounded-full bg-[rgba(255,255,255,0.06)] blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute bottom-8 right-0 h-60 w-60 rounded-full bg-[rgba(146,48,52,0.06)] blur-3xl sm:h-80 sm:w-80" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-4 py-4 sm:px-6 sm:py-8">
        <div className="flex flex-1 items-center">
          <section className="w-full">
            <div className="mx-auto flex w-full max-w-[380px] flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/20 bg-white/95 p-3 shadow-[0_20px_50px_-30px_rgba(28,17,14,0.7)] sm:h-28 sm:w-28">
                <img
                  src="/logo_red.webp"
                  alt={`${churchName} logo`}
                  className="h-full w-full object-contain"
                />
              </div>

              <h1 className="mt-5 font-serif text-[clamp(2.1rem,8.6vw,4rem)] font-semibold leading-[0.96] text-white sm:mt-6 sm:text-[clamp(2.7rem,11vw,4.4rem)]">
                {churchName}
              </h1>
              <p className="mt-3 max-w-[30rem] text-pretty text-[0.92rem] leading-6 text-[#f5e6dc] sm:mt-4 sm:text-base sm:leading-7">
                {churchSubtitle}
              </p>

              <div className="mt-7 w-full space-y-3 sm:mt-8">
                {socials.map(({ key, icon, label, description, href }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "outline",
                        className:
                          "flex h-auto min-h-[4.75rem] w-full justify-start rounded-[1.5rem] border-white/18 bg-white px-4 py-4 text-left normal-case tracking-normal text-[var(--foreground)] shadow-[0_18px_40px_-28px_rgba(28,17,14,0.35)] transition-all hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[rgba(255,250,246,0.98)] hover:shadow-[0_22px_45px_-30px_rgba(28,17,14,0.45)] focus-visible:ring-white active:translate-y-0 active:scale-[0.99] sm:min-h-20 sm:px-5 sm:py-4.5",
                      }),
                    )}
                    aria-label={`Open ${label}`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.05rem] bg-[rgba(146,48,52,0.1)] text-[var(--primary)]">
                      <FontAwesomeIcon icon={icon} className="h-5 w-5" />
                    </span>
                    <span className="ml-4 flex min-w-0 flex-1 flex-col">
                      <span className="text-left font-sans text-[0.96rem] font-semibold tracking-normal text-[var(--foreground)] sm:text-base">
                        {label}
                      </span>
                      <span className="mt-1 text-left text-[0.8rem] font-medium normal-case tracking-normal text-[var(--muted-foreground)] sm:text-sm">
                        {description}
                      </span>
                    </span>
                    <svg
                      className="ml-3 h-5 w-5 shrink-0 text-[var(--muted-foreground)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                ))}
              </div>

              <div className="mt-7 flex w-full flex-col gap-3 rounded-[1.5rem] border border-white/60 bg-[rgba(255,255,255,0.58)] p-4 text-left shadow-[0_20px_45px_-34px_rgba(35,23,21,0.18)] backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                  Quick visit
                </p>
                <p className="text-sm leading-6 text-[var(--foreground)] opacity-90">
                  New to Powerhouse Church? Find service times and directions on our main site.
                </p>
                <Link
                  to="/new-here"
                  className={buttonVariants({
                    variant: "default",
                    className: "w-full rounded-[1.25rem] normal-case tracking-normal shadow-none",
                  })}
                >
                  Visit Us
                </Link>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-5 pb-2 text-center text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[#8c6e5b] sm:mt-6">
          Tap a platform to connect
        </p>
      </div>
    </main>
  );
}
