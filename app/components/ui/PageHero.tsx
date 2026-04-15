// app/components/ui/PageHero.tsx
// Full-width hero used on all public interior pages.
// - Fluid typography via clamp() — no jarring size jumps
// - Proper top padding for fixed navbar (pt-24 on mobile, pt-28 on lg)
// - Optional background image with red overlay for readability
// - Optional scripture quote in italic serif

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
      className="relative overflow-hidden"
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
      {/* Gradient overlay — always present; more opaque over images */}
      <div
        className="absolute inset-0 bg-linear-to-br from-red-700 via-red-800 to-red-950"
        style={{ opacity: bgImage ? 0.9 : 1 }}
        aria-hidden="true"
      />

      {/* Decorative circles — purely atmospheric */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/4 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-white/3 pointer-events-none"
        aria-hidden="true"
      />
      {/* Red accent line at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-red-400/30 to-transparent"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 lg:pt-36 pb-16 sm:pb-20 lg:pb-24 text-center">
        <h1
          id="page-hero-title"
          className="font-serif font-bold text-white leading-tight mb-4"
          style={{ fontSize: "clamp(2rem, 5vw + 1rem, 3.5rem)" }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className="text-red-200 max-w-2xl mx-auto leading-relaxed mb-4"
            style={{ fontSize: "clamp(1rem, 1.5vw + 0.5rem, 1.2rem)" }}
          >
            {subtitle}
          </p>
        )}

        {scripture && (
          <p className="font-serif italic text-red-300 max-w-xl mx-auto mt-5"
             style={{ fontSize: "clamp(0.95rem, 1.2vw + 0.4rem, 1.1rem)" }}>
            "{scripture}"
          </p>
        )}

        {children && (
          <div className="mt-8">{children}</div>
        )}
      </div>
    </section>
  );
}