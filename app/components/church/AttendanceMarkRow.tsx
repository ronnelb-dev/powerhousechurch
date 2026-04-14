import { useFetcher } from "react-router";

interface AttendanceMarkRowProps {
  userId: string;
  firstName: string;
  lastName: string;
  currentStatus: "PRESENT" | "ABSENT" | null;
  date: string;
  type: "SUNDAY_SERVICE" | "CELL_GROUP";
  disabled?: boolean; // true when date is in the future
}

export function AttendanceMarkRow({
  userId, firstName, lastName, currentStatus, date, type, disabled,
}: AttendanceMarkRowProps) {
  const fetcher = useFetcher();

  // Optimistic status
  const optimisticStatus = fetcher.formData
    ? (fetcher.formData.get("status") as "PRESENT" | "ABSENT")
    : currentStatus;

  const initials = firstName[0] + lastName[0];

  return (
    <li className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full bg-red-50 border border-red-100
                   flex items-center justify-center text-xs font-bold
                   text-red-700 font-sans flex-shrink-0"
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Name */}
      <p className="flex-1 text-sm font-sans font-bold text-gray-800 min-w-0 truncate">
        {firstName} {lastName}
      </p>

      {/* Single-tap present/absent toggle — the core of Principle 5 */}
      <fetcher.Form method="post" action="/portal/attendance" className="flex gap-2">
        <input type="hidden" name="intent" value="markAttendance" />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="type" value={type} />

        <button
          type="submit"
          name="status"
          value="PRESENT"
          disabled={disabled}
          aria-pressed={optimisticStatus === "PRESENT"}
          aria-label={`Mark ${firstName} ${lastName} as present`}
          className={[
            "px-4 py-2 rounded-lg text-xs font-sans font-bold border",
            "transition-all duration-150 min-w-[72px]",
            "focus:outline-none focus:ring-2 focus:ring-green-400",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            optimisticStatus === "PRESENT"
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600",
          ].join(" ")}
        >
          Present
        </button>

        <button
          type="submit"
          name="status"
          value="ABSENT"
          disabled={disabled}
          aria-pressed={optimisticStatus === "ABSENT"}
          aria-label={`Mark ${firstName} ${lastName} as absent`}
          className={[
            "px-4 py-2 rounded-lg text-xs font-sans font-bold border",
            "transition-all duration-150 min-w-[72px]",
            "focus:outline-none focus:ring-2 focus:ring-red-400",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            optimisticStatus === "ABSENT"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-500 border-gray-200 hover:border-red-400 hover:text-red-600",
          ].join(" ")}
        >
          Absent
        </button>
      </fetcher.Form>
    </li>
  );
}