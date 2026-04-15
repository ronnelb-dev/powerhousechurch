// app/components/ui/SectionHeader.tsx
// Section heading used throughout public pages.
// Eyebrow (small caps), title (fluid serif), red accent bar, optional subtitle.

interface SectionHeaderProps {
  eyebrow?:  string;
  title:     string;
  subtitle?: string;
  centered?: boolean;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  centered = false,
}: SectionHeaderProps) {
  const align = centered ? "text-center" : "";

  return (
    <div className={align}>
      {eyebrow && (
        <p
          className="font-sans font-bold text-red-600 tracking-[0.15em]
                     uppercase text-xs sm:text-[0.7rem] mb-2"
        >
          {eyebrow}
        </p>
      )}

      <h2
        className="font-serif font-bold text-gray-900 leading-tight mb-3"
        style={{ fontSize: "clamp(1.5rem, 3vw + 0.75rem, 2.5rem)" }}
      >
        {title}
      </h2>

      {/* Red underline accent */}
      <div
        className={[
          "w-10 h-1 bg-red-700 rounded-full mb-4",
          centered ? "mx-auto" : "",
        ].join(" ")}
        aria-hidden="true"
      />

      {subtitle && (
        <p
          className={[
            "text-gray-500 font-sans leading-relaxed",
            "text-base sm:text-lg max-w-xl",
            centered ? "mx-auto" : "",
          ].join(" ")}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}