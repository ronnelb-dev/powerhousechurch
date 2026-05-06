import {
  Form,
  Link,
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { EventCard } from "~/components/church/EventCard";
import { EmptyState } from "~/components/ui/EmptyState";
import { Card, CardContent } from "~/components/ui/card";
import { PendingButton } from "~/components/ui/PendingButton";
import { PageHero } from "~/components/ui/PageHero";
import { SectionHeader } from "~/components/ui/SectionHeader";
import { getSession } from "~/lib/auth.server";
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

type CurrentMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  isEmailVerified: boolean;
};

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
  const { user, session } = await getSession(request);
  const raw = {
    intent: String(formData.get("intent") ?? ""),
    eventId: String(formData.get("eventId") ?? ""),
    name: "",
    email: "",
    phone: "",
    notes: String(formData.get("notes") ?? "").trim(),
    honeypot: String(formData.get("honeypot") ?? ""),
  };

  if (!user || !session) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      formError: "Please log in with your member account to RSVP.",
      errors: {},
    } satisfies ActionData;
  }

  if (!user.isEmailVerified) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      formError: "Please verify your email before reserving a spot.",
      errors: {},
    } satisfies ActionData;
  }

  const member = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      isActive: true,
    },
  });

  if (!member || !member.isActive) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      formError: "Your member account is not currently active for RSVPs.",
      errors: {},
    } satisfies ActionData;
  }

  raw.name = `${member.firstName} ${member.lastName}`.trim();
  raw.email = (member.email ?? "").trim().toLowerCase();
  raw.phone = (member.phone ?? "").trim();

  if (!raw.email || !raw.phone) {
    return {
      success: false,
      eventId: raw.eventId || undefined,
      formError:
        "Please add an email address and phone number to your profile before reserving a spot.",
      errors: {},
    } satisfies ActionData;
  }

  const limit = publicSubmissionRateLimiter.consume({
    bucket: "public:rsvp",
    key: user.id,
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

export async function loader({ request }: LoaderFunctionArgs) {
  const now = new Date();
  const { user } = await getSession(request);
  const [upcoming, past, currentMember] = await Promise.all([
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
    user
      ? prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isEmailVerified: true,
            isActive: true,
          },
        })
      : null,
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
    currentMember:
      currentMember && currentMember.isActive
        ? {
            id: currentMember.id,
            firstName: currentMember.firstName,
            lastName: currentMember.lastName,
            email: currentMember.email,
            phone: currentMember.phone,
            role: currentMember.role,
            isEmailVerified: currentMember.isEmailVerified,
          }
        : null,
  };
}

