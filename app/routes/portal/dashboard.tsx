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
      className={`group block rounded-lg border border-l-2 px-4 py-3 transition-colors ${toneClasses}`}
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
  const heroIntro =
    user.role === "ADMIN"
      ? "Stay close to the church's operational pulse: attendance, care, members, and ministry follow-up."
      : user.role === "CELL_LEADER"
        ? cellGroup
          ? `You are leading ${cellGroup.name} Group. Keep momentum strong with attendance, care, and community rhythms this week.`
          : "Your leader tools will become more useful once a cell group is assigned."
        : cellGroup
          ? `You are connected to ${cellGroup.name} Group. Keep growing through sermons, prayer, and community life this week.`
          : "Your portal keeps prayer, sermons, community, and church life close at hand.";
  const primaryActions =
    user.role === "ADMIN"
      ? [
          { to: "/portal/attendance", label: "Mark Attendance", variant: "primary" as const },
          { to: "/portal/admin/members", label: "Manage Members", variant: "secondary" as const },
          { to: "/portal/care", label: "Care Queue", variant: "secondary" as const },
        ]
      : user.role === "CELL_LEADER"
        ? [
            { to: "/portal/attendance", label: "Mark Attendance", variant: "primary" as const },
            { to: "/portal/care", label: "Care Queue", variant: "secondary" as const },
          ]
        : [
            { to: "/portal/community", label: "Open Community", variant: "primary" as const },
            { to: "/portal/engagement", label: "View Engagement", variant: "secondary" as const },
          ];
  const scopeCard =
    user.role === "ADMIN"
      ? {
          label: "Admin Snapshot",
          title: cellGroup ? `${cellGroup.name} Group` : "Church Operations",
          description: cellGroup
            ? `${memberCount} members connected in your current group. Use admin tools for the wider church view.`
            : "Use the admin workspace to manage members, ministries, communications, reports, and care rhythms.",
        }
      : {
          label: "Group Snapshot",
          title: cellGroup ? `${cellGroup.name} Group` : "Awaiting Cell Group",
          description: cellGroup
            ? `${memberCount} members connected in your current group.`
            : "Once assigned, your group updates and attendance rhythms will appear here.",
        };
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const sermonHasGuide = Boolean(
    latestSermon?.weeklyGuide || latestSermon?.reflectionPrompts,
  );
  const quickActions = [
    ...(user.role === "ADMIN"
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
          {
            to: "/portal/admin/members",
            title: "Manage Members",
            description: "Update roles, assignments, status, exports, and bulk actions.",
            tone: "neutral" as const,
          },
          {
            to: "/portal/admin/communications",
            title: "Communications",
            description: "Send church updates and manage scheduled messages.",
            tone: "neutral" as const,
          },
          {
            to: "/portal/admin/reports",
            title: "Reports",
            description: "Review attendance, engagement, and ministry health signals.",
            tone: "gold" as const,
          },
        ]
      : isCellLeaderOrAdmin
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
    <div className="max-w-6xl p-4 sm:p-5 md:p-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1">
              <span className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-700">
                {roleLabel}
              </span>
            </div>
            <h1 className="mt-3 font-sans text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Welcome back, {user.firstName}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-sans leading-6 text-gray-600 sm:text-base">
              {today}
            </p>
            <p className="mt-3 max-w-2xl text-sm font-sans leading-6 text-gray-600">
              {heroIntro}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {primaryActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={[
                    "inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-sans font-bold transition-colors",
                    action.variant === "primary"
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-950",
                  ].join(" ")}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                {scopeCard.label}
              </p>
              <p className="mt-2 font-sans text-base font-bold text-gray-900">
                {scopeCard.title}
              </p>
              <p className="mt-1 text-sm font-sans leading-6 text-gray-500">
                {scopeCard.description}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Weekly Focus
              </p>
              <p className="mt-2 font-sans text-base font-bold text-gray-900">
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
                  className="mt-3 inline-flex text-sm font-sans font-bold text-gray-700 transition-colors hover:text-gray-950"
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
        <div className="mt-5">
          <PastoralAlert members={needsCare} />
        </div>
      )}

      {/* KPI cards — cell leader / admin only */}
      {isCellLeaderOrAdmin && attendanceSummary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="space-y-5">
          {recentAttendance.length > 0 && (
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Consistency
                  </p>
                  <h2 className="mt-1.5 font-sans text-lg font-bold text-gray-900">
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
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Latest Message
                  </p>
                  <h2 className="mt-2 font-sans text-xl font-bold text-gray-900">
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
                    className="inline-flex min-h-10 items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-sans font-bold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    Watch Message
                  </Link>
                  {sermonHasGuide ? (
                    <Link
                      to="/portal/community"
                      className="inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-sans font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      Open Community
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Next Steps
                </p>
                <h2 className="mt-1.5 font-sans text-lg font-bold text-gray-900">
                  Quick Actions
                </h2>
              </div>
            </div>
            <div className="mt-4 space-y-2">
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

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div>
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Stay Engaged
              </p>
              <h2 className="mt-1.5 font-sans text-lg font-bold text-gray-900">
                Personal Momentum
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Prayer
                </p>
                <p className="mt-1.5 font-sans text-xl font-bold text-gray-900">
                  {engagementSummary.prayerRequestCount}
                </p>
                <p className="mt-1 text-xs font-sans text-gray-400">Requests shared</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Sermons
                </p>
                <p className="mt-1.5 font-sans text-xl font-bold text-gray-900">
                  {engagementSummary.savedSermonCount}
                </p>
                <p className="mt-1 text-xs font-sans text-gray-400">Saved messages</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Serving
                </p>
                <p className="mt-1.5 font-sans text-xl font-bold text-gray-900">
                  {engagementSummary.servingInterestCount}
                </p>
                <p className="mt-1 text-xs font-sans text-gray-400">Forms submitted</p>
              </div>
            </div>
            <Link
              to="/portal/engagement"
              className="mt-4 inline-flex text-sm font-sans font-bold text-gray-700 transition-colors hover:text-gray-950"
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
