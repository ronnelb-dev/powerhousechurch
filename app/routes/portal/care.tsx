import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import {
  CARE_CATEGORY_ATTENDANCE,
  CARE_CATEGORY_PRAYER,
  getCareQueue,
  type CareOwner,
  type CareQueueItem,
} from "~/lib/care-queue.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Care Queue — Powerhouse Church Portal" },
];

const PRAYER_STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "FOLLOW_UP", label: "Needs Follow-Up" },
  { value: "ONGOING", label: "Ongoing Prayer" },
  { value: "ANSWERED", label: "Answered" },
] as const;

function parseDateTimeInput(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim();
  return input ? new Date(input) : null;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  if (user.role === "MEMBER") {
    throw new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const bucket = user.role === "ADMIN" && url.searchParams.get("bucket") === "archive"
    ? "archive"
    : "open";
  const sourceParam = url.searchParams.get("source") ?? "all";
  const source =
    user.role === "ADMIN" && (sourceParam === "attendance" || sourceParam === "prayer")
      ? sourceParam
      : "all";
  const ownerId = url.searchParams.get("ownerId") ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  const dueOnly = url.searchParams.get("due") === "true";
  const memberId = url.searchParams.get("memberId") ?? "";

  const { owners, items, stats } = await getCareQueue({
    role: user.role,
    cellGroupId: user.cellGroupId,
    bucket,
    source,
    ownerId,
    query,
    dueOnly,
    memberId,
  });

  return {
    user: {
      id: user.id,
      role: user.role as "ADMIN" | "CELL_LEADER",
      cellGroupId: user.cellGroupId,
    },
    owners,
    items,
    stats,
    filters: {
      bucket,
      source,
      ownerId,
      query,
      dueOnly,
      memberId,
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  if (user.role === "MEMBER") {
    throw new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const assignedOwnerId = String(formData.get("assignedOwnerId") ?? "") || null;
  const lastContactedAt = parseDateTimeInput(formData.get("lastContactedAt"));
  const reminderAt = parseDateTimeInput(formData.get("reminderAt"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const nextAction = String(formData.get("nextAction") ?? "").trim() || null;

  if (intent === "updateAttendanceCare") {
    const memberId = String(formData.get("memberId") ?? "");
    if (!memberId) {
      return { error: "Member ID is missing." };
    }

    const member = await db.user.findUnique({
      where: { id: memberId },
      select: { id: true, cellGroupId: true, firstName: true, lastName: true },
    });

    if (!member) {
      return { error: "Member not found." };
    }

    if (user.role === "CELL_LEADER" && member.cellGroupId !== user.cellGroupId) {
      throw new Response("Forbidden", { status: 403 });
    }

    await db.careCase.upsert({
      where: {
        memberId_category: {
          memberId,
          category: CARE_CATEGORY_ATTENDANCE,
        },
      },
      update: {
        assignedOwnerId,
        lastContactedAt,
        reminderAt,
        notes,
        nextAction,
        isResolved: false,
        resolvedAt: null,
      },
      create: {
        category: CARE_CATEGORY_ATTENDANCE,
        memberId,
        assignedOwnerId,
        lastContactedAt,
        reminderAt,
        notes,
        nextAction,
      },
    });

    return {
      success: `Care notes saved for ${member.firstName} ${member.lastName}.`,
    };
  }

  if (intent === "updatePrayerCare") {
    if (user.role !== "ADMIN") {
      throw new Response("Forbidden", { status: 403 });
    }

    const prayerId = String(formData.get("prayerId") ?? "");
    const status = String(formData.get("status") ?? "NEW");
    const visibility = String(formData.get("visibility") ?? "private");
    const isAnswered = status === "ANSWERED";

    if (!prayerId) {
      return { error: "Prayer request ID is missing." };
    }

    if (!PRAYER_STATUS_OPTIONS.some((option) => option.value === status)) {
      return { error: "Invalid prayer status." };
    }

    await db.$transaction([
      db.prayerRequest.update({
        where: { id: prayerId },
        data: {
          status,
          followUpOwnerId: assignedOwnerId,
          isPrivate: visibility !== "public",
          isAnswered,
          answeredAt: isAnswered ? new Date() : null,
        },
      }),
      db.careCase.upsert({
        where: { prayerRequestId: prayerId },
        update: {
          category: CARE_CATEGORY_PRAYER,
          assignedOwnerId,
          lastContactedAt,
          reminderAt,
          notes,
          nextAction,
          isResolved: isAnswered,
          resolvedAt: isAnswered ? new Date() : null,
        },
        create: {
          category: CARE_CATEGORY_PRAYER,
          prayerRequestId: prayerId,
          assignedOwnerId,
          lastContactedAt,
          reminderAt,
          notes,
          nextAction,
          isResolved: isAnswered,
          resolvedAt: isAnswered ? new Date() : null,
        },
      }),
    ]);

    return { success: "Prayer care workflow updated." };
  }

  if (intent === "deletePrayer") {
    if (user.role !== "ADMIN") {
      throw new Response("Forbidden", { status: 403 });
    }

    const prayerId = String(formData.get("prayerId") ?? "");
    if (!prayerId) {
      return { error: "Prayer request ID is missing." };
    }

    await db.prayerRequest.delete({ where: { id: prayerId } });
    return { success: "Prayer request deleted." };
  }

  return { error: "Unknown intent." };
}

function sourceTone(sourceType: CareQueueItem["sourceType"]) {
  return sourceType === "ATTENDANCE"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
}

function prayerStatusTone(status: string) {
  switch (status) {
    case "ANSWERED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FOLLOW_UP":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ONGOING":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function OwnerSelect({
  owners,
  defaultValue,
}: {
  owners: CareOwner[];
  defaultValue: string | null;
}) {
  return (
    <select
      name="assignedOwnerId"
      defaultValue={defaultValue ?? ""}
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
    >
      <option value="">Unassigned</option>
      {owners.map((owner) => (
        <option key={owner.id} value={owner.id}>
          {owner.firstName} {owner.lastName} ({owner.role === "ADMIN" ? "Admin" : "Cell Leader"})
        </option>
      ))}
    </select>
  );
}

function AttendanceCareCard({
  item,
  owners,
}: {
  item: CareQueueItem;
  owners: CareOwner[];
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-gray-900">
              {item.title}
            </h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${sourceTone(item.sourceType)}`}
            >
              Attendance Care
            </span>
            {item.isReminderDue ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-800">
                Reminder due
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-400 font-sans">
            Missed {item.consecutiveMissed} consecutive Sunday
            {item.consecutiveMissed === 1 ? "" : "s"}
            {item.cellGroupName ? ` · ${item.cellGroupName}` : ""}
          </p>
          <p className="mt-1 text-sm text-gray-500 font-sans">
            {[item.email, item.phone].filter(Boolean).join(" · ") || "No direct contact info on file"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-sans text-gray-500">
          Owner:{" "}
          <span className="font-bold text-gray-700">
            {item.owner ? `${item.owner.firstName} ${item.owner.lastName}` : "Unassigned"}
          </span>
        </div>
      </div>

      <Form method="post">
        <input type="hidden" name="intent" value="updateAttendanceCare" />
        <input type="hidden" name="memberId" value={item.memberId} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Assigned owner
            </label>
            <OwnerSelect owners={owners} defaultValue={item.ownerId ?? null} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Last contact date
            </label>
            <input
              type="datetime-local"
              name="lastContactedAt"
              defaultValue={item.lastContactedAt?.slice(0, 16) ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Reminder
            </label>
            <input
              type="datetime-local"
              name="reminderAt"
              defaultValue={item.reminderAt?.slice(0, 16) ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Next action
          </label>
          <input
            type="text"
            name="nextAction"
            defaultValue={item.nextAction ?? ""}
            placeholder="Call after service, send a text, arrange a visit, or ask a leader to follow up."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Notes
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={item.notes ?? ""}
            placeholder="Document conversations, family context, prayer needs, and what would help the next follow-up feel personal."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            Last contact: {formatDateTime(item.lastContactedAt)}
          </div>

          <div className="flex flex-wrap gap-3">
            {item.memberLink ? (
              <Link
                to={item.memberLink}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:border-red-300 hover:text-red-700"
              >
                View member
              </Link>
            ) : null}
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Save care notes
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}

function PrayerCareCard({
  item,
  owners,
}: {
  item: CareQueueItem;
  owners: CareOwner[];
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-gray-900">
              {item.title}
            </h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${sourceTone(item.sourceType)}`}
            >
              Prayer Care
            </span>
            {item.prayerStatus ? (
              <span
                className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${prayerStatusTone(item.prayerStatus)}`}
              >
                {item.prayerStatus.replaceAll("_", " ")}
              </span>
            ) : null}
            {item.isReminderDue ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-800">
                Reminder due
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-400 font-sans">
            Submitted {formatShortDate(item.openedAt)}
            {item.answeredAt ? ` · Answered ${formatShortDate(item.answeredAt)}` : ""}
            {item.email ? ` · ${item.email}` : ""}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-sans text-gray-500">
          Owner:{" "}
          <span className="font-bold text-gray-700">
            {item.owner ? `${item.owner.firstName} ${item.owner.lastName}` : "Unassigned"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm leading-relaxed text-gray-700">{item.prayerRequest}</p>
      </div>

      <Form method="post" className="mt-5">
        <input type="hidden" name="intent" value="updatePrayerCare" />
        <input type="hidden" name="prayerId" value={item.sourceId} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Prayer status
            </label>
            <select
              name="status"
              defaultValue={item.prayerStatus ?? "NEW"}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              {PRAYER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Assigned owner
            </label>
            <OwnerSelect owners={owners} defaultValue={item.ownerId ?? null} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Visibility
            </label>
            <select
              name="visibility"
              defaultValue={item.isPrivate ? "private" : "public"}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Last contact date
            </label>
            <input
              type="datetime-local"
              name="lastContactedAt"
              defaultValue={item.lastContactedAt?.slice(0, 16) ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Reminder
            </label>
            <input
              type="datetime-local"
              name="reminderAt"
              defaultValue={item.reminderAt?.slice(0, 16) ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Next action
          </label>
          <input
            type="text"
            name="nextAction"
            defaultValue={item.nextAction ?? ""}
            placeholder="Offer a pastoral call, send encouragement, follow up on an update, or schedule a check-in."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Notes
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={item.notes ?? ""}
            placeholder="Track updates, care offered, who contacted them, and what should happen next."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-xs text-gray-400">
            <p>Last contact: {formatDateTime(item.lastContactedAt)}</p>
            <p>{item.isPrivate ? "Visible to pastoral team only" : "Can be shared in public prayer contexts"}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Save workflow
            </button>
          </div>
        </div>
      </Form>

      <Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="deletePrayer" />
        <input type="hidden" name="prayerId" value={item.sourceId} />
        <button
          type="submit"
          onClick={(event) => {
            if (!confirm(`Delete prayer request for ${item.title}?`)) {
              event.preventDefault();
            }
          }}
          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50"
        >
          Delete request
        </button>
      </Form>
    </div>
  );
}

export default function CareQueuePage() {
  const { user, owners, items, stats, filters } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const clearParams = new URLSearchParams();
  if (user.role === "ADMIN" && filters.bucket === "archive") {
    clearParams.set("bucket", "archive");
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">
            Care Queue
          </h1>
          <p className="text-sm text-gray-400 font-sans">
            {user.role === "ADMIN"
              ? "One place to triage attendance gaps and prayer follow-up with ownership, notes, next steps, and reminders."
              : "Track pastoral follow-up for members in your group who may need care."}
          </p>
        </div>

        {user.role === "ADMIN" ? (
          <div className="flex gap-2">
            <Link
              to="/portal/care"
              className={[
                "rounded-lg border px-4 py-2 text-sm font-bold transition-all",
                filters.bucket === "open"
                  ? "border-red-700 bg-red-700 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-red-300",
              ].join(" ")}
            >
              Open Queue
            </Link>
            <Link
              to="/portal/care?bucket=archive&source=prayer"
              className={[
                "rounded-lg border px-4 py-2 text-sm font-bold transition-all",
                filters.bucket === "archive"
                  ? "border-red-700 bg-red-700 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-red-300",
              ].join(" ")}
            >
              Prayer Archive
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label={filters.bucket === "archive" ? "Archived" : "Open items"} value={String(stats.total)} />
        <MetricCard label="Due now" value={String(stats.due)} />
        <MetricCard label="Attendance care" value={String(stats.attendance)} />
        <MetricCard label={user.role === "ADMIN" ? "Prayer care" : "Unassigned"} value={String(user.role === "ADMIN" ? stats.prayer : stats.unassigned)} />
      </div>

      <Form method="get" className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
        {user.role === "ADMIN" && filters.bucket === "archive" ? (
          <input type="hidden" name="bucket" value="archive" />
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
          <input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Search by person, request, notes, or next action..."
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />

          {user.role === "ADMIN" ? (
            <select
              name="source"
              defaultValue={filters.source}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="all">All sources</option>
              <option value="attendance">Attendance care</option>
              <option value="prayer">Prayer care</option>
            </select>
          ) : (
            <input type="hidden" name="source" value="all" />
          )}

          <select
            name="ownerId"
            defaultValue={filters.ownerId}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option value="">All owners</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.firstName} {owner.lastName}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600">
              <input
                type="checkbox"
                name="due"
                value="true"
                defaultChecked={filters.dueOnly}
                className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
              />
              Due only
            </label>

            <button
              type="submit"
              className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800"
            >
              Filter
            </button>

            {(filters.query || filters.ownerId || filters.dueOnly || (user.role === "ADMIN" && filters.source !== "all")) && (
              <Link
                to={clearParams.toString() ? `/portal/care?${clearParams.toString()}` : "/portal/care"}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:text-gray-700"
              >
                Clear
              </Link>
            )}
          </div>
        </div>
      </Form>

      {actionData && typeof actionData === "object" && ("success" in actionData || "error" in actionData) ? (
        <div
          role="status"
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-sans ${
            "error" in actionData && actionData.error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {"error" in actionData && actionData.error
            ? actionData.error
            : "success" in actionData
            ? actionData.success
            : null}
        </div>
      ) : null}

      {isSubmitting ? (
        <p className="mb-4 text-sm font-sans text-gray-400">Saving changes…</p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) =>
            item.sourceType === "ATTENDANCE" ? (
              <AttendanceCareCard key={item.key} item={item} owners={owners} />
            ) : (
              <PrayerCareCard key={item.key} item={item} owners={owners} />
            )
          )}
        </div>
      ) : (
        <EmptyState
          icon="generic"
          title={filters.bucket === "archive" ? "No archived prayer follow-up" : "No care items in this queue"}
          message={
            user.role === "ADMIN"
              ? filters.bucket === "archive"
                ? "Answered prayer requests will appear here after they are closed out."
                : "Attendance risks and active prayer requests will appear here for coordinated follow-up."
              : "When members in your group miss two or more Sundays in a row, they will appear here for follow-up."
          }
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
        icon="generic"
        title={
          isRouteErrorResponse(error) && error.status === 403
            ? "Care Queue Unavailable"
            : "Something went wrong"
        }
        message={
          isRouteErrorResponse(error)
            ? error.status === 403
              ? "Only cell leaders and admins can access the care queue."
              : error.data
            : "Please refresh the page."
        }
      />
    </div>
  );
}
