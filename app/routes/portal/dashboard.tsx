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
import { getMembersNeedingCare } from "~/lib/attendance.server";
import { PastoralAlert } from "~/components/church/PastoralAlert";
import { AttendanceHeatmap, type HeatmapCell } from "~/components/church/AttendanceHeatmap";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Dashboard — Powerhouse Church Portal" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);

  // Fetch cell group if applicable
  let cellGroup = null;
  let memberCount = 0;
  let attendanceSummary = null;
  let needsCare: Awaited<ReturnType<typeof getMembersNeedingCare>> = [];
  let recentAttendance: HeatmapCell[] = [];
  const [prayerRequestCount, savedSermonCount, servingInterestCount] =
    await Promise.all([
      db.prayerRequest.count({ where: { memberId: user.id } }),
      db.sermonBookmark.count({ where: { userId: user.id, isBookmarked: true } }),
      db.servingInterest.count({ where: { userId: user.id } }),
    ]);

  if (user.cellGroupId) {
    cellGroup = await db.cellGroup.findUnique({
      where: { id: user.cellGroupId },
      select: { id: true, name: true, leaderId: true },
    });

    memberCount = await db.user.count({
      where: { cellGroupId: user.cellGroupId, isActive: true },
    });

    // For CELL_LEADER or ADMIN — show pastoral care alert
    if (user.role === "CELL_LEADER" || user.role === "ADMIN") {
      needsCare = await getMembersNeedingCare({ cellGroupId: user.cellGroupId });

      // Attendance % for this Sunday
      const thisSunday = getMostRecentSunday();
      const presentCount = await db.attendance.count({
        where: {
          cellGroupId: user.cellGroupId,
          type:   "SUNDAY_SERVICE",
          status: "PRESENT",
          date:   thisSunday,
        },
      });
      const totalMarked = await db.attendance.count({
        where: {
          cellGroupId: user.cellGroupId,
          type: "SUNDAY_SERVICE",
          date: thisSunday,
        },
      });
      attendanceSummary = {
        presentCount,
        totalMarked,
        memberCount,
        percentage: memberCount > 0 ? Math.round((presentCount / memberCount) * 100) : 0,
      };
    }

    // Personal heatmap — last 12 Sundays
    const last12 = getLast12Sundays();
    const records = await db.attendance.findMany({
      where: {
        userId: user.id,
        type:   "SUNDAY_SERVICE",
        date:   { in: last12 },
      },
      select: { date: true, status: true },
    });
    const recordMap = new Map(
      records.map((r) => [
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date).slice(0, 10),
        r.status,
      ])
    );
    const now = new Date();
    recentAttendance = last12.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const status = recordMap.get(key);
      const isFuture = date > now;
      return {
        date: key,
        status: isFuture
          ? "future"
          : status === "PRESENT"
          ? "present"
          : status === "ABSENT"
          ? "absent"
          : "unmarked",
      } satisfies HeatmapCell;
    });
  }

  // Latest sermon for quick access
  const latestSermon = await db.sermon.findFirst({
    where: { isPublished: true },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      speaker: true,
      date: true,
      weeklyGuide: true,
      reflectionPrompts: true,
    },
  });

  return {
    user: {
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      user.role,
    },
    cellGroup,
    memberCount,
    attendanceSummary,
    needsCare,
    recentAttendance,
    engagementSummary: {
      prayerRequestCount,
      savedSermonCount,
      servingInterestCount,
    },
    latestSermon: latestSermon
      ? {
          ...latestSermon,
          date: latestSermon.date instanceof Date
            ? latestSermon.date.toISOString()
            : latestSermon.date,
        }
      : null,
  };
}

function getMostRecentSunday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // 0 = Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getLast12Sundays(): Date[] {
  const sundays: Date[] = [];
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    sundays.unshift(new Date(d));
    d.setDate(d.getDate() - 7);
  }
  return sundays;
}

