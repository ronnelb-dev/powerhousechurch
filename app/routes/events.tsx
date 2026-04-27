import {
  Form,
  Link,
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { EventCard } from "~/components/church/EventCard";
import { EmptyState } from "~/components/ui/EmptyState";
import { Card, CardContent } from "~/components/ui/card";
import { PendingButton } from "~/components/ui/PendingButton";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import {
  buildEventCalendarUrl,
  buildGoogleCalendarUrl,
  getEventCalendarPath,
} from "~/lib/calendar";
import { db } from "~/lib/db.server";
import { sendEventRegistrationConfirmation } from "~/lib/email.server";
import {
  handleRsvpSubmission,
  type RSVPActionData as ActionData,
} from "~/lib/public-submissions.server";
import {
  getClientIpAddress,
  publicSubmissionRateLimiter,
} from "~/lib/rate-limit.server";

const prisma = db as any;

export const meta: MetaFunction = () => [
  { title: "Events — Powerhouse Church" },
  {
    name: "description",
    content:
      "Upcoming services, celebrations, and gatherings at Powerhouse Church.",
  },
];

type RSVPFieldErrors = Partial<Record<"name" | "email" | "phone" | "notes", string[]>>;

type SerializedUpcomingEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string | null;
  imageUrl: string | null;
  requiresRegistration: boolean;
  capacity: number | null;
  registrationDeadline: string | null;
  counts: {
    total: number;
    confirmed: number;
    waitlist: number;
  };
};

type SerializedPastEvent = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string | null;
  imageUrl: string | null;
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const raw = {
    intent: String(formData.get("intent") ?? ""),
    eventId: String(formData.get("eventId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    honeypot: String(formData.get("honeypot") ?? ""),
  };
  const limit = publicSubmissionRateLimiter.consume({
    bucket: "public:rsvp",
    key: getClientIpAddress(request),
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!limit.ok) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      formError: `Too many RSVP attempts. Please wait about ${limit.retryAfterSeconds} seconds and try again.`,
      errors: {},
    } satisfies ActionData;
  }

  return handleRsvpSubmission(raw, request.url, {
    db: prisma,
    sendEventRegistrationConfirmation,
    buildEventCalendarUrl,
    buildGoogleCalendarUrl,
  });
}

export async function loader() {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true, startDate: { gt: now } },
      orderBy: { startDate: "asc" },
      include: {
        _count: { select: { registrations: true } },
        registrations: { select: { status: true } },
      },
    }),
    prisma.event.findMany({
      where: { isPublished: true, startDate: { lte: now } },
      orderBy: { startDate: "desc" },
      take: 6,
    }),
  ]);

  const serializeUpcoming = (event: any): SerializedUpcomingEvent => ({
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate:
      event.startDate instanceof Date
        ? event.startDate.toISOString()
        : event.startDate,
    endDate:
      event.endDate instanceof Date
        ? event.endDate.toISOString()
        : (event.endDate ?? null),
    imageUrl: event.imageUrl ?? null,
    requiresRegistration: Boolean(event.requiresRegistration),
    capacity: typeof event.capacity === "number" ? event.capacity : null,
    registrationDeadline:
      event.registrationDeadline instanceof Date
        ? event.registrationDeadline.toISOString()
        : (event.registrationDeadline ?? null),
    counts: {
      total: Number(event._count?.registrations ?? 0),
      confirmed: event.registrations.filter(
        (entry: { status: string }) => entry.status === "CONFIRMED",
      ).length,
      waitlist: event.registrations.filter(
        (entry: { status: string }) => entry.status === "WAITLISTED",
      ).length,
    },
  });

  const serializePast = (event: any): SerializedPastEvent => ({
    id: event.id,
    title: event.title,
    location: event.location,
    startDate:
      event.startDate instanceof Date
        ? event.startDate.toISOString()
        : event.startDate,
    endDate:
      event.endDate instanceof Date
        ? event.endDate.toISOString()
        : (event.endDate ?? null),
    imageUrl: event.imageUrl ?? null,
  });

  return {
    upcoming: upcoming.map(serializeUpcoming),
    past: past.map(serializePast),
  };
}

