// app/components/ui/ServiceTimesBar.tsx
// Displayed on the home page, overlapping the hero bottom.
// Mobile: stacks vertically (single column).
// sm+: 3 columns side by side with dividers.
// Lifted above the section below with shadow.

import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface ServiceTime {
  label:  string;
  time?:  string;
  detail?: string;
  lines?: string[];
}

interface ServiceTimesBarProps {
  times: ServiceTime[];
}

export function ServiceTimesBar({ times }: ServiceTimesBarProps) {
  return (
    <Card className="overflow-hidden bg-[rgba(255,250,245,0.86)]" aria-label="Service times">
      <div
        className={cn(
          "grid grid-cols-2",
          "sm:grid-cols-3",
          times.length !== 3 && "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {times.map((item, i) => (
          <div
            key={`${item.label}-${item.time ?? i}`}
            className={cn(
              "flex flex-col items-center border-[var(--border)] px-3 py-4 text-center sm:px-5 sm:py-7",
              i === 0 && "border-r",
              i === 2 && "col-span-2 border-t sm:col-span-1 sm:border-l sm:border-t-0",
            )}
          >
            <Badge variant="outline" className="border-white/60 bg-white/65">
              {item.label}
            </Badge>
            {item.time ? (
              <p className="mt-3 font-serif text-2xl font-semibold text-[var(--foreground)] sm:mt-4 sm:text-4xl">
                {item.time}
              </p>
            ) : null}
            {item.lines?.length ? (
              <div className="mt-3 flex flex-col gap-1.5 text-sm leading-6 text-[var(--foreground)] sm:mt-4">
                {item.lines.map((line) => (
                  <p key={line} className="text-[var(--foreground)]">{line}</p>
                ))}
              </div>
            ) : null}
            {item.detail ? (
              <p className="mt-1 text-sm uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{item.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
