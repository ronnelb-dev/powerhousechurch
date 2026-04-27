import { useEffect, useRef } from "react";
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
import { useToast } from "~/components/ui/ToastProvider";

export const meta: MetaFunction = () => [{ title: "Visit Plans — Admin" }];

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "CONTACT_ATTEMPTED", label: "Contact Attempted" },
  { value: "READY_FOR_SUNDAY", label: "Ready for Sunday" },
  { value: "VISITED", label: "Visited" },
  { value: "CONNECTED", label: "Connected" },
  { value: "CLOSED", label: "Closed" },
] as const;

const BUCKET_OPTIONS = [
  { value: "open", label: "Open Pipeline" },
  { value: "closed", label: "Completed" },
] as const;

type VisitPlanItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  preferredService: string;
  visitDate: string | null;
  adultCount: number;
  isFirstTimeGuest: boolean;
  bringingKids: boolean;
  kidsCount: number | null;
  kidsDetails: string | null;
  wantsUsherFollowUp: boolean;
  wantsPastorFollowUp: boolean;
  notes: string | null;
  status: string;
  followUpOwnerId: string | null;
  followUpOwner: { id: string; firstName: string; lastName: string } | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  outcomeNotes: string | null;
  submittedAt: string;
};

function isClosedStatus(status: string) {
  return status === "CONNECTED" || status === "CLOSED";
}

