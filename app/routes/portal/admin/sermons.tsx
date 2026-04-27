// app/routes/portal/admin/sermons.tsx
// Admin sermon management: create, edit, delete, toggle published.

import {
  useLoaderData,
  useFetcher,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";
import { describedBy, useFocusFirstInvalidField, ValidationSummary } from "~/components/ui/FormAccessibility";
import { PendingButton } from "~/components/ui/PendingButton";
import { useToast } from "~/components/ui/ToastProvider";

export const meta: MetaFunction = () => [{ title: "Manage Sermons — Admin" }];

type LoaderData = Awaited<ReturnType<typeof loader>>;
type AdminSermon = LoaderData["sermons"][number];
type SermonActionData = {
  success?: boolean;
  sermonId?: string;
  message?: string;
  formError?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const sermons = await db.sermon.findMany({
    orderBy: { date: "desc" },
    select: {
      id: true, title: true, speaker: true, series: true,
      date: true, isPublished: true, videoUrl: true, audioUrl: true,
      thumbnail: true, notes: true, scriptureFocus: true, weeklyGuide: true,
      reflectionPrompts: true, tags: true,
    },
  });
  return {
    sermons: sermons.map((s) => ({
      ...s,
      date: s.date instanceof Date ? s.date.toISOString() : s.date,
    })),
  };
}

const SermonSchema = z.object({
  title:       z.string().min(1, "Title is required").max(200),
  speaker:     z.string().min(1, "Speaker is required").max(100),
  series:      z.string().max(100).optional().or(z.literal("")),
  videoUrl:    z.string().url("Invalid URL").optional().or(z.literal("")),
  audioUrl:    z.string().url("Invalid URL").optional().or(z.literal("")),
  thumbnail:   z.string().url("Invalid URL").optional().or(z.literal("")),
  notes:       z.string().optional().or(z.literal("")),
  scriptureFocus: z.string().max(200).optional().or(z.literal("")),
  weeklyGuide: z.string().max(4000).optional().or(z.literal("")),
  reflectionPrompts: z.string().max(2000).optional().or(z.literal("")),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  tags:        z.string().max(200).default(""),
  isPublished: z.coerce.boolean().default(true),
});

async function findDuplicateSermon(args: {
  title: string;
  speaker: string;
  date: Date;
  excludeId?: string;
}) {
  const { title, speaker, date, excludeId } = args;
  return db.sermon.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      speaker: { equals: speaker, mode: "insensitive" },
      date,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      title: true,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent   = formData.get("intent") as string;

  if (intent === "create" || intent === "update") {
    const raw = {
      title:       String(formData.get("title") ?? "").trim(),
      speaker:     String(formData.get("speaker") ?? "").trim(),
      series:      String(formData.get("series") ?? "").trim(),
      videoUrl:    String(formData.get("videoUrl") ?? "").trim(),
      audioUrl:    String(formData.get("audioUrl") ?? "").trim(),
      thumbnail:   String(formData.get("thumbnail") ?? "").trim(),
      notes:       String(formData.get("notes") ?? "").trim(),
      scriptureFocus: String(formData.get("scriptureFocus") ?? "").trim(),
      weeklyGuide: String(formData.get("weeklyGuide") ?? "").trim(),
      reflectionPrompts: String(formData.get("reflectionPrompts") ?? "").trim(),
      date:        String(formData.get("date") ?? ""),
      tags:        String(formData.get("tags") ?? "").trim(),
      isPublished: formData.get("isPublished") as string,
    };
    const result = SermonSchema.safeParse(raw);
    if (!result.success) {
      return { success: false, errors: result.error.flatten().fieldErrors };
    }
    const id = String(formData.get("id") ?? "");
    const { date, ...rest } = result.data;
    const data = {
      ...rest,
      series: nullableText(rest.series),
      videoUrl: nullableText(rest.videoUrl),
      audioUrl: nullableText(rest.audioUrl),
      thumbnail: nullableText(rest.thumbnail),
      notes: nullableText(rest.notes),
      scriptureFocus: nullableText(rest.scriptureFocus),
      weeklyGuide: nullableText(rest.weeklyGuide),
      reflectionPrompts: nullableText(rest.reflectionPrompts),
      date: new Date(date),
    };

    const duplicateSermon = await findDuplicateSermon({
      title: data.title,
      speaker: data.speaker,
      date: data.date,
      excludeId: intent === "update" ? id : undefined,
    });

    if (duplicateSermon) {
      return {
        success: false,
        sermonId: intent === "update" ? id : undefined,
        formError: `A matching sermon already exists: "${duplicateSermon.title}".`,
      };
    }

    if (intent === "create") {
      await db.sermon.create({ data });
    } else {
      await db.sermon.update({ where: { id }, data });
    }
    return {
      success: true,
      sermonId: intent === "update" ? id : undefined,
      message: intent === "create" ? "Sermon created." : "Sermon updated.",
    };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.sermon.delete({ where: { id } });
    return { success: true, sermonId: id, message: "Sermon deleted." };
  }

  if (intent === "togglePublished") {
    const id      = formData.get("id") as string;
    const current = await db.sermon.findUnique({ where: { id }, select: { isPublished: true } });
    if (current) {
      await db.sermon.update({ where: { id }, data: { isPublished: !current.isPublished } });
    }
    return { success: true, sermonId: id, message: current?.isPublished ? "Sermon moved to draft." : "Sermon published." };
  }

  return { error: "Unknown intent." };
}

const inputClass =
  "w-full px-3 py-2 text-sm font-sans border border-gray-200 rounded-lg " +
  "bg-white text-gray-800 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent";

const labelClass = "block text-xs font-sans font-bold text-gray-600 mb-1";

function nullableText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function SermonForm({
  sermon,
  onClose,
}: {
  sermon?: AdminSermon | null;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<SermonActionData>();
  const { showToast } = useToast();
  const isSubmitting = fetcher.state !== "idle";
  const errors = fetcher.data?.success === false ? fetcher.data.errors ?? {} : {};

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      if (fetcher.data.message) {
        showToast({ tone: "success", message: fetcher.data.message });
      }
      onClose();
    }
  }, [fetcher.state, fetcher.data, onClose, showToast]);

  useFocusFirstInvalidField({
    formRef,
    errors,
    globalError: fetcher.data?.success === false ? fetcher.data.formError : null,
    fieldOrder: [
      "title",
      "speaker",
      "series",
      "date",
      "tags",
      "videoUrl",
      "audioUrl",
      "thumbnail",
      "notes",
      "scriptureFocus",
      "weeklyGuide",
      "reflectionPrompts",
    ],
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="sermon-form-title">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 id="sermon-form-title" className="font-serif text-xl font-bold text-gray-900">
            {sermon ? "Edit Sermon" : "Add Sermon"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl
                                               leading-none focus:outline-none" aria-label="Close">×</button>
        </div>
        <fetcher.Form ref={formRef} method="post" className="p-6 space-y-4">
          <input type="hidden" name="intent" value={sermon ? "update" : "create"} />
          {sermon && <input type="hidden" name="id" value={sermon.id} />}

          <ValidationSummary
            errors={errors}
            globalError={fetcher.data?.success === false ? fetcher.data.formError : null}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="s-title" className={labelClass}>Title *</label>
              <input id="s-title" type="text" name="title"
                     defaultValue={sermon?.title} required aria-invalid={errors.title?.length ? true : undefined}
                     aria-describedby={describedBy(errors.title?.length ? "s-title-error" : null)} className={inputClass} />
              <FieldError errors={errors.title} id="s-title-error" />
            </div>
            <div>
              <label htmlFor="s-speaker" className={labelClass}>Speaker *</label>
              <input id="s-speaker" type="text" name="speaker"
                     defaultValue={sermon?.speaker} required aria-invalid={errors.speaker?.length ? true : undefined}
                     aria-describedby={describedBy(errors.speaker?.length ? "s-speaker-error" : null)} className={inputClass} />
              <FieldError errors={errors.speaker} id="s-speaker-error" />
            </div>
            <div>
              <label htmlFor="s-series" className={labelClass}>Series</label>
              <input id="s-series" type="text" name="series"
                     defaultValue={sermon?.series ?? ""} aria-invalid={errors.series?.length ? true : undefined}
                     aria-describedby={describedBy(errors.series?.length ? "s-series-error" : null)} className={inputClass} />
              <FieldError errors={errors.series} id="s-series-error" />
            </div>
            <div>
              <label htmlFor="s-date" className={labelClass}>Date *</label>
              <input id="s-date" type="date" name="date"
                     defaultValue={sermon?.date?.slice(0, 10)} required aria-invalid={errors.date?.length ? true : undefined}
                     aria-describedby={describedBy(errors.date?.length ? "s-date-error" : null)} className={inputClass} />
              <FieldError errors={errors.date} id="s-date-error" />
            </div>
            <div>
              <label htmlFor="s-tags" className={labelClass}>Tags (comma-separated)</label>
              <input id="s-tags" type="text" name="tags"
                     defaultValue={sermon?.tags} placeholder="Faith,Holy Spirit,Revival"
                     aria-invalid={errors.tags?.length ? true : undefined}
                     aria-describedby={describedBy(errors.tags?.length ? "s-tags-error" : null)}
                     className={inputClass} />
              <FieldError errors={errors.tags} id="s-tags-error" />
            </div>
            <div className="col-span-2">
              <label htmlFor="s-videoUrl" className={labelClass}>YouTube Video URL</label>
              <input id="s-videoUrl" type="url" name="videoUrl"
                     defaultValue={sermon?.videoUrl ?? ""}
                     placeholder="https://www.youtube.com/watch?v=..." aria-invalid={errors.videoUrl?.length ? true : undefined}
                     aria-describedby={describedBy(errors.videoUrl?.length ? "s-videoUrl-error" : null)} className={inputClass} />
              <FieldError errors={errors.videoUrl} id="s-videoUrl-error" />
            </div>
            <div>
              <label htmlFor="s-audioUrl" className={labelClass}>Audio URL</label>
              <input id="s-audioUrl" type="url" name="audioUrl"
                     defaultValue={sermon?.audioUrl ?? ""}
                     placeholder="https://..." aria-invalid={errors.audioUrl?.length ? true : undefined}
                     aria-describedby={describedBy(errors.audioUrl?.length ? "s-audioUrl-error" : null)} className={inputClass} />
              <FieldError errors={errors.audioUrl} id="s-audioUrl-error" />
            </div>
            <div>
              <label htmlFor="s-thumbnail" className={labelClass}>Thumbnail URL</label>
              <input id="s-thumbnail" type="url" name="thumbnail"
                     defaultValue={sermon?.thumbnail ?? ""}
                     placeholder="https://res.cloudinary.com/..." aria-invalid={errors.thumbnail?.length ? true : undefined}
                     aria-describedby={describedBy(errors.thumbnail?.length ? "s-thumbnail-error" : null)} className={inputClass} />
              <FieldError errors={errors.thumbnail} id="s-thumbnail-error" />
            </div>
            <div className="col-span-2">
              <label htmlFor="s-notes" className={labelClass}>Sermon Notes (Markdown)</label>
              <textarea id="s-notes" name="notes" rows={4}
                        aria-invalid={errors.notes?.length ? true : undefined}
                        aria-describedby={describedBy(errors.notes?.length ? "s-notes-error" : null)}
                        className={`${inputClass} resize-y`}
                        defaultValue={sermon?.notes ?? ""}
                        placeholder="## Key Points&#10;- Point 1&#10;- Point 2" />
              <FieldError errors={errors.notes} id="s-notes-error" />
            </div>
            <div className="col-span-2">
              <label htmlFor="s-scriptureFocus" className={labelClass}>Scripture Focus</label>
              <input id="s-scriptureFocus" type="text" name="scriptureFocus"
                     defaultValue={sermon?.scriptureFocus ?? ""}
                     placeholder="James 1:22-25" aria-invalid={errors.scriptureFocus?.length ? true : undefined}
                     aria-describedby={describedBy(errors.scriptureFocus?.length ? "s-scriptureFocus-error" : null)} className={inputClass} />
              <FieldError errors={errors.scriptureFocus} id="s-scriptureFocus-error" />
            </div>
            <div className="col-span-2">
              <label htmlFor="s-weeklyGuide" className={labelClass}>Weekly Sermon Guide</label>
              <textarea id="s-weeklyGuide" name="weeklyGuide" rows={5}
                        defaultValue={sermon?.weeklyGuide ?? ""}
                        aria-invalid={errors.weeklyGuide?.length ? true : undefined}
                        aria-describedby={describedBy(errors.weeklyGuide?.length ? "s-weeklyGuide-error" : null)}
                        className={`${inputClass} resize-y`}
                        placeholder="Summarize how the church can carry this message into the week." />
              <FieldError errors={errors.weeklyGuide} id="s-weeklyGuide-error" />
            </div>
            <div className="col-span-2">
              <label htmlFor="s-reflectionPrompts" className={labelClass}>
                Reflection Prompts
              </label>
              <textarea id="s-reflectionPrompts" name="reflectionPrompts" rows={4}
                        defaultValue={sermon?.reflectionPrompts ?? ""}
                        aria-invalid={errors.reflectionPrompts?.length ? true : undefined}
                        aria-describedby={describedBy(errors.reflectionPrompts?.length ? "s-reflectionPrompts-error" : null)}
                        className={`${inputClass} resize-y`}
                        placeholder={"One prompt per line\nWhere is God asking for obedience this week?\nWho can you encourage with this message?"} />
              <FieldError errors={errors.reflectionPrompts} id="s-reflectionPrompts-error" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="isPublished" value="true"
                   defaultChecked={sermon?.isPublished ?? true}
                   className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-400" />
            <span className="text-sm font-sans font-bold text-gray-700">Publish immediately</span>
          </label>

          <div className="flex gap-3 pt-2">
            <PendingButton type="submit" isPending={isSubmitting} pendingText="Saving..."
                    className="flex-1 py-3 bg-red-700 text-white font-bold text-sm font-sans
                               rounded-lg hover:bg-red-800 disabled:opacity-60 transition-all">
              {sermon ? "Update Sermon" : "Add Sermon"}
            </PendingButton>
            <button type="button" onClick={onClose}
                    className="px-5 py-3 border border-gray-200 text-gray-600 font-bold
                               text-sm font-sans rounded-lg hover:border-gray-300 transition-all">
              Cancel
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

export default function AdminSermonsPage() {
  const { sermons } = useLoaderData<typeof loader>();
  const [showForm, setShowForm] = useState(false);
  const [editSermon, setEditSermon] = useState<AdminSermon | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">Sermons</h1>
          <p className="text-sm text-gray-400 font-sans">{sermons.length} total</p>
        </div>
        <button
          onClick={() => { setEditSermon(null); setShowForm(true); }}
          className="px-4 py-2.5 bg-red-700 text-white font-sans font-bold text-sm
                     rounded-lg hover:bg-red-800 transition-colors focus:outline-none
                     focus:ring-2 focus:ring-red-400"
        >
          + Add Sermon
        </button>
      </div>

      {(showForm || editSermon) && (
        <SermonForm
          key={editSermon?.id ?? "new"}
          sermon={editSermon}
          onClose={() => { setShowForm(false); setEditSermon(null); }}
        />
      )}

      {sermons.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm" aria-label="Sermon list">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Title", "Speaker", "Date", "Status", ""].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-sans font-bold
                                          uppercase tracking-widest text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sermons.map((sermon) => (
                <SermonRow
                  key={sermon.id}
                  sermon={sermon}
                  onEdit={(nextSermon) => {
                    setEditSermon(nextSermon);
                    setShowForm(false);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="sermons" title="No sermons yet"
          message="Add your first sermon to get started." />
      )}
    </div>
  );
}

function SermonRow({
  sermon,
  onEdit,
}: {
  sermon: AdminSermon;
  onEdit: (sermon: AdminSermon) => void;
}) {
  const deleteFetcher = useFetcher<SermonActionData>();
  const toggleFetcher = useFetcher<SermonActionData>();
  const { showToast } = useToast();
  const isDeleting = deleteFetcher.state !== "idle";
  const isToggling = toggleFetcher.state !== "idle";

  useEffect(() => {
    const fetchers = [deleteFetcher, toggleFetcher];
    for (const fetcher of fetchers) {
      if (fetcher.state !== "idle" || !fetcher.data) continue;
      const message = fetcher.data.message ?? fetcher.data.formError;
      if (!message) continue;
      showToast({
        tone: fetcher.data.success ? "success" : "error",
        message,
      });
    }
  }, [deleteFetcher, toggleFetcher, showToast]);

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <p className="font-sans font-bold text-gray-800 text-sm truncate max-w-xs">
          {sermon.title}
        </p>
        {sermon.series && (
          <p className="text-xs text-gray-400 font-sans">{sermon.series}</p>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-gray-600 font-sans">{sermon.speaker}</td>
      <td className="py-3 px-4 text-xs text-gray-400 font-sans">
        {new Date(sermon.date).toLocaleDateString("en-PH", {
          month: "short", day: "numeric", year: "numeric",
        })}
      </td>
      <td className="py-3 px-4">
        <toggleFetcher.Form method="post">
          <input type="hidden" name="intent" value="togglePublished" />
          <input type="hidden" name="id" value={sermon.id} />
          <PendingButton
            type="submit"
            isPending={isToggling}
            pendingText="Saving..."
            className={[
              "text-xs font-sans font-bold px-2.5 py-1 rounded-full border transition-all disabled:opacity-60",
              sermon.isPublished
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-500 border-gray-200",
            ].join(" ")}
            aria-label={`Toggle published status for ${sermon.title}`}
          >
            {sermon.isPublished ? "Published" : "Draft"}
          </PendingButton>
        </toggleFetcher.Form>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onEdit(sermon)}
            className="text-xs font-sans font-bold text-blue-600 hover:text-blue-800
                       px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50
                       transition-all focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Edit
          </button>
          <deleteFetcher.Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={sermon.id} />
            <PendingButton
              type="submit"
              isPending={isDeleting}
              pendingText="Deleting..."
              onClick={(e) => {
                if (!confirm(`Delete "${sermon.title}"? This cannot be undone.`)) {
                  e.preventDefault();
                }
              }}
              className="text-xs font-sans font-bold text-red-600 hover:text-red-800
                         px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50
                         transition-all focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
            >
              Delete
            </PendingButton>
          </deleteFetcher.Form>
        </div>
      </td>
    </tr>
  );
}

function FieldError({ errors, id }: { errors?: string[]; id?: string }) {
  if (!errors?.length) return null;
  return <p id={id} className="mt-1 text-xs font-medium text-red-600">{errors[0]}</p>;
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState icon="sermons" title="Sermons unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh."} />
  );
}
