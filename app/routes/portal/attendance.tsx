// app/routes/portal/attendance.tsx
import {
  useLoaderData,
  Form,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AttendanceMarkRow } from "~/components/church/AttendanceMarkRow";
import { EmptyState } from "~/components/ui/EmptyState";

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
  const userId = formData.get("userId") as string;
  const date   = formData.get("date") as string;
  const type   = formData.get("type") as "SUNDAY_SERVICE" | "CELL_GROUP";
  const status = formData.get("status") as "PRESENT" | "ABSENT";

  // Prevent marking future dates
  const selectedDate = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate > today) {
    return { error: "Cannot mark attendance for a future date." };
  }

  // CELL_LEADER can only mark members in their own group
  if (user.role === "CELL_LEADER") {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { cellGroupId: true },
    });
    if (targetUser?.cellGroupId !== user.cellGroupId) {
      throw new Response("Forbidden", { status: 403 });
    }
  }

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

  return { success: true };
}

export default function AttendancePage() {
  const { members, attendanceMap, date, type, isFuture, cellGroups } =
    useLoaderData<typeof loader>();

  const presentCount = Object.values(attendanceMap).filter((s) => s === "PRESENT").length;
  const absentCount  = Object.values(attendanceMap).filter((s) => s === "ABSENT").length;

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">
        Attendance
      </h1>
      <p className="text-sm text-gray-400 font-sans mb-8">
        Mark attendance with a single tap. Records save instantly.
      </p>

      {/* Controls */}
      <Form method="get" className="flex flex-wrap gap-3 mb-6">
        {/* Date picker */}
        <div>
          <label htmlFor="date" className="sr-only">Select date</label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="px-4 py-2.5 text-sm font-sans border border-gray-200
                       rounded-lg bg-white text-gray-700 focus:outline-none
                       focus:ring-2 focus:ring-red-300 cursor-pointer"
          />
        </div>

        {/* Type toggle */}
        <fieldset className="flex gap-2" aria-label="Attendance type">
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
                  "inline-block px-4 py-2.5 text-xs font-sans font-bold rounded-lg",
                  "border transition-all cursor-pointer",
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
            className="px-4 py-2.5 text-sm font-sans border border-gray-200
                       rounded-lg bg-white text-gray-700 focus:outline-none
                       focus:ring-2 focus:ring-red-300 cursor-pointer"
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
        <div className="flex gap-4 mb-6 text-sm font-sans">
          <span className="text-green-600 font-bold">{presentCount} present</span>
          <span className="text-gray-300">·</span>
          <span className="text-red-600 font-bold">{absentCount} absent</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400">
            {members.length - presentCount - absentCount} unmarked
          </span>
        </div>
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
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
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
              />
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon="members"
          title="No members to mark"
          message="No members are assigned to this group yet. Contact your administrator."
        />
      )}
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
