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
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [{ title: "Prayer Requests — Admin" }];

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "FOLLOW_UP", label: "Needs Follow-Up" },
  { value: "ONGOING", label: "Ongoing Prayer" },
  { value: "ANSWERED", label: "Answered" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "all", label: "All visibility" },
  { value: "private", label: "Private only" },
  { value: "public", label: "Public only" },
] as const;

type PrayerListItem = {
  id: string;
  name: string;
  email: string | null;
  request: string;
  isPrivate: boolean;
  status: string;
  isAnswered: boolean;
  submittedAt: string;
  answeredAt: string | null;
  followUpOwnerId: string | null;
  followUpOwner: { id: string; firstName: string; lastName: string } | null;
};

function buildPrayerWhere({
  archive,
  status,
  ownerId,
  visibility,
  query,
}: {
  archive: boolean;
  status: string;
  ownerId: string;
  visibility: string;
  query: string;
}): Prisma.PrayerRequestWhereInput {
  const where: Prisma.PrayerRequestWhereInput = {
    isAnswered: archive,
  };

  if (status) {
    where.status = status;
  }

  if (ownerId === "unassigned") {
    where.followUpOwnerId = null;
  } else if (ownerId) {
    where.followUpOwnerId = ownerId;
  }

  if (visibility === "private") {
    where.isPrivate = true;
  } else if (visibility === "public") {
    where.isPrivate = false;
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { request: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const archive = url.searchParams.get("archive") === "true";
  const status = url.searchParams.get("status") ?? "";
  const ownerId = url.searchParams.get("ownerId") ?? "";
  const visibility = url.searchParams.get("visibility") ?? "all";
  const query = url.searchParams.get("q")?.trim() ?? "";

  const where = buildPrayerWhere({
    archive,
    status,
    ownerId,
    visibility,
    query,
  });

  const [prayers, total, admins, stats] = await Promise.all([
    db.prayerRequest.findMany({
      where,
      orderBy: archive
        ? [{ answeredAt: "desc" }, { submittedAt: "desc" }]
        : [{ submittedAt: "desc" }],
      take: 75,
      include: {
        followUpOwner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    db.prayerRequest.count({ where }),
    db.user.findMany({
      where: { role: "ADMIN", isActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    db.prayerRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { isAnswered: archive },
    }),
  ]);

  return {
    prayers: prayers.map((prayer): PrayerListItem => ({
      id: prayer.id,
      name: prayer.name,
      email: prayer.email,
      request: prayer.request,
      isPrivate: prayer.isPrivate,
      status: prayer.status,
      isAnswered: prayer.isAnswered,
      submittedAt:
        prayer.submittedAt instanceof Date
          ? prayer.submittedAt.toISOString()
          : prayer.submittedAt,
      answeredAt: prayer.answeredAt
        ? prayer.answeredAt instanceof Date
          ? prayer.answeredAt.toISOString()
          : prayer.answeredAt
        : null,
      followUpOwnerId: prayer.followUpOwnerId,
      followUpOwner: prayer.followUpOwner,
    })),
    total,
    archive,
    admins,
    filters: { status, ownerId, visibility, query },
    stats: Object.fromEntries(stats.map((item) => [item.status, item._count._all])),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const prayerId = String(formData.get("prayerId") ?? "");
  const intent = String(formData.get("intent") ?? "");

  if (!prayerId) {
    return { error: "Prayer request ID is missing." };
  }

  if (intent === "updateTracking") {
    const status = String(formData.get("status") ?? "NEW");
    const followUpOwnerId = String(formData.get("followUpOwnerId") ?? "");
    const visibility = String(formData.get("visibility") ?? "private");
    const isAnswered = status === "ANSWERED";

    if (!STATUS_OPTIONS.some((option) => option.value === status)) {
      return { error: "Invalid prayer status." };
    }

    await db.prayerRequest.update({
      where: { id: prayerId },
      data: {
        status,
        followUpOwnerId: followUpOwnerId || null,
        isPrivate: visibility !== "public",
        isAnswered,
        answeredAt: isAnswered ? new Date() : null,
      },
    });

    return { success: "Prayer request updated." };
  }

  if (intent === "reopen") {
    await db.prayerRequest.update({
      where: { id: prayerId },
      data: {
        status: "ONGOING",
        isAnswered: false,
        answeredAt: null,
      },
    });
    return { success: "Prayer request moved back to active follow-up." };
  }

  if (intent === "delete") {
    await db.prayerRequest.delete({ where: { id: prayerId } });
    return { success: "Prayer request deleted." };
  }

  return { error: "Unknown intent." };
}

function statusTone(status: string) {
  switch (status) {
    case "ANSWERED":
      return "border-green-200 bg-green-50 text-green-700";
    case "FOLLOW_UP":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ONGOING":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-red-200 bg-red-50 text-red-700";
  }
}

function PrayerCard({
  prayer,
  admins,
}: {
  prayer: PrayerListItem;
  admins: { id: string; firstName: string; lastName: string }[];
}) {
  const submittedDate = new Date(prayer.submittedAt).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const answeredDate = prayer.answeredAt
    ? new Date(prayer.answeredAt).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-gray-900">
              {prayer.name}
            </h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${statusTone(prayer.status)}`}
            >
              {prayer.status.replaceAll("_", " ")}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${
                prayer.isPrivate
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {prayer.isPrivate ? "Private" : "Public"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400 font-sans">
            Submitted {submittedDate}
            {prayer.email ? ` · ${prayer.email}` : ""}
            {answeredDate ? ` · Answered ${answeredDate}` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-sans text-gray-500">
          Owner:{" "}
          <span className="font-bold text-gray-700">
            {prayer.followUpOwner
              ? `${prayer.followUpOwner.firstName} ${prayer.followUpOwner.lastName}`
              : "Unassigned"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border-l-4 border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm leading-relaxed text-gray-700 font-sans">
          {prayer.request}
        </p>
      </div>

      <Form method="post" className="mt-5">
        <input type="hidden" name="intent" value="updateTracking" />
        <input type="hidden" name="prayerId" value={prayer.id} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Status
            </label>
            <select
              name="status"
              defaultValue={prayer.status}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Follow-Up Owner
            </label>
            <select
              name="followUpOwnerId"
              defaultValue={prayer.followUpOwnerId ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="">Unassigned</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.firstName} {admin.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Visibility
            </label>
            <select
              name="visibility"
              defaultValue={prayer.isPrivate ? "private" : "public"}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Save
            </button>
          </div>
        </div>
      </Form>

      <div className="mt-4 flex flex-wrap gap-3">
        {prayer.isAnswered ? (
          <Form method="post">
            <input type="hidden" name="intent" value="reopen" />
            <input type="hidden" name="prayerId" value={prayer.id} />
            <button
              type="submit"
              className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Reopen Request
            </button>
          </Form>
        ) : null}

        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="prayerId" value={prayer.id} />
          <button
            type="submit"
            onClick={(event) => {
              if (!confirm("Delete this prayer request?")) {
                event.preventDefault();
              }
            }}
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </Form>
      </div>
    </div>
  );
}

export default function AdminPrayersPage() {
  const { prayers, total, archive, admins, filters, stats } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">
            Prayer Requests
          </h1>
          <p className="text-sm text-gray-400 font-sans">
            {total} {archive ? "answered requests in the archive" : "active requests needing care"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/portal/admin/prayers"
            className={[
              "rounded-lg border px-4 py-2 text-sm font-bold transition-all",
              !archive
                ? "border-red-700 bg-red-700 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-red-300",
            ].join(" ")}
          >
            Active Queue
          </Link>
          <Link
            to="/portal/admin/prayers?archive=true"
            className={[
              "rounded-lg border px-4 py-2 text-sm font-bold transition-all",
              archive
                ? "border-red-700 bg-red-700 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-red-300",
            ].join(" ")}
          >
            Answered Archive
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {STATUS_OPTIONS.map((option) => (
          <div key={option.value} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              {option.label}
            </p>
            <p className="mt-2 font-serif text-3xl font-semibold text-gray-900">
              {stats[option.value] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <Form method="get" className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
        {archive && <input type="hidden" name="archive" value="true" />}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
          <input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Search by name, email, or request..."
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />

          <select
            name="status"
            defaultValue={filters.status}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name="ownerId"
            defaultValue={filters.ownerId}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option value="">All owners</option>
            <option value="unassigned">Unassigned</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.firstName} {admin.lastName}
              </option>
            ))}
          </select>

          <select
            name="visibility"
            defaultValue={filters.visibility}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800"
            >
              Filter
            </button>
            {(filters.query || filters.status || filters.ownerId || filters.visibility !== "all") && (
              <Link
                to={archive ? "/portal/admin/prayers?archive=true" : "/portal/admin/prayers"}
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

      {prayers.length > 0 ? (
        <div className="space-y-4">
          {prayers.map((prayer) => (
            <PrayerCard key={prayer.id} prayer={prayer} admins={admins} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="generic"
          title={archive ? "No answered prayers in the archive" : "No prayer requests in the queue"}
          message={
            archive
              ? "Answered requests will appear here once they are marked complete."
              : "New prayer requests will appear here for follow-up and care."
          }
        />
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-4">
      <p className="text-sm font-sans text-red-700">
        {isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
      </p>
    </div>
  );
}
