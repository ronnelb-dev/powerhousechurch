// app/components/ui/PageHero.tsx
// Full-width hero used on all public interior pages.
// - Fluid typography via clamp() — no jarring size jumps
// - Proper top padding for fixed navbar (pt-24 on mobile, pt-28 on lg)
// - Optional background image with red overlay for readability
// - Optional scripture quote in italic serif

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface PageHeroProps {
  title:      string;
  subtitle?:  string;
  /** Bible verse reference + text, displayed in italic serif */
  scripture?: string;
  /** Cloudinary URL — red gradient overlay applied automatically */
  bgImage?:   string;
  children?:  React.ReactNode;
}

export function PageHero({
  title,
  subtitle,
  scripture,
  bgImage,
  children,
}: PageHeroProps) {
  return (
    <section
      className="relative overflow-hidden pt-28 sm:pt-32"
      style={
        bgImage
          ? {
              backgroundImage:    `url(${bgImage})`,
              backgroundSize:     "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
      aria-labelledby="page-hero-title"
    >
      <div
        className="absolute inset-0 bg-[linear-gradient(135deg,#2b1815_0%,#5b2627_48%,#8f3c37_100%)]"
        style={{ opacity: bgImage ? 0.9 : 1 }}
        aria-hidden="true"
      />
      <div
        className="hero-glow absolute inset-0"
        aria-hidden="true"
      />
      <div
        className="warm-grid absolute inset-0 opacity-10"
        aria-hidden="true"
      />
      <div
        className="absolute -right-12 top-16 h-56 w-56 rounded-full border border-white/15 bg-white/8 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -left-16 bottom-10 h-48 w-48 rounded-full border border-[#d6a24c]/20 bg-[#d6a24c]/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f7d493]/60 to-transparent"
        aria-hidden="true"
      />

      <div className="shell relative pb-16 sm:pb-20 lg:pb-24">
        <div className={cn("mx-auto max-w-4xl text-center", children ? "max-w-5xl" : undefined)}>
          <Badge className="border-white/10 bg-white/10 text-white">Powerhouse Church</Badge>
          <h1
            id="page-hero-title"
            className="text-balance mt-6 font-serif text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl"
          >
          {title}
          </h1>

          {subtitle && (
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-8 text-[#f5dbd2] sm:text-xl">
            {subtitle}
            </p>
          )}

          {scripture && (
            <p className="mx-auto mt-6 max-w-xl font-serif text-xl italic text-[#f1d2a4] sm:text-2xl">
              "{scripture}"
            </p>
          )}

          {children && <div className="mt-10">{children}</div>}
        </div>
      </div>
    </section>
  );
}
