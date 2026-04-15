// app/components/church/AttendanceHeatmap.tsx
// Visual 12-week Sunday attendance grid.
// Each cell = one Sunday. Color encodes status.
// Legend + percentage shown below the grid.
// Screen reader: each cell has aria-label for its date + status.

export type HeatmapCell = {
  date:   string; // ISO date string YYYY-MM-DD
  status: "present" | "absent" | "unmarked" | "future";
};

interface AttendanceHeatmapProps {
  cells:  HeatmapCell[];
  label?: string;
}

const STATUS: Record<
  HeatmapCell["status"],
  { bg: string; label: string }
> = {
  present:  { bg: "bg-green-500",          label: "Present"  },
  absent:   { bg: "bg-red-500",            label: "Absent"   },
  unmarked: { bg: "bg-gray-200",           label: "Unmarked" },
  future:   { bg: "bg-gray-100 border border-gray-200", label: "Upcoming" },
};

export function AttendanceHeatmap({ cells, label }: AttendanceHeatmapProps) {
  const presentCount = cells.filter((c) => c.status === "present").length;
  const markedCount  = cells.filter(
    (c) => c.status === "present" || c.status === "absent"
  ).length;
  const percentage =
    markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : 0;

  return (
    <div>
      {label && (
        <p className="font-sans font-bold tracking-[0.15em] uppercase text-xs text-gray-400 mb-3">
          {label}
        </p>
      )}

      {/* Grid — 12 cells in a row, each is a square */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(cells.length, 12)}, 1fr)` }}
        role="list"
        aria-label="Sunday attendance history"
      >
        {cells.map((cell) => {
          const { bg, label: statusLabel } = STATUS[cell.status];
          const dateFormatted = new Date(cell.date + "T00:00:00").toLocaleDateString(
            "en-PH",
            { month: "short", day: "numeric" }
          );
          return (
            <div
              key={cell.date}
              role="listitem"
              title={`${dateFormatted}: ${statusLabel}`}
              aria-label={`${dateFormatted}: ${statusLabel}`}
              className={`rounded-sm ${bg}`}
              style={{ aspectRatio: "1" }}
            />
          );
        })}
      </div>

      {/* Legend + percentage */}
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <div className="flex flex-wrap gap-3" aria-label="Legend">
          {(["present", "absent", "unmarked"] as const).map((status) => (
            <span
              key={status}
              className="flex items-center gap-1.5 font-sans text-xs text-gray-500 capitalize"
            >
              <span
                className={`inline-block w-3 h-3 rounded-sm ${STATUS[status].bg}`}
                aria-hidden="true"
              />
              {STATUS[status].label}
            </span>
          ))}
        </div>
        <span
          className="font-sans font-bold text-xs text-gray-600"
          aria-label={`Attendance rate: ${percentage}%`}
        >
          {percentage}% attended
        </span>
      </div>
    </div>
  );
}