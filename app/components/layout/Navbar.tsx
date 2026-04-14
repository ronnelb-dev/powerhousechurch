import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { to: "/",           label: "Home"       },
  { to: "/sermons",    label: "Sermons"    },
  { to: "/events",     label: "Events"     },
  { to: "/ministries", label: "Ministries" },
  { to: "/about",       label: "About"       },
  { to: "/contact",    label: "Contact"    },
];

export function Navbar() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isHome = location.pathname === "/";
  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled || menuOpen || !isHome
          ? "bg-red-900 shadow-lg"
          : "bg-transparent",
      ].join(" ")}
      role="banner"
    >
      <nav
        className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          to="/"
          className="flex flex-col leading-tight group"
          aria-label="Powerhouse Church — Home"
        >
          <span className="font-serif text-white text-lg font-bold tracking-tight
                           group-hover:text-yellow-300 transition-colors">
            Powerhouse
          </span>
          <span className="text-red-200 text-xs tracking-widest uppercase font-sans
                           group-hover:text-yellow-200 transition-colors">
            Church
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to}>
              <Link
                to={to}
                className={[
                  "px-3 py-2 rounded-md text-sm font-sans font-bold tracking-wide",
                  "transition-all duration-150",
                  isActive(to)
                    ? "text-white bg-white/10"
                    : "text-red-100 hover:text-white hover:bg-white/10",
                ].join(" ")}
                aria-current={isActive(to) ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right cluster */}
        <div className="hidden md:flex items-center gap-3">
          {/* New Here — the radical welcome CTA */}
          <Link
            to="/new-here"
            className="px-4 py-2 rounded-full border-2 border-yellow-400
                       text-yellow-300 text-sm font-sans font-bold tracking-wide
                       hover:bg-yellow-400 hover:text-red-900 transition-all duration-150"
            aria-label="New to Powerhouse Church? Start here"
          >
            New Here?
          </Link>
          <Link
            to="/portal/dashboard"
            className="px-4 py-2 rounded-md bg-white text-red-800
                       text-sm font-sans font-bold tracking-wide
                       hover:bg-red-50 transition-all duration-150"
          >
            Member Login
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center
                     w-10 h-10 gap-1.5 rounded-md hover:bg-white/10
                     transition-colors focus:outline-none focus:ring-2
                     focus:ring-white/50"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <span
            className={`w-5 h-0.5 bg-white transition-all duration-200
              ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`w-5 h-0.5 bg-white transition-all duration-200
              ${menuOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`w-5 h-0.5 bg-white transition-all duration-200
              ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-red-900 border-t border-red-800 px-6 py-4"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <ul className="flex flex-col gap-1" role="list">
            {NAV_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={[
                    "block px-4 py-3 rounded-lg text-sm font-sans font-bold",
                    "transition-colors",
                    isActive(to)
                      ? "bg-white/10 text-white"
                      : "text-red-100 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                  aria-current={isActive(to) ? "page" : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-red-800 flex flex-col gap-3">
            <Link
              to="/new-here"
              className="block text-center px-4 py-3 rounded-full border-2
                         border-yellow-400 text-yellow-300 text-sm font-bold
                         hover:bg-yellow-400 hover:text-red-900 transition-all"
            >
              New Here? ✦
            </Link>
            <Link
              to="/portal/dashboard"
              className="block text-center px-4 py-3 rounded-lg bg-white
                         text-red-800 text-sm font-bold hover:bg-red-50 transition-all"
            >
              Member Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}