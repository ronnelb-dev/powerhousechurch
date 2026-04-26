import {
  Form,
  isRouteErrorResponse,
  useFetcher,
  useLoaderData,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect, useState } from "react";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { EmptyState } from "~/components/ui/EmptyState";
import { requireAdmin } from "~/lib/auth.server";
import {
  buildEventCalendarUrl,
  buildGoogleCalendarUrl,
} from "~/lib/calendar";
import { db } from "~/lib/db.server";
import { sendEventReminderEmail } from "~/lib/email.server";

const prisma = db as any;

export const meta: MetaFunction = () => [{ title: "Manage Events — Admin" }];

type LoaderData = Awaited<ReturnType<typeof loader>>;
type AdminEvent = LoaderData["events"][number];
type AdminRegistration = AdminEvent["registrations"][number];

type EventActionData = {
  success?: boolean;
  eventId?: string;
  registrationId?: string;
  message?: string;
  formError?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const events = await prisma.event.findMany({
    orderBy: { startDate: "desc" },
    include: {
      registrations: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return {
    events: events.map((event: any) => {
      const confirmed = event.registrations.filter(
        (entry: { status: string }) => entry.status === "CONFIRMED",
      ).length;
      const waitlist = event.registrations.filter(
        (entry: { status: string }) => entry.status === "WAITLISTED",
      ).length;
      const checkedIn = event.registrations.filter(
        (entry: { checkedInAt: Date | null }) => Boolean(entry.checkedInAt),
      ).length;

      return {
        ...event,
        startDate:
          event.startDate instanceof Date
            ? event.startDate.toISOString()
            : event.startDate,
        endDate:
          event.endDate instanceof Date
            ? event.endDate.toISOString()
            : (event.endDate ?? null),
        registrationDeadline:
          event.registrationDeadline instanceof Date
            ? event.registrationDeadline.toISOString()
            : (event.registrationDeadline ?? null),
        counts: {
          total: event.registrations.length,
          confirmed,
          waitlist,
          checkedIn,
        },
        registrations: event.registrations.map((registration: any) => ({
          ...registration,
          createdAt:
            registration.createdAt instanceof Date
              ? registration.createdAt.toISOString()
              : registration.createdAt,
          updatedAt:
            registration.updatedAt instanceof Date
              ? registration.updatedAt.toISOString()
              : registration.updatedAt,
          checkedInAt:
            registration.checkedInAt instanceof Date
              ? registration.checkedInAt.toISOString()
              : (registration.checkedInAt ?? null),
        })),
      };
    }),
  };
}

const EventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().min(1, "Description is required").max(2000),
    location: z.string().min(1, "Location is required").max(200),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid date"),
    endDate: z.string().optional().or(z.literal("")),
    imageUrl: z.string().url().optional().or(z.literal("")),
    isPublished: z.coerce.boolean().default(true),
    requiresRegistration: z.coerce.boolean().default(false),
    capacity: z.string().optional().or(z.literal("")),
    registrationDeadline: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.endDate) {
      const start = new Date(value.startDate);
      const end = new Date(value.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "End date must be after the start date",
        });
      }
    }

    if (value.registrationDeadline) {
      const start = new Date(value.startDate);
      const deadline = new Date(value.registrationDeadline);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(deadline.getTime()) ||
        deadline > start
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["registrationDeadline"],
          message: "Registration deadline must be before the event starts",
        });
      }
    }

    if (!value.requiresRegistration) return;

    if (value.capacity) {
      const parsedCapacity = Number(value.capacity);
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["capacity"],
          message: "Capacity must be a whole number greater than 0",
        });
      }
    }
  });

