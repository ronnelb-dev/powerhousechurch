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
      className="relative overflow-hidden pt-24 sm:pt-28"
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
        className="absolute -right-10 top-14 h-48 w-48 rounded-full border border-white/15 bg-white/8 blur-3xl sm:h-56 sm:w-56"
        aria-hidden="true"
      />
      <div
        className="absolute -left-14 bottom-8 h-40 w-40 rounded-full border border-[#d6a24c]/20 bg-[#d6a24c]/10 blur-3xl sm:h-48 sm:w-48"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f7d493]/60 to-transparent"
        aria-hidden="true"
      />

      <div className="shell relative pb-14 sm:pb-20 lg:pb-24">
        <div className={cn("mx-auto max-w-4xl text-center", children ? "max-w-5xl" : undefined)}>
          <Badge className="border-white/10 bg-white/10 text-white">Powerhouse Church</Badge>
          <h1
            id="page-hero-title"
            className="text-balance mt-5 font-serif text-[clamp(3rem,11vw,5rem)] font-semibold leading-[0.92] text-white sm:mt-6 sm:text-[clamp(4rem,8vw,5.75rem)] lg:text-7xl"
          >
          {title}
          </h1>

          {subtitle && (
            <p className="mx-auto mt-4 max-w-[38rem] text-balance text-base leading-7 text-[#f5dbd2] sm:mt-5 sm:text-lg sm:leading-8">
            {subtitle}
            </p>
          )}

          {scripture && (
            <p className="mx-auto mt-5 max-w-2xl font-serif text-lg leading-8 italic text-[#f1d2a4] sm:mt-6 sm:text-2xl">
              "{scripture}"
            </p>
          )}

          {children && <div className="mt-8 sm:mt-10">{children}</div>}
        </div>
      </div>
    </section>
  );
}
