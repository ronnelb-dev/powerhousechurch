import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { z } from "zod";
import type { MetaFunction } from "react-router";
import { EmptyState } from "~/components/ui/EmptyState";
import {
  COMMUNICATION_AUDIENCE_TYPES,
  type CommunicationAudienceType,
} from "~/lib/communications";
import {
  getCommunicationAudienceOptions,
  getCommunicationAudienceRecipients,
  sendCommunicationToAudience,
} from "~/lib/communications.server";
import { requireAdmin } from "~/lib/auth.server";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";

export const meta: MetaFunction = () => [
  { title: "Communications Center — Admin" },
];

type CommunicationsActionData = {
  ok: boolean;
  message?: string;
  formError?: string;
  errors?: Record<string, string[] | undefined>;
  values?: {
    subject: string;
    body: string;
  };
};

const audienceTypeSchema = z.enum(COMMUNICATION_AUDIENCE_TYPES);

const sendCommunicationSchema = z.object({
  audienceType: audienceTypeSchema,
  audienceId: z.string().optional(),
  subject: z.string().trim().min(1, "Subject is required.").max(180),
  body: z.string().trim().min(1, "Message is required.").max(8000),
});

function audienceNeedsSelection(audienceType: CommunicationAudienceType) {
  return audienceType === "CELL_GROUP" || audienceType === "EVENT_REGISTRANTS";
}

