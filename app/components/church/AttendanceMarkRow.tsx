// app/components/church/AttendanceMarkRow.tsx
// Single list item in the attendance marking screen.
// Present / Absent buttons = single tap, no confirmation needed.
// Optimistic status update via useFetcher.
// Buttons ≥44px tall AND ≥72px wide for comfortable mobile tapping.

import { useFetcher } from "react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { PendingButton } from "~/components/ui/PendingButton";

interface AttendanceMarkRowProps {
  userId: string;
  firstName: string;
  lastName: string;
  category?: string | null;
  currentStatus: "PRESENT" | "ABSENT" | null;
  date: string;
  type: "SUNDAY_SERVICE" | "CELL_GROUP";
  disabled?: boolean;
  selected?: boolean;
  onToggleSelect?: (userId: string) => void;
}

export function AttendanceMarkRow({
  userId,
  firstName,
  lastName,
  category,
  currentStatus,
  date,
  type,
  disabled,
  selected = false,
  onToggleSelect,
}: AttendanceMarkRowProps) {
  const fetcher = useFetcher();
  const seenResultsRef = useRef(new WeakSet<object>());
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const isPending = fetcher.state !== "idle";

  // Optimistic status — show the value the user just submitted immediately
  const pendingIntent = String(fetcher.formData?.get("intent") ?? "");
  const pendingStatus = String(fetcher.formData?.get("status") ?? "");
  const optimisticStatus: "PRESENT" | "ABSENT" | null =
    pendingIntent === "clearAttendance"
      ? null
      : pendingStatus === "PRESENT" || pendingStatus === "ABSENT"
        ? pendingStatus
        : currentStatus;

  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");
  const categoryLabel = category === "ADULT"
    ? "Adult"
    : category === "YOUNG_PROFESSIONAL"
      ? "Young Professional"
      : category === "KIDS"
        ? "Kids"
        : category;

  useEffect(() => {
    if (fetcher.state !== "idle") {
      if (fetcher.data && typeof fetcher.data === "object") {
        seenResultsRef.current.delete(fetcher.data);
      }
      return;
    }
    if (!fetcher.data || typeof fetcher.data !== "object") {
      return;
    }

    const data = fetcher.data as {
      ok?: boolean;
      error?: string;
      message?: string;
      status?: "PRESENT" | "ABSENT" | null;
      affectedIds?: string[];
    };
    const message =
      data.error ??
      (data.ok && data.status
        ? `${firstName} ${lastName} marked ${data.status === "PRESENT" ? "present" : "absent"}.`
        : data.ok && data.status === null && data.affectedIds?.includes(userId)
          ? `${firstName} ${lastName} returned to unmarked.`
          : data.message
            ? data.message
          : null);

    if (!message || seenResultsRef.current.has(fetcher.data)) {
      return;
    }

    seenResultsRef.current.add(fetcher.data);
    if (data.ok) {
      toast.success(message, { role: "status" });
    } else {
      toast.error(message, { autoClose: 6000, role: "alert" });
    }

    if (data.ok) {
      setSavedMessage(
        data.status
          ? `Saved ${data.status === "PRESENT" ? "present" : "absent"}`
          : "Saved unmarked",
      );
    }
  }, [fetcher.data, fetcher.state, firstName, lastName, userId]);

  useEffect(() => {
    if (!savedMessage) return;
    const timeoutId = window.setTimeout(() => setSavedMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [savedMessage]);

  return (
    <li className="border-b border-gray-100 px-3 py-3 transition-colors last:border-b-0 hover:bg-gray-50 sm:px-4 sm:py-3.5">
      <div className="flex items-start gap-3">
        <label className="-ml-2 -mt-1 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-start justify-center pt-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(userId)}
            disabled={disabled}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-red-700 focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed"
            aria-label={`Select ${firstName} ${lastName}`}
          />
        </label>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-100 bg-red-50 text-xs font-bold text-red-700 font-sans sm:h-10 sm:w-10 sm:text-sm"
          aria-hidden="true"
        >
          {initials.toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words font-sans text-sm font-bold leading-5 text-gray-800 sm:text-base">
            {firstName} {lastName}
          </p>
          {category ? (
            <p className="mt-0.5 font-sans text-xs text-gray-500">
              {categoryLabel}
            </p>
          ) : (
            <p className="mt-0.5 font-sans text-xs text-amber-700">Category not set</p>
          )}
          {optimisticStatus && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p
                className={`font-sans text-[11px] font-bold uppercase tracking-[0.08em] sm:text-xs ${
                  optimisticStatus === "PRESENT" ? "text-green-600" : "text-red-500"
                }`}
              >
                {optimisticStatus === "PRESENT" ? "Present" : "Absent"}
              </p>
              <fetcher.Form method="post" action="/portal/attendance">
                <input type="hidden" name="intent" value="clearAttendance" />
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="type" value={type} />
                <button
                  type="submit"
                  disabled={disabled || isPending}
                  className="min-h-11 rounded-md px-2 text-[11px] font-sans font-bold text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Return ${firstName} ${lastName} to unmarked`}
                >
                  {pendingIntent === "clearAttendance" ? "Clearing…" : "Undo mark"}
                </button>
              </fetcher.Form>
            </div>
          )}
          {savedMessage ? (
            <p
              className="mt-1 font-sans text-[11px] font-bold text-green-700"
              role="status"
            >
              {savedMessage}
            </p>
          ) : null}
        </div>
      </div>

      <fetcher.Form
        method="post"
        action="/portal/attendance"
        className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:justify-end"
      >
        <input type="hidden" name="intent" value="markAttendance" />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="type" value={type} />

        <PendingButton
          type="submit"
          name="status"
          value="PRESENT"
          disabled={disabled || isPending}
          isPending={isPending && optimisticStatus === "PRESENT"}
          pendingText="Saving"
          aria-pressed={optimisticStatus === "PRESENT"}
          aria-label={`Mark ${firstName} ${lastName} as present`}
          className={[
            "min-h-10 w-full rounded-xl px-3 sm:min-h-11 sm:min-w-18 sm:w-auto",
            "border font-sans text-sm font-bold",
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
          disabled={disabled || isPending}
          isPending={isPending && optimisticStatus === "ABSENT"}
          pendingText="Saving"
          aria-pressed={optimisticStatus === "ABSENT"}
          aria-label={`Mark ${firstName} ${lastName} as absent`}
          className={[
            "min-h-10 w-full rounded-xl px-3 sm:min-h-11 sm:min-w-18 sm:w-auto",
            "border font-sans text-sm font-bold",
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
