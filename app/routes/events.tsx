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
import { z } from "zod";
import { EventCard } from "~/components/church/EventCard";
import { EmptyState } from "~/components/ui/EmptyState";
import { Card, CardContent } from "~/components/ui/card";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import {
  buildEventCalendarUrl,
  buildGoogleCalendarUrl,
  getEventCalendarPath,
} from "~/lib/calendar";
import { db } from "~/lib/db.server";
import { sendEventRegistrationConfirmation } from "~/lib/email.server";

const prisma = db as any;

export const meta: MetaFunction = () => [
  { title: "Events — Powerhouse Church" },
  {
    name: "description",
    content:
      "Upcoming services, celebrations, and gatherings at Powerhouse Church.",
  },
];

const RSVP_SCHEMA = z.object({
  intent: z.literal("rsvp"),
  eventId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email address").max(200),
  phone: z.string().min(7, "Phone number is required").max(30),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or fewer")
    .optional()
    .or(z.literal("")),
  honeypot: z.string().max(0, "Bot detected").default(""),
});

type ActionData =
  | {
      success: true;
      eventId: string;
      status: "CONFIRMED" | "WAITLISTED";
      message: string;
    }
  | {
      success: false;
      eventId?: string;
      formError?: string;
      errors: Record<string, string[]>;
    };

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

  const parsed = RSVP_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      errors: parsed.error.flatten().fieldErrors,
    } satisfies ActionData;
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const event = await tx.event.findUnique({
        where: { id: parsed.data.eventId },
        include: {
          registrations: {
            select: { status: true },
          },
        },
      });

      if (!event || !event.isPublished) {
        return {
          kind: "error" as const,
          formError: "This event is no longer available for registration.",
        };
      }

      if (!event.requiresRegistration) {
        return {
          kind: "error" as const,
          formError: "This event does not require RSVP.",
        };
      }

      const now = new Date();
      if (event.startDate < now) {
        return {
          kind: "error" as const,
          formError: "This event has already started.",
        };
      }

      if (event.registrationDeadline && event.registrationDeadline < now) {
        return {
          kind: "error" as const,
          formError: "Registration for this event has already closed.",
        };
      }

      const existing = await tx.eventRegistration.findUnique({
        where: {
          eventId_email: {
            eventId: event.id,
            email: parsed.data.email,
          },
        },
      });

      if (existing) {
        return {
          kind: "error" as const,
          formError: "This email address is already registered for the event.",
        };
      }

      const confirmedCount = event.registrations.filter(
        (entry: { status: string }) => entry.status === "CONFIRMED",
      ).length;
      const status: "CONFIRMED" | "WAITLISTED" =
        typeof event.capacity === "number" && confirmedCount >= event.capacity
          ? "WAITLISTED"
          : "CONFIRMED";

      await tx.eventRegistration.create({
        data: {
          eventId: event.id,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          notes: parsed.data.notes || null,
          status,
        },
      });

      return {
        kind: "success" as const,
        status,
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
        },
      };
    });

    if (result.kind === "error") {
      return {
        success: false,
        eventId: parsed.data.eventId,
        formError: result.formError,
        errors: {},
      } satisfies ActionData;
    }

    const currentUrl = new URL(request.url);
    const origin =
      process.env.APP_URL || process.env.PUBLIC_APP_URL || currentUrl.origin;
    const eventUrl = `${origin}/events#${result.event.id}`;
    const calendarUrl = buildEventCalendarUrl(origin, result.event.id);
    const googleCalendarUrl = buildGoogleCalendarUrl({
      id: result.event.id,
      title: result.event.title,
      description: result.event.description,
      location: result.event.location,
      startDate: result.event.startDate,
      endDate: result.event.endDate,
      url: eventUrl,
    });

    await Promise.allSettled([
      sendEventRegistrationConfirmation({
        to: parsed.data.email,
        name: parsed.data.name,
        eventTitle: result.event.title,
        eventLocation: result.event.location,
        eventStartDate: result.event.startDate,
        eventEndDate: result.event.endDate,
        status: result.status,
        calendarUrl,
        googleCalendarUrl,
        eventUrl,
      }),
    ]);

    return {
      success: true,
      eventId: parsed.data.eventId,
      status: result.status,
      message:
        result.status === "CONFIRMED"
          ? "Your RSVP is confirmed. A confirmation email is on its way."
          : "The event is full, so you have been added to the waitlist. A confirmation email is on its way.",
    } satisfies ActionData;
  } catch {
    return {
      success: false,
      eventId: parsed.data.eventId,
      formError: "We could not complete your RSVP. Please try again.",
      errors: {},
    } satisfies ActionData;
  }
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
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event: SerializedUpcomingEvent) => (
              <div key={event.id} id={event.id}>
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
                {event.requiresRegistration && (
                  <div className="mt-4 rounded-[var(--radius)] border border-white/60 bg-white/85 p-5 shadow-sm">
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
                        <button
                          type="submit"
                          disabled={activeEventId === event.id}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {activeEventId === event.id
                            ? "Submitting..."
                            : "Reserve my spot"}
                        </button>
                      </Form>
                    )}
                  </div>
                )}
              </div>
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
