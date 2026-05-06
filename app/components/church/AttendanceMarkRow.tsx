// app/components/church/AttendanceMarkRow.tsx
// Single list item in the attendance marking screen.
// Present / Absent buttons = single tap, no confirmation needed.
// Optimistic status update via useFetcher.
// Buttons ≥44px tall AND ≥72px wide for comfortable mobile tapping.

import { useFetcher } from "react-router";
import { useEffect, useRef, useState } from "react";
import { PendingButton } from "~/components/ui/PendingButton";
import { useToast } from "~/components/ui/ToastProvider";

interface AttendanceMarkRowProps {
  userId: string;
  firstName: string;
  lastName: string;
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
  currentStatus,
  date,
  type,
  disabled,
  selected = false,
  onToggleSelect,
}: AttendanceMarkRowProps) {
  const fetcher = useFetcher();
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const isPending = fetcher.state !== "idle";

  // Optimistic status — show the value the user just submitted immediately
  const optimisticStatus: "PRESENT" | "ABSENT" | null = fetcher.formData
    ? (fetcher.formData.get("status") as "PRESENT" | "ABSENT")
    : currentStatus;

  const initials = (firstName[0] ?? "") + (lastName[0] ?? "");

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || typeof fetcher.data !== "object") {
      return;
    }

    const data = fetcher.data as {
      error?: string;
      success?: string | boolean;
      status?: "PRESENT" | "ABSENT";
    };
    const message =
      data.error ??
      (data.status
        ? `${firstName} ${lastName} marked ${data.status === "PRESENT" ? "present" : "absent"}.`
        : typeof data.success === "string"
          ? data.success
          : null);

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: data.error ? "error" : "success",
      message,
    });

    if (!data.error && data.status) {
      setSavedMessage(`Saved ${data.status === "PRESENT" ? "present" : "absent"}`);
    }
  }, [fetcher.data, fetcher.state, firstName, lastName, showToast]);

  useEffect(() => {
    if (!savedMessage) return;
    const timeoutId = window.setTimeout(() => setSavedMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [savedMessage]);

  return (
    <li className="border-b border-gray-100 px-3 py-3 transition-colors last:border-b-0 hover:bg-gray-50 sm:px-4 sm:py-3.5">
      <div className="flex items-start gap-3">
        <label className="mt-1 shrink-0 cursor-pointer">
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
          {optimisticStatus && (
            <p
              className={`mt-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em] sm:text-xs ${
                optimisticStatus === "PRESENT" ? "text-green-600" : "text-red-500"
              }`}
            >
              {optimisticStatus === "PRESENT" ? "Present" : "Absent"}
            </p>
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
          disabled={disabled}
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
          disabled={disabled}
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
