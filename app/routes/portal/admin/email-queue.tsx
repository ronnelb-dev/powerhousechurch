import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processPendingOutboundEmails } from "~/lib/email-queue.server";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [{ title: "Email Queue — Admin" }];

type ActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

type QueueJob = {
  id: string;
  toEmail: string;
  subject: string;
  tag: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  sentAt: Date | null;
  lastError: string | null;
  createdAt: Date;
};

function getOutboundEmailModel() {
  return (db as unknown as {
    outboundEmail: {
      findMany(args: Record<string, unknown>): Promise<QueueJob[]>;
      groupBy(args: Record<string, unknown>): Promise<Array<{ status: string; _count: { _all: number } }>>;
      updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
    };
  }).outboundEmail;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const outboundEmail = getOutboundEmailModel();

  const [jobs, grouped] = await Promise.all([
    outboundEmail.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        tag: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        nextAttemptAt: true,
        sentAt: true,
        lastError: true,
        createdAt: true,
      },
    }),
    outboundEmail.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return {
    jobs: jobs.map((job) => ({
      ...job,
      nextAttemptAt: job.nextAttemptAt.toISOString(),
      sentAt: job.sentAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    })),
    stats: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const outboundEmail = getOutboundEmailModel();

  if (intent === "process") {
    const result = await processPendingOutboundEmails();
    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "email_queue.process",
      entityType: "outbound_email",
      summary: `Processed ${result.processed} queued email job${result.processed === 1 ? "" : "s"}`,
      details: result,
    });
    return {
      ok: true,
      message: `Processed ${result.processed} job${result.processed === 1 ? "" : "s"}: ${result.sent} sent, ${result.failed} failed.`,
    } satisfies ActionData;
  }

  if (intent === "retry-dead") {
    const count = await outboundEmail.updateMany({
      where: { status: "DEAD_LETTER" },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(),
        lockedAt: null,
      },
    });
    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "email_queue.retry_dead_letter",
      entityType: "outbound_email",
      summary: `Requeued ${count.count} dead-letter email job${count.count === 1 ? "" : "s"}`,
      details: { requeuedCount: count.count },
    });
    return {
      ok: true,
      message: `Requeued ${count.count} dead-letter job${count.count === 1 ? "" : "s"}.`,
    } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function statusTone(status: string) {
  switch (status) {
    case "SENT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "DEAD_LETTER":
      return "border-red-200 bg-red-50 text-red-700";
    case "PROCESSING":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

export default function AdminEmailQueuePage() {
  const { jobs, stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">Email Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Durable outbound delivery with retry state for transactional and admin email.
          </p>
        </div>
        <div className="flex gap-3">
          <Form method="post">
            <input type="hidden" name="intent" value="process" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              {isSubmitting ? "Processing..." : "Process queue"}
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="retry-dead" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              Retry dead letters
            </button>
          </Form>
        </div>
      </div>

      {actionData ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${actionData.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {actionData.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Pending" value={stats.PENDING ?? 0} />
        <StatCard label="Processing" value={stats.PROCESSING ?? 0} />
        <StatCard label="Failed" value={stats.FAILED ?? 0} />
        <StatCard label="Dead letter" value={stats.DEAD_LETTER ?? 0} />
        <StatCard label="Sent" value={stats.SENT ?? 0} />
      </div>

      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">{job.subject}</p>
                  <p className="mt-1 text-sm text-gray-500">{job.toEmail}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    Created {new Date(job.createdAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${statusTone(job.status)}`}>
                  {job.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Attempts</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">{job.attempts} / {job.maxAttempts}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Next attempt</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">
                    {new Date(job.nextAttemptAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Tag</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">{job.tag ?? "none"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">Sent at</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800">
                    {job.sentAt
                      ? new Date(job.sentAt).toLocaleString("en-PH", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Not sent yet"}
                  </p>
                </div>
              </div>

              {job.lastError ? (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {job.lastError}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="generic"
          title="Email queue is empty"
          message="Queued emails will appear here once transactional or admin messages are created."
        />
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="generic"
      title="Email queue unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
    />
  );
}
