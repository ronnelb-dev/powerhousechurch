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
import { getMidweekServices } from "~/lib/service-times";
import { cn } from "~/lib/utils";

interface FooterProps {
  settings: Record<string, string>;
}

export function Footer({ settings }: FooterProps) {
  const churchName = settings["church.name"] ?? "Powerhouse Church";
  const churchAddress =
    settings["church.address"] ?? "PowerHouse Church, 2nd Flr. Sundrel Business Center Bldg. #25, FB Bailon St, Corner National Road, Cabuyao City, Laguna";
  const churchPhone = settings["church.phone"] ?? "(555) 123-4567";
  const churchEmail = settings["church.email"] ?? "info@powerhousechurch.org";
  const sundayServices = [
    settings["service.sunday1"] && `Sunday Service: ${settings["service.sunday1"]}`,
    settings["service.sunday2"] && `Second Service: ${settings["service.sunday2"]}`,
  ].filter(Boolean) as string[];
  const midweekServices = getMidweekServices(settings);

  const socials = [
    {
      key: "social.facebook",
      icon: faFacebookF,
      label: "Facebook",
      href:
        settings["social.facebook"] ??
        "https://www.facebook.com/PowerhouseChurchInternational",
    },
    {
      key: "social.instagram",
      icon: faInstagram,
      label: "Instagram",
      href:
        settings["social.instagram"] ??
        "https://www.instagram.com/_powerhouseintl/",
    },
    {
      key: "social.youtube",
      icon: faYoutube,
      label: "YouTube",
      href: settings["social.youtube"] ?? "https://www.youtube.com/@pcf_intl",
    },
    {
      key: "social.tiktok",
      icon: faTiktok,
      label: "TikTok",
      href: settings["social.tiktok"] ?? "https://www.tiktok.com/@pcf_intl",
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/50 bg-[#231715] py-16 text-white" role="contentinfo">
      <div className="absolute inset-0 hero-glow opacity-30" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d6a24c]/70 to-transparent" aria-hidden="true" />
      <div className="shell relative">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[#e7c07d]">Gather. Grow. Go.</p>
            <h3 className="mt-4 font-serif text-4xl font-semibold text-[#fff8f1]">
              {churchName}
            </h3>
            <p className="mt-4 max-w-lg leading-relaxed text-[#d6ccc4]">
              A community of faith where everyone is welcome to experience God's love, grow in their relationship with
              Christ, and serve others with purpose.
            </p>

            <div className="mt-8 grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <FontAwesomeIcon icon={faMapMarkerAlt} className="mt-1 h-4 w-4 text-[#e7c07d]" />
                <span className="text-sm text-[#f1e8df]">{churchAddress}</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <FontAwesomeIcon icon={faPhone} className="mt-1 h-4 w-4 text-[#e7c07d]" />
                <span className="text-sm text-[#f1e8df]">{churchPhone}</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <FontAwesomeIcon icon={faEnvelope} className="mt-1 h-4 w-4 text-[#e7c07d]" />
                <span className="text-sm text-[#f1e8df]">{churchEmail}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/new-here" className={buttonVariants({ variant: "secondary" })}>
                Plan a Visit
              </Link>
              <Link
                to="/give"
                className={buttonVariants({
                  variant: "outline",
                  className: "border-white/20 bg-white/10 text-white hover:bg-white/15",
                })}
              >
                Give Online
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-serif text-2xl font-semibold text-[#fff8f1]">Quick Links</h4>
            <ul className="mt-5 space-y-3" role="list">
              {[
                { to: "/about",       label: "About Us"   },
                { to: "/sermons",     label: "Sermons"  },
                { to: "/events",      label: "Events"     },
                { to: "/ministries",  label: "Ministries" },
                { to: "/contact",     label: "Contact"    },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm uppercase tracking-[0.14em] text-[#d6ccc4] transition-colors hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-2xl font-semibold text-[#fff8f1]">Connect With Us</h4>

            <div className="mt-5 flex space-x-3" aria-label="Social media links">
              {socials.map(({ key, icon, label, href }) =>
                href ? (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 transition-all",
                      "hover:-translate-y-0.5 hover:border-[#e7c07d]/60 hover:bg-white/12",
                    )}
                    aria-label={`Follow us on ${label}`}
                  >
                    <FontAwesomeIcon icon={icon} className="w-5 h-5" />
                  </a>
                ) : null
              )}
            </div>

            <div className="mt-8 rounded-[var(--radius)] border border-white/10 bg-white/5 p-5">
              <h5 className="text-xs uppercase tracking-[0.24em] text-[#e7c07d]">Service Times</h5>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[#f1e8df]">
                {(sundayServices.length > 0
                  ? sundayServices
                  : ["Sunday Service: 9:00 AM"]).map((item) => (
                  <p key={item}>{item}</p>
                ))}
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#e7c07d]">Midweek Service</p>
                  <div className="mt-2 space-y-1.5">
                    {midweekServices.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[#bcaea2]">
            © {new Date().getFullYear()} {churchName}. All rights reserved. Built with love for our community.
          </p>
          <nav aria-label="Footer legal links">
            <ul className="flex flex-wrap gap-5 text-sm" role="list">
              <li>
                <Link to="/new-here" className="text-[#d6ccc4] transition-colors hover:text-white">
                  New Here?
                </Link>
              </li>
              <li>
                <Link to="/prayer-request" className="text-[#d6ccc4] transition-colors hover:text-white">
                  Prayer Request
                </Link>
              </li>
              <li>
                <Link to="/give" className="text-[#d6ccc4] transition-colors hover:text-white">
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