export default function DashboardPage() {
  const {
    user, cellGroup, memberCount, attendanceSummary,
    needsCare, recentAttendance, latestSermon, engagementSummary,
  } = useLoaderData<typeof loader>();

  const isCellLeaderOrAdmin = user.role === "CELL_LEADER" || user.role === "ADMIN";
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-0.5">
            Welcome back, {user.firstName}.
          </h1>
          <p className="text-sm text-gray-400 font-sans">{today}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                          bg-red-50 border border-red-100">
            <span className="text-xs font-sans font-bold text-red-700">
              {user.role === "ADMIN"
                ? "Administrator"
                : user.role === "CELL_LEADER"
                ? "Cell Leader"
                : "Member"}
            </span>
          </div>
          {cellGroup && (
            <p className="text-xs text-gray-400 font-sans mt-1">
              {cellGroup.name} Group
            </p>
          )}
        </div>
      </div>

      {/* Pastoral alert — only visible when members need care */}
      {isCellLeaderOrAdmin && needsCare.length > 0 && (
        <PastoralAlert members={needsCare} />
      )}

      {/* KPI cards — cell leader / admin only */}
      {isCellLeaderOrAdmin && attendanceSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-gray-400 mb-2">
              Members
            </p>
            <p className="font-serif text-3xl font-bold text-gray-900">
              {memberCount}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-gray-400 mb-2">
              This Sunday
            </p>
            <p className="font-serif text-3xl font-bold text-gray-900">
              {attendanceSummary.presentCount}
            </p>
            <p className="text-xs text-gray-400 font-sans mt-1">
              {attendanceSummary.percentage}% attended
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-gray-400 mb-2">
              Needs Care
            </p>
            <p
              className={`font-serif text-3xl font-bold ${
                needsCare.length > 0 ? "text-red-700" : "text-gray-900"
              }`}
            >
              {needsCare.length}
            </p>
            <p className="text-xs text-gray-400 font-sans mt-1">
              Missed 2+ Sundays
            </p>
            {needsCare.length > 0 ? (
              <Link
                to="/portal/care"
                className="mt-2 inline-flex text-xs font-bold text-red-700 hover:text-red-900"
              >
                Open queue →
              </Link>
            ) : null}
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-gray-400 mb-2">
              Unmarked
            </p>
            <p className="font-serif text-3xl font-bold text-gray-900">
              {memberCount - attendanceSummary.totalMarked}
            </p>
            <p className="text-xs text-gray-400 font-sans mt-1">
              This Sunday
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My attendance heatmap */}
        {recentAttendance.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="font-serif text-base font-bold text-gray-800 mb-4">
              My Sunday Attendance
            </h2>
            <AttendanceHeatmap
              cells={recentAttendance}
              label="Last 12 Sundays"
            />
          </div>
        )}

        {/* Quick links */}
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="font-serif text-base font-bold text-gray-800 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {isCellLeaderOrAdmin && (
              <Link
                to="/portal/care"
                className="flex items-center justify-between px-4 py-3 rounded-lg
                           bg-amber-50 border border-amber-100 hover:border-amber-300
                           transition-all group"
              >
                <span className="text-sm font-sans font-bold text-amber-800">
                  Care Queue
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="#92400e" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            )}
            {isCellLeaderOrAdmin && (
              <Link
                to="/portal/attendance"
                className="flex items-center justify-between px-4 py-3 rounded-lg
                           bg-red-50 border border-red-100 hover:border-red-300
                           transition-all group"
              >
                <span className="text-sm font-sans font-bold text-red-800">
                  Mark Attendance
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="#be123c" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            )}
            <Link
              to="/portal/community"
              className="flex items-center justify-between px-4 py-3 rounded-lg
                         bg-gray-50 border border-gray-100 hover:border-gray-200
                         transition-all group"
            >
              <span className="text-sm font-sans font-bold text-gray-700">
                Daily Bread Feed
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="#6b7280" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
            <Link
              to="/portal/directory"
              className="flex items-center justify-between px-4 py-3 rounded-lg
                         bg-gray-50 border border-gray-100 hover:border-gray-200
                         transition-all group"
            >
              <span className="text-sm font-sans font-bold text-gray-700">
                Member Directory
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="#6b7280" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
            <Link
              to="/portal/engagement"
              className="flex items-center justify-between px-4 py-3 rounded-lg
                         bg-amber-50 border border-amber-100 hover:border-amber-300
                         transition-all group"
            >
              <span className="text-sm font-sans font-bold text-amber-800">
                Engagement Hub
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="#92400e" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="font-serif text-base font-bold text-gray-800 mb-4">
            Stay Engaged
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[0.7rem] font-sans font-bold uppercase tracking-[0.14em] text-gray-500">
                Prayer
              </p>
              <p className="mt-2 font-serif text-2xl font-bold text-gray-900">
                {engagementSummary.prayerRequestCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">Requests shared</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[0.7rem] font-sans font-bold uppercase tracking-[0.14em] text-gray-500">
                Sermons
              </p>
              <p className="mt-2 font-serif text-2xl font-bold text-gray-900">
                {engagementSummary.savedSermonCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">Saved messages</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[0.7rem] font-sans font-bold uppercase tracking-[0.14em] text-gray-500">
                Serving
              </p>
              <p className="mt-2 font-serif text-2xl font-bold text-gray-900">
                {engagementSummary.servingInterestCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">Forms submitted</p>
            </div>
          </div>
          <Link
            to="/portal/engagement"
            className="mt-4 inline-flex text-sm font-bold text-red-700 hover:text-red-900"
          >
            Open your engagement hub →
          </Link>
        </div>

        {/* Latest sermon */}
        {latestSermon && (
          <div className="bg-white border border-gray-100 rounded-xl p-6 md:col-span-2">
            <p className="text-xs font-sans font-bold tracking-widest uppercase
                          text-red-600 mb-3">
              Latest Message
            </p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-gray-900 mb-1">
                  {latestSermon.title}
                </h3>
                <p className="text-sm text-gray-400 font-sans">
                  {latestSermon.speaker} ·{" "}
                  {new Date(latestSermon.date).toLocaleDateString("en-PH", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
                {(latestSermon.weeklyGuide || latestSermon.reflectionPrompts) && (
                  <p className="mt-2 text-sm font-sans text-gray-600">
                    Weekly guide and reflection prompts are ready in Daily Bread.
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <Link
                  to={`/sermons/${latestSermon.id}`}
                  className="px-4 py-2 bg-red-700 text-white font-sans
                             font-bold text-xs rounded-lg hover:bg-red-800 transition-colors
                             focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Watch →
                </Link>
                {(latestSermon.weeklyGuide || latestSermon.reflectionPrompts) && (
                  <Link
                    to="/portal/community"
                    className="px-4 py-2 border border-red-200 bg-white text-red-700
                               font-sans font-bold text-xs rounded-lg hover:bg-red-50
                               transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Daily Bread →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state for members with no cell group yet */}
      {!cellGroup && user.role === "MEMBER" && (
        <div className="mt-8">
          <EmptyState
            icon="members"
            title="You haven't been assigned to a cell group yet"
            message="Your cell group assignment is coming soon. In the meantime, explore the Daily Bread devotion feed and the member directory."
            action={{ label: "Browse Daily Bread", to: "/portal/community" }}
          />
        </div>
      )}
    </div>
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