function buildVisitPlanWhere(args: {
  bucket: string;
  status: string;
  ownerId: string;
  query: string;
}): Prisma.VisitPlanWhereInput {
  const where: Prisma.VisitPlanWhereInput = {};

  if (args.bucket === "closed") {
    where.status = { in: ["CONNECTED", "CLOSED"] };
  } else {
    where.status = args.status
      ? args.status
      : { notIn: ["CONNECTED", "CLOSED"] };
  }

  if (args.bucket === "closed" && args.status) {
    where.status = args.status;
  }

  if (args.ownerId === "unassigned") {
    where.followUpOwnerId = null;
  } else if (args.ownerId) {
    where.followUpOwnerId = args.ownerId;
  }

  if (args.query) {
    where.OR = [
      { name: { contains: args.query, mode: "insensitive" } },
      { email: { contains: args.query, mode: "insensitive" } },
      { phone: { contains: args.query, mode: "insensitive" } },
      { city: { contains: args.query, mode: "insensitive" } },
      { notes: { contains: args.query, mode: "insensitive" } },
      { outcomeNotes: { contains: args.query, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") ?? "open";
  const status = url.searchParams.get("status") ?? "";
  const ownerId = url.searchParams.get("ownerId") ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  const where = buildVisitPlanWhere({ bucket, status, ownerId, query });

  const [visitPlans, owners, stats, dueFollowUps] = await Promise.all([
    db.visitPlan.findMany({
      where,
      orderBy: [
        { nextFollowUpAt: "asc" },
        { visitDate: "asc" },
        { submittedAt: "desc" },
      ],
      take: 100,
      include: {
        followUpOwner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        role: { in: ["ADMIN", "CELL_LEADER"] },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
    db.visitPlan.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.visitPlan.count({
      where: {
        nextFollowUpAt: { lte: new Date() },
        status: { notIn: ["CONNECTED", "CLOSED"] },
      },
    }),
  ]);

  const serialized = visitPlans.map((plan): VisitPlanItem => ({
    id: plan.id,
    name: plan.name,
    email: plan.email,
    phone: plan.phone,
    city: plan.city,
    preferredService: plan.preferredService,
    visitDate: plan.visitDate ? plan.visitDate.toISOString() : null,
    adultCount: plan.adultCount,
    isFirstTimeGuest: plan.isFirstTimeGuest,
    bringingKids: plan.bringingKids,
    kidsCount: plan.kidsCount,
    kidsDetails: plan.kidsDetails,
    wantsUsherFollowUp: plan.wantsUsherFollowUp,
    wantsPastorFollowUp: plan.wantsPastorFollowUp,
    notes: plan.notes,
    status: plan.status,
    followUpOwnerId: plan.followUpOwnerId,
    followUpOwner: plan.followUpOwner,
    lastContactedAt: plan.lastContactedAt ? plan.lastContactedAt.toISOString() : null,
    nextFollowUpAt: plan.nextFollowUpAt ? plan.nextFollowUpAt.toISOString() : null,
    outcomeNotes: plan.outcomeNotes,
    submittedAt: plan.submittedAt.toISOString(),
  }));

  return {
    visitPlans: serialized,
    owners,
    filters: { bucket, status, ownerId, query },
    stats: Object.fromEntries(stats.map((item) => [item.status, item._count._all])),
    dueFollowUps,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const visitPlanId = String(formData.get("visitPlanId") ?? "");

  if (!visitPlanId) {
    return { error: "Visit plan ID is missing." };
  }

  if (intent === "updateTracking") {
    const status = String(formData.get("status") ?? "NEW");
    const followUpOwnerId = String(formData.get("followUpOwnerId") ?? "");
    const nextFollowUpAt = String(formData.get("nextFollowUpAt") ?? "");
    const outcomeNotes = String(formData.get("outcomeNotes") ?? "").trim();
    const markContacted = formData.get("markContacted") === "on";

    if (!STATUS_OPTIONS.some((option) => option.value === status)) {
      return { error: "Invalid visit-plan status." };
    }

    await db.visitPlan.update({
      where: { id: visitPlanId },
      data: {
        status,
        followUpOwnerId: followUpOwnerId || null,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
        outcomeNotes: outcomeNotes || null,
        ...(markContacted ? { lastContactedAt: new Date() } : {}),
      },
    });

    return { success: "Visit plan updated." };
  }

  if (intent === "delete") {
    await db.visitPlan.delete({ where: { id: visitPlanId } });
    return { success: "Visit plan deleted." };
  }

  return { error: "Unknown intent." };
}

function statusTone(status: string) {
  switch (status) {
    case "CONNECTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "VISITED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "READY_FOR_SUNDAY":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "CONTACT_ATTEMPTED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CLOSED":
      return "border-gray-200 bg-gray-100 text-gray-700";
    default:
      return "border-red-200 bg-red-50 text-red-700";
  }
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function VisitPlanCard({
  visitPlan,
  owners,
}: {
  visitPlan: VisitPlanItem;
  owners: { id: string; firstName: string; lastName: string; role: string }[];
}) {
  const submitted = new Date(visitPlan.submittedAt).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const visitDate = visitPlan.visitDate
    ? new Date(visitPlan.visitDate).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const isDue =
    visitPlan.nextFollowUpAt &&
    new Date(visitPlan.nextFollowUpAt) <= new Date() &&
    !isClosedStatus(visitPlan.status);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-gray-900">
              {visitPlan.name}
            </h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${statusTone(visitPlan.status)}`}
            >
              {visitPlan.status.replaceAll("_", " ")}
            </span>
            {isDue ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-800">
                Follow-up due
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-400 font-sans">
            Submitted {submitted}
            {visitDate ? ` · Visit date ${visitDate}` : ""}
            {visitPlan.city ? ` · ${visitPlan.city}` : ""}
          </p>
          <p className="mt-1 text-sm text-gray-500 font-sans">
            {visitPlan.email}
            {visitPlan.phone ? ` · ${visitPlan.phone}` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-sans text-gray-500">
          Owner:{" "}
          <span className="font-bold text-gray-700">
            {visitPlan.followUpOwner
              ? `${visitPlan.followUpOwner.firstName} ${visitPlan.followUpOwner.lastName}`
              : "Unassigned"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Preferred service" value={visitPlan.preferredService} />
        <InfoTile
          label="Party details"
          value={`${visitPlan.adultCount} adult${visitPlan.adultCount === 1 ? "" : "s"}${visitPlan.kidsCount ? ` · ${visitPlan.kidsCount} kid${visitPlan.kidsCount === 1 ? "" : "s"}` : ""}`}
        />
        <InfoTile
          label="First-time guest"
          value={visitPlan.isFirstTimeGuest ? "Yes" : "No"}
        />
        <InfoTile
          label="Requested follow-up"
          value={[
            visitPlan.wantsUsherFollowUp ? "Usher" : null,
            visitPlan.wantsPastorFollowUp ? "Pastor" : null,
          ]
            .filter(Boolean)
            .join(" + ") || "None"}
        />
      </div>

      {(visitPlan.notes || visitPlan.kidsDetails) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {visitPlan.notes ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                Guest Notes
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{visitPlan.notes}</p>
            </div>
          ) : null}
          {visitPlan.kidsDetails ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                Kids Notes
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {visitPlan.kidsDetails}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-5">
      <Form method="post">
        <input type="hidden" name="intent" value="updateTracking" />
        <input type="hidden" name="visitPlanId" value={visitPlan.id} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Status
            </label>
            <select
              name="status"
              defaultValue={visitPlan.status}
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
              defaultValue={visitPlan.followUpOwnerId ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName} ({owner.role === "ADMIN" ? "Admin" : "Cell Leader"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Next Follow-Up
            </label>
            <input
              type="datetime-local"
              name="nextFollowUpAt"
              defaultValue={visitPlan.nextFollowUpAt?.slice(0, 16) ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            Outcome Notes
          </label>
          <textarea
            name="outcomeNotes"
            rows={3}
            defaultValue={visitPlan.outcomeNotes ?? ""}
            placeholder="Document calls, texts, prayer offered, visit outcome, next step, or connection notes."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                name="markContacted"
                className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
              />
              Mark contacted now
            </label>
            <p className="text-xs text-gray-400">
              Last contact: {formatDateTime(visitPlan.lastContactedAt) ?? "Not recorded"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Save Tracking
            </button>
          </div>
        </div>
      </Form>
      <Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="visitPlanId" value={visitPlan.id} />
        <button
          type="submit"
          onClick={(event) => {
            if (!confirm(`Delete visit plan for ${visitPlan.name}?`)) {
              event.preventDefault();
            }
          }}
          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50"
        >
          Delete
        </button>
      </Form>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

export default function AdminVisitPlansPage() {
  const { visitPlans, owners, filters, stats, dueFollowUps } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);

  const openCount =
    Object.entries(stats)
      .filter(([status]) => !isClosedStatus(status))
      .reduce((sum, [, count]) => sum + Number(count), 0);
  const closedCount =
    Number(stats.CONNECTED ?? 0) + Number(stats.CLOSED ?? 0);
  const pastorRequestedCount = visitPlans.filter(
    (plan) => plan.wantsPastorFollowUp,
  ).length;
  const familyCount = visitPlans.filter((plan) => plan.bringingKids).length;

  useEffect(() => {
    if (!actionData || typeof actionData !== "object") {
      return;
    }

    const message =
      "error" in actionData && actionData.error
        ? actionData.error
        : "success" in actionData && actionData.success
        ? actionData.success
        : null;

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: "error" in actionData && actionData.error ? "error" : "success",
      message,
    });
  }, [actionData, showToast]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">
            Visit Plans
          </h1>
          <p className="text-sm text-gray-400 font-sans">
            Track first-time guests from initial form submission through follow-up and connection.
          </p>
        </div>

        <div className="flex gap-2">
          {BUCKET_OPTIONS.map((option) => (
            <Link
              key={option.value}
              to={`/portal/admin/visit-plans?${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(filters).filter(([, value]) => value),
                ),
                bucket: option.value,
              }).toString()}`}
              className={[
                "rounded-lg border px-4 py-2 text-sm font-bold transition-all",
                filters.bucket === option.value
                  ? "border-red-700 bg-red-700 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-red-300",
              ].join(" ")}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Open pipeline" value={String(openCount)} />
        <MetricCard label="Completed" value={String(closedCount)} />
        <MetricCard label="Pastor follow-up" value={String(pastorRequestedCount)} />
        <MetricCard label="Due now" value={String(dueFollowUps)} />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
        <p className="mb-4 text-sm text-gray-500 font-sans">
          Families bringing kids in this filtered view:{" "}
          <span className="font-bold text-gray-700">{familyCount}</span>
        </p>
        <Form method="get" className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
          <input type="hidden" name="bucket" value={filters.bucket} />
          <input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Search by guest name, email, city, or notes..."
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
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.firstName} {owner.lastName}
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
            {(filters.query || filters.status || filters.ownerId) && (
              <Link
                to={`/portal/admin/visit-plans?bucket=${filters.bucket}`}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:text-gray-700"
              >
                Clear
              </Link>
            )}
          </div>
        </Form>
      </div>

      {isSubmitting ? (
        <p className="mb-4 text-sm font-sans text-gray-400">Saving changes…</p>
      ) : null}

      {visitPlans.length > 0 ? (
        <div className="space-y-4">
          {visitPlans.map((visitPlan) => (
            <VisitPlanCard key={visitPlan.id} visitPlan={visitPlan} owners={owners} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="generic"
          title="No visit plans found"
          message="New guest submissions will appear here once people fill out the Plan Your Visit form."
        />
      )}
    </div>
  );
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
