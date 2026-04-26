import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";

import { Button, buttonVariants } from "~/components/ui/Button";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

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
        isScrolled
          ? "border-b border-white/50 bg-[rgba(255,247,240,0.82)] shadow-[0_18px_50px_-30px_rgba(31,17,15,0.45)] backdrop-blur-xl"
          : "bg-transparent",
      ].join(" ")}
      role="banner"
    >
      <nav className="shell" aria-label="Main navigation">
        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-full px-4 py-3 transition-all duration-300 lg:px-6",
            isScrolled
              ? "bg-white/55"
              : "bg-[rgba(255,250,245,0.52)] shadow-[0_16px_45px_-34px_rgba(42,18,12,0.65)] backdrop-blur-md",
          )}
        >
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="Powerhouse Church — Home"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-sm">
              <img
                src="/logo_red.webp"
                alt="Powerhouse Church logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <p className="font-serif text-2xl font-semibold leading-tight text-[var(--foreground)]">
                Powerhouse Church
              </p>
              <p className="hidden font-sans text-[0.65rem] uppercase tracking-[0.34em] text-[var(--muted-foreground)] lg:block">
                Christian Fellowship Intl.
              </p>
            </div>
          </Link>

          <ul className="hidden items-center gap-1.5 lg:flex" role="list">
            {NAV_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-150",
                    isActive(to)
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:bg-white/75 hover:text-[var(--foreground)]",
                  )}
                  aria-current={isActive(to) ? "page" : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/new-here"
              className="rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] transition hover:border-[var(--ring)] hover:bg-white"
              aria-label="New to Powerhouse Church? Start here"
            >
              New Here?
            </Link>
            <Link
              to="/portal/dashboard"
              className={buttonVariants({ size: "sm" })}
            >
              Member Login
            </Link>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="lg:hidden rounded-full bg-white/80"
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
          </Button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent id="mobile-menu" className="lg:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-serif text-2xl font-semibold text-[var(--foreground)]">
                Powerhouse Church
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
                Christian Fellowship Intl.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>

          <div className="mt-8 rounded-[var(--radius)] border border-white/50 bg-white/60 p-3 shadow-[var(--shadow-soft)]">
            <ul className="space-y-1" role="list">
              {NAV_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "block rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition-colors",
                      isActive(to)
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "text-[var(--foreground)] hover:bg-[var(--muted)]",
                    )}
                    aria-current={isActive(to) ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 space-y-3">
            <Link to="/new-here" className="block">
              <span className={buttonVariants({ variant: "secondary", className: "flex w-full" })}>
                Plan a Visit
              </span>
            </Link>
            <Link to="/portal/dashboard" className="block">
              <span className={buttonVariants({ className: "flex w-full" })}>Member Login</span>
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
