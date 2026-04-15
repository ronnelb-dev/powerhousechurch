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

interface FooterProps {
  settings: Record<string, string>;
}

export function Footer({ settings }: FooterProps) {
  const churchName = settings["church.name"] ?? "Powerhouse Church";

  const socials = [
    { key: "social.facebook",  icon: faFacebookF,  label: "Facebook",  href:"https://www.facebook.com/PowerhouseChurchInternational"  },
    { key: "social.instagram", icon: faInstagram,  label: "Instagram", href: "https://www.instagram.com/_powerhouseintl/" },
    { key: "social.youtube",   icon: faYoutube,    label: "YouTube",   href: "https://www.youtube.com/@pcf_intl"   },
    { key: "social.tiktok",    icon: faTiktok,     label: "TikTok",    href: "https://www.tiktok.com/@pcf_intl"    },
  ];

  return (
    <footer className="bg-gray-900 text-white py-12" role="contentinfo">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">

          {/* Church Info */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">Powerhouse Church</h3>
            <p className="text-gray-300 mb-6 leading-relaxed">
              A community of faith where everyone is welcome to experience God's love, grow in their relationship with
              Christ, and serve others with purpose.
            </p>

            <div className="space-y-3">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faMapMarkerAlt} className="w-5 h-5 mr-3 text-red-800" />
                <span className="text-gray-300">2nd Flr. Sundrel Business Center Bldg Cabuyao City, Laguna</span>
              </div>
              <div className="flex items-center">
                <FontAwesomeIcon icon={faPhone} className="w-5 h-5 mr-3 text-red-800" />
                <span className="text-gray-300">(555) 123-4567</span>
              </div>
              <div className="flex items-center">
                <FontAwesomeIcon icon={faEnvelope} className="w-5 h-5 mr-3 text-red-800" />
                <span className="text-gray-300">info@powerhousechurch.org</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2" role="list">
              {[
                { to: "/about",       label: "About Us"   },
                { to: "/sermons",     label: "Sermons"  },
                { to: "/events",      label: "Events"     },
                { to: "/ministries",  label: "Ministries" },
                { to: "/contact",     label: "Contact"    },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-gray-300 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Connect With Us</h4>

            {/* Social icons */}
            <div className="flex space-x-4 mb-6" aria-label="Social media links">
              {socials.map(({ key, icon, label, href }) =>
                href ? (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-church-red transition-colors"
                    aria-label={`Follow us on ${label}`}
                  >
                    <FontAwesomeIcon icon={icon} className="w-5 h-5" />
                  </a>
                ) : null
              )}
            </div>

            {/* Service times */}
            <div>
              <h5 className="font-medium mb-2">Service Times</h5>
              <p className="text-gray-300 text-sm">
                Morning Service: 9:00 AM (Sunday)
                <br />
                Youth Service: 2:00 PM  (Sunday)
                 <br />
                Midweek: 6:30 PM (Wednesday)
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} {churchName}. All rights reserved. Built with love for our community.
          </p>
          <nav aria-label="Footer legal links">
            <ul className="flex gap-6 text-sm" role="list">
              <li>
                <Link to="/new-here" className="text-gray-400 hover:text-white transition-colors">
                  New Here?
                </Link>
              </li>
              <li>
                <Link to="/prayer-request" className="text-gray-400 hover:text-white transition-colors">
                  Prayer Request
                </Link>
              </li>
              <li>
                <Link to="/give" className="text-gray-400 hover:text-white transition-colors">
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