async function findDuplicateEvent(args: {
  title: string;
  location: string;
  startDate: Date;
  excludeId?: string;
}) {
  const { title, location, startDate, excludeId } = args;
  return prisma.event.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      location: { equals: location, mode: "insensitive" },
      startDate,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      title: true,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create" || intent === "update") {
    const raw = {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      isPublished: formData.get("isPublished") === "true",
      requiresRegistration: formData.get("requiresRegistration") === "true",
      capacity: String(formData.get("capacity") ?? ""),
      registrationDeadline: String(formData.get("registrationDeadline") ?? ""),
    };
    const result = EventSchema.safeParse(raw);
    if (!result.success) {
      return {
        success: false,
        errors: result.error.flatten().fieldErrors,
      };
    }

    const { startDate, endDate, capacity, registrationDeadline, ...rest } =
      result.data;
    const id = String(formData.get("id") ?? "");
    const data = {
      ...rest,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      capacity: result.data.requiresRegistration && capacity ? Number(capacity) : null,
      registrationDeadline: registrationDeadline
        ? new Date(registrationDeadline)
        : null,
    };

    const duplicateEvent = await findDuplicateEvent({
      title: data.title,
      location: data.location,
      startDate: data.startDate,
      excludeId: intent === "update" ? id : undefined,
    });

    if (duplicateEvent) {
      return {
        success: false,
        eventId: intent === "update" ? id : undefined,
        formError: `A matching event already exists: "${duplicateEvent.title}".`,
      };
    }

    if (intent === "create") {
      await prisma.event.create({ data });
    } else {
      await prisma.event.update({ where: { id }, data });
    }
    return {
      success: true,
      eventId: intent === "update" ? id : undefined,
      message: intent === "create" ? "Event created." : "Event updated.",
    };
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    await prisma.event.delete({ where: { id } });
    return { success: true };
  }

  if (intent === "togglePublished") {
    const id = String(formData.get("id") ?? "");
    const event = await prisma.event.findUnique({
      where: { id },
      select: { isPublished: true },
    });
    if (event) {
      await prisma.event.update({
        where: { id },
        data: { isPublished: !event.isPublished },
      });
    }
    return { success: true };
  }

  if (intent === "sendReminder") {
    const id = String(formData.get("id") ?? "");
    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        registrations: {
          where: { status: "CONFIRMED" },
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!event) {
      return {
        success: false,
        eventId: id,
        formError: "Event not found.",
      };
    }

    if (event.startDate <= new Date()) {
      return {
        success: false,
        eventId: id,
        formError: "Reminders can only be sent for upcoming events.",
      };
    }

    if (!process.env.RESEND_API_KEY) {
      return {
        success: false,
        eventId: id,
        formError: "Email reminders are not configured yet.",
      };
    }

    if (event.registrations.length === 0) {
      return {
        success: false,
        eventId: id,
        formError: "There are no confirmed attendees to remind yet.",
      };
    }

    const origin =
      process.env.APP_URL || process.env.PUBLIC_APP_URL || new URL(request.url).origin;
    const eventUrl = `${origin}/events#${event.id}`;
    const calendarUrl = buildEventCalendarUrl(origin, event.id);
    const googleCalendarUrl = buildGoogleCalendarUrl({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
      url: eventUrl,
    });

    const results = await Promise.allSettled(
      event.registrations.map((registration: { email: string; name: string }) =>
        sendEventReminderEmail({
          to: registration.email,
          name: registration.name,
          eventTitle: event.title,
          eventLocation: event.location,
          eventStartDate: event.startDate,
          eventEndDate: event.endDate,
          calendarUrl,
          googleCalendarUrl,
          eventUrl,
        }),
      ),
    );

    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - sentCount;

    if (sentCount === 0) {
      return {
        success: false,
        eventId: id,
        formError: "Reminder emails could not be sent. Please try again.",
      };
    }

    return {
      success: true,
      eventId: id,
      message:
        failedCount === 0
          ? `Reminder sent to ${sentCount} attendee${sentCount === 1 ? "" : "s"}.`
          : `Reminder sent to ${sentCount} attendee${sentCount === 1 ? "" : "s"}. ${failedCount} failed.`,
    };
  }

  if (intent === "checkInRegistration" || intent === "undoCheckIn") {
    const registrationId = String(formData.get("registrationId") ?? "");
    const eventId = String(formData.get("eventId") ?? "");
    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      select: { id: true, status: true, checkedInAt: true },
    });

    if (!registration) {
      return {
        success: false,
        eventId,
        registrationId,
        formError: "Registration not found.",
      };
    }

    if (registration.status !== "CONFIRMED") {
      return {
        success: false,
        eventId,
        registrationId,
        formError: "Only confirmed attendees can be checked in.",
      };
    }

    await prisma.eventRegistration.update({
      where: { id: registrationId },
      data:
        intent === "checkInRegistration"
          ? { checkedInAt: new Date(), checkedInById: user.id }
          : { checkedInAt: null, checkedInById: null },
    });

    return {
      success: true,
      eventId,
      registrationId,
      message:
        intent === "checkInRegistration"
          ? "Attendee checked in."
          : "Check-in removed.",
    };
  }

  if (intent === "promoteWaitlist") {
    const registrationId = String(formData.get("registrationId") ?? "");
    const eventId = String(formData.get("eventId") ?? "");

    const outcome = await prisma.$transaction(async (tx: any) => {
      const registration = await tx.eventRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true, eventId: true, status: true, name: true },
      });

      if (!registration) {
        return { ok: false as const, formError: "Registration not found." };
      }

      if (registration.status !== "WAITLISTED") {
        return { ok: false as const, formError: "Only waitlisted registrations can be promoted." };
      }

      const event = await tx.event.findUnique({
        where: { id: registration.eventId },
        select: {
          id: true,
          capacity: true,
          registrations: {
            select: { status: true },
          },
        },
      });

      if (!event) {
        return { ok: false as const, formError: "Event not found." };
      }

      const confirmedCount = event.registrations.filter(
        (entry: { status: string }) => entry.status === "CONFIRMED",
      ).length;

      if (typeof event.capacity === "number" && confirmedCount >= event.capacity) {
        return {
          ok: false as const,
          formError: "No seats are currently available to promote this attendee.",
        };
      }

      await tx.eventRegistration.update({
        where: { id: registrationId },
        data: { status: "CONFIRMED" },
      });

      return {
        ok: true as const,
        message: `${registration.name} moved from waitlist to confirmed.`,
      };
    });

    if (!outcome.ok) {
      return {
        success: false,
        eventId,
        registrationId,
        formError: outcome.formError,
      };
    }

    return {
      success: true,
      eventId,
      registrationId,
      message: outcome.message,
    };
  }

  if (intent === "exportRegistrations") {
    const eventId = String(formData.get("eventId") ?? "");
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        registrations: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          select: {
            name: true,
            email: true,
            phone: true,
            notes: true,
            status: true,
            checkedInAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!event) {
      return new Response("Event not found.", { status: 404 });
    }

    const csv = [
      "Name,Email,Phone,Status,Checked In At,Registered At,Notes",
      ...event.registrations.map((registration: any) =>
        [
          registration.name,
          registration.email,
          registration.phone ?? "",
          registration.status,
          registration.checkedInAt
            ? registration.checkedInAt.toISOString()
            : "",
          registration.createdAt.toISOString(),
          registration.notes ?? "",
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug || "event"}-registrations.csv"`,
      },
    });
  }

  return { error: "Unknown intent." };
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 " +
  "placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-300";
