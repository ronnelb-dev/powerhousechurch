// app/components/ui/SectionHeader.tsx
// Section heading used throughout public pages.
// Eyebrow (small caps), title (fluid serif), red accent bar, optional subtitle.

import { cn } from "~/lib/utils";

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
  return (
    <div className={cn(centered && "text-center")}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
          {eyebrow}
        </p>
      )}

      <h2 className="text-balance mb-4 font-serif text-4xl font-semibold leading-none sm:text-5xl">
        {title}
      </h2>

      <div
        className={cn(
          "mb-5 h-px w-24 bg-gradient-to-r from-[var(--accent)] via-[var(--primary)] to-transparent",
          centered && "mx-auto",
        )}
        aria-hidden="true"
      />

      {subtitle && (
        <p className={cn("max-w-2xl text-base leading-7 sm:text-lg", centered && "mx-auto")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
