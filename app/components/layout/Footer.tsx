import { Link } from "react-router";

interface FooterProps {
  settings: Record<string, string>;
}

export function Footer({ settings }: FooterProps) {
  return (
    <footer className="bg-red-900 text-red-100 font-sans" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

          {/* Church identity */}
          <div className="md:col-span-2">
            <p className="font-serif text-white text-2xl font-bold mb-1">
              {settings["church.name"] ?? "Powerhouse Church"}
            </p>
            <p className="text-yellow-300 text-xs tracking-widest uppercase mb-4">
              Where Faith Meets Community
            </p>
            <p className="text-red-200 text-sm leading-relaxed max-w-sm">
              A Spirit-filled church committed to making disciples, building
              community, and declaring the excellencies of Christ in every
              generation.
            </p>
          </div>

          {/* Service times */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest
                           uppercase mb-4 border-b border-red-700 pb-2">
              Join Us
            </h3>
            <ul className="space-y-3 text-sm" role="list">
              <li>
                <span className="text-yellow-300 font-bold block">Sunday Services</span>
                <span className="text-red-200">
                  {settings["service.sunday1"]} &amp; {settings["service.sunday2"]}
                </span>
              </li>
              <li>
                <span className="text-yellow-300 font-bold block">Cell Groups</span>
                <span className="text-red-200">
                  {settings["service.cellGroupDays"]} · Various Locations
                </span>
              </li>
            </ul>
          </div>

          {/* Contact & socials */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest
                           uppercase mb-4 border-b border-red-700 pb-2">
              Connect
            </h3>
            <address className="not-italic text-sm space-y-2 text-red-200 mb-4">
              <p>{settings["church.address"]}</p>
              <p>
                <a
                  href={`tel:${settings["church.phone"]}`}
                  className="hover:text-yellow-300 transition-colors"
                >
                  {settings["church.phone"]}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${settings["church.email"]}`}
                  className="hover:text-yellow-300 transition-colors"
                >
                  {settings["church.email"]}
                </a>
              </p>
            </address>
            <div className="flex gap-3" aria-label="Social media links">
              {[
                { key: "social.facebook",  label: "Facebook",  abbr: "FB" },
                { key: "social.youtube",   label: "YouTube",   abbr: "YT" },
                { key: "social.instagram", label: "Instagram", abbr: "IG" },
              ].map(({ key, label, abbr }) =>
                settings[key] ? (
                  <a
                    key={key}
                    href={settings[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full border border-red-600
                               flex items-center justify-center text-xs font-bold
                               text-red-200 hover:border-yellow-400 hover:text-yellow-300
                               transition-all"
                    aria-label={`Visit our ${label} page`}
                  >
                    {abbr}
                  </a>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-red-800 pt-6 flex flex-col md:flex-row
                        justify-between items-center gap-4 text-xs text-red-400">
          <p>
            © {new Date().getFullYear()} {settings["church.name"] ?? "Powerhouse Church"}.
            All rights reserved.
          </p>
          <nav aria-label="Footer legal links">
            <ul className="flex gap-6" role="list">
              <li><Link to="/new-here" className="hover:text-red-200 transition-colors">New Here?</Link></li>
              <li><Link to="/prayer-request" className="hover:text-red-200 transition-colors">Prayer Request</Link></li>
              <li><Link to="/give" className="hover:text-red-200 transition-colors">Give Online</Link></li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}