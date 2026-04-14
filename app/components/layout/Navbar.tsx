import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { to: "/",           label: "Home"       },
  { to: "/sermons",    label: "Sermons"    },
  { to: "/events",     label: "Events"     },
  { to: "/ministries", label: "Ministries" },
  { to: "/about",      label: "About"      },
  { to: "/contact",    label: "Contact"    },
];

export function Navbar() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "bg-white shadow-lg" : "bg-white/95 backdrop-blur-sm",
      ].join(" ")}
      role="banner"
    >
      <nav
        className="max-w-7xl mx-auto px-6"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="Powerhouse Church — Home"
          >
            <div className="w-10 h-10 flex-shrink-0">
              <img
                src="/logo_red.webp"
                alt="Powerhouse Church logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <p className="text-xl lg:text-2xl font-serif font-bold text-gray-900 leading-tight">
                Powerhouse Church
              </p>
              <p className="text-xs text-gray-500 tracking-widest uppercase font-sans hidden lg:block">
                Christian Fellowship Intl.
              </p>
            </div>
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden lg:flex items-center gap-1" role="list">
            {NAV_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={[
                    "px-3 py-2 rounded-md text-sm font-sans font-bold tracking-wide transition-all duration-150",
                    isActive(to)
                      ? "text-red-800 bg-red-50"
                      : "text-gray-700 hover:text-red-800 hover:bg-red-50",
                  ].join(" ")}
                  aria-current={isActive(to) ? "page" : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/new-here"
              className="px-4 py-2 rounded-full border-2 border-red-800
                         text-red-800 text-sm font-sans font-bold tracking-wide
                         hover:bg-red-800 hover:text-white transition-all duration-150"
              aria-label="New to Powerhouse Church? Start here"
            >
              New Here?
            </Link>
            <Link
              to="/portal/dashboard"
              className="px-4 py-2 rounded-md bg-red-800 text-white
                         text-sm font-sans font-bold tracking-wide
                         hover:bg-red-900 transition-all duration-150"
            >
              Member Login
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-gray-700 hover:text-red-800 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-red-800/30 rounded-md"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu — smooth max-h transition */}
        <div
          id="mobile-menu"
          className={[
            "lg:hidden transition-all duration-300 overflow-hidden",
            menuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="py-4 border-t border-gray-200">
            <ul className="flex flex-col" role="list">
              {NAV_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={[
                      "block px-4 py-3 text-sm font-sans font-bold transition-colors",
                      isActive(to)
                        ? "text-red-800 bg-red-50"
                        : "text-gray-700 hover:text-red-800 hover:bg-gray-50",
                    ].join(" ")}
                    aria-current={isActive(to) ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="px-4 pt-4 flex flex-col gap-3 border-t border-gray-200 mt-2">
              <Link
                to="/new-here"
                className="block text-center px-4 py-3 rounded-full border-2
                           border-red-800 text-red-800 text-sm font-bold
                           hover:bg-red-800 hover:text-white transition-all"
              >
                New Here? ✦
              </Link>
              <Link
                to="/portal/dashboard"
                className="block text-center px-4 py-3 rounded-md bg-red-800
                           text-white text-sm font-bold hover:bg-red-900 transition-all"
              >
                Member Login
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}