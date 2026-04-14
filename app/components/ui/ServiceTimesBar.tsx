interface ServiceTime {
  label: string;
  time: string;
  detail: string;
}

interface ServiceTimesBarProps {
  times: ServiceTime[];
}

export function ServiceTimesBar({ times }: ServiceTimesBarProps) {
  return (
    <section
      className="bg-primary-50 border border-primary-200 rounded-2xl
                 py-6 px-8 my-8"
      aria-label="Service times"
    >
      <p className="text-center text-xs font-sans font-bold tracking-widest
                   uppercase text-red-600 mb-5">
        Join Us in Worship
      </p>
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${times.length}, 1fr)` }}
      >
        {times.map((item, i) => (
          <div
            key={i}
            className={[
              "text-center",
              i < times.length - 1
                ? "border-r border-red-200 pr-6"
                : "",
            ].join(" ")}
          >
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-600 mb-1">
              {item.label}
            </p>
            <p className="font-serif text-2xl font-bold text-gray-900 mb-0.5">
              {item.time}
            </p>
            <p className="text-xs text-gray-500 font-sans">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}