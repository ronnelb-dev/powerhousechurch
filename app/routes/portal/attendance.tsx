// app/routes/portal/attendance.tsx
import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { useEffect, useRef, useState } from "react";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AttendanceMarkRow } from "~/components/church/AttendanceMarkRow";
import { EmptyState } from "~/components/ui/EmptyState";
import { PendingButton } from "~/components/ui/PendingButton";
import { PortalHeader, PortalPage, PortalSection } from "~/components/ui/Portal";
import { useToast } from "~/components/ui/ToastProvider";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";

export const meta: MetaFunction = () => [
  { title: "Attendance — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);

  // Only CELL_LEADER and ADMIN can mark attendance
  if (user.role === "MEMBER") {
    throw new Response("Forbidden", { status: 403 });
  }

  const url  = new URL(request.url);
  const type = (url.searchParams.get("type") ?? "SUNDAY_SERVICE") as
    "SUNDAY_SERVICE" | "CELL_GROUP";

  // Default date = today formatted as YYYY-MM-DD
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultDate = today.toISOString().slice(0, 10);
  const dateParam   = url.searchParams.get("date") ?? defaultDate;
  const selectedDate = new Date(dateParam + "T00:00:00");
  const isFuture = selectedDate > today;

  // Determine which cell group to show
  // ADMIN sees all members (or can filter); CELL_LEADER sees own group
  let members: { id: string; firstName: string; lastName: string }[] = [];

  if (user.role === "ADMIN") {
    const groupId = url.searchParams.get("cellGroupId") ?? user.cellGroupId;
    members = await db.user.findMany({
      where: { isActive: true, role: "MEMBER", ...(groupId ? { cellGroupId: groupId } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });
  } else {
    // CELL_LEADER sees their own group only
    if (!user.cellGroupId) {
      return { members: [], attendanceMap: {}, date: dateParam, type, isFuture, cellGroups: [] };
    }
    members = await db.user.findMany({
      where: { isActive: true, cellGroupId: user.cellGroupId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });
  }

  // Fetch existing attendance records for the selected date
  const records = await db.attendance.findMany({
    where: {
      userId: { in: members.map((m) => m.id) },
      type,
      date: selectedDate,
    },
    select: { userId: true, status: true },
  });
  const attendanceMap = Object.fromEntries(
    records.map((r) => [r.userId, r.status as "PRESENT" | "ABSENT"])
  );

  // For admin dropdown
  const cellGroups =
    user.role === "ADMIN"
      ? await db.cellGroup.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return { members, attendanceMap, date: dateParam, type, isFuture, cellGroups };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  if (user.role === "MEMBER") throw new Response("Forbidden", { status: 403 });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const date   = formData.get("date") as string;
  const type   = formData.get("type") as "SUNDAY_SERVICE" | "CELL_GROUP";

  // Prevent marking future dates
  const selectedDate = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate > today) {
    return { error: "Cannot mark attendance for a future date." };
  }

  const assertLeaderAccess = async (userIds: string[]) => {
    if (user.role !== "CELL_LEADER") return;
    const allowedMembers = await db.user.findMany({
      where: {
        id: { in: userIds },
        cellGroupId: user.cellGroupId ?? "__no_group__",
      },
      select: { id: true },
    });
    if (allowedMembers.length !== userIds.length) {
      throw new Response("Forbidden", { status: 403 });
    }
  };

  if (intent === "bulkMarkPresent" || intent === "bulkMarkAbsent") {
    const nextStatus = intent === "bulkMarkPresent" ? "PRESENT" : "ABSENT";
    const userIds = formData
      .getAll("userIds")
      .map((value) => String(value))
      .filter(Boolean);

    if (userIds.length === 0) {
      return { error: "Select at least one member first." };
    }

    await assertLeaderAccess(userIds);

    const existingRecords = await db.attendance.findMany({
      where: {
        userId: { in: userIds },
        type,
        date: selectedDate,
      },
      select: { userId: true, status: true },
    });
    const previousStatuses = new Map(
      existingRecords.map((record) => [record.userId, record.status]),
    );

    await Promise.all(
      userIds.map((userId) =>
        db.attendance.upsert({
          where: { userId_type_date: { userId, type, date: selectedDate } },
          update: { status: nextStatus, markedById: user.id },
          create: {
            userId,
            type,
            status: nextStatus,
            date: selectedDate,
            markedById: user.id,
            cellGroupId: user.cellGroupId ?? undefined,
          },
        }),
      ),
    );

    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "attendance.mark.bulk",
      entityType: "attendance",
      entityId: `${type}:${date}:bulk-${nextStatus.toLowerCase()}`,
      summary: `Marked ${userIds.length} members ${nextStatus.toLowerCase()} for ${date}`,
      details: {
        memberIds: userIds,
        attendanceType: type,
        date,
        previousStatuses: Object.fromEntries(previousStatuses),
        nextStatus,
      },
    });

    return {
      success: `Marked ${userIds.length} member${userIds.length === 1 ? "" : "s"} ${nextStatus === "PRESENT" ? "present" : "absent"}.`,
    };
  }

  const userId = formData.get("userId") as string;
  const status = formData.get("status") as "PRESENT" | "ABSENT";

  await assertLeaderAccess([userId]);

  const previousRecord = await db.attendance.findUnique({
    where: { userId_type_date: { userId, type, date: selectedDate } },
    select: { status: true },
  });

  await db.attendance.upsert({
    where: { userId_type_date: { userId, type, date: selectedDate } },
    update: { status, markedById: user.id },
    create: {
      userId,
      type,
      status,
      date: selectedDate,
      markedById: user.id,
      cellGroupId: user.cellGroupId ?? undefined,
    },
  });

  await recordAdminAuditEvent({
    request,
    actorId: user.id,
    actorRole: user.role,
    action: "attendance.mark",
    entityType: "attendance",
    entityId: `${userId}:${type}:${date}`,
    summary: `${previousRecord ? "Updated" : "Created"} ${type.toLowerCase()} attendance for ${date}`,
    details: {
      memberId: userId,
      attendanceType: type,
      date,
      previousStatus: previousRecord?.status ?? null,
      nextStatus: status,
    },
  });

  return {
    success: `Marked member ${status === "PRESENT" ? "present" : "absent"}.`,
    status,
  };
}

export default function AttendancePage() {
  const { members, attendanceMap, date, type, isFuture, cellGroups } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const feedback =
    actionData && typeof actionData === "object" && ("error" in actionData || "success" in actionData)
      ? actionData
      : null;

  const presentCount = Object.values(attendanceMap).filter((s) => s === "PRESENT").length;
  const absentCount  = Object.values(attendanceMap).filter((s) => s === "ABSENT").length;
  const pendingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : "";
  const presentBulkPending = pendingIntent === "bulkMarkPresent";
  const absentBulkPending = pendingIntent === "bulkMarkAbsent";
  const bulkPending = presentBulkPending || absentBulkPending;

  const toggleSelected = (userId: string) => {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  useEffect(() => {
    const message =
      feedback && "error" in feedback && feedback.error
        ? feedback.error
        : feedback && "success" in feedback && feedback.success
          ? feedback.success
          : null;

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: feedback && "error" in feedback && feedback.error ? "error" : "success",
      message: String(message),
    });

    if (feedback && "success" in feedback && feedback.success) {
      setSelectedIds([]);
    }
  }, [feedback, showToast]);

  return (
    <PortalPage className="max-w-3xl">
      <PortalHeader
        eyebrow="Members Portal"
        title="Attendance"
        subtitle="Mark attendance with a single tap. Records save instantly."
      />

      {/* Controls */}
      <Form method="get" className="mb-5 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        {/* Date picker */}
        <div className="w-full">
          <label htmlFor="date" className="sr-only">Select date</label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-full cursor-pointer rounded-lg border border-gray-200
                       bg-white px-4 py-2.5 text-sm font-sans text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        {/* Type toggle */}
        <fieldset className="grid grid-cols-2 gap-2" aria-label="Attendance type">
          {(["SUNDAY_SERVICE", "CELL_GROUP"] as const).map((t) => (
            <label key={t} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                defaultChecked={type === t}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="sr-only"
              />
              <span
                className={[
                  "flex min-h-11 items-center justify-center rounded-lg border px-3 py-2.5 text-center text-xs font-sans font-bold",
                  "cursor-pointer transition-all",
                  type === t
                    ? "bg-red-700 text-white border-red-700"
                    : "bg-white text-gray-600 border-gray-200 hover:border-red-300",
                ].join(" ")}
              >
                {t === "SUNDAY_SERVICE" ? "Sunday Service" : "Cell Group"}
              </span>
            </label>
          ))}
        </fieldset>

        {/* Cell group selector (admin only) */}
        {cellGroups.length > 0 && (
          <select
            name="cellGroupId"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-full cursor-pointer rounded-lg border border-gray-200
                       bg-white px-4 py-2.5 text-sm font-sans text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-red-300"
            aria-label="Filter by cell group"
          >
            <option value="">All Groups</option>
            {cellGroups.map((cg) => (
              <option key={cg.id} value={cg.id}>{cg.name}</option>
            ))}
          </select>
        )}
      </Form>

      {/* Summary strip */}
      {members.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2 text-center font-sans text-xs sm:mb-6 sm:text-sm">
          <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2.5">
            <p className="font-bold text-green-700">{presentCount}</p>
            <p className="mt-0.5 text-green-600">Present</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
            <p className="font-bold text-red-700">{absentCount}</p>
            <p className="mt-0.5 text-red-600">Absent</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="font-bold text-gray-700">{members.length - presentCount - absentCount}</p>
            <p className="mt-0.5 text-gray-500">Unmarked</p>
          </div>
        </div>
      )}

      {members.length > 0 && (
        <Form
          method="post"
          className="mb-5 rounded-lg border border-gray-200 bg-white p-4"
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="type" value={type} />
          {selectedIds.map((userId) => (
            <input key={userId} type="hidden" name="userIds" value={userId} />
          ))}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-sans text-sm font-bold text-gray-900">
                {selectedIds.length} selected
              </p>
              <p className="mt-1 font-sans text-xs text-gray-500">
                Choose members below, then mark them present or absent in one step.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                disabled={selectedIds.length === 0 || bulkPending}
                className="min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-sans font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
              <PendingButton
                type="submit"
                name="intent"
                value="bulkMarkAbsent"
                isPending={absentBulkPending}
                pendingText="Saving..."
                disabled={selectedIds.length === 0 || isFuture || bulkPending}
                className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-sans font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark Absent
              </PendingButton>
              <PendingButton
                type="submit"
                name="intent"
                value="bulkMarkPresent"
                isPending={presentBulkPending}
                pendingText="Saving..."
                disabled={selectedIds.length === 0 || isFuture || bulkPending}
                className="min-h-10 rounded-lg bg-red-700 px-4 py-2 text-sm font-sans font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark Present
              </PendingButton>
            </div>
          </div>
        </Form>
      )}

      {/* Future date warning */}
      {isFuture && (
        <div
          role="alert"
          className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200
                     rounded-lg text-sm font-sans text-amber-700"
        >
          This date is in the future. Attendance cannot be marked yet.
        </div>
      )}

      {/* Member list */}
      {members.length > 0 ? (
        <PortalSection className="overflow-hidden p-0">
          <ul
            role="list"
            aria-label="Members attendance list"
          >
            {members.map((member) => (
              <AttendanceMarkRow
                key={member.id}
                userId={member.id}
                firstName={member.firstName}
                lastName={member.lastName}
                currentStatus={attendanceMap[member.id] ?? null}
                date={date}
                type={type}
                disabled={isFuture}
                selected={selectedIds.includes(member.id)}
                onToggleSelect={toggleSelected}
              />
            ))}
          </ul>
        </PortalSection>
      ) : (
        <EmptyState
          icon="members"
          title="No members to mark"
          message="No members are assigned to this group yet. Contact your administrator."
        />
      )}
    </PortalPage>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="attendance"
        title={
          isRouteErrorResponse(error) && error.status === 403
            ? "Access Denied"
            : "Attendance Unavailable"
        }
        message={
          isRouteErrorResponse(error)
            ? error.status === 403
              ? "Only cell leaders and admins can mark attendance."
              : error.data
            : "Please refresh the page."
        }
      />
    </div>
  );
}
