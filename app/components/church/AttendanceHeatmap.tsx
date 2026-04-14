export type HeatmapCell = {
  date: string;       // ISO date string
  status: "present" | "absent" | "unmarked" | "future";
};

interface AttendanceHeatmapProps {
  cells: HeatmapCell[];
  label?: string;
}

const STATUS_CONFIG = {
  present:  { bg: "bg-green-500",  title: "Present"  },
  absent:   { bg: "bg-red-500",    title: "Absent"   },
  unmarked: { bg: "bg-gray-200",   title: "Unmarked" },
  future:   { bg: "bg-gray-100 border border-gray-200", title: "Upcoming" },
} as const;

export function AttendanceHeatmap({ cells, label }: AttendanceHeatmapProps) {
  const presentCount = cells.filter((c) => c.status === "present").length;
  const totalMarked  = cells.filter((c) => c.status !== "future").length;
  const percentage   = totalMarked > 0
    ? Math.round((presentCount / totalMarked) * 100)
    : 0;

  return (
    <div>
      {label && (
        <p className="text-xs font-sans font-bold tracking-widest uppercase
                      text-gray-400 mb-3">
          {label}
        </p>
      )}

      {/* Grid */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(cells.length, 12)}, 1fr)` }}
        role="list"
        aria-label="Attendance history"
      >
        {cells.map((cell) => {
          const config = STATUS_CONFIG[cell.status];
          return (
            <div
              key={cell.date}
              role="listitem"
              title={`${cell.date}: ${config.title}`}
              aria-label={`${cell.date}: ${config.title}`}
              className={`aspect-square rounded-sm ${config.bg}`}
            />
          );
        })}
      </div>

      {/* Legend + percentage */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-4" aria-label="Legend">
          {(["present", "absent", "unmarked"] as const).map((status) => (
            <span
              key={status}
              className="flex items-center gap-1.5 text-xs text-gray-500 font-sans capitalize"
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-sm ${STATUS_CONFIG[status].bg}`}
                aria-hidden="true"
              />
              {status}
            </span>
          ))}
        </div>
        <span
          className="text-xs font-sans font-bold text-gray-600"
          aria-label={`Attendance rate: ${percentage}%`}
        >
          {percentage}% attended
        </span>
      </div>
    </div>
  );
}

export default AttendanceHeatmap; 