// app/components/church/AttendanceBadge.tsx
// Color-coded pill badge used in attendance lists and member directory.
// Colors pass WCAG AA contrast on their respective backgrounds.

type Status = "present" | "absent" | "unmarked";

interface AttendanceBadgeProps {
  status: Status;
}

const CONFIG: Record<Status, { label: string; className: string }> = {
  present:  {
    label:     "Present",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  absent:   {
    label:     "Absent",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  unmarked: {
    label:     "—",
    className: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

export function AttendanceBadge({ status }: AttendanceBadgeProps) {
  const { label, className } = CONFIG[status];
  return (
    <span
      className={[
        "inline-flex items-center font-sans font-bold text-xs",
        "px-2.5 py-1 rounded-full border",
        className,
      ].join(" ")}
      aria-label={`Attendance: ${label}`}
    >
      {label}
    </span>
  );
}