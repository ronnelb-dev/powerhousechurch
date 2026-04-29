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
      ? "border-red-100 bg-red-50/70"
      : tone === "success"
        ? "border-green-100 bg-green-50/70"
        : "border-white/70 bg-white/88";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <p className="mt-3 font-serif text-3xl font-bold text-gray-900">
        {value}
      </p>
      <p className="mt-1 text-xs font-sans text-gray-500">{note}</p>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 inline-flex text-xs font-sans font-bold text-red-700 transition-colors hover:text-red-900"
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
      ? "border-red-100 bg-red-50/70 hover:border-red-200"
      : tone === "gold"
        ? "border-amber-100 bg-amber-50/70 hover:border-amber-200"
        : "border-gray-100 bg-white hover:border-gray-200";

  return (
    <Link
      to={to}
      className={`group block rounded-2xl border p-4 transition-all ${toneClasses}`}
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
    user, cellGroup, memberCount, attendanceSummary,
    needsCare, recentAttendance, latestSermon, engagementSummary,
  } = useLoaderData<typeof loader>();

  const isCellLeaderOrAdmin = user.role === "CELL_LEADER" || user.role === "ADMIN";
  const roleLabel =
    user.role === "ADMIN"
      ? "Administrator"
      : user.role === "CELL_LEADER"
        ? "Cell Leader"
        : "Member";
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const sermonHasGuide = Boolean(
    latestSermon?.weeklyGuide || latestSermon?.reflectionPrompts,
  );
  const quickActions = [
    ...(isCellLeaderOrAdmin
      ? [
          {
            to: "/portal/attendance",
            title: "Mark Attendance",
            description: "Update Sunday service or cell group attendance in a few taps.",
            tone: "warm" as const,
          },
          {
            to: "/portal/care",
            title: "Care Queue",
            description: "Follow up with members who may need encouragement this week.",
            tone: "gold" as const,
          },
        ]
      : []),
    {
      to: "/portal/community",
      title: "Community Feed",
      description: "Read reflections, weekly prompts, and encouragement from the church.",
      tone: "neutral" as const,
    },
    {
      to: "/portal/directory",
      title: "Member Directory",
      description: "Find and connect with people in the church family.",
      tone: "neutral" as const,
    },
    {
      to: "/portal/engagement",
      title: "Engagement Hub",
      description: "Track prayer, serving, and sermon engagement in one place.",
      tone: "gold" as const,
    },
  ];

  return (
    <div className="max-w-6xl p-4 sm:p-6 md:p-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-red-100 bg-linear-to-br from-[#fff4ef] via-white to-[#fff8e7] p-6 shadow-sm sm:p-8">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-red-100/60 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-12 h-24 w-24 rounded-full bg-amber-100/70 blur-2xl" aria-hidden="true" />

        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.95fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/85 px-3 py-1.5">
              <span className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-red-700">
                {roleLabel}
              </span>
            </div>
            <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Welcome back, {user.firstName}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-sans leading-6 text-gray-600 sm:text-base">
              {today}
            </p>
            <p className="mt-3 max-w-2xl text-sm font-sans leading-6 text-gray-600">
              {cellGroup
                ? `You are connected to ${cellGroup.name} Group. Keep momentum strong with attendance, care, and community rhythms this week.`
                : "Your portal keeps prayer, sermons, community, and church life close at hand."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/portal/community"
                className="inline-flex min-h-11 items-center rounded-full bg-red-700 px-5 py-2.5 text-sm font-sans font-bold text-white transition-colors hover:bg-red-800"
              >
                Open Community
              </Link>
              <Link
                to="/portal/engagement"
                className="inline-flex min-h-11 items-center rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-sans font-bold text-red-700 transition-colors hover:bg-red-50"
              >
                View Engagement
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/80 bg-white/88 p-4 shadow-sm">
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
                Group Snapshot
              </p>
              <p className="mt-3 font-serif text-xl font-bold text-gray-900">
                {cellGroup ? `${cellGroup.name} Group` : "Awaiting Cell Group"}
              </p>
              <p className="mt-1 text-sm font-sans leading-6 text-gray-500">
                {cellGroup
                  ? `${memberCount} members connected in your current group.`
                  : "Once assigned, your group updates and attendance rhythms will appear here."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/88 p-4 shadow-sm">
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
                Weekly Focus
              </p>
              <p className="mt-3 font-serif text-xl font-bold text-gray-900">
                {sermonHasGuide ? "Community prompts are ready" : "Fresh sermon content available"}
              </p>
              <p className="mt-1 text-sm font-sans leading-6 text-gray-500">
                {sermonHasGuide
                  ? "Open the latest message, then move into reflection prompts with your church family."
                  : "Catch up on the newest sermon and keep building a consistent rhythm."}
              </p>
              {latestSermon ? (
                <Link
                  to={`/sermons/${latestSermon.id}`}
                  className="mt-3 inline-flex text-sm font-sans font-bold text-red-700 transition-colors hover:text-red-900"
                >
                  Open latest sermon →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Pastoral alert — only visible when members need care */}
      {isCellLeaderOrAdmin && needsCare.length > 0 && (
        <div className="mt-6">
          <PastoralAlert members={needsCare} />
        </div>
      )}

      {/* KPI cards — cell leader / admin only */}
      {isCellLeaderOrAdmin && attendanceSummary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Members"
            value={String(memberCount)}
            note="Active members in your current group"
          />
          <MetricCard
            label="This Sunday"
            value={String(attendanceSummary.presentCount)}
            note={`${attendanceSummary.percentage}% attended so far`}
            tone="success"
          />
          <MetricCard
            label="Needs Care"
            value={String(needsCare.length)}
            note="People who missed 2 or more Sundays"
            tone={needsCare.length > 0 ? "alert" : "default"}
            action={needsCare.length > 0 ? { to: "/portal/care", label: "Open queue" } : undefined}
          />
          <MetricCard
            label="Unmarked"
            value={String(memberCount - attendanceSummary.totalMarked)}
            note="Members still waiting for attendance today"
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="space-y-6">
          {recentAttendance.length > 0 && (
            <section className="rounded-[1.6rem] border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
                    Consistency
                  </p>
                  <h2 className="mt-2 font-serif text-xl font-bold text-gray-900">
                    My Sunday Attendance
                  </h2>
                  <p className="mt-1 text-sm font-sans text-gray-500">
                    A quick look at your rhythm over the last 12 Sundays.
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <AttendanceHeatmap
                  cells={recentAttendance}
                  label="Last 12 Sundays"
                />
              </div>
            </section>
          )}

          {latestSermon && (
            <section className="rounded-[1.6rem] border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-red-600">
                    Latest Message
                  </p>
                  <h2 className="mt-3 font-serif text-2xl font-bold text-gray-900">
                    {latestSermon.title}
                  </h2>
                  <p className="mt-1 text-sm font-sans text-gray-400">
                    {latestSermon.speaker} ·{" "}
                    {new Date(latestSermon.date).toLocaleDateString("en-PH", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                  </p>
                  <p className="mt-3 text-sm font-sans leading-6 text-gray-600">
                    {sermonHasGuide
                      ? "Weekly guide and reflection prompts are ready in Community."
                      : "Revisit the latest sermon and keep its message close this week."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/sermons/${latestSermon.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-sans font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    Watch Message
                  </Link>
                  {sermonHasGuide ? (
                    <Link
                      to="/portal/community"
                      className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-sans font-bold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                    >
                      Open Community
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.6rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
                  Next Steps
                </p>
                <h2 className="mt-2 font-serif text-xl font-bold text-gray-900">
                  Quick Actions
                </h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {quickActions.map((action) => (
                <QuickActionCard
                  key={action.to}
                  to={action.to}
                  title={action.title}
                  description={action.description}
                  tone={action.tone}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.18em] text-gray-500">
                Stay Engaged
              </p>
              <h2 className="mt-2 font-serif text-xl font-bold text-gray-900">
                Personal Momentum
              </h2>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.14em] text-gray-500">
                  Prayer
                </p>
                <p className="mt-2 font-serif text-2xl font-bold text-gray-900">
                  {engagementSummary.prayerRequestCount}
                </p>
                <p className="mt-1 text-xs font-sans text-gray-400">Requests shared</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.14em] text-gray-500">
                  Sermons
                </p>
                <p className="mt-2 font-serif text-2xl font-bold text-gray-900">
                  {engagementSummary.savedSermonCount}
                </p>
                <p className="mt-1 text-xs font-sans text-gray-400">Saved messages</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.14em] text-gray-500">
                  Serving
                </p>
                <p className="mt-2 font-serif text-2xl font-bold text-gray-900">
                  {engagementSummary.servingInterestCount}
                </p>
                <p className="mt-1 text-xs font-sans text-gray-400">Forms submitted</p>
              </div>
            </div>
            <Link
              to="/portal/engagement"
              className="mt-4 inline-flex text-sm font-sans font-bold text-red-700 transition-colors hover:text-red-900"
            >
              Open your engagement hub →
            </Link>
          </section>
        </div>
      </div>

      {!cellGroup && user.role === "MEMBER" && (
        <div className="mt-8">
          <EmptyState
            icon="members"
            title="You haven't been assigned to a cell group yet"
            message="Your cell group assignment is coming soon. In the meantime, explore the Community devotion feed and the member directory."
            action={{ label: "Browse Community", to: "/portal/community" }}
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
