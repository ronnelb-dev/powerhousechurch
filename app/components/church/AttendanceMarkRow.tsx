// app/components/church/AttendanceMarkRow.tsx
// Single list item in the attendance marking screen.
// Present / Absent buttons = single tap, no confirmation needed.
// Optimistic status update via useFetcher.
// Buttons ≥44px tall AND ≥72px wide for comfortable mobile tapping.

import { useFetcher } from "react-router";
import { PendingButton } from "~/components/ui/PendingButton";

interface AttendanceMarkRowProps {
  userId: string;
  firstName: string;
  lastName: string;
  currentStatus: "PRESENT" | "ABSENT" | null;
  date: string;
  type: "SUNDAY_SERVICE" | "CELL_GROUP";
  disabled?: boolean;
}

export function AttendanceMarkRow({
  userId,
  firstName,
  lastName,
  currentStatus,
  date,
  type,
  disabled,
}: AttendanceMarkRowProps) {
  const fetcher = useFetcher();
  const isPending = fetcher.state !== "idle";

  // Optimistic status — show the value the user just submitted immediately
  const optimisticStatus: "PRESENT" | "ABSENT" | null = fetcher.formData
    ? (fetcher.formData.get("status") as "PRESENT" | "ABSENT")
    : currentStatus;

  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");

  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-gray-50last:border-0 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-sm font-bold text-red-700 font-sans shrink-0"
        aria-hidden="true"
      >
        {initials.toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-sans font-bold text-gray-800 text-base truncate">
          {firstName} {lastName}
        </p>
        {optimisticStatus && (
          <p
            className={`font-sans text-xs font-bold ${
              optimisticStatus === "PRESENT" ? "text-green-600" : "text-red-500"
            }`}
          >
            {optimisticStatus === "PRESENT" ? "✓ Present" : "✗ Absent"}
          </p>
        )}
      </div>

      {/* Present / Absent buttons — submitted via hidden form fields */}
      <fetcher.Form
        method="post"
        action="/portal/attendance"
        className="flex gap-2 shrink-0"
      >
        <input type="hidden" name="intent" value="markAttendance" />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="type" value={type} />

        <PendingButton
          type="submit"
          name="status"
          value="PRESENT"
          disabled={disabled}
          isPending={isPending && optimisticStatus === "PRESENT"}
          pendingText="Saving"
          aria-pressed={optimisticStatus === "PRESENT"}
          aria-label={`Mark ${firstName} ${lastName} as present`}
          className={[
            "min-h-11 min-w-18 px-3 rounded-xl",
            "font-sans font-bold text-sm border",
            "transition-all duration-150 touch-manipulation",
            "focus:outline-none focus:ring-2 focus:ring-green-400",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            optimisticStatus === "PRESENT"
              ? "bg-green-600 text-white border-green-600 shadow-sm shadow-green-200"
              : "bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600",
          ].join(" ")}
        >
          Present
        </PendingButton>

        <PendingButton
          type="submit"
          name="status"
          value="ABSENT"
          disabled={disabled}
          isPending={isPending && optimisticStatus === "ABSENT"}
          pendingText="Saving"
          aria-pressed={optimisticStatus === "ABSENT"}
          aria-label={`Mark ${firstName} ${lastName} as absent`}
          className={[
            "min-h-11 min-w-18 px-3 rounded-xl",
            "font-sans font-bold text-sm border",
            "transition-all duration-150 touch-manipulation",
            "focus:outline-none focus:ring-2 focus:ring-red-400",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            optimisticStatus === "ABSENT"
              ? "bg-red-600 text-white border-red-600 shadow-sm shadow-red-200"
              : "bg-white text-gray-500 border-gray-200 hover:border-red-400 hover:text-red-500",
          ].join(" ")}
        >
          Absent
        </PendingButton>
      </fetcher.Form>
    </li>
  );
}
