// app/components/ui/ServiceTimesBar.tsx
// Displayed on the home page, overlapping the hero bottom.
// Mobile: stacks vertically (single column).
// sm+: 3 columns side by side with dividers.
// Lifted above the section below with shadow.

import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

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
        className={[
          "grid divide-y divide-[var(--border)]",
          "sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        ].join(" ")}
        style={{ gridTemplateColumns: times.length === 3 ? undefined : `repeat(${times.length}, 1fr)` }}
      >
        {times.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center px-5 py-5 text-center sm:py-7"
          >
            <Badge variant="outline" className="border-white/60 bg-white/65">
              {item.label}
            </Badge>
            {item.time ? (
              <p className="mt-4 font-serif text-2xl font-semibold text-[var(--foreground)] sm:text-4xl">
                {item.time}
              </p>
            ) : null}
            {item.lines?.length ? (
              <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--foreground)]">
                {item.lines.map((line) => (
                  <p key={line}>{line}</p>
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
