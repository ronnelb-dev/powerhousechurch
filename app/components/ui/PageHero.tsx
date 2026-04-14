interface PageHeroProps {
  title: string;
  subtitle?: string;
  /** Optional scripture reference — displayed in italic serif below subtitle */
  scripture?: string;
  /** Cloudinary URL for background image — red gradient overlay applied */
  bgImage?: string;
  children?: React.ReactNode;
}

export function PageHero({ title, subtitle, scripture, bgImage, children }: PageHeroProps) {
  return (
    <section
      className="relative pt-32 pb-20 px-6 overflow-hidden"
      style={
        bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
      aria-labelledby="page-hero-title"
    >
      {/* Always-on gradient overlay — ensures white text contrast on any bg */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-800 to-red-900"
        style={{ opacity: bgImage ? 0.88 : 1 }}
        aria-hidden="true"
      />

      {/* Decorative circle — pure atmosphere */}
      <div
        className="absolute -top-16 -right-16 w-72 h-72 rounded-full
                   bg-white/5 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full
                   bg-white/[0.03] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative max-w-4xl mx-auto text-center">
        <h1
          id="page-hero-title"
          className="font-serif text-white text-4xl md:text-5xl lg:text-6xl
                     font-bold leading-tight mb-4"
        >
          {title}
        </h1>

        {subtitle && (
          <p className="text-red-200 text-lg md:text-xl max-w-2xl mx-auto mb-4">
            {subtitle}
          </p>
        )}

        {scripture && (
          <p className="font-serif italic text-red-300 text-base md:text-lg max-w-xl mx-auto mb-6">
            "{scripture}"
          </p>
        )}

        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}

export default PageHero;