export default function EventsPage() {
  const { upcoming, past } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const activeEventId =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("eventId") ?? "")
      : "";
  const errors: RSVPFieldErrors =
    actionData?.success === false ? actionData.errors : {};

  return (
    <>
      <PageHero
        title="Events & Gatherings"
        subtitle="Come and be part of what God is doing in our community."
        scripture="Let us not give up meeting together — Hebrews 10:25"
      />

      <div className="shell section-gap">
        <SectionHeader
          eyebrow="What's Next"
          title="Upcoming Events"
          subtitle="Mark your calendar for gatherings designed to strengthen faith and deepen friendship."
        />
        {upcoming.length > 0 ? (
          <div className="mt-10 space-y-8">
            {upcoming.map((event: SerializedUpcomingEvent) => (
              <section
                key={event.id}
                id={event.id}
                className={
                  event.requiresRegistration
                    ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:items-start"
                    : "max-w-3xl"
                }
              >
                <div className="min-w-0">
                  <EventCard
                    id={event.id}
                    title={event.title}
                    location={event.location}
                    startDate={event.startDate}
                    endDate={event.endDate}
                    imageUrl={event.imageUrl}
                  />
                  <div className="mt-3 px-1">
                    <p className="text-sm leading-6">{event.description}</p>
                  </div>
                  <CalendarLinks
                    eventId={event.id}
                    title={event.title}
                    description={event.description}
                    location={event.location}
                    startDate={event.startDate}
                    endDate={event.endDate}
                  />
                </div>

                {event.requiresRegistration && (
                  <div className="rounded-[var(--radius)] border border-white/60 bg-white/85 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                        RSVP Required
                      </p>
                      {typeof event.capacity === "number" ? (
                        <span className="rounded-full bg-[rgba(146,48,52,0.08)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                          {Math.max(
                            event.capacity - (event.counts?.confirmed ?? 0),
                            0,
                          )}{" "}
                          seats left
                        </span>
                      ) : (
                        <span className="rounded-full bg-[rgba(146,48,52,0.08)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                          Open registration
                        </span>
                      )}
                      {(event.counts?.waitlist ?? 0) > 0 && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                          Waitlist: {event.counts?.waitlist}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                      {typeof event.capacity === "number"
                        ? `${event.counts?.confirmed ?? 0} of ${event.capacity} seats filled.`
                        : "Register to receive a confirmation email and event updates."}
                      {event.registrationDeadline && (
                        <>
                          {" "}
                          Registration closes{" "}
                          {new Date(event.registrationDeadline).toLocaleString(
                            "en-PH",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}
                          .
                        </>
                      )}
                    </p>

                    {actionData?.success && actionData.eventId === event.id ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        {actionData.message}
                      </div>
                    ) : (
                      <Form method="post" noValidate className="mt-5 space-y-3">
                        <input type="hidden" name="intent" value="rsvp" />
                        <input type="hidden" name="eventId" value={event.id} />
                        <div className="hidden" aria-hidden="true">
                          <label htmlFor={`honeypot-${event.id}`}>Leave this blank</label>
                          <input
                            id={`honeypot-${event.id}`}
                            type="text"
                            name="honeypot"
                            tabIndex={-1}
                            autoComplete="off"
                          />
                        </div>
                        {actionData?.success === false &&
                          actionData.eventId === event.id &&
                          actionData.formError && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                              {actionData.formError}
                            </div>
                          )}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label
                              className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
                              htmlFor={`name-${event.id}`}
                            >
                              Full name
                            </label>
                            <input
                              id={`name-${event.id}`}
                              type="text"
                              name="name"
                              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                              aria-invalid={Boolean(errors.name?.length)}
                            />
                            <FieldError errors={errors.name} />
                          </div>
                          <div>
                            <label
                              className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
                              htmlFor={`phone-${event.id}`}
                            >
                              Phone
                            </label>
                            <input
                              id={`phone-${event.id}`}
                              type="tel"
                              name="phone"
                              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                              aria-invalid={Boolean(errors.phone?.length)}
                            />
                            <FieldError errors={errors.phone} />
                          </div>
                        </div>
                        <div>
                          <label
                            className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
                            htmlFor={`email-${event.id}`}
                          >
                            Email
                          </label>
                          <input
                            id={`email-${event.id}`}
                            type="email"
                            name="email"
                            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                            aria-invalid={Boolean(errors.email?.length)}
                          />
                          <FieldError errors={errors.email} />
                        </div>
                        <div>
                          <label
                            className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
                            htmlFor={`notes-${event.id}`}
                          >
                            Notes
                          </label>
                          <textarea
                            id={`notes-${event.id}`}
                            name="notes"
                            rows={3}
                            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                            placeholder="Dietary needs, transport notes, or anything else we should know."
                            aria-invalid={Boolean(errors.notes?.length)}
                          />
                          <FieldError errors={errors.notes} />
                        </div>
                        <PendingButton
                          type="submit"
                          isPending={activeEventId === event.id}
                          pendingText="Submitting..."
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          Reserve my spot
                        </PendingButton>
                      </Form>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="events"
            title="No upcoming events"
            message="Check back soon — we're always planning something."
          />
        )}

        {past.length > 0 && (
          <div className="mt-20">
            <details className="group">
              <summary className="list-none cursor-pointer rounded-[var(--radius)] border border-white/60 bg-white/70 px-6 py-5 focus:outline-none">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                      Recently Past
                    </p>
                    <h2 className="font-serif text-4xl font-semibold text-[var(--foreground)]">
                      Past Events
                    </h2>
                  </div>
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)] group-open:hidden">
                    Show →
                  </span>
                  <span className="hidden text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)] group-open:inline">
                    Hide ↑
                  </span>
                </div>
              </summary>
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {past.map((event: SerializedPastEvent) => (
                  <div
                    key={event.id}
                    className="opacity-75 transition-opacity hover:opacity-100"
                  >
                    <EventCard
                      id={event.id}
                      title={event.title}
                      location={event.location}
                      startDate={event.startDate}
                      endDate={event.endDate}
                      imageUrl={event.imageUrl}
                    />
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        <div className="mt-20">
          <Card className="bg-[linear-gradient(135deg,rgba(255,250,245,0.92),rgba(239,226,210,0.78))]">
            <CardContent className="grid gap-6 p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                  Need Prayer?
                </p>
                <h2 className="mt-4 font-serif text-4xl font-semibold text-[var(--foreground)]">
                  Let us stand with you before the next gathering.
                </h2>
              </div>
              <Link
                to="/prayer-request"
                className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"
              >
                Submit a prayer request →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

function CalendarLinks({
  eventId,
  title,
  description,
  location,
  startDate,
  endDate,
}: {
  eventId: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string | null;
}) {
  const googleCalendarUrl = buildGoogleCalendarUrl({
    id: eventId,
    title,
    description,
    location,
    startDate,
    endDate,
  });

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 px-1">
      <a
        href={googleCalendarUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center rounded-xl border border-[rgba(146,48,52,0.18)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)] transition-colors hover:border-[var(--primary)]"
      >
        Add to Google Calendar
      </a>
      <a
        href={getEventCalendarPath(eventId)}
        className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        Download .ics
      </a>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="events"
      title="Could not load events"
      message={
        isRouteErrorResponse(error) ? error.data : "Please refresh and try again."
      }
      action={{ label: "Go home", to: "/" }}
    />
  );
}