const labelClass = "mb-1 block text-xs font-bold text-gray-600";

function EventFormModal({
  event,
  onClose,
}: {
  event?: AdminEvent | null;
  onClose: () => void;
}) {
  const fetcher = useFetcher<EventActionData>();
  const isSubmitting = fetcher.state !== "idle";
  const errors = fetcher.data?.success === false ? fetcher.data.errors ?? {} : {};

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onClose();
    }
  }, [fetcher.state, fetcher.data, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h2 id="event-form-title" className="font-serif text-xl font-bold text-gray-900">
            {event ? "Edit Event" : "Add Event"}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <fetcher.Form method="post" className="space-y-4 p-6">
          <input type="hidden" name="intent" value={event ? "update" : "create"} />
          {event && <input type="hidden" name="id" value={event.id} />}

          {fetcher.data?.success === false && fetcher.data.formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {fetcher.data.formError}
            </div>
          )}

          <div>
            <label htmlFor="e-title" className={labelClass}>
              Title *
            </label>
            <input
              id="e-title"
              type="text"
              name="title"
              defaultValue={event?.title}
              required
              className={inputClass}
            />
            <FieldError errors={errors.title} />
          </div>
          <div>
            <label htmlFor="e-description" className={labelClass}>
              Description *
            </label>
            <textarea
              id="e-description"
              name="description"
              rows={3}
              required
              defaultValue={event?.description}
              className={`${inputClass} resize-y`}
            />
            <FieldError errors={errors.description} />
          </div>
          <div>
            <label htmlFor="e-location" className={labelClass}>
              Location *
            </label>
            <input
              id="e-location"
              type="text"
              name="location"
              defaultValue={event?.location}
              required
              className={inputClass}
            />
            <FieldError errors={errors.location} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="e-startDate" className={labelClass}>
                Start Date & Time *
              </label>
              <input
                id="e-startDate"
                type="datetime-local"
                name="startDate"
                defaultValue={event?.startDate?.slice(0, 16)}
                required
                className={inputClass}
              />
              <FieldError errors={errors.startDate} />
            </div>
            <div>
              <label htmlFor="e-endDate" className={labelClass}>
                End Date & Time
              </label>
              <input
                id="e-endDate"
                type="datetime-local"
                name="endDate"
                defaultValue={event?.endDate?.slice(0, 16) ?? ""}
                className={inputClass}
              />
              <FieldError errors={errors.endDate} />
            </div>
          </div>
          <div>
            <label htmlFor="e-imageUrl" className={labelClass}>
              Image URL (Cloudinary)
            </label>
            <input
              id="e-imageUrl"
              type="url"
              name="imageUrl"
              defaultValue={event?.imageUrl ?? ""}
              placeholder="https://res.cloudinary.com/..."
              className={inputClass}
            />
            <FieldError errors={errors.imageUrl} />
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="requiresRegistration"
                value="true"
                defaultChecked={event?.requiresRegistration ?? false}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
              />
              <span className="text-sm font-bold text-gray-700">
                Enable RSVP / registration
              </span>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="e-capacity" className={labelClass}>
                  Seat capacity
                </label>
                <input
                  id="e-capacity"
                  type="number"
                  min="1"
                  name="capacity"
                  defaultValue={event?.capacity ?? ""}
                  placeholder="Leave blank for unlimited"
                  className={inputClass}
                />
                <FieldError errors={errors.capacity} />
              </div>
              <div>
                <label htmlFor="e-registrationDeadline" className={labelClass}>
                  Registration deadline
                </label>
                <input
                  id="e-registrationDeadline"
                  type="datetime-local"
                  name="registrationDeadline"
                  defaultValue={event?.registrationDeadline?.slice(0, 16) ?? ""}
                  className={inputClass}
                />
                <FieldError errors={errors.registrationDeadline} />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              When capacity is reached, new signups will automatically join the waitlist.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              value="true"
              defaultChecked={event?.isPublished ?? true}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
            />
            <span className="text-sm font-bold text-gray-700">
              Publish immediately
            </span>
          </label>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : event ? "Update Event" : "Add Event"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-bold text-gray-600 transition-all hover:border-gray-300"
            >
              Cancel
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const { events } = useLoaderData<typeof loader>();
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<AdminEvent | null>(null);

  const totalRegistrations = events.reduce(
    (sum: number, event: AdminEvent) => sum + event.counts.total,
    0,
  );
  const totalCheckedIn = events.reduce(
    (sum: number, event: AdminEvent) => sum + event.counts.checkedIn,
    0,
  );
  const totalWaitlisted = events.reduce(
    (sum: number, event: AdminEvent) => sum + event.counts.waitlist,
    0,
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-400">
            {events.length} total · {totalRegistrations} registrations · {totalCheckedIn} checked in
          </p>
        </div>
        <button
          onClick={() => {
            setEditEvent(null);
            setShowForm(true);
          }}
          className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          + Add Event
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Registrations" value={String(totalRegistrations)} />
        <MetricCard label="Checked In" value={String(totalCheckedIn)} />
        <MetricCard label="Waitlisted" value={String(totalWaitlisted)} />
      </div>

      {(showForm || editEvent) && (
        <EventFormModal
          key={editEvent?.id ?? "new"}
          event={editEvent}
          onClose={() => {
            setShowForm(false);
            setEditEvent(null);
          }}
        />
      )}

      {events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event: AdminEvent) => (
            <AdminEventCard
              key={event.id}
              event={event}
              onEdit={(nextEvent) => setEditEvent(nextEvent)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="events"
          title="No events yet"
          message="Add your first event to get started."
        />
      )}
    </div>
  );
}

