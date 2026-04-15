// app/components/ui/ServiceTimesBar.tsx
// Displayed on the home page, overlapping the hero bottom.
// Mobile: stacks vertically (single column).
// sm+: 3 columns side by side with dividers.
// Lifted above the section below with shadow.

interface ServiceTime {
  label:  string;
  time:   string;
  detail: string;
}

interface ServiceTimesBarProps {
  times: ServiceTime[];
}

export function ServiceTimesBar({ times }: ServiceTimesBarProps) {
  return (
    <section
      className="bg-white rounded-2xl shadow-lg shadow-red-900/10
                 border border-red-100 overflow-hidden"
      aria-label="Service times"
    >
      <div
        className={[
          "grid divide-y divide-red-100",
          "sm:grid-cols-3 sm:divide-y-0 sm:divide-x sm:divide-red-100",
        ].join(" ")}
        style={{ gridTemplateColumns: times.length === 3 ? undefined : `repeat(${times.length}, 1fr)` }}
      >
        {times.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center text-center px-4 py-5 sm:py-6"
          >
            <p
              className="font-sans font-bold text-red-600 tracking-[0.15em]
                         uppercase text-xs mb-1.5"
            >
              {item.label}
            </p>
            <p className="font-serif font-bold text-gray-900 text-2xl sm:text-3xl mb-1">
              {item.time}
            </p>
            <p className="font-sans text-gray-400 text-sm">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}