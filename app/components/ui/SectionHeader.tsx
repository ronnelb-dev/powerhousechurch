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
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)] sm:tracking-[0.28em]">
          {eyebrow}
        </p>
      )}

      <h2 className="text-balance mb-3 font-serif text-[clamp(2.35rem,8vw,3.75rem)] font-semibold leading-[0.95]">
        {title}
      </h2>

      <div
        className={cn(
          "mb-4 h-px w-24 bg-gradient-to-r from-[var(--accent)] via-[var(--primary)] to-transparent",
          centered && "mx-auto",
        )}
        aria-hidden="true"
      />

      {subtitle && (
        <p className={cn("max-w-2xl text-sm leading-7 sm:text-lg", centered && "mx-auto")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
