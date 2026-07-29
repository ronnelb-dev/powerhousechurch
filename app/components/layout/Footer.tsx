import { Link } from "react-router";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFacebookF,
  faInstagram,
  faYoutube,
  faTiktok,
} from '@fortawesome/free-brands-svg-icons'
import {
  faEnvelope,
  faPhone,
  faMapMarkerAlt,
} from '@fortawesome/free-solid-svg-icons'

import { buttonVariants } from "~/components/ui/Button";
import { getServiceSchedule } from "~/lib/service-times";
import { getSocialLink } from "~/lib/social-links";
import { cn } from "~/lib/utils";

interface FooterProps {
  settings: Record<string, string>;
}

function isPlaceholderContactValue(value: string) {
  const normalizedValue = value.toLowerCase();
  const digits = value.replace(/\D/g, "");

  return (
    normalizedValue.includes("example.com") ||
    normalizedValue.includes("(555)") ||
    digits.endsWith("0000000")
  );
}

export function Footer({ settings }: FooterProps) {
  const churchName =
    settings["church.name"]?.trim() || "Powerhouse Church";
  const churchNameWithoutTrailingPeriod = churchName.replace(/\.+$/, "");
  const churchAddress =
    settings["church.address"]?.trim() ||
    "2nd Flr. Sundrel Business Center Bldg., Cabuyao City, Laguna";
  const configuredPhone = settings["church.phone"]?.trim();
  const configuredEmail = settings["church.email"]?.trim();
  const churchPhone =
    configuredPhone && !isPlaceholderContactValue(configuredPhone)
      ? configuredPhone
      : null;
  const churchEmail =
    configuredEmail && !isPlaceholderContactValue(configuredEmail)
      ? configuredEmail
      : null;
  const serviceSchedule = getServiceSchedule(settings);
  const contactItems = [
    {
      key: "address",
      icon: faMapMarkerAlt,
      value: churchAddress,
    },
    churchPhone
      ? {
          key: "phone",
          icon: faPhone,
          value: churchPhone,
        }
      : null,
    churchEmail
      ? {
          key: "email",
          icon: faEnvelope,
          value: churchEmail,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const socials = [
    {
      key: "social.facebook",
      icon: faFacebookF,
      label: "Facebook",
      href: getSocialLink(settings, "social.facebook"),
    },
    {
      key: "social.instagram",
      icon: faInstagram,
      label: "Instagram",
      href: getSocialLink(settings, "social.instagram"),
    },
    {
      key: "social.youtube",
      icon: faYoutube,
      label: "YouTube",
      href: getSocialLink(settings, "social.youtube"),
    },
    {
      key: "social.tiktok",
      icon: faTiktok,
      label: "TikTok",
      href: getSocialLink(settings, "social.tiktok"),
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/50 bg-[var(--surface-inverse)] py-16 text-[var(--inverse)]" role="contentinfo">
      <div className="absolute inset-0 hero-glow opacity-30" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/70 to-transparent" aria-hidden="true" />
      <div className="shell relative">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--inverse-accent)]">Gather. Grow. Go.</p>
            <h3 className="mt-4 font-serif text-3xl font-semibold text-[var(--inverse)] sm:text-4xl">
              {churchName}
            </h3>
            <p className="mt-4 max-w-lg leading-relaxed text-[var(--inverse-muted)]">
              A community of faith where everyone is welcome to experience God's love, grow in their relationship with
              Christ, and serve others with purpose.
            </p>

            <div className="mt-8 grid gap-3">
              {contactItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <FontAwesomeIcon
                    icon={item.icon}
                    className="mt-1 size-4 text-[var(--inverse-accent)]"
                  />
                  <span className="break-words text-sm leading-6 text-[var(--inverse)]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/new-here"
                className={buttonVariants({
                  variant: "secondary",
                  className: "w-full justify-center sm:w-auto",
                })}
              >
                Plan a Visit
              </Link>
              <Link
                to="/give"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full justify-center border-white/20 bg-white/10 text-white hover:bg-white/15 sm:w-auto",
                })}
              >
                Give Online
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-serif text-2xl font-semibold text-[var(--inverse)]">Quick Links</h4>
            <ul className="mt-5 flex flex-col gap-3" role="list">
              {[
                { to: "/about",       label: "About Us"   },
                { to: "/preaching",   label: "Preaching"  },
                { to: "/events",      label: "Events"     },
                { to: "/ministries",  label: "Ministries" },
                { to: "/contact",     label: "Contact"    },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm uppercase tracking-[0.14em] text-[var(--inverse-muted)] transition-colors hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-2xl font-semibold text-[var(--inverse)]">Connect With Us</h4>

            <div className="mt-5 flex gap-3" aria-label="Social media links">
              {socials.map(({ key, icon, label, href }) =>
                href ? (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/6 transition-all",
                      "hover:-translate-y-0.5 hover:border-[var(--inverse-accent)]/60 hover:bg-white/12",
                    )}
                    aria-label={`Follow us on ${label}`}
                  >
                    <FontAwesomeIcon icon={icon} className="size-5" />
                  </a>
                ) : null
              )}
            </div>

            <div className="mt-8 rounded-[var(--radius)] border border-white/10 bg-white/5 p-5">
              <h5 className="text-xs uppercase tracking-[0.24em] text-[var(--inverse-accent)]">Service Times</h5>
              <div className="mt-3 flex flex-col gap-2 text-sm leading-7">
                {serviceSchedule.sunday.map((service) => (
                  <p key={service.detail} className="text-[var(--inverse)]">
                    {service.detail}: {service.time}
                  </p>
                ))}
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--inverse-accent)]">Midweek Service</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {serviceSchedule.midweek.map((item) => (
                      <p key={item} className="text-[var(--inverse-muted)]">{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--inverse-subtle)]">
            © {new Date().getFullYear()} {churchNameWithoutTrailingPeriod}. All rights reserved. Built with love for our community.
          </p>
          <nav aria-label="Footer legal links">
            <ul className="flex flex-wrap gap-5 text-sm" role="list">
              <li>
                <Link to="/new-here" className="text-[var(--inverse-muted)] transition-colors hover:text-white">
                  New Here?
                </Link>
              </li>
              <li>
                <Link to="/prayer-request" className="text-[var(--inverse-muted)] transition-colors hover:text-white">
                  Prayer Request
                </Link>
              </li>
              <li>
                <Link to="/give" className="text-[var(--inverse-muted)] transition-colors hover:text-white">
                  Give Online
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