function getAudienceLabel(audienceType: CommunicationAudienceType) {
  switch (audienceType) {
    case "CELL_GROUP":
      return "Cell group";
    case "EVENT_REGISTRANTS":
      return "Event registrants";
    case "FIRST_TIME_GUESTS":
      return "First-time guests";
    case "KIDS_GUARDIANS":
      return "Kids ministry guardians";
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const requestedType = url.searchParams.get("audienceType");
  const requestedId = url.searchParams.get("audienceId") ?? "";
  const audienceType = audienceTypeSchema.safeParse(requestedType).success
    ? (requestedType as CommunicationAudienceType)
    : "CELL_GROUP";

  const options = await getCommunicationAudienceOptions();
  const preview = await getCommunicationAudienceRecipients({
    audienceType,
    audienceId: requestedId,
  });

  return {
    options,
    selectedAudience: {
      audienceType,
      audienceId: requestedId,
    },
    preview: {
      audienceLabel: preview.audienceLabel,
      count: preview.recipients.length,
      recipients: preview.recipients.slice(0, 12),
      hasMore: preview.recipients.length > 12,
    },
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "send") {
    return { ok: false, formError: "Unknown action." } satisfies CommunicationsActionData;
  }

  const parsed = sendCommunicationSchema.safeParse({
    audienceType: formData.get("audienceType"),
    audienceId: String(formData.get("audienceId") ?? ""),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      values: {
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
      },
    } satisfies CommunicationsActionData;
  }

  const { audienceType, audienceId, subject, body } = parsed.data;

  if (audienceNeedsSelection(audienceType) && !audienceId) {
    return {
      ok: false,
      formError: `Choose a ${audienceType === "CELL_GROUP" ? "cell group" : "event"} before sending.`,
      values: { subject, body },
    } satisfies CommunicationsActionData;
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      formError: "Email sending is not configured yet. Add RESEND_API_KEY to enable this center.",
      values: { subject, body },
    } satisfies CommunicationsActionData;
  }

  const audience = await getCommunicationAudienceRecipients({
    audienceType,
    audienceId,
  });

  if (audience.recipients.length === 0) {
    return {
      ok: false,
      formError: "This audience has no email recipients yet.",
      values: { subject, body },
    } satisfies CommunicationsActionData;
  }

  const result = await sendCommunicationToAudience({
    subject,
    body,
    audienceLabel: audience.audienceLabel,
    recipients: audience.recipients,
  });

  await recordAdminAuditEvent({
    request,
    actorId: user.id,
    actorRole: user.role,
    action: "communications.send",
    entityType: "communication_audience",
    entityId: audienceId || audienceType,
    summary: `Sent "${subject}" to ${audience.audienceLabel}`,
    details: {
      audienceType,
      audienceId: audienceId || null,
      audienceLabel: audience.audienceLabel,
      recipientCount: audience.recipients.length,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      subject,
    },
  });

  if (result.sentCount === 0) {
    return {
      ok: false,
      formError: "No messages were sent. Please try again.",
      values: { subject, body },
    } satisfies CommunicationsActionData;
  }

  return {
    ok: true,
    message:
      result.failedCount === 0
        ? `Queued "${subject}" for ${result.queuedCount} recipient${result.queuedCount === 1 ? "" : "s"}. ${result.sentCount > 0 ? `${result.sentCount} delivered immediately.` : "Delivery will continue from the email queue."}`
        : `Queued "${subject}" for ${result.queuedCount} recipient${result.queuedCount === 1 ? "" : "s"}. ${result.sentCount} delivered immediately and ${result.failedCount} moved to retry.`,
    values: { subject: "", body: "" },
  } satisfies CommunicationsActionData;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

export default function AdminCommunicationsPage() {
  const { options, selectedAudience, preview, emailConfigured } =
    useLoaderData<typeof loader>();
  const actionData = useActionData() as CommunicationsActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const selectedEvent = options.events.find(
    (event) => event.id === selectedAudience.audienceId,
  );
  const selectedCellGroup = options.cellGroups.find(
    (group) => group.id === selectedAudience.audienceId,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">
            Communications Center
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Send targeted messages to operational audiences without exporting lists by hand.
          </p>
        </div>
        <div className="rounded-full bg-red-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-red-700">
          Admin messaging
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Cell groups"
          value={String(options.cellGroups.length)}
        />
        <MetricCard
          label="Events"
          value={String(options.events.length)}
        />
        <MetricCard
          label="First-time guests"
          value={String(options.audienceStats.firstTimeGuests)}
        />
        <MetricCard
          label="Kids guardians"
          value={String(options.audienceStats.kidsGuardians)}
        />
      </div>

      {!emailConfigured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          `RESEND_API_KEY` is missing, so previews work but sending is disabled until email is configured.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-serif text-xl font-bold text-gray-900">
              Choose Audience
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Preview exactly who will receive the message before sending.
            </p>
          </div>

          <Form method="get" className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                Audience Type
              </label>
              <select
                name="audienceType"
                defaultValue={selectedAudience.audienceType}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                {COMMUNICATION_AUDIENCE_TYPES.map((audienceType) => (
                  <option key={audienceType} value={audienceType}>
                    {getAudienceLabel(audienceType)}
                  </option>
                ))}
              </select>
            </div>

            {selectedAudience.audienceType === "CELL_GROUP" ? (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                  Cell Group
                </label>
                <select
                  name="audienceId"
                  defaultValue={selectedAudience.audienceId}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="">Choose a cell group</option>
                  {options.cellGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.memberCount} members)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {selectedAudience.audienceType === "EVENT_REGISTRANTS" ? (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                  Event
                </label>
                <select
                  name="audienceId"
                  defaultValue={selectedAudience.audienceId}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="">Choose an event</option>
                  {options.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} ({event.registrationCount} registrants)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <button
              type="submit"
              className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-800"
            >
              Preview audience
            </button>
          </Form>
        </section>

        <aside className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-bold text-gray-900">Recipient Preview</h2>
          <p className="mt-1 text-sm text-gray-500">{preview.audienceLabel}</p>
          <p className="mt-4 font-serif text-4xl font-bold text-gray-900">
            {preview.count}
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
            recipient{preview.count === 1 ? "" : "s"}
          </p>

          {selectedEvent ? (
            <p className="mt-4 text-sm text-gray-500">
              Event date:{" "}
              {new Date(selectedEvent.startDate).toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}

          {selectedCellGroup ? (
            <p className="mt-4 text-sm text-gray-500">
              Targeting members assigned to {selectedCellGroup.name}.
            </p>
          ) : null}

          {preview.recipients.length > 0 ? (
            <div className="mt-5 space-y-3">
              {preview.recipients.map((recipient) => (
                <div
                  key={recipient.email}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <p className="text-sm font-bold text-gray-800">{recipient.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{recipient.email}</p>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-red-700">
                    {recipient.sourceLabel}
                  </p>
                </div>
              ))}
              {preview.hasMore ? (
                <p className="text-xs text-gray-400">
                  Showing the first 12 recipients. The full audience will still receive the send.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500">
              Pick an audience and preview it here before sending.
            </p>
          )}
        </aside>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="font-serif text-xl font-bold text-gray-900">
            Compose Message
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Each recipient gets an individual email, so addresses stay private.
          </p>
        </div>

        {actionData && typeof actionData === "object" ? (
          actionData.ok ? (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {actionData.message}
            </div>
          ) : actionData.formError ? (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionData.formError}
            </div>
          ) : null
        ) : null}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="send" />
          <input
            type="hidden"
            name="audienceType"
            value={selectedAudience.audienceType}
          />
          <input
            type="hidden"
            name="audienceId"
            value={selectedAudience.audienceId}
          />

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Sending to:{" "}
            <span className="font-bold text-gray-800">{preview.audienceLabel}</span>
            {" · "}
            <span className="font-bold text-gray-800">{preview.count}</span> recipients
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Subject
            </label>
            <input
              type="text"
              name="subject"
              placeholder="Example: Sunday service reminder"
              defaultValue={actionData?.values?.subject ?? ""}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <FieldError message={actionData?.errors?.subject?.[0]} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
              Message
            </label>
            <textarea
              name="body"
              rows={9}
              defaultValue={actionData?.values?.body ?? ""}
              placeholder={"Write the message here.\n\nUse blank lines to separate paragraphs."}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <FieldError message={actionData?.errors?.body?.[0]} />
          </div>

          <button
            type="submit"
            disabled={!emailConfigured || preview.count === 0 || isSubmitting}
            className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Send message"}
          </button>
        </Form>
      </section>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="generic"
      title="Communications unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
    />
  );
}
