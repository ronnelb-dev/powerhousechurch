// app/routes/portal/attendance.tsx
import {
  useLoaderData,
  Form,
  useActionData,
  useFetchers,
  useLocation,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AttendanceMarkRow } from "~/components/church/AttendanceMarkRow";
import { EmptyState } from "~/components/ui/EmptyState";
import { PendingButton } from "~/components/ui/PendingButton";
import { PortalHeader, PortalPage, PortalSection } from "~/components/ui/Portal";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";
import {
  assertAttendanceRole,
  resolveAttendanceMembers,
  updateAttendanceRecords,
  type AttendanceStatus,
  type AttendanceType,
} from "~/lib/attendance.server";
import {
  AttendanceActionSchema,
  AttendanceLoaderFiltersSchema,
} from "~/lib/schemas.server";
import {
  getChurchCalendarDate,
  isCalendarDate,
  calendarDateToUtc,
} from "~/lib/calendar-date";
import {
  filterAttendanceMembers,
  projectAttendanceMap,
  pruneSelectedIds,
  type AttendanceStatusFilter,
} from "~/lib/attendance-ui";

export const meta: MetaFunction = () => [
  { title: "Attendance — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  assertAttendanceRole(user);

  const url = new URL(request.url);
  const churchToday = getChurchCalendarDate();
  const requestedDate = url.searchParams.get("date");
  const requestedType = url.searchParams.get("type");
  const requestedCellGroupId = url.searchParams.get("cellGroupId");
  const parsedFilters = AttendanceLoaderFiltersSchema.safeParse({
    date: requestedDate || undefined,
    type: requestedType || undefined,
    cellGroupId: requestedCellGroupId || undefined,
  });
  const notices: string[] = [];
  const date =
    requestedDate && isCalendarDate(requestedDate) ? requestedDate : churchToday;
  const type: AttendanceType =
    requestedType === "SUNDAY_SERVICE" || requestedType === "CELL_GROUP"
      ? requestedType
      : "SUNDAY_SERVICE";

  if (!parsedFilters.success && requestedDate && !isCalendarDate(requestedDate)) {
    notices.push("The selected date was invalid, so attendance was reset to today.");
  }
  if (
    requestedType &&
    requestedType !== "SUNDAY_SERVICE" &&
    requestedType !== "CELL_GROUP"
  ) {
    notices.push("The attendance type was invalid, so Sunday Service was selected.");
  }

  const selectedDate = calendarDateToUtc(date);
  const isFuture = date > churchToday;

  // Determine which cell group to show
  // ADMIN sees all members (or can filter); CELL_LEADER sees own group
  let members: { id: string; firstName: string; lastName: string }[] = [];
  const cellGroups =
    user.role === "ADMIN"
      ? await db.cellGroup.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];
  const validCellGroupIds = new Set(cellGroups.map((group) => group.id));
  const selectedCellGroupId =
    user.role === "ADMIN" &&
    requestedCellGroupId &&
    validCellGroupIds.has(requestedCellGroupId)
      ? requestedCellGroupId
      : "";

  if (
    user.role === "ADMIN" &&
    requestedCellGroupId &&
    !validCellGroupIds.has(requestedCellGroupId)
  ) {
    notices.push("The selected cell group is unavailable, so all groups are shown.");
  }

  if (user.role === "ADMIN") {
    members = await db.user.findMany({
      where: {
        isActive: true,
        role: "MEMBER",
        ...(selectedCellGroupId ? { cellGroupId: selectedCellGroupId } : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });
  } else {
    // CELL_LEADER sees their own group only
    if (!user.cellGroupId) {
      return {
        members: [],
        attendanceMap: {},
        date,
        type,
        isFuture,
        churchToday,
        filterNotice: notices.join(" "),
        cellGroups: [],
        selectedCellGroupId,
      };
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

  return {
    members,
    attendanceMap,
    date,
    type,
    isFuture,
    churchToday,
    filterNotice: notices.join(" "),
    cellGroups,
    selectedCellGroupId,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  assertAttendanceRole(user);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const rawInput = {
    intent,
    date: String(formData.get("date") ?? ""),
    type: String(formData.get("type") ?? ""),
    ...(intent.startsWith("bulk")
      ? { userIds: formData.getAll("userIds").map(String) }
      : {
          userId: String(formData.get("userId") ?? ""),
          ...(intent === "markAttendance"
            ? { status: String(formData.get("status") ?? "") }
            : {}),
        }),
  };
  const parsed = AttendanceActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid attendance request.",
    };
  }

  const input = parsed.data;
  if (input.date > getChurchCalendarDate()) {
    return {
      ok: false as const,
      error: "Cannot mark attendance for a future date.",
    };
  }

  const userIds =
    "userIds" in input ? input.userIds : [input.userId];
  const members = await resolveAttendanceMembers({ actor: user, userIds });
  if (!members) {
    return {
      ok: false as const,
      error: "Some selected members are unavailable or inactive.",
    };
  }

  const status: AttendanceStatus | null =
    input.intent === "markAttendance"
      ? input.status
      : input.intent === "bulkMarkPresent"
        ? "PRESENT"
        : input.intent === "bulkMarkAbsent"
          ? "ABSENT"
          : null;
  const isBulk = input.intent.startsWith("bulk");
  const result = await updateAttendanceRecords({
    actorId: user.id,
    members,
    date: input.date,
    type: input.type,
    status,
    atomic: isBulk,
  });

  if (status || result.affectedIds.length > 0) {
    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: status
        ? isBulk
          ? "attendance.mark.bulk"
          : "attendance.mark"
        : isBulk
          ? "attendance.clear.bulk"
          : "attendance.clear",
      entityType: "attendance",
      entityId: isBulk
        ? `${input.type}:${input.date}:bulk`
        : `${userIds[0]}:${input.type}:${input.date}`,
      summary: status
        ? `Marked ${userIds.length} member${userIds.length === 1 ? "" : "s"} ${status.toLowerCase()} for ${input.date}`
        : `Cleared attendance for ${result.affectedIds.length} member${result.affectedIds.length === 1 ? "" : "s"} on ${input.date}`,
      details: {
        memberIds: userIds,
        attendanceType: input.type,
        date: input.date,
        previousStatuses: result.previousStatuses,
        nextStatus: status,
      },
    });
  }

  const message = status
    ? `Marked ${userIds.length === 1 ? "member" : `${userIds.length} members`} ${status === "PRESENT" ? "present" : "absent"}.`
    : result.affectedIds.length > 0
      ? `Cleared attendance for ${result.affectedIds.length === 1 ? "member" : `${result.affectedIds.length} members`}.`
      : "The selected member was already unmarked.";

  return {
    ok: true as const,
    message,
    affectedIds: result.affectedIds,
    status,
  };
}

export default function AttendancePage() {
  const {
    members,
    attendanceMap,
    date,
    type,
    isFuture,
    churchToday,
    filterNotice,
    cellGroups,
    selectedCellGroupId,
  } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetchers = useFetchers();
  const navigation = useNavigation();
  const location = useLocation();
  const lastToastRef = useRef<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] =
    useState<AttendanceStatusFilter>("ALL");
  const projectedAttendanceMap = useMemo(
    () =>
      projectAttendanceMap(attendanceMap, [
        ...(navigation.formData ? [{ formData: navigation.formData }] : []),
        ...fetchers
          .filter((fetcher) => fetcher.state !== "idle" && fetcher.formData)
          .map((fetcher) => ({ formData: fetcher.formData })),
      ]),
    [attendanceMap, fetchers, navigation.formData],
  );
  const effectiveSearch = members.length > 100 ? deferredSearch : search;
  const visibleMembers = useMemo(
    () =>
      filterAttendanceMembers(
        members,
        projectedAttendanceMap,
        effectiveSearch,
        statusFilter,
      ),
    [effectiveSearch, members, projectedAttendanceMap, statusFilter],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const presentCount = Object.values(projectedAttendanceMap).filter(
    (status) => status === "PRESENT",
  ).length;
  const absentCount = Object.values(projectedAttendanceMap).filter(
    (status) => status === "ABSENT",
  ).length;
  const unmarkedCount = members.length - presentCount - absentCount;
  const pendingIntent =
    navigation.state !== "idle"
      ? String(navigation.formData?.get("intent") ?? "")
      : "";
  const presentBulkPending = pendingIntent === "bulkMarkPresent";
  const absentBulkPending = pendingIntent === "bulkMarkAbsent";
  const clearBulkPending = pendingIntent === "bulkClearAttendance";
  const bulkPending =
    presentBulkPending || absentBulkPending || clearBulkPending;
  const isRefreshing =
    navigation.state === "loading" &&
    navigation.location?.pathname === location.pathname;
  const visibleUnmarkedIds = visibleMembers
    .filter((member) => !projectedAttendanceMap[member.id])
    .map((member) => member.id);

  const toggleSelected = (userId: string) => {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [date, selectedCellGroupId, type]);

  useEffect(() => {
    if (bulkPending) return;
    setSelectedIds((current) => {
      const next = pruneSelectedIds(current, visibleMembers);
      return next.length === current.length ? current : next;
    });
  }, [bulkPending, visibleMembers]);

  useEffect(() => {
    if (navigation.state === "submitting") {
      lastToastRef.current = null;
    }
  }, [navigation.state]);

  useEffect(() => {
    if (navigation.state !== "idle") {
      return;
    }

    const message = actionData?.ok ? actionData.message : actionData?.error;

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    if (actionData?.ok) {
      toast.success(message, { role: "status" });
    } else {
      toast.error(message, { autoClose: 6000, role: "alert" });
    }

    if (actionData?.ok) {
      setSelectedIds([]);
    }
  }, [actionData, navigation.state]);

  const statusTabs: Array<{
    value: AttendanceStatusFilter;
    label: string;
    count: number;
  }> = [
    { value: "ALL", label: "All", count: members.length },
    { value: "PRESENT", label: "Present", count: presentCount },
    { value: "ABSENT", label: "Absent", count: absentCount },
    { value: "UNMARKED", label: "Unmarked", count: unmarkedCount },
  ];

  return (
    <PortalPage
      className={`max-w-3xl ${selectedIds.length > 0 ? "pb-36 md:pb-6" : ""}`}
      style={{ maxWidth: "48rem" }}
    >
      <PortalHeader
        eyebrow="Members Portal"
        title="Attendance"
        subtitle="Mark attendance quickly, correct mistakes, and keep every church day accurate."
      />

      {filterNotice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-sans text-amber-800"
        >
          {filterNotice}
        </div>
      ) : null}

      <Form
        method="get"
        className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2 sm:p-4"
        aria-label="Attendance context"
      >
        <div>
          <label
            htmlFor="date"
            className="mb-1.5 block text-xs font-sans font-bold text-gray-600"
          >
            Church date
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={date}
            max={churchToday}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-sans font-bold text-gray-600">
            Gathering
          </legend>
          <div className="grid grid-cols-2 gap-2">
          {(["SUNDAY_SERVICE", "CELL_GROUP"] as const).map((t) => (
            <label key={t} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                defaultChecked={type === t}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="peer sr-only"
              />
              <span
                className={[
                  "flex min-h-11 items-center justify-center rounded-lg border px-3 py-2.5 text-center text-xs font-sans font-bold",
                  "cursor-pointer transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-red-300 peer-focus-visible:ring-offset-2",
                  type === t
                    ? "bg-red-700 text-white border-red-700"
                    : "bg-white text-gray-600 border-gray-200 hover:border-red-300",
                ].join(" ")}
              >
                {t === "SUNDAY_SERVICE" ? "Sunday Service" : "Cell Group"}
              </span>
            </label>
          ))}
          </div>
        </fieldset>

        {cellGroups.length > 0 && (
          <div className="sm:col-span-2">
            <label
              htmlFor="cellGroupId"
              className="mb-1.5 block text-xs font-sans font-bold text-gray-600"
            >
              Cell group
            </label>
            <select
              id="cellGroupId"
              name="cellGroupId"
              defaultValue={selectedCellGroupId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="min-h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="">All Groups</option>
              {cellGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>{cg.name}</option>
              ))}
            </select>
          </div>
        )}
      </Form>

      {members.length > 0 && (
        <div
          className="mb-4 grid grid-cols-3 gap-2 text-center font-sans text-xs sm:text-sm"
          aria-live="polite"
        >
          <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2.5">
            <p className="font-bold text-green-700">{presentCount}</p>
            <p className="mt-0.5 text-green-600">Present</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
            <p className="font-bold text-red-700">{absentCount}</p>
            <p className="mt-0.5 text-red-600">Absent</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="font-bold text-gray-700">{unmarkedCount}</p>
            <p className="mt-0.5 text-gray-500">Unmarked</p>
          </div>
        </div>
      )}

      {members.length > 0 && (
        <>
          <section className="mb-4 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
            <label
              htmlFor="attendance-search"
              className="mb-1.5 block text-xs font-sans font-bold text-gray-600"
            >
              Find a member
            </label>
            <input
              id="attendance-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search first or last name"
              className="min-h-11 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
            />

            <div
              className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="group"
              aria-label="Filter members by attendance status"
            >
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={statusFilter === tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={[
                    "min-h-11 rounded-lg border px-3 py-2 text-xs font-sans font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-red-300",
                    statusFilter === tab.value
                      ? "border-red-700 bg-red-700 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:text-red-700",
                  ].join(" ")}
                >
                  {tab.label} <span aria-hidden="true">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(visibleMembers.map((member) => member.id))
                }
                disabled={visibleMembers.length === 0 || bulkPending}
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-sans font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select all visible
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(visibleUnmarkedIds)}
                disabled={visibleUnmarkedIds.length === 0 || bulkPending}
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-sans font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select all unmarked
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                disabled={selectedIds.length === 0 || bulkPending}
                className="min-h-11 rounded-lg px-3 py-2 text-xs font-sans font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear selection
              </button>
              <p className="ml-auto text-xs font-sans font-bold text-gray-500" aria-live="polite">
                {selectedIds.length} selected
              </p>
            </div>
          </section>

          {selectedIds.length > 0 ? (
            <Form
              method="post"
              className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:static md:mb-4 md:rounded-lg md:p-4 md:shadow-sm"
              aria-label="Bulk attendance actions"
            >
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="type" value={type} />
              {selectedIds.map((userId) => (
                <input key={userId} type="hidden" name="userIds" value={userId} />
              ))}

              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-sans text-sm font-bold text-gray-900">
                  {selectedIds.length} selected
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  disabled={bulkPending}
                  className="min-h-11 px-2 text-xs font-sans font-bold text-gray-500 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <PendingButton
                  type="submit"
                  name="intent"
                  value="bulkMarkAbsent"
                  isPending={absentBulkPending}
                  pendingText="Saving..."
                  disabled={isFuture || bulkPending}
                  className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs font-sans font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:text-sm"
                >
                  Absent
                </PendingButton>
                <PendingButton
                  type="submit"
                  name="intent"
                  value="bulkClearAttendance"
                  isPending={clearBulkPending}
                  pendingText="Clearing..."
                  disabled={isFuture || bulkPending}
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        `Clear attendance for ${selectedIds.length} selected member${selectedIds.length === 1 ? "" : "s"} on ${date}?`,
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                  className="min-h-11 rounded-lg border border-amber-200 bg-white px-2 py-2 text-xs font-sans font-bold text-amber-800 transition-colors hover:bg-amber-50 disabled:opacity-50 sm:text-sm"
                >
                  Unmark
                </PendingButton>
                <PendingButton
                  type="submit"
                  name="intent"
                  value="bulkMarkPresent"
                  isPending={presentBulkPending}
                  pendingText="Saving..."
                  disabled={isFuture || bulkPending}
                  className="min-h-11 rounded-lg bg-red-700 px-2 py-2 text-xs font-sans font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-50 sm:text-sm"
                >
                  Present
                </PendingButton>
              </div>
            </Form>
          ) : null}
        </>
      )}

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
        visibleMembers.length > 0 ? (
        <PortalSection className="relative overflow-hidden p-0">
          {isRefreshing ? <AttendanceListSkeleton /> : null}
          <ul
            role="list"
            aria-label="Members attendance list"
            className={isRefreshing ? "pointer-events-none opacity-40" : undefined}
          >
            {visibleMembers.map((member) => (
              <AttendanceMarkRow
                key={member.id}
                userId={member.id}
                firstName={member.firstName}
                lastName={member.lastName}
                currentStatus={projectedAttendanceMap[member.id] ?? null}
                date={date}
                type={type}
                disabled={isFuture}
                selected={selectedSet.has(member.id)}
                onToggleSelect={toggleSelected}
              />
            ))}
          </ul>
        </PortalSection>
        ) : (
          <EmptyState
            icon="attendance"
            title="No matching members"
            message="Try a different name or attendance status filter."
          />
        )
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

function AttendanceListSkeleton() {
  return (
    <div
      className="absolute inset-0 z-10 bg-white/95 p-4"
      role="status"
      aria-live="polite"
      aria-label="Refreshing attendance list"
    >
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-gray-200 motion-safe:animate-pulse" />
              <div className="h-10 w-10 rounded-full bg-red-100 motion-safe:animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-gray-200 motion-safe:animate-pulse" />
                <div className="h-3 w-20 rounded bg-gray-100 motion-safe:animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <div className="h-10 rounded-xl bg-green-100 motion-safe:animate-pulse sm:w-20" />
              <div className="h-10 rounded-xl bg-red-100 motion-safe:animate-pulse sm:w-20" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Refreshing attendance list</span>
    </div>
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
