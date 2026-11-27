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
import {
  PortalHeader,
  PortalSection,
  PortalSectionHeading,
  portalButtonClasses,
} from "~/components/ui/Portal";
import {
  buildAttendanceTrend,
  type AttendanceTrendPoint,
} from "~/lib/attendance-trend";
import {
  addCalendarDays,
  calendarDateToUtc,
  getChurchCalendarDate,
  getMostRecentSundayDate,
  getRecentSundayDates,
  isCalendarDate,
  utcDateToCalendarDate,
} from "~/lib/calendar-date";

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

  const churchToday = getChurchCalendarDate();
  const sundaySeries = getLastNSundays(12, churchToday);
  const monthSeries = getLastNMonths(12);
  const firstSunday = sundaySeries[0] ?? getMostRecentSunday();
  const lastSunday = sundaySeries[sundaySeries.length - 1] ?? firstSunday;
  const dayAfterLastSunday = calendarDateToUtc(
    addCalendarDays(utcDateToCalendarDate(lastSunday), 1),
  );

  const [
    cellGroups,
    totalMembers,
    totalAttendance,
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
    db.attendeeProfile.count({ where: { isActive: true } }),
    db.attendance.count(),
    db.prayerRequest.count(),
    db.attendance.findMany({
      where: {
        type: "SUNDAY_SERVICE",
        date: { gte: firstSunday, lt: dayAfterLastSunday },
      },
      select: {
        date: true,
        status: true,
        attendeeProfile: { select: { isActive: true } },
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
    totalMembers,
    totalAttendance,
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
    churchToday,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const startDateKey = String(formData.get("startDate") ?? "");
  const endDateKey = String(formData.get("endDate") ?? "");
  const cellGroupId = (formData.get("cellGroupId") as string) || undefined;
  const type =
    formData.get("type") === "CELL_GROUP" ? "CELL_GROUP" : "SUNDAY_SERVICE";

  if (
    !isCalendarDate(startDateKey) ||
    !isCalendarDate(endDateKey) ||
    startDateKey > endDateKey
  ) {
    return new Response("Invalid date range", { status: 400 });
  }

  const adultStartDate = calendarDateToUtc(startDateKey);
  const adultEndDateExclusive = calendarDateToUtc(addCalendarDays(endDateKey, 1));
  const records = await db.attendance.findMany({
    where: {
      date: { gte: adultStartDate, lt: adultEndDateExclusive },
      type,
      ...(cellGroupId ? { cellGroupId } : {}),
    },
    include: {
      user: { select: { email: true, phone: true } },
      attendeeProfile: {
        select: { firstName: true, lastName: true, phone: true },
      },
      cellGroup: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { attendeeProfile: { lastName: "asc" } }],
  });

  const header = "Date,Last Name,First Name,Category,Email,Phone,Cell Group,Type,Status";
  const rows = records.map((record) => {
    const date =
      record.date instanceof Date
        ? utcDateToCalendarDate(record.date)
        : String(record.date).slice(0, 10);
    return [
      date,
      record.attendeeProfile?.lastName ?? "",
      record.attendeeProfile?.firstName ?? "",
      record.categorySnapshot ?? "Unclassified",
      record.user?.email ?? "",
      record.attendeeProfile?.phone ?? record.user?.phone ?? "",
      record.cellGroup?.name ?? "Unassigned",
      record.type,
      record.status,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `attendance-${type.toLowerCase().replace("_", "-")}-${startDateKey}-to-${endDateKey}.csv`;

  await recordAdminAuditEvent({
    request,
    actorId: user.id,
    actorRole: user.role,
    action: "report.export",
    entityType: "attendance_report",
    summary: `Exported attendee attendance report for ${type}`,
    details: {
      type,
      cellGroupId: cellGroupId ?? null,
      startDate: startDateKey,
      endDate: endDateKey,
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

function getMostRecentSunday(referenceDate = getChurchCalendarDate()) {
  return calendarDateToUtc(getMostRecentSundayDate(referenceDate));
}

function getLastNSundays(count: number, referenceDate = getChurchCalendarDate()) {
  return getRecentSundayDates(count, referenceDate)
    .reverse()
    .map(calendarDateToUtc);
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
    totalMembers,
    totalAttendance,
    totalPrayers,
    attendanceTrend,
    memberGrowth,
    recentAuditLogs,
    churchToday,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  const today = churchToday;
  const thirtyAgo = addCalendarDays(churchToday, -30);

  const latestAttendance = attendanceTrend[attendanceTrend.length - 1] ?? null;
  const averageAttendance =
    attendanceTrend.length > 0
      ? Math.round(
          attendanceTrend.reduce((sum, point) => sum + point.presentCount, 0) /
            attendanceTrend.length,
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
  const hasAttendanceMarks = attendanceTrend.some((point) => point.markedCount > 0);
  const hasActiveMembers = (latestGrowthPoint?.totalMembers ?? 0) > 0;

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <PortalHeader
        eyebrow="Admin"
        title="Reports & Analytics"
        subtitle="Track attendance momentum and member growth, then export records for deeper review."
      />

      <section aria-label="Summary metrics">
        <p className="mb-3 text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
          At a glance
        </p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Active Attendees", value: totalMembers },
            { label: "Attendance Records", value: totalAttendance },
            { label: "Prayer Requests", value: totalPrayers },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 font-sans">
                {label}
              </p>
              <p className="font-sans text-2xl font-bold text-gray-900 sm:text-3xl">
                {value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PortalSection className="min-w-0 p-4 sm:p-5 lg:p-6">
        <PortalSectionHeading
          eyebrow="12-week trend"
          title="Adult Sunday attendance"
          subtitle="Attendance across the last 12 Sundays, with weekly counts and active-member rate."
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <MetricTile label="Average attendance" value={String(averageAttendance)} note="Per Sunday" />
          <MetricTile
            label="Latest Sunday"
            value={latestAttendance ? String(latestAttendance.attendanceRate) + "%" : "0%"}
            note={latestAttendance ? String(latestAttendance.presentCount) + " present" : "No recent marks"}
          />
          <MetricTile
            label="Best week"
            value={bestAttendance ? String(bestAttendance.presentCount) : "0"}
            note={bestAttendance ? bestAttendance.shortLabel : "No data"}
          />
        </div>

        <div className="mt-6 min-w-0">
          {hasAttendanceMarks ? (
            <TrendChart
              id="attendance-trend"
              ariaLabel="Adult attendance for the last 12 Sundays"
              data={attendanceTrend.map((point) => ({
                label: point.shortLabel,
                fullLabel: point.fullLabel,
                value: point.presentCount,
                detail: String(point.attendanceRate) + "% of active members",
              }))}
              stroke="#923034"
              fillFrom="rgba(146,48,52,0.24)"
              fillTo="rgba(146,48,52,0.03)"
              valueFormatter={(value) => String(value) + " attendees"}
            />
          ) : (
            <p role="status" className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm leading-6 text-gray-600">
              No attendance has been marked for the last 12 Sundays yet. The trend will appear here when records are available.
            </p>
          )}
        </div>

        <div className="mt-5 grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
          {attendanceTrend.map((point) => (
            <div
              key={point.dateKey}
              className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-2"
              title={point.fullLabel + ": " + point.presentCount + " present, " + point.unmarkedCount + " unmarked"}
            >
              <div className={"h-2 rounded-full " + getAttendanceTone(point.attendanceRate)} />
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-600 font-sans sm:text-[11px]">
                {point.shortLabel}
              </p>
              <p className="mt-1 font-sans text-base font-bold text-gray-900 sm:text-lg">
                {point.presentCount}
              </p>
              <p className="text-[10px] text-gray-600 font-sans sm:text-[11px]">
                {point.attendanceRate}% rate
              </p>
            </div>
          ))}
        </div>
      </PortalSection>

      <PortalSection className="min-w-0 p-4 sm:p-5 lg:p-6">
        <PortalSectionHeading
          eyebrow="12-month trend"
          title="Active member growth"
          subtitle="Cumulative active-member totals across the last 12 months, based on join dates."
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <MetricTile
            label="Current active"
            value={latestGrowthPoint ? String(latestGrowthPoint.totalMembers) : "0"}
            note="Members in the portal"
          />
          <MetricTile
            label="Added this year"
            value={String(newMembersLast12Months)}
            note={
              firstGrowthPoint && latestGrowthPoint
                ? String(firstGrowthPoint.totalMembers) + " → " + String(latestGrowthPoint.totalMembers)
                : "No change"
            }
          />
        </div>

        <div className="mt-6 min-w-0">
          {hasActiveMembers ? (
            <TrendChart
              id="member-growth"
              ariaLabel="Active member growth over the last 12 months"
              data={memberGrowth.map((point) => ({
                label: point.shortLabel,
                fullLabel: point.fullLabel,
                value: point.totalMembers,
                detail: String(point.newMembers) + " new members",
              }))}
              stroke="#2563eb"
              fillFrom="rgba(37,99,235,0.20)"
              fillTo="rgba(37,99,235,0.03)"
              valueFormatter={(value) => String(value) + " active members"}
            />
          ) : (
            <p role="status" className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm leading-6 text-gray-600">
              Active-member growth will appear here once active member records are available.
            </p>
          )}
        </div>

        <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {hasActiveMembers ? memberGrowth.slice(-4).map((point) => (
            <div
              key={point.monthKey}
              className="min-w-0 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800 font-sans">
                {point.shortLabel}
              </p>
              <p className="mt-1 font-sans text-lg font-bold text-blue-950">
                {point.totalMembers}
              </p>
              <p className="text-[11px] text-blue-800 font-sans">
                +{point.newMembers} joined
              </p>
            </div>
          )) : (
            <p className="col-span-2 text-sm text-gray-600 sm:col-span-4">
              No monthly figures are available yet.
            </p>
          )}
        </div>
      </PortalSection>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2 xl:items-start">
        <PortalSection className="min-w-0 p-4 sm:p-5">
          <PortalSectionHeading
            eyebrow="Download data"
            title="Export attendance (CSV)"
            subtitle="Download attendance records for review in a spreadsheet."
          />

          <Form method="post" aria-label="Attendance export form">
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
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
                  className={inputClass + " min-h-11"}
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
                  className={inputClass + " min-h-11"}
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="report-type" className={labelClass}>
                Attendance Type
              </label>
              <select id="report-type" name="type" className={inputClass + " min-h-11"}>
                <option value="SUNDAY_SERVICE">Sunday Service</option>
                <option value="CELL_GROUP">Cell Group</option>
              </select>
            </div>

            <div className="mb-6">
              <label htmlFor="report-cellGroup" className={labelClass}>
                Cell Group
              </label>
              <select id="report-cellGroup" name="cellGroupId" className={inputClass + " min-h-11"}>
                <option value="">All Groups</option>
                {cellGroups.map((cellGroup) => (
                  <option key={cellGroup.id} value={cellGroup.id}>
                    {cellGroup.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              aria-busy={isGenerating}
              className={portalButtonClasses({
                className: "min-h-11 w-full bg-red-700 text-white hover:bg-red-800 focus:ring-red-400",
              })}
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

          <p aria-live="polite" className="mt-4 text-xs text-gray-600 font-sans">
            {isGenerating
              ? "Preparing your CSV download…"
              : "The CSV will download directly to your browser for spreadsheet analysis."}
          </p>
        </PortalSection>

        <PortalSection className="min-w-0 p-4 sm:p-5">
          <PortalSectionHeading
            eyebrow="Admin activity"
            title="Recent audit activity"
            subtitle="Recent sensitive actions recorded across admin and leadership workflows."
            actions={
              <div
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700"
                aria-label={recentAuditLogs.length + " recent audit entries"}
              >
                Last {recentAuditLogs.length}
              </div>
            }
          />

          <div className="space-y-3">
            {recentAuditLogs.length > 0 ? (
              recentAuditLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 sm:px-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-bold text-gray-900">
                      {entry.summary}
                    </p>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-700">
                      {entry.actorRole}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-xs text-gray-600 font-sans">
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
              <p role="status" className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-600">
                Audit activity will appear here after admins start using the tracked workflows.
              </p>
            )}
          </div>
        </PortalSection>
      </div>
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
