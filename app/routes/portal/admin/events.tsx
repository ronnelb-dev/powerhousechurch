import {
  Form,
  isRouteErrorResponse,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useState } from "react";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { EmptyState } from "~/components/ui/EmptyState";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";

const prisma = db as any;

export const meta: MetaFunction = () => [{ title: "Manage Events — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const events = await prisma.event.findMany({
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { registrations: true } },
      registrations: {
        select: { status: true },
      },
    },
  });

  return {
    events: events.map((event: any) => ({
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
        total: event._count.registrations,
        confirmed: event.registrations.filter(
          (entry: { status: string }) => entry.status === "CONFIRMED",
        ).length,
        waitlist: event.registrations.filter(
          (entry: { status: string }) => entry.status === "WAITLISTED",
        ).length,
      },
    })),
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

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create" || intent === "update") {
    const raw = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      location: String(formData.get("location") ?? ""),
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
    const data = {
      ...rest,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      capacity: result.data.requiresRegistration && capacity ? Number(capacity) : null,
      registrationDeadline: registrationDeadline
        ? new Date(registrationDeadline)
        : null,
    };

    if (intent === "create") {
      await prisma.event.create({ data });
    } else {
      const id = String(formData.get("id") ?? "");
      await prisma.event.update({ where: { id }, data });
    }
    return { success: true };
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
  event?: ReturnType<typeof useLoaderData<typeof loader>>["events"][0] | null;
  onClose: () => void;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
        <Form method="post" className="space-y-4 p-6">
          <input type="hidden" name="intent" value={event ? "update" : "create"} />
          {event && <input type="hidden" name="id" value={event.id} />}

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
        </Form>
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const { events } = useLoaderData<typeof loader>();
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<(typeof events)[0] | null>(null);
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-400">{events.length} total</p>
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

      {(showForm || editEvent) && (
        <EventFormModal
          event={editEvent}
          onClose={() => {
            setShowForm(false);
            setEditEvent(null);
          }}
        />
      )}

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event: (typeof events)[number]) => {
            const isPast = new Date(event.startDate) < new Date();
            return (
              <div
                key={event.id}
                className={`gap-4 rounded-xl border border-gray-100 bg-white p-5 transition-all hover:border-red-100 ${
                  isPast ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-gray-800">
                        {event.title}
                      </p>
                      <toggleFetcher.Form method="post">
                        <input type="hidden" name="intent" value="togglePublished" />
                        <input type="hidden" name="id" value={event.id} />
                        <button
                          type="submit"
                          className={[
                            "rounded-full border px-2 py-0.5 text-xs font-bold",
                            event.isPublished
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-gray-200 bg-gray-50 text-gray-500",
                          ].join(" ")}
                        >
                          {event.isPublished ? "Live" : "Draft"}
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
                    <p className="text-xs text-gray-400">
                      {new Date(event.startDate).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {event.location}
                    </p>
                    {event.requiresRegistration && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          Confirmed: {event.counts.confirmed}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                          Waitlist: {event.counts.waitlist}
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                          Total: {event.counts.total}
                        </span>
                        {typeof event.capacity === "number" && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                            Seats left: {Math.max(event.capacity - event.counts.confirmed, 0)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      onClick={() => setEditEvent(event)}
                      className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-600 transition-all hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Edit
                    </button>
                    <deleteFetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={event.id} />
                      <button
                        type="submit"
                        onClick={(e) => {
                          if (!confirm(`Delete "${event.title}"?`)) {
                            e.preventDefault();
                          }
                        }}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition-all hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                      >
                        Delete
                      </button>
                    </deleteFetcher.Form>
                  </div>
                </div>
              </div>
            );
          })}
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
