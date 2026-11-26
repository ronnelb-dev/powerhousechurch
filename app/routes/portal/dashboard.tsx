// app/routes/portal/dashboard.tsx
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  Link,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { buildAttendanceTrend } from "~/lib/attendance-trend";
import { AttendanceHeatmap, type HeatmapCell } from "~/components/church/AttendanceHeatmap";
import { EmptyState } from "~/components/ui/EmptyState";
import {
  PortalHeader,
  PortalPage,
  PortalPanel,
  PortalSection,
  PortalSectionHeading,
  portalButtonClasses,
} from "~/components/ui/Portal";
import {
  addCalendarDays,
  calendarDateToUtc,
  getChurchCalendarDate,
  getMostRecentSundayDate,
  getRecentSundayDates,
  utcDateToCalendarDate,
} from "~/lib/calendar-date";

export const meta: MetaFunction = () => [
  { title: "Dashboard — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  const churchToday = getChurchCalendarDate();
  const last12 = getRecentSundayDates(12, churchToday)
    .reverse()
    .map(calendarDateToUtc);

  if (user.role === "ADMIN") {
    const firstSunday = last12[0]!;
    const lastSunday = last12[last12.length - 1]!;
    const dayAfterLastSunday = calendarDateToUtc(
      addCalendarDays(utcDateToCalendarDate(lastSunday), 1),
    );
    const [activeMembers, activeGroups, records] = await Promise.all([
      db.user.count({ where: { isActive: true } }),
      db.cellGroup.count({ where: { isActive: true } }),
      db.attendance.findMany({
        where: {
          type: "SUNDAY_SERVICE",
          date: { gte: firstSunday, lt: dayAfterLastSunday },
        },
        select: {
          date: true,
          status: true,
          user: { select: { isActive: true } },
        },
      }),
    ]);

    const attendanceTrend = buildAttendanceTrend({
      sundaySeries: last12,
      records,
      totalMembers: activeMembers,
    });

    return {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      cellGroup: null,
      memberCount: 0,
      groupAttendance: null,
      recentAttendance: [],
      engagementSummary: null,
      latestPrayerStatus: null,
      latestServingStatus: null,
      churchToday,
      adminSummary: { activeMembers, activeGroups, attendanceTrend },
    };
  }

  let cellGroup = null;
  let memberCount = 0;
  let groupAttendance = null;
  let recentAttendance: HeatmapCell[] = [];
  let engagementSummary = null;
  let latestPrayerStatus: string | null = null;
  let latestServingStatus: string | null = null;

  if (user.cellGroupId) {
    cellGroup = await db.cellGroup.findUnique({
      where: { id: user.cellGroupId },
      select: {
        id: true,
        name: true,
        leaderId: true,
        meetingDay: true,
        meetingTime: true,
        barangay: true,
      },
    });
    memberCount = await db.user.count({
      where: { cellGroupId: user.cellGroupId, isActive: true },
    });
  }

  if (user.role === "CELL_LEADER" && user.cellGroupId) {
    const thisSunday = calendarDateToUtc(getMostRecentSundayDate(churchToday));
    const [presentCount, totalMarked] = await Promise.all([
      db.attendance.count({
        where: {
          cellGroupId: user.cellGroupId,
          type: "SUNDAY_SERVICE",
          status: "PRESENT",
          date: thisSunday,
          user: { isActive: true },
        },
      }),
      db.attendance.count({
        where: {
          cellGroupId: user.cellGroupId,
          type: "SUNDAY_SERVICE",
          date: thisSunday,
          user: { isActive: true },
        },
      }),
    ]);
    groupAttendance = {
      presentCount,
      totalMarked,
      memberCount,
      percentage:
        memberCount > 0 ? Math.round((presentCount / memberCount) * 100) : 0,
    };
  }

  if (user.role === "MEMBER") {
    const [prayerRequestCount, servingInterestCount, prayerRequest, servingInterest, attendanceRecords] =
      await Promise.all([
        db.prayerRequest.count({ where: { memberId: user.id } }),
        db.servingInterest.count({ where: { userId: user.id } }),
        db.prayerRequest.findFirst({
          where: { memberId: user.id },
          orderBy: { submittedAt: "desc" },
          select: { status: true },
        }),
        db.servingInterest.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { status: true },
        }),
        db.attendance.findMany({
          where: {
            userId: user.id,
            type: "SUNDAY_SERVICE",
            date: { in: last12 },
          },
          select: { date: true, status: true },
        }),
      ]);

    engagementSummary = { prayerRequestCount, servingInterestCount };
    latestPrayerStatus = prayerRequest?.status ?? null;
    latestServingStatus = servingInterest?.status ?? null;

    const recordMap = new Map(
      attendanceRecords.map((record) => [
        record.date instanceof Date
          ? utcDateToCalendarDate(record.date)
          : String(record.date).slice(0, 10),
        record.status,
      ]),
    );
    recentAttendance = last12.map((date) => {
      const key = utcDateToCalendarDate(date);
      const status = recordMap.get(key);
      return {
        date: key,
        status:
          key > churchToday
            ? "future"
            : status === "PRESENT"
              ? "present"
              : status === "ABSENT"
                ? "absent"
                : "unmarked",
      } satisfies HeatmapCell;
    });
  }

  return {
    user: {
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      user.role,
    },
    cellGroup,
    memberCount,
    groupAttendance,
    recentAttendance,
    churchToday,
    engagementSummary,
    latestPrayerStatus,
    latestServingStatus,
    adminSummary: null,
  };
}

