// app/routes/portal/admin/events.tsx
// Admin event management: create, edit, delete, publish/unpublish.

import {
  useLoaderData,
  useFetcher,
  Form,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { useState } from "react";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [{ title: "Manage Events — Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const events = await db.event.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true, title: true, location: true,
      startDate: true, endDate: true, isPublished: true, description: true,
    },
  });
  return {
    events: events.map((e) => ({
      ...e,
      startDate: e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate,
      endDate:   e.endDate instanceof Date ? e.endDate.toISOString() : (e.endDate ?? null),
    })),
  };
}

const EventSchema = z.object({
  title:       z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  location:    z.string().min(1, "Location is required").max(200),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid date"),
  endDate:     z.string().optional().or(z.literal("")),
  imageUrl:    z.string().url().optional().or(z.literal("")),
  isPublished: z.coerce.boolean().default(true),
});

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent   = formData.get("intent") as string;

  if (intent === "create" || intent === "update") {
    const raw = {
      title:       formData.get("title")       as string,
      description: formData.get("description") as string,
      location:    formData.get("location")    as string,
      startDate:   formData.get("startDate")   as string,
      endDate:     (formData.get("endDate")    as string) ?? "",
      imageUrl:    (formData.get("imageUrl")   as string) ?? "",
      isPublished: formData.get("isPublished") as string,
    };
    const result = EventSchema.safeParse(raw);
    if (!result.success) return { success: false, errors: result.error.flatten().fieldErrors };

    const { startDate, endDate, ...rest } = result.data;
    const data = {
      ...rest,
      startDate: new Date(startDate),
      endDate:   endDate ? new Date(endDate) : null,
    };

    if (intent === "create") {
      await db.event.create({ data });
    } else {
      const id = formData.get("id") as string;
      await db.event.update({ where: { id }, data });
    }
    return { success: true };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.event.delete({ where: { id } });
    return { success: true };
  }

  if (intent === "togglePublished") {
    const id = formData.get("id") as string;
    const e  = await db.event.findUnique({ where: { id }, select: { isPublished: true } });
    if (e) await db.event.update({ where: { id }, data: { isPublished: !e.isPublished } });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const inputClass =
  "w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent";
const labelClass = "block text-xs font-sans font-bold text-gray-600 mb-1";

function EventFormModal({
  event,
  onClose,
}: {
  event?: ReturnType<typeof useLoaderData<typeof loader>>["events"][0] | null;
  onClose: () => void;
}) {
  const navigation  = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="event-form-title">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 id="event-form-title" className="font-serif text-xl font-bold text-gray-900">
            {event ? "Edit Event" : "Add Event"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl
                                               leading-none focus:outline-none" aria-label="Close">×</button>
        </div>
        <Form method="post" className="p-6 space-y-4">
          <input type="hidden" name="intent" value={event ? "update" : "create"} />
          {event && <input type="hidden" name="id" value={event.id} />}

          <div>
            <label htmlFor="e-title" className={labelClass}>Title *</label>
            <input id="e-title" type="text" name="title"
                   defaultValue={event?.title} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="e-description" className={labelClass}>Description *</label>
            <textarea id="e-description" name="description" rows={3} required
                      defaultValue={event?.description}
                      className={`${inputClass} resize-y`} />
          </div>
          <div>
            <label htmlFor="e-location" className={labelClass}>Location *</label>
            <input id="e-location" type="text" name="location"
                   defaultValue={event?.location} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="e-startDate" className={labelClass}>Start Date & Time *</label>
              <input id="e-startDate" type="datetime-local" name="startDate"
                     defaultValue={event?.startDate?.slice(0, 16)} required className={inputClass} />
            </div>
            <div>
              <label htmlFor="e-endDate" className={labelClass}>End Date & Time</label>
              <input id="e-endDate" type="datetime-local" name="endDate"
                     defaultValue={event?.endDate?.slice(0, 16) ?? ""} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="e-imageUrl" className={labelClass}>Image URL (Cloudinary)</label>
            <input id="e-imageUrl" type="url" name="imageUrl"
                   placeholder="https://res.cloudinary.com/..." className={inputClass} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="isPublished" value="true"
                   defaultChecked={event?.isPublished ?? true}
                   className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-400" />
            <span className="text-sm font-sans font-bold text-gray-700">Publish immediately</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting}
                    className="flex-1 py-3 bg-red-700 text-white font-bold text-sm font-sans
                               rounded-lg hover:bg-red-800 disabled:opacity-60 transition-all">
              {isSubmitting ? "Saving…" : event ? "Update Event" : "Add Event"}
            </button>
            <button type="button" onClick={onClose}
                    className="px-5 py-3 border border-gray-200 text-gray-600 font-bold
                               text-sm font-sans rounded-lg hover:border-gray-300 transition-all">
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
  const [showForm,   setShowForm]   = useState(false);
  const [editEvent,  setEditEvent]  = useState<typeof events[0] | null>(null);
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">Events</h1>
          <p className="text-sm text-gray-400 font-sans">{events.length} total</p>
        </div>
        <button
          onClick={() => { setEditEvent(null); setShowForm(true); }}
          className="px-4 py-2.5 bg-red-700 text-white font-sans font-bold text-sm
                     rounded-lg hover:bg-red-800 transition-colors focus:outline-none
                     focus:ring-2 focus:ring-red-400"
        >
          + Add Event
        </button>
      </div>

      {(showForm || editEvent) && (
        <EventFormModal
          event={editEvent}
          onClose={() => { setShowForm(false); setEditEvent(null); }}
        />
      )}

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => {
            const isPast = new Date(event.startDate) < new Date();
            return (
              <div
                key={event.id}
                className={`bg-white border border-gray-100 rounded-xl p-5 flex
                            items-start justify-between gap-4 hover:border-red-100
                            transition-all ${isPast ? "opacity-60" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-sans font-bold text-gray-800 text-sm truncate">
                      {event.title}
                    </p>
                    <toggleFetcher.Form method="post">
                      <input type="hidden" name="intent" value="togglePublished" />
                      <input type="hidden" name="id" value={event.id} />
                      <button type="submit"
                              className={[
                                "text-xs font-sans font-bold px-2 py-0.5 rounded-full border",
                                event.isPublished
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-500 border-gray-200",
                              ].join(" ")}>
                        {event.isPublished ? "Live" : "Draft"}
                      </button>
                    </toggleFetcher.Form>
                    {isPast && (
                      <span className="text-xs font-sans text-gray-400 border border-gray-200
                                       rounded-full px-2 py-0.5">Past</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-sans">
                    {new Date(event.startDate).toLocaleString("en-PH", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })} · {event.location}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditEvent(event)}
                    className="text-xs font-sans font-bold text-blue-600 px-3 py-1.5
                               rounded-lg border border-blue-200 hover:bg-blue-50
                               transition-all focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    Edit
                  </button>
                  <deleteFetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={event.id} />
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Delete "${event.title}"?`)) e.preventDefault();
                      }}
                      className="text-xs font-sans font-bold text-red-600 px-3 py-1.5
                                 rounded-lg border border-red-200 hover:bg-red-50
                                 transition-all focus:outline-none focus:ring-2 focus:ring-red-300"
                    >
                      Delete
                    </button>
                  </deleteFetcher.Form>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="events" title="No events yet"
          message="Add your first event to get started." />
      )}
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <EmptyState icon="events" title="Events unavailable" message="Please refresh." />
  );
}