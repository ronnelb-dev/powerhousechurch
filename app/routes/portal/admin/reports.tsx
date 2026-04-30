import {
  Form,
  isRouteErrorResponse,
  useLoaderData,
  useNavigation,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";

type AttendanceTrendPoint = {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  presentCount: number;
  absentCount: number;
  markedCount: number;
  unmarkedCount: number;
  attendanceRate: number;
};

type MemberGrowthPoint = {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  newMembers: number;
  totalMembers: number;
};

type TrendChartPoint = {
  label: string;
  fullLabel: string;
  value: number;
  detail?: string;
};

interface TrendChartProps {
  id: string;
  data: TrendChartPoint[];
  ariaLabel: string;
  stroke: string;
  fillFrom: string;
  fillTo: string;
  valueFormatter: (value: number) => string;
}

export const meta: MetaFunction = () => [{ title: "Reports & Analytics — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const auditLogModel = (db as unknown as {
    adminAuditLog?: {
      findMany(args: unknown): Promise<Array<{
        id: string;
        actorRole: string;
        action: string;
        entityType: string;
        summary: string;
        createdAt: Date;
        actor: { firstName: string; lastName: string } | null;
      }>>;
    };
  }).adminAuditLog;

  const sundaySeries = getLastNSundays(12);
  const monthSeries = getLastNMonths(12);
  const firstSunday = sundaySeries[0] ?? getMostRecentSunday();
  const lastSunday = sundaySeries[sundaySeries.length - 1] ?? firstSunday;

  const [
    cellGroups,
    classrooms,
    totalMembers,
    totalChildren,
    totalAttendance,
    totalChildAttendance,
    totalSermons,
    totalPrayers,
    attendanceRecords,
    memberRows,
    recentAuditLogs,
  ] = await Promise.all([
    db.cellGroup.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.childProfile.findMany({
      where: { classroom: { not: null } },
      distinct: ["classroom"],
      select: { classroom: true },
      orderBy: { classroom: "asc" },
    }),
    db.user.count({ where: { isActive: true } }),
    db.childProfile.count({ where: { isActive: true } }),
    db.attendance.count(),
    db.childAttendance.count(),
    db.sermon.count({ where: { isPublished: true } }),
    db.prayerRequest.count(),
    db.attendance.findMany({
      where: {
        type: "SUNDAY_SERVICE",
        date: { gte: firstSunday, lte: endOfDay(lastSunday) },
      },
      select: {
        date: true,
        status: true,
        user: { select: { isActive: true } },
      },
    }),
    db.user.findMany({
      where: { isActive: true },
      select: { createdAt: true },
    }),
    auditLogModel?.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        actorRole: true,
        action: true,
        entityType: true,
        summary: true,
        createdAt: true,
        actor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }) ?? Promise.resolve([]),
  ]);

  const attendanceTrend = buildAttendanceTrend({
    sundaySeries,
    records: attendanceRecords,
    totalMembers,
  });
  const memberGrowth = buildMemberGrowth({
    monthSeries,
    records: memberRows,
  });

  return {
    cellGroups,
    classrooms: classrooms
      .map((item) => item.classroom)
      .filter((room): room is string => Boolean(room)),
    totalMembers,
    totalChildren,
    totalSermons,
    totalAttendance,
    totalChildAttendance,
    totalPrayers,
    attendanceTrend,
    memberGrowth,
    recentAuditLogs: recentAuditLogs.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      actorName: entry.actor
        ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim()
        : "System",
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const startDate = new Date(`${String(formData.get("startDate") ?? "")}T00:00:00`);
  const endDate = new Date(`${String(formData.get("endDate") ?? "")}T23:59:59`);
  const audience = ((formData.get("audience") as string) || "adults") as
    | "adults"
    | "kids";
  const cellGroupId = (formData.get("cellGroupId") as string) || undefined;
  const classroom = (formData.get("classroom") as string) || undefined;
  const type = (formData.get("type") as string) || "SUNDAY_SERVICE";

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return new Response("Invalid date range", { status: 400 });
  }

  if (audience === "kids") {
    const records = await db.childAttendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        serviceType: type,
        ...(classroom ? { child: { classroom } } : {}),
      },
      include: {
        child: {
          include: {
            guardians: {
              orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { child: { lastName: "asc" } }],
    });

    const header =
      "Date,Last Name,First Name,Preferred Name,Classroom,Primary Guardian,Phone,Service Type,Status";
    const rows = records.map((record) => {
      const guardian = record.child.guardians[0];
      const date =
        record.date instanceof Date
          ? record.date.toLocaleDateString("en-PH", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
          : String(record.date).slice(0, 10);
      return [
        date,
        record.child.lastName,
        record.child.firstName,
        record.child.preferredName ?? "",
        record.child.classroom ?? "",
        guardian ? `${guardian.firstName} ${guardian.lastName}` : "",
        guardian?.phone ?? "",
        record.serviceType,
        record.status,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header, ...rows].join("\n");
    const filename = `kids-attendance-${type.toLowerCase().replace("_", "-")}-${startDate
      .toISOString()
      .slice(0, 10)}-to-${endDate.toISOString().slice(0, 10)}.csv`;

    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "report.export",
      entityType: "attendance_report",
      summary: `Exported kids attendance report for ${type}`,
      details: {
        audience,
        type,
        classroom: classroom ?? null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        rowCount: records.length,
      },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const records = await db.attendance.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      type,
      ...(cellGroupId ? { cellGroupId } : {}),
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      cellGroup: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { user: { lastName: "asc" } }],
  });

  const header = "Date,Last Name,First Name,Email,Phone,Cell Group,Type,Status";
  const rows = records.map((record) => {
    const date =
      record.date instanceof Date
        ? record.date.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : String(record.date).slice(0, 10);
    return [
      date,
      record.user.lastName,
      record.user.firstName,
      record.user.email ?? "",
      record.user.phone ?? "",
      record.cellGroup?.name ?? "Unassigned",
      record.type,
      record.status,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `attendance-${type.toLowerCase().replace("_", "-")}-${startDate
    .toISOString()
    .slice(0, 10)}-to-${endDate.toISOString().slice(0, 10)}.csv`;

  await recordAdminAuditEvent({
    request,
    actorId: user.id,
    actorRole: user.role,
    action: "report.export",
    entityType: "attendance_report",
    summary: `Exported adult attendance report for ${type}`,
    details: {
      audience,
      type,
      cellGroupId: cellGroupId ?? null,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      rowCount: records.length,
    },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function buildAttendanceTrend(args: {
  sundaySeries: Date[];
  records: Array<{
    date: Date;
    status: string;
    user: { isActive: boolean };
  }>;
  totalMembers: number;
}): AttendanceTrendPoint[] {
  const bucket = new Map<
    string,
    { presentCount: number; absentCount: number; markedCount: number }
  >();

  for (const record of args.records) {
    if (!record.user.isActive) continue;
    const key = toDateKey(record.date);
    const existing = bucket.get(key) ?? {
      presentCount: 0,
      absentCount: 0,
      markedCount: 0,
    };

    if (record.status === "PRESENT") {
      existing.presentCount += 1;
      existing.markedCount += 1;
    } else if (record.status === "ABSENT") {
      existing.absentCount += 1;
      existing.markedCount += 1;
    }

    bucket.set(key, existing);
  }

  return args.sundaySeries.map((sunday) => {
    const dateKey = toDateKey(sunday);
    const counts = bucket.get(dateKey) ?? {
      presentCount: 0,
      absentCount: 0,
      markedCount: 0,
    };
    const attendanceRate =
      args.totalMembers > 0
        ? Math.round((counts.presentCount / args.totalMembers) * 100)
        : 0;

    return {
      dateKey,
      shortLabel: sunday.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
      fullLabel: sunday.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      presentCount: counts.presentCount,
      absentCount: counts.absentCount,
      markedCount: counts.markedCount,
      unmarkedCount: Math.max(args.totalMembers - counts.markedCount, 0),
      attendanceRate,
    };
  });
}

function buildMemberGrowth(args: {
  monthSeries: Date[];
  records: Array<{ createdAt: Date }>;
}): MemberGrowthPoint[] {
  const firstMonth = args.monthSeries[0] ?? startOfMonth(new Date());
  const monthCounts = new Map<string, number>();
  let baselineMembers = 0;

  for (const record of args.records) {
    const month = startOfMonth(record.createdAt);
    if (month < firstMonth) {
      baselineMembers += 1;
      continue;
    }

    const key = toMonthKey(month);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  let runningTotal = baselineMembers;
  return args.monthSeries.map((month) => {
    const monthKey = toMonthKey(month);
    const newMembers = monthCounts.get(monthKey) ?? 0;
    runningTotal += newMembers;

    return {
      monthKey,
      shortLabel: month.toLocaleDateString("en-PH", {
        month: "short",
        year: "2-digit",
      }),
      fullLabel: month.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      }),
      newMembers,
      totalMembers: runningTotal,
    };
  });
}

function getMostRecentSunday(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function getLastNSundays(count: number) {
  const sundays: Date[] = [];
  const cursor = getMostRecentSunday();

  for (let index = 0; index < count; index += 1) {
    sundays.unshift(new Date(cursor));
    cursor.setDate(cursor.getDate() - 7);
  }

  return sundays;
}

function getLastNMonths(count: number) {
  const months: Date[] = [];
  const cursor = startOfMonth(new Date());
  cursor.setMonth(cursor.getMonth() - (count - 1));

  for (let index = 0; index < count; index += 1) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getAttendanceTone(rate: number) {
  if (rate >= 90) return "bg-emerald-600";
  if (rate >= 75) return "bg-emerald-400";
  if (rate >= 60) return "bg-amber-300";
  if (rate > 0) return "bg-amber-200";
  return "bg-gray-200";
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300";
const labelClass = "mb-1.5 block text-xs font-sans font-bold text-gray-600";

export default function AdminReportsPage() {
  const {
    cellGroups,
    classrooms,
    totalMembers,
    totalChildren,
    totalSermons,
    totalAttendance,
    totalChildAttendance,
    totalPrayers,
    attendanceTrend,
    memberGrowth,
    recentAuditLogs,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const latestAttendance = attendanceTrend[attendanceTrend.length - 1] ?? null;
  const averageAttendance =
    attendanceTrend.length > 0
      ? Math.round(
          attendanceTrend.reduce(
            (sum, point) => sum + point.presentCount,
            0,
          ) / attendanceTrend.length,
        )
      : 0;
  const bestAttendance =
    attendanceTrend.reduce<AttendanceTrendPoint | null>((best, point) => {
      if (!best || point.presentCount > best.presentCount) return point;
      return best;
    }, null) ?? latestAttendance;

  const firstGrowthPoint = memberGrowth[0] ?? null;
  const latestGrowthPoint = memberGrowth[memberGrowth.length - 1] ?? null;
  const newMembersLast12Months = memberGrowth.reduce(
    (sum, point) => sum + point.newMembers,
    0,
  );

  return (
    <div className="space-y-12">
      <div>
        <h1 className="mb-2 font-serif text-2xl font-bold text-gray-900">
          Reports & Analytics
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-gray-500 font-sans">
          Track attendance momentum and member growth from one leadership dashboard,
          then export raw records whenever you need to dig deeper.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Active Members", value: totalMembers },
          { label: "Active Children", value: totalChildren },
          { label: "Adult Attendance", value: totalAttendance },
          { label: "Kids Attendance", value: totalChildAttendance },
          { label: "Published Sermons", value: totalSermons },
          { label: "Prayer Requests", value: totalPrayers },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 font-sans">
              {label}
            </p>
            <p className="font-serif text-3xl font-bold text-gray-900">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-6">
        <div className="rounded-xl border border-gray-100 bg-white p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600 font-sans">
                12-Week Attendance Trend
              </p>
              <h2 className="mt-3 font-serif text-xl font-bold text-gray-900">
                Adult Sunday attendance over the last 12 Sundays
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500 font-sans">
                This trend uses the same week-by-week Sunday attendance history already
                reflected elsewhere in the portal, but rolls it up for leadership visibility.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
              <MetricTile label="Average attendance" value={`${averageAttendance}`} note="Per Sunday" />
              <MetricTile
                label="Latest Sunday"
                value={latestAttendance ? `${latestAttendance.attendanceRate}%` : "0%"}
                note={
                  latestAttendance
                    ? `${latestAttendance.presentCount} present`
                    : "No recent marks"
                }
              />
              <MetricTile
                label="Best week"
                value={bestAttendance ? `${bestAttendance.presentCount}` : "0"}
                note={bestAttendance ? bestAttendance.shortLabel : "No data"}
              />
            </div>
          </div>

          <div className="mt-8">
            <TrendChart
              id="attendance-trend"
              ariaLabel="Adult attendance for the last 12 Sundays"
              data={attendanceTrend.map((point) => ({
                label: point.shortLabel,
                fullLabel: point.fullLabel,
                value: point.presentCount,
                detail: `${point.attendanceRate}% of active members`,
              }))}
              stroke="#923034"
              fillFrom="rgba(146,48,52,0.24)"
              fillTo="rgba(146,48,52,0.03)"
              valueFormatter={(value) => `${value} attendees`}
            />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6 xl:grid-cols-12">
            {attendanceTrend.map((point) => (
              <div
                key={point.dateKey}
                className="rounded-lg border border-gray-100 bg-gray-50 p-2"
                title={`${point.fullLabel}: ${point.presentCount} present, ${point.unmarkedCount} unmarked`}
              >
                <div className={`h-2 rounded-full ${getAttendanceTone(point.attendanceRate)}`} />
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 font-sans">
                  {point.shortLabel}
                </p>
                <p className="mt-1 font-serif text-lg font-bold text-gray-900">
                  {point.presentCount}
                </p>
                <p className="text-[11px] text-gray-500 font-sans">
                  {point.attendanceRate}% rate
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-gray-100 bg-white p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600 font-sans">
                  Member Growth
                </p>
                <h2 className="mt-3 font-serif text-xl font-bold text-gray-900">
                  Active member growth curve
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 font-sans">
                  This curve shows the cumulative rise in active members across the last
                  12 months, anchored by each member&apos;s join date.
                </p>
              </div>
              <div className="grid gap-3 sm:min-w-[16rem]">
                <MetricTile
                  label="Current active"
                  value={latestGrowthPoint ? `${latestGrowthPoint.totalMembers}` : "0"}
                  note="Members in the portal"
                />
                <MetricTile
                  label="Added this year"
                  value={`${newMembersLast12Months}`}
                  note={
                    firstGrowthPoint && latestGrowthPoint
                      ? `${firstGrowthPoint.totalMembers} → ${latestGrowthPoint.totalMembers}`
                      : "No change"
                  }
                />
              </div>
            </div>

            <div className="mt-8">
              <TrendChart
                id="member-growth"
                ariaLabel="Active member growth over the last 12 months"
                data={memberGrowth.map((point) => ({
                  label: point.shortLabel,
                  fullLabel: point.fullLabel,
                  value: point.totalMembers,
                  detail: `${point.newMembers} new members`,
                }))}
                stroke="#2563eb"
                fillFrom="rgba(37,99,235,0.20)"
                fillTo="rgba(37,99,235,0.03)"
                valueFormatter={(value) => `${value} active members`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {memberGrowth.slice(-4).map((point) => (
                <div
                  key={point.monthKey}
                  className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700 font-sans">
                    {point.shortLabel}
                  </p>
                  <p className="mt-1 font-serif text-lg font-bold text-blue-950">
                    {point.totalMembers}
                  </p>
                  <p className="text-[11px] text-blue-700 font-sans">
                    +{point.newMembers} joined
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-xl rounded-xl border border-gray-100 bg-white p-7">
        <h2 className="mb-2 font-serif text-lg font-bold text-gray-800">
          Export Attendance (CSV)
        </h2>
        <p className="mb-6 text-sm leading-6 text-gray-500 font-sans">
          Download adult or kids ministry attendance for deeper review in Excel or Google Sheets.
        </p>

        <Form method="post" aria-label="Attendance export form">
          <div className="mb-4">
            <label htmlFor="report-audience" className={labelClass}>
              Attendance Audience
            </label>
            <select
              id="report-audience"
              name="audience"
              className={inputClass}
              defaultValue="adults"
            >
              <option value="adults">Adults</option>
              <option value="kids">Kids Ministry</option>
            </select>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className={labelClass}>
                Start Date *
              </label>
              <input
                id="startDate"
                type="date"
                name="startDate"
                defaultValue={thirtyAgo}
                required
                max={today}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="endDate" className={labelClass}>
                End Date *
              </label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                defaultValue={today}
                required
                max={today}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="report-type" className={labelClass}>
              Attendance Type
            </label>
            <select id="report-type" name="type" className={inputClass}>
              <option value="SUNDAY_SERVICE">Sunday Service</option>
              <option value="CELL_GROUP">Cell Group</option>
              <option value="KIDS_CHURCH">Kids Church</option>
              <option value="NURSERY">Nursery</option>
              <option value="SPECIAL_EVENT">Special Event</option>
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="report-cellGroup" className={labelClass}>
              Cell Group
            </label>
            <select id="report-cellGroup" name="cellGroupId" className={inputClass}>
              <option value="">All Groups</option>
              {cellGroups.map((cellGroup) => (
                <option key={cellGroup.id} value={cellGroup.id}>
                  {cellGroup.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="report-classroom" className={labelClass}>
              Kids Classroom
            </label>
            <select id="report-classroom" name="classroom" className={inputClass}>
              <option value="">All classrooms</option>
              {classrooms.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-400 font-sans"
          >
            {isGenerating ? (
              "Generating…"
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download CSV
              </>
            )}
          </button>
        </Form>

        <p className="mt-4 text-xs text-gray-400 font-sans">
          The CSV will download directly to your browser for spreadsheet analysis.
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-gray-800">
              Recent Admin Audit Activity
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500 font-sans">
              A quick view of the latest sensitive actions recorded across admin and leadership workflows.
            </p>
          </div>
          <div className="rounded-full bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-600">
            Last {recentAuditLogs.length}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {recentAuditLogs.length > 0 ? (
            recentAuditLogs.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-800">{entry.summary}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
                    {entry.actorRole}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 font-sans">
                  {entry.actorName} · {entry.action} · {new Date(entry.createdAt).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
              Audit activity will appear here after admins start using the tracked workflows.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 font-sans">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500 font-sans">{note}</p>
    </div>
  );
}

function TrendChart({
  id,
  data,
  ariaLabel,
  stroke,
  fillFrom,
  fillTo,
  valueFormatter,
}: TrendChartProps) {
  const width = 320;
  const height = 140;
  const paddingX = 14;
  const paddingY = 12;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const points = data.map((point, index) => {
    const x =
      data.length <= 1
        ? width / 2
        : paddingX + (index / (data.length - 1)) * innerWidth;
    const y =
      height - paddingY - Math.max(point.value, 0) / maxValue * innerHeight;
    return { ...point, x, y };
  });

  const areaPath =
    points.length > 0
      ? `M ${paddingX} ${height - paddingY} L ${points
          .map((point) => `${point.x} ${point.y}`)
          .join(" L ")} L ${paddingX + innerWidth} ${height - paddingY} Z`
      : "";
  const linePath = points.length > 0
    ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`
    : "";

  const firstLabel = data[0]?.label ?? "";
  const midLabel = data[Math.floor(data.length / 2)]?.label ?? "";
  const lastLabel = data[data.length - 1]?.label ?? "";

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillFrom} />
            <stop offset="100%" stopColor={fillTo} />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((step) => {
          const y = paddingY + step * innerHeight;
          return (
            <line
              key={step}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#e5e7eb"
              strokeDasharray="4 6"
            />
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${id}-fill)`} />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point) => (
          <circle
            key={`${id}-${point.fullLabel}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="white"
            stroke={stroke}
            strokeWidth="2"
          >
            <title>
              {`${point.fullLabel}: ${valueFormatter(point.value)}${
                point.detail ? ` • ${point.detail}` : ""
              }`}
            </title>
          </circle>
        ))}
      </svg>

      <div className="mt-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 font-sans">
        <span>{firstLabel}</span>
        <span>{midLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-4">
      <p className="text-sm font-sans text-red-700">
        {isRouteErrorResponse(error)
          ? error.data
          : "Reports unavailable. Please refresh."}
      </p>
    </div>
  );
}