function MetricCard({
  label,
  value,
  note,
  tone = "default",
  action,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "alert" | "success";
  action?: { to: string; label: string };
}) {
  const toneClasses =
    tone === "alert"
      ? "border-red-200 bg-white"
      : tone === "success"
        ? "border-green-200 bg-white"
        : "border-gray-200 bg-white";

  return (
    <div className={`rounded-lg border p-4 ${toneClasses}`}>
      <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 font-sans text-2xl font-bold text-gray-900">
        {value}
      </p>
      <p className="mt-1 text-xs font-sans text-gray-500">{note}</p>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 inline-flex text-xs font-sans font-bold text-gray-700 transition-colors hover:text-gray-950"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

function QuickActionCard({
  to,
  title,
  description,
  tone = "neutral",
}: {
  to: string;
  title: string;
  description: string;
  tone?: "neutral" | "warm" | "gold";
}) {
  const toneClasses =
    tone === "warm"
      ? "border-gray-200 border-l-red-300 bg-white hover:border-gray-300"
      : tone === "gold"
        ? "border-gray-200 border-l-amber-300 bg-white hover:border-gray-300"
        : "border-gray-200 border-l-gray-300 bg-white hover:border-gray-300";

  return (
    <Link
      to={to}
      className={`group block min-h-16 rounded-lg border border-l-2 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${toneClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-sm font-bold text-gray-900">{title}</p>
          <p className="mt-1 text-xs font-sans leading-5 text-gray-500">
            {description}
          </p>
        </div>
        <span className="text-sm text-gray-400 transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const {
    user,
    cellGroup,
    memberCount,
    groupAttendance,
    recentAttendance,
    engagementSummary,
    latestPrayerStatus,
    latestServingStatus,
    adminSummary,
    churchToday,
  } = useLoaderData<typeof loader>();
  const roleLabel =
    user.role === "ADMIN"
      ? "Administrator"
      : user.role === "CELL_LEADER"
        ? "Cell Leader"
        : "Member";
  const today = calendarDateToUtc(churchToday).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const latestAttendance = adminSummary?.attendanceTrend.at(-1) ?? null;
  const statusLabel = (status: string | null) =>
    status
      ? status
          .toLowerCase()
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "No activity yet";

  const memberActions = [
    {
      to: "/portal/community",
      title: "Community Feed",
      description: "Read reflections, weekly prompts, and encouragement from the church.",
      tone: "neutral" as const,
    },
    {
      to: "/portal/engagement",
      title: "Engagement Hub",
      description: "View prayer and serving updates or share a new request.",
      tone: "gold" as const,
    },
    {
      to: "/portal/directory",
      title: "Member Directory",
      description: "Find and connect with people in the church family.",
      tone: "neutral" as const,
    },
  ];

  return (
    <PortalPage>
      <PortalHeader
        eyebrow={roleLabel}
        title={`Welcome back, ${user.firstName}.`}
        subtitle={today}
      />

      {user.role === "ADMIN" && adminSummary ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Active Members"
              value={adminSummary.activeMembers.toLocaleString()}
              note="Active accounts across the church"
            />
            <MetricCard
              label="Cell Groups"
              value={adminSummary.activeGroups.toLocaleString()}
              note="Active groups"
            />
            <MetricCard
              label="Latest Sunday"
              value={`${latestAttendance?.attendanceRate ?? 0}%`}
              note={`${latestAttendance?.presentCount ?? 0} present`}
            />
          </div>

          <PortalSection>
            <PortalSectionHeading
              eyebrow="Church-wide view"
              title="Sunday attendance"
              subtitle="Attendance over the last 12 Sundays. Open Reports for the full analytics view."
              actions={
                <Link
                  to="/portal/admin/reports"
                  className={portalButtonClasses({ variant: "secondary" })}
                >
                  View Reports
                </Link>
              }
            />
            <AttendanceTrendChart points={adminSummary.attendanceTrend} />
          </PortalSection>

          <PortalSection>
            <PortalSectionHeading eyebrow="Administration" title="Quick Actions" />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <QuickActionCard
                to="/portal/attendance"
                title="Mark Attendance"
                description="Update Sunday service or cell group attendance."
                tone="warm"
              />
              <QuickActionCard
                to="/portal/admin/prayers"
                title="Prayer Requests"
                description="Review requests and coordinate follow-up."
                tone="gold"
              />
              <QuickActionCard
                to="/portal/admin/members"
                title="Manage Members"
                description="Update roles, assignments, and member status."
              />
              <QuickActionCard
                to="/portal/admin/cell-groups"
                title="Cell Groups"
                description="Review group assignments and meeting details."
              />
            </div>
          </PortalSection>
        </div>
      ) : null}

      {user.role === "CELL_LEADER" ? (
        <div className="space-y-5">
          <PortalSection>
            <PortalSectionHeading
              eyebrow="Group health"
              title={cellGroup?.name ?? "No cell group assigned"}
              subtitle={
                cellGroup
                  ? "Your assigned group at a glance. Attendance is limited to this group."
                  : "Your leader tools will become more useful once a cell group is assigned."
              }
              actions={
                cellGroup ? (
                  <Link
                    to="/portal/attendance"
                    className={portalButtonClasses()}
                  >
                    Mark Attendance
                  </Link>
                ) : undefined
              }
            />
            {cellGroup ? (
              <>
                {(cellGroup.meetingDay || cellGroup.meetingTime || cellGroup.barangay) ? (
                  <PortalPanel className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {cellGroup.meetingDay || cellGroup.meetingTime ? (
                      <span>
                        <span className="font-bold text-gray-800">Meeting</span>{" "}
                        {[cellGroup.meetingDay, cellGroup.meetingTime]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    {cellGroup.barangay ? (
                      <span>
                        <span className="font-bold text-gray-800">Area</span>{" "}
                        {cellGroup.barangay}
                      </span>
                    ) : null}
                  </PortalPanel>
                ) : null}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="People in Group"
                    value={memberCount.toLocaleString()}
                    note="Active group members"
                  />
                  <MetricCard
                    label="Present Sunday"
                    value={String(groupAttendance?.presentCount ?? 0)}
                    note={`${groupAttendance?.percentage ?? 0}% of the group`}
                    tone="success"
                  />
                  <MetricCard
                    label="Unmarked"
                    value={String(
                      Math.max(
                        memberCount - (groupAttendance?.totalMarked ?? 0),
                        0,
                      ),
                    )}
                    note="Attendance still to record"
                    tone="alert"
                  />
                </div>
              </>
            ) : null}
          </PortalSection>

          <PortalSection>
            <PortalSectionHeading eyebrow="Stay connected" title="Quick Actions" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <QuickActionCard
                to="/portal/community"
                title="Community Feed"
                description="Read reflections and encouragement from the church."
              />
              <QuickActionCard
                to="/portal/directory"
                title="Member Directory"
                description="Find people in your group and church family."
              />
              <QuickActionCard
                to="/portal/engagement"
                title="Engagement Hub"
                description="View your prayer and serving activity."
                tone="gold"
              />
            </div>
          </PortalSection>
        </div>
      ) : null}

      {user.role === "MEMBER" ? (
        <div className="space-y-5">
          <PortalSection>
            <PortalSectionHeading
              eyebrow="Personal progress"
              title="My Sunday Attendance"
              subtitle="Your attendance rhythm over the last 12 Sundays."
            />
            {recentAttendance.some((cell) => cell.status === "present" || cell.status === "absent") ? (
              <AttendanceHeatmap cells={recentAttendance} label="Last 12 Sundays" />
            ) : (
              <PortalPanel>
                <p className="text-sm font-sans text-gray-600">
                  No Sunday attendance has been recorded for this period yet.
                </p>
              </PortalPanel>
            )}
          </PortalSection>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <PortalSection>
              <PortalSectionHeading
                eyebrow="Your activity"
                title="Prayer and serving"
                subtitle="Your latest statuses and submitted activity."
              />
              <div className="grid grid-cols-2 gap-3">
                <StatusMetricCard
                  label="Prayer Requests"
                  count={engagementSummary?.prayerRequestCount ?? 0}
                  status={statusLabel(latestPrayerStatus)}
                />
                <StatusMetricCard
                  label="Serving Interests"
                  count={engagementSummary?.servingInterestCount ?? 0}
                  status={statusLabel(latestServingStatus)}
                />
              </div>
              <Link
                to="/portal/engagement"
                className="mt-4 inline-flex min-h-11 items-center rounded-md font-sans text-sm font-bold text-gray-700 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Open Engagement Hub →
              </Link>
            </PortalSection>

            <PortalSection>
              <PortalSectionHeading eyebrow="Next steps" title="Stay connected" />
              <div className="space-y-2">
                {memberActions.map((action) => (
                  <QuickActionCard key={action.to} {...action} />
                ))}
              </div>
            </PortalSection>
          </div>

          {!cellGroup ? (
            <EmptyState
              icon="members"
              title="You haven't been assigned to a cell group yet"
              message="Your Sunday attendance and personal activity stay available here. In the meantime, explore the Community devotion feed and member directory."
              action={{ label: "Browse Community", to: "/portal/community" }}
            />
          ) : (
            <PortalPanel>
              <p className="text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Your cell group
              </p>
              <p className="mt-1 font-sans text-base font-bold text-gray-900">
                {cellGroup.name}
              </p>
            </PortalPanel>
          )}
        </div>
      ) : null}
    </PortalPage>
  );
}

function StatusMetricCard({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: string;
}) {
  return (
    <PortalPanel className="min-w-0 p-3 sm:p-4">
      <p className="text-[0.65rem] font-sans font-bold uppercase tracking-[0.08em] text-gray-500 sm:text-xs">
        {label}
      </p>
      <p className="mt-2 font-sans text-2xl font-bold text-gray-900">
        {count.toLocaleString()}
      </p>
      <p className="mt-1 break-words text-xs font-sans text-gray-600">
        Latest: {status}
      </p>
    </PortalPanel>
  );
}

function AttendanceTrendChart({
  points,
}: {
  points: Array<{
    dateKey: string;
    shortLabel: string;
    fullLabel: string;
    presentCount: number;
    absentCount: number;
    attendanceRate: number;
  }>;
}) {
  if (points.length === 0) {
    return <p className="text-sm font-sans text-gray-500">No Sunday attendance data is available yet.</p>;
  }

  return (
    <figure>
      <div
        role="img"
        aria-label={`Sunday attendance over ${points.length} weeks, from ${points[0]!.fullLabel} to ${points.at(-1)!.fullLabel}. Latest: ${points.at(-1)!.presentCount} present.`}
      >
        <div
          aria-hidden="true"
          className="grid h-32 grid-cols-12 items-end gap-1 border-b border-gray-200 px-1 sm:h-40 sm:gap-2"
        >
          {points.map((point) => (
            <div
              key={point.dateKey}
              className="flex h-full min-w-0 items-end justify-center"
              title={`${point.fullLabel}: ${point.presentCount} present, ${point.absentCount} absent (${point.attendanceRate}%).`}
            >
              <div
                className="w-full max-w-8 rounded-t bg-red-700 transition-[height]"
                style={{
                  height: `${point.attendanceRate}%`,
                  minHeight: point.attendanceRate > 0 ? "0.25rem" : "0.125rem",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 flex justify-between text-[0.65rem] font-sans text-gray-500">
        <span>{points[0]!.shortLabel}</span>
        <span>{points.at(-1)!.shortLabel}</span>
      </figcaption>
      <ol className="sr-only">
        {points.map((point) => (
          <li key={point.dateKey}>
            {point.fullLabel}: {point.presentCount} present, {point.absentCount} absent, {point.attendanceRate}% attendance.
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="generic"
        title="Dashboard unavailable"
        message={
          isRouteErrorResponse(error)
            ? error.data
            : "Please refresh the page."
        }
      />
    </div>
  );
}
