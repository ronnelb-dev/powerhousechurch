interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
}

export function SectionHeader({
  eyebrow, title, subtitle, centered = false,
}: SectionHeaderProps) {
  return (
    <div className={centered ? "text-center" : ""}>
      {eyebrow && (
        <p className="text-xs font-sans font-bold tracking-widest uppercase
                      text-red-600 mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-gray-900
                     leading-tight mb-3">
        {title}
      </h2>
      {/* The red underline accent */}
      <div
        className={[
          "w-10 h-1 bg-red-700 rounded-full mb-4",
          centered ? "mx-auto" : "",
        ].join(" ")}
        aria-hidden="true"
      />
      {subtitle && (
        <p className="text-gray-500 font-sans text-base leading-relaxed max-w-xl
                      {centered ? 'mx-auto' : ''}">
          {subtitle}
        </p>
      )}
    </div>
  );
}