type AttendanceStatus = "present" | "absent" | "unmarked";

interface AttendanceBadgeProps {
  status: AttendanceStatus;
}

const CONFIG = {
  present:  { label: "Present", className: "bg-green-100 text-green-800 border-green-200" },
  absent:   { label: "Absent",  className: "bg-red-100 text-red-800 border-red-200"       },
  unmarked: { label: "—",       className: "bg-gray-100 text-gray-500 border-gray-200"    },
} as const;

export function AttendanceBadge({ status }: AttendanceBadgeProps) {
  const { label, className } = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                  text-xs font-sans font-bold border ${className}`}
      aria-label={`Attendance: ${label}`}
    >
      {label}
    </span>
  );
}