function AdminEventCard({
  event,
  onEdit,
}: {
  event: AdminEvent;
  onEdit: (event: AdminEvent) => void;
}) {
  const deleteFetcher = useFetcher<EventActionData>();
  const toggleFetcher = useFetcher<EventActionData>();
  const reminderFetcher = useFetcher<EventActionData>();
  const isPast = new Date(event.startDate) < new Date();
  const seatsLeft =
    typeof event.capacity === "number"
      ? Math.max(event.capacity - event.counts.confirmed, 0)
      : null;
  const reminderResult = reminderFetcher.data;
  const isDeleting = deleteFetcher.state !== "idle";
  const isToggling = toggleFetcher.state !== "idle";
  const isSendingReminder = reminderFetcher.state !== "idle";

  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-red-100 ${
        isPast ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-serif font-bold text-gray-900">{event.title}</p>
            <toggleFetcher.Form method="post">
              <input type="hidden" name="intent" value="togglePublished" />
              <input type="hidden" name="id" value={event.id} />
              <button
                type="submit"
                disabled={isToggling}
                className={[
                  "rounded-full border px-2 py-0.5 text-xs font-bold disabled:opacity-60",
                  event.isPublished
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-gray-50 text-gray-500",
                ].join(" ")}
              >
                {isToggling ? "Saving..." : event.isPublished ? "Live" : "Draft"}
              </button>
            </toggleFetcher.Form>
            {event.requiresRegistration && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                RSVP on
              </span>
            )}
            {isPast && (
              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-400">
                Past
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {new Date(event.startDate).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {event.location}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            {event.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isPast && (
            <reminderFetcher.Form method="post">
              <input type="hidden" name="intent" value="sendReminder" />
              <input type="hidden" name="id" value={event.id} />
              <button
                type="submit"
                disabled={isSendingReminder}
                className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
              >
                {isSendingReminder ? "Sending..." : "Send reminder"}
              </button>
            </reminderFetcher.Form>
          )}
          <Form method="post" reloadDocument>
            <input type="hidden" name="intent" value="exportRegistrations" />
            <input type="hidden" name="eventId" value={event.id} />
            <button
              type="submit"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
            >
              Export roster
            </button>
          </Form>
          <button
            onClick={() => onEdit(event)}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-600 transition-all hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Edit
          </button>
          <deleteFetcher.Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={event.id} />
            <button
              type="submit"
              disabled={isDeleting}
              onClick={(e) => {
                if (!confirm(`Delete "${event.title}"?`)) {
                  e.preventDefault();
                }
              }}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition-all hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </deleteFetcher.Form>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <StatPill label="Confirmed" value={String(event.counts.confirmed)} tone="slate" />
        <StatPill label="Checked in" value={String(event.counts.checkedIn)} tone="emerald" />
        <StatPill label="Waitlist" value={String(event.counts.waitlist)} tone="amber" />
        <StatPill
          label={typeof event.capacity === "number" ? "Seats left" : "Capacity"}
          value={typeof event.capacity === "number" ? String(seatsLeft) : "Open"}
          tone="gray"
        />
      </div>

      {reminderResult && reminderResult.eventId === event.id &&
        (reminderResult.success ? (
          <p className="mt-3 text-xs font-semibold text-emerald-700">
            {reminderResult.message}
          </p>
        ) : reminderResult.formError ? (
          <p className="mt-3 text-xs font-semibold text-red-600">
            {reminderResult.formError}
          </p>
        ) : null)}

      {event.requiresRegistration ? (
        <details className="group mt-5 rounded-xl border border-gray-100 bg-gray-50">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-bold text-gray-800">Registrant roster</p>
              <p className="text-xs text-gray-500">
                Manage check-in, exports, and waitlist promotions for this event.
              </p>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-red-700 group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs font-bold uppercase tracking-[0.12em] text-red-700 group-open:inline">
              Hide
            </span>
          </summary>

          <div className="border-t border-gray-100 bg-white">
            {event.registrations.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {event.registrations.map((registration: AdminRegistration) => (
                  <RegistrationRow
                    key={registration.id}
                    eventId={event.id}
                    registration={registration}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 py-5 text-sm text-gray-500">
                No registrations yet.
              </div>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function RegistrationRow({
  eventId,
  registration,
}: {
  eventId: string;
  registration: AdminRegistration;
}) {
  const actionFetcher = useFetcher<EventActionData>();
  const isSubmitting = actionFetcher.state !== "idle";
  const checkedInAt = registration.checkedInAt
    ? new Date(registration.checkedInAt).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-gray-800">{registration.name}</p>
            <span
              className={[
                "rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em]",
                registration.status === "CONFIRMED"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              ].join(" ")}
            >
              {registration.status}
            </span>
            {registration.checkedInAt ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                Checked in
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {registration.email}
            {registration.phone ? ` · ${registration.phone}` : ""}
            {checkedInAt ? ` · ${checkedInAt}` : ""}
          </p>
          {registration.notes ? (
            <p className="mt-2 text-sm leading-6 text-gray-600">{registration.notes}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {registration.status === "WAITLISTED" ? (
            <actionFetcher.Form method="post">
              <input type="hidden" name="intent" value="promoteWaitlist" />
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="registrationId" value={registration.id} />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800 transition-all hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
              >
                {isSubmitting ? "Updating..." : "Promote"}
              </button>
            </actionFetcher.Form>
          ) : (
            <actionFetcher.Form method="post">
              <input
                type="hidden"
                name="intent"
                value={registration.checkedInAt ? "undoCheckIn" : "checkInRegistration"}
              />
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="registrationId" value={registration.id} />
              <button
                type="submit"
                disabled={isSubmitting}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 disabled:opacity-60",
                  registration.checkedInAt
                    ? "border border-gray-200 text-gray-700 hover:bg-gray-50 focus:ring-gray-300"
                    : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-300",
                ].join(" ")}
              >
                {isSubmitting
                  ? "Saving..."
                  : registration.checkedInAt
                  ? "Undo check-in"
                  : "Check in"}
              </button>
            </actionFetcher.Form>
          )}
        </div>
      </div>

      {actionFetcher.data &&
      (actionFetcher.data.registrationId === registration.id ||
        actionFetcher.data.eventId === eventId) ? (
        actionFetcher.data.success ? (
          <p className="mt-3 text-xs font-semibold text-emerald-700">
            {actionFetcher.data.message}
          </p>
        ) : actionFetcher.data.formError ? (
          <p className="mt-3 text-xs font-semibold text-red-600">
            {actionFetcher.data.formError}
          </p>
        ) : null
      ) : null}
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "amber" | "gray";
}) {
  const toneClasses = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-900",
    gray: "bg-gray-100 text-gray-700",
  } as const;

  return (
    <div className={`rounded-xl px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold">{value}</p>
    </div>
  );
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

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{errors[0]}</p>;
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="events"
      title="Events unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh."}
    />
  );
}