export default function EventsPage() {
  const { upcoming, past, currentMember } = useLoaderData<typeof loader>();
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
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {upcoming.map((event: SerializedUpcomingEvent) => (
              <section
                key={event.id}
                id={event.id}
                className="scroll-mt-28"
              >
                <EventCard
                  title={event.title}
                  location={event.location}
                  startDate={event.startDate}
                  endDate={event.endDate}
                  imageUrl={event.imageUrl}
                  description={event.description}
                  statusLabel={getRegistrationStatusLabel(event)}
                >
                  <div className="space-y-4">
                  <CalendarLinks
                    eventId={event.id}
                    title={event.title}
                    description={event.description}
                    location={event.location}
                    startDate={event.startDate}
                    endDate={event.endDate}
                  />

                  {event.requiresRegistration && (
                    <RsvpPanel
                      event={event}
                      actionData={actionData}
                      activeEventId={activeEventId}
                      currentMember={currentMember}
                      errors={
                        actionData?.success === false &&
                        actionData.eventId === event.id
                          ? errors
                          : {}
                      }
                    />
                  )}
                  </div>
                </EventCard>
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
                    <h2 className="font-serif text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
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
            <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
                  Need Prayer?
                </p>
                <h2 className="mt-4 font-serif text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
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

function getRegistrationStatusLabel(event: SerializedUpcomingEvent) {
  if (!event.requiresRegistration) return null;

  if (typeof event.capacity !== "number") return "RSVP open";

  const seatsLeft = Math.max(event.capacity - (event.counts?.confirmed ?? 0), 0);
  if (seatsLeft === 0) return "Waitlist open";

  return `${seatsLeft} seats left`;
}

function RsvpPanel({
  event,
  actionData,
  activeEventId,
  currentMember,
  errors,
}: {
  event: SerializedUpcomingEvent;
  actionData: ActionData | undefined;
  activeEventId: string;
  currentMember: CurrentMember | null;
  errors: RSVPFieldErrors;
}) {
  const hasCompleteProfile = Boolean(
    currentMember?.isEmailVerified && currentMember.email && currentMember.phone,
  );

  return (
    <details
      className="group rounded-2xl border border-[rgba(146,48,52,0.16)] bg-white/70"
      open={actionData?.eventId === event.id}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus:outline-none">
        <span>
          <span className="block text-sm font-semibold text-[var(--foreground)]">
            RSVP Required
          </span>
          <span className="block text-xs leading-5 text-[var(--muted-foreground)]">
            {getRegistrationSummary(event)}
          </span>
        </span>
        <span className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary-foreground)] group-open:hidden">
          Reserve spot
        </span>
        <span className="hidden rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)] group-open:inline">
          Close
        </span>
      </summary>

      <div className="border-t border-[var(--border)] px-4 py-4">
        {!currentMember ? (
          <MemberLoginPrompt />
        ) : !currentMember.isEmailVerified ? (
          <ProfileBlocker
            title="Verify your email first"
            message="Your member account needs a verified email before you can reserve a spot."
            actionLabel="Verify email"
            actionHref={`/auth/verify-email?email=${encodeURIComponent(currentMember.email ?? "")}`}
          />
        ) : !hasCompleteProfile ? (
          <ProfileBlocker
            title="Complete your profile"
            message="RSVPs use your saved member email and phone number. Add those details once, then come back to reserve your spot."
            actionLabel="Update profile"
            actionHref="/portal/profile"
          />
        ) : actionData?.success && actionData.eventId === event.id ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {actionData.message}
          </div>
        ) : (
          <Form method="post" noValidate className="space-y-3">
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
            <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                Reserving as
              </p>
              <p className="mt-2 font-serif text-xl font-semibold text-[var(--foreground)]">
                {currentMember.firstName} {currentMember.lastName}
              </p>
              <div className="mt-2 grid gap-1 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
                <p>{currentMember.email}</p>
                <p>{currentMember.phone}</p>
              </div>
            </div>
            {actionData?.success === false &&
              actionData.eventId === event.id &&
              actionData.formError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {actionData.formError}
                </div>
              )}
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
            {(errors.name?.length || errors.email?.length || errors.phone?.length) && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Please update your saved member profile details before reserving a spot.
              </div>
            )}
            <PendingButton
              type="submit"
              isPending={activeEventId === event.id}
              pendingText="Submitting..."
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
            >
              Reserve my spot
            </PendingButton>
          </Form>
        )}
      </div>
    </details>
  );
}

function MemberLoginPrompt() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/85 p-4">
      <p className="font-serif text-xl font-semibold text-[var(--foreground)]">
        Member login required
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
        RSVPs are reserved for members. Log in or create a member account to
        reserve your spot.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/auth/login"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary-foreground)] sm:flex-none"
        >
          Log in
        </Link>
        <Link
          to="/auth/register"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)] sm:flex-none"
        >
          Register
        </Link>
      </div>
    </div>
  );
}

function ProfileBlocker({
  title,
  message,
  actionLabel,
  actionHref,
}: {
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <p className="font-serif text-xl font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-amber-900">{message}</p>
      <Link
        to={actionHref}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function getRegistrationSummary(event: SerializedUpcomingEvent) {
  const pieces = [];

  if (typeof event.capacity === "number") {
    pieces.push(`${event.counts?.confirmed ?? 0} of ${event.capacity} seats filled`);
  } else {
    pieces.push("Register for confirmation and event updates");
  }

  if ((event.counts?.waitlist ?? 0) > 0) {
    pieces.push(`${event.counts.waitlist} on waitlist`);
  }

  if (event.registrationDeadline) {
    pieces.push(
      `closes ${new Date(event.registrationDeadline).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
    );
  }

  return pieces.join(" · ");
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
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={googleCalendarUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[rgba(146,48,52,0.18)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)] transition-colors hover:border-[var(--primary)] sm:flex-none"
      >
        Add to Google Calendar
      </a>
      <a
        href={getEventCalendarPath(eventId)}
        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] sm:flex-none"
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
