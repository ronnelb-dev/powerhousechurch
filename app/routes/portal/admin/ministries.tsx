import {
  useFetcher,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import type { MetaFunction } from "react-router";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { toast } from "react-toastify";
import { z } from "zod";
import { requireAdmin } from "~/lib/auth.server";
import { uploadImageToCloudinary } from "~/lib/cloudinary.server";
import { db } from "~/lib/db.server";
import { ensureSampleMinistries } from "~/lib/ministries.server";
import { validateMinistryOrder } from "~/lib/ministry-order";
import { EmptyState } from "~/components/ui/EmptyState";
import { describedBy } from "~/components/ui/FormAccessibility";
import { PendingButton } from "~/components/ui/PendingButton";
import {
  PortalHeader,
  PortalSection,
  PortalSectionHeading,
  portalButtonClasses,
} from "~/components/ui/Portal";

export const meta: MetaFunction = () => [{ title: "Manage Ministries — Admin" }];

type LoaderData = Awaited<ReturnType<typeof loader>>;
type MinistryData = LoaderData["ministries"][number];
type MinistryActionData = {
  ok: boolean;
  intent?: FormDataEntryValue | null;
  ministryId?: string;
  formError?: string;
  orderedIds?: string[];
  errors?: Record<string, string[] | undefined>;
};

const ministrySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  leader: z.string().trim().min(1, "Leader is required.").max(120, "Leader is too long."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(1000, "Description is too long."),
  isActive: z.boolean(),
});

function parseMinistryForm(formData: FormData) {
  return ministrySchema.safeParse({
    name: formData.get("name"),
    leader: formData.get("leader"),
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  await ensureSampleMinistries();

  const ministries = await db.ministry.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      leader: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
    },
  });

  return {
    ministries: ministries.map((ministry) => ({
      ...ministry,
      createdAt:
        ministry.createdAt instanceof Date
          ? ministry.createdAt.toISOString()
          : ministry.createdAt,
    })),
  };
}

async function findDuplicateMinistry(args: {
  name: string;
  excludeId?: string;
}) {
  const { name, excludeId } = args;
  return db.ministry.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const result = parseMinistryForm(formData);
    if (!result.success) {
      return { ok: false, intent, errors: result.error.flatten().fieldErrors };
    }

    const duplicateMinistry = await findDuplicateMinistry({
      name: result.data.name,
    });

    if (duplicateMinistry) {
      return {
        ok: false,
        intent,
        errors: { name: [`A ministry named "${duplicateMinistry.name}" already exists.`] },
      };
    }

    const lastMinistry = await db.ministry.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const uploadedImage = await uploadImageToCloudinary(
      formData.get("imageFile"),
      "powerhouse/ministries",
    );

    if (!uploadedImage.ok) {
      return {
        ok: false,
        intent,
        errors: { imageFile: [uploadedImage.error] },
      };
    }

    await db.ministry.create({
      data: {
        ...result.data,
        sortOrder: (lastMinistry?.sortOrder ?? 0) + 1,
        imageUrl: uploadedImage.secureUrl || null,
      },
    });

    return { ok: true, intent };
  }

  if (intent === "update") {
    const ministryId = formData.get("ministryId");
    if (typeof ministryId !== "string" || !ministryId) {
      return { ok: false, intent, formError: "Ministry not found." };
    }

    const result = parseMinistryForm(formData);
    if (!result.success) {
      return {
        ok: false,
        intent,
        ministryId,
        errors: result.error.flatten().fieldErrors,
      };
    }

    const duplicateMinistry = await findDuplicateMinistry({
      name: result.data.name,
      excludeId: ministryId,
    });

    if (duplicateMinistry) {
      return {
        ok: false,
        intent,
        ministryId,
        errors: { name: [`A ministry named "${duplicateMinistry.name}" already exists.`] },
      };
    }

    const currentImageUrl = String(formData.get("currentImageUrl") ?? "");
    const uploadedImage = await uploadImageToCloudinary(
      formData.get("imageFile"),
      "powerhouse/ministries",
    );

    if (!uploadedImage.ok) {
      return {
        ok: false,
        intent,
        ministryId,
        errors: { imageFile: [uploadedImage.error] },
      };
    }

    await db.ministry.update({
      where: { id: ministryId },
      data: {
        ...result.data,
        imageUrl: uploadedImage.secureUrl || currentImageUrl || null,
      },
    });

    return { ok: true, intent, ministryId };
  }

  if (intent === "delete") {
    const ministryId = formData.get("ministryId");
    if (typeof ministryId !== "string" || !ministryId) {
      return { ok: false, intent, formError: "Ministry not found." };
    }

    await db.ministry.delete({
      where: { id: ministryId },
    });

    return { ok: true, intent, ministryId };
  }

  if (intent === "reorder") {
    const serializedIds = formData.get("orderedIds");
    if (typeof serializedIds !== "string") {
      return { ok: false, intent, formError: "The ministry order is invalid. Refresh and try again." };
    }

    let parsedIds: unknown;
    try {
      parsedIds = JSON.parse(serializedIds);
    } catch {
      return { ok: false, intent, formError: "The ministry order is invalid. Refresh and try again." };
    }

    if (
      !Array.isArray(parsedIds) ||
      parsedIds.some((id) => typeof id !== "string" || !id) ||
      new Set(parsedIds).size !== parsedIds.length
    ) {
      return { ok: false, intent, formError: "The ministry order is invalid. Refresh and try again." };
    }

    try {
      const reordered = await db.$transaction(async (transaction) => {
        const currentIds = await transaction.ministry.findMany({ select: { id: true } });
        const orderedIds = validateMinistryOrder(
          parsedIds,
          currentIds.map(({ id }) => id),
        );
        if (!orderedIds) return null;

        for (const [index, id] of orderedIds.entries()) {
          await transaction.ministry.update({
            where: { id },
            data: { sortOrder: index + 1 },
          });
        }

        return orderedIds;
      });

      if (!reordered) {
        return {
          ok: false,
          intent,
          formError: "The roster changed before the new order could be saved. Refresh and try again.",
        };
      }

      return { ok: true, intent, orderedIds: reordered };
    } catch {
      return { ok: false, intent, formError: "Could not save the ministry order. Please try again." };
    }
  }

  return { ok: false, formError: "Unknown action." };
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-xs font-sans text-red-600">{message}</p>;
}

function MinistryCard({
  ministry,
  index,
  total,
  isReordering,
}: {
  ministry: MinistryData;
  index: number;
  total: number;
  isReordering: boolean;
}) {
  const updateFetcher = useFetcher<MinistryActionData>();
  const deleteFetcher = useFetcher<MinistryActionData>();
  const [isEditing, setIsEditing] = useState(false);
  const seenResultsRef = useRef(new WeakSet<object>());
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: ministry.id,
    index,
    disabled: isReordering,
  });

  const updateErrors =
    updateFetcher.data &&
    !updateFetcher.data.ok &&
    updateFetcher.data.intent === "update" &&
    updateFetcher.data.ministryId === ministry.id
      ? updateFetcher.data.errors
      : undefined;

  const isSaving = updateFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  useEffect(() => {
    if (updateFetcher.state !== "idle" && updateFetcher.data) {
      seenResultsRef.current.delete(updateFetcher.data);
    }
    if (deleteFetcher.state !== "idle" && deleteFetcher.data) {
      seenResultsRef.current.delete(deleteFetcher.data);
    }
    if (
      updateFetcher.state === "idle" &&
      updateFetcher.data?.ok &&
      updateFetcher.data.ministryId === ministry.id &&
      !seenResultsRef.current.has(updateFetcher.data)
    ) {
      seenResultsRef.current.add(updateFetcher.data);
      toast.success("Ministry updated.", { role: "status" });
      setIsEditing(false);
    }
    if (
      deleteFetcher.state === "idle" &&
      deleteFetcher.data?.ok &&
      deleteFetcher.data.ministryId === ministry.id &&
      !seenResultsRef.current.has(deleteFetcher.data)
    ) {
      seenResultsRef.current.add(deleteFetcher.data);
      toast.success("Ministry deleted.", { role: "status" });
    }
  }, [deleteFetcher.data, deleteFetcher.state, ministry.id, updateFetcher.data, updateFetcher.state]);

  const editorId = `ministry-editor-${ministry.id}`;

  return (
    <article
      ref={ref}
      style={{ opacity: isDragging ? 0.55 : 1 }}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${isDropTarget ? "border-red-400 shadow-md" : "border-gray-200"}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <button
              ref={handleRef}
              type="button"
              disabled={isReordering}
              aria-label={`Reorder ${ministry.name}. Position ${index + 1} of ${total}. Use Space or Enter to pick up, arrow keys to move, and Space or Enter to drop.`}
              aria-describedby="ministry-reorder-help"
              className="mt-1 flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-wait disabled:opacity-50"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="7" cy="5" r="1.4" />
                <circle cx="13" cy="5" r="1.4" />
                <circle cx="7" cy="10" r="1.4" />
                <circle cx="13" cy="10" r="1.4" />
                <circle cx="7" cy="15" r="1.4" />
                <circle cx="13" cy="15" r="1.4" />
              </svg>
            </button>
            {ministry.imageUrl ? (
              <img
                src={ministry.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl border border-gray-100 object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg font-bold text-red-800 sm:h-20 sm:w-20">
                {ministry.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-xl font-bold text-gray-900">{ministry.name}</h3>
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px] font-sans font-bold",
                    ministry.isActive
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-gray-50 text-gray-600",
                  ].join(" ")}
                >
                  {ministry.isActive ? "Visible publicly" : "Hidden"}
                </span>
              </div>
              <p className="mt-1 text-sm font-sans text-gray-600">Led by {ministry.leader}</p>
              <p className="mt-2 line-clamp-2 text-sm font-sans leading-6 text-gray-500">
                {ministry.description}
              </p>
              <p className="mt-3 text-xs font-sans text-gray-400">
                Position {index + 1} of {total} <span aria-hidden="true">·</span> Added{" "}
                {new Date(ministry.createdAt).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              aria-expanded={isEditing}
              aria-controls={isEditing ? editorId : undefined}
              onClick={() => setIsEditing((current) => !current)}
              className={portalButtonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}
            >
              {isEditing ? "Close editor" : "Edit ministry"}
            </button>
            <deleteFetcher.Form method="post" className="contents">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="ministryId" value={ministry.id} />
              <PendingButton
                type="submit"
                isPending={isDeleting}
                pendingText="Deleting..."
                onClick={(event) => {
                  if (!confirm(`Delete "${ministry.name}"?`)) {
                    event.preventDefault();
                  }
                }}
                className={portalButtonClasses({ variant: "danger", className: "w-full sm:w-auto" })}
              >
                Delete
              </PendingButton>
            </deleteFetcher.Form>
          </div>
        </div>

        {deleteFetcher.data && !deleteFetcher.data.ok && deleteFetcher.data.formError ? (
          <p role="alert" className="mt-2 text-xs font-sans text-red-600">{deleteFetcher.data.formError}</p>
        ) : null}
      </div>

      {isEditing ? (
        <div id={editorId} className="border-t border-gray-100 bg-gray-50/70 p-4 sm:p-5">
        <updateFetcher.Form
          method="post"
          encType="multipart/form-data"
          className="space-y-4"
        >
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="ministryId" value={ministry.id} />
          <input type="hidden" name="currentImageUrl" value={ministry.imageUrl ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`ministry-name-${ministry.id}`} className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">Ministry name</label>
              <input
                id={`ministry-name-${ministry.id}`}
                type="text"
                name="name"
                defaultValue={ministry.name}
                aria-invalid={updateErrors?.name?.[0] ? true : undefined}
                aria-describedby={describedBy(updateErrors?.name?.[0] ? `ministry-name-${ministry.id}-error` : null)}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.name?.[0]} id={`ministry-name-${ministry.id}-error`} />
            </div>

            <div>
              <label htmlFor={`ministry-leader-${ministry.id}`} className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">Ministry leader</label>
              <input
                id={`ministry-leader-${ministry.id}`}
                type="text"
                name="leader"
                defaultValue={ministry.leader}
                aria-invalid={updateErrors?.leader?.[0] ? true : undefined}
                aria-describedby={describedBy(updateErrors?.leader?.[0] ? `ministry-leader-${ministry.id}-error` : null)}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.leader?.[0]} id={`ministry-leader-${ministry.id}-error`} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`ministry-description-${ministry.id}`} className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">Description</label>
              <textarea
                id={`ministry-description-${ministry.id}`}
                name="description"
                rows={3}
                defaultValue={ministry.description}
                aria-invalid={updateErrors?.description?.[0] ? true : undefined}
                aria-describedby={describedBy(updateErrors?.description?.[0] ? `ministry-description-${ministry.id}-error` : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.description?.[0]} id={`ministry-description-${ministry.id}-error`} />
            </div>

            <div>
              <label htmlFor={`ministry-imageFile-${ministry.id}`} className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">Ministry image</label>
              {ministry.imageUrl ? (
                <div className="mb-2 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                  <img
                    src={ministry.imageUrl}
                    alt=""
                    className="h-24 w-full object-cover"
                  />
                </div>
              ) : null}
              <input
                id={`ministry-imageFile-${ministry.id}`}
                type="file"
                name="imageFile"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-invalid={updateErrors?.imageFile?.[0] ? true : undefined}
                aria-describedby={describedBy(updateErrors?.imageFile?.[0] ? `ministry-imageFile-${ministry.id}-error` : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <p className="mt-1 text-xs font-sans text-gray-400">
                JPG, PNG, WebP, or GIF up to 5 MB. Leave blank to keep the current image.
              </p>
              <FieldError message={updateErrors?.imageFile?.[0]} id={`ministry-imageFile-${ministry.id}-error`} />
            </div>

          </div>

          <label className="flex items-center gap-2 text-xs font-sans font-bold text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={ministry.isActive}
              className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
            />
            Show this ministry on the public ministries page
          </label>

            <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center">
            <PendingButton
              type="submit"
              isPending={isSaving}
              pendingText="Saving..."
                className={portalButtonClasses({ variant: "primary", className: "w-full sm:w-auto" })}
            >
              Save changes
            </PendingButton>
            {updateFetcher.data && !updateFetcher.data.ok && updateFetcher.data.formError ? (
              <p className="text-xs font-sans text-red-600">{updateFetcher.data.formError}</p>
            ) : null}
          </div>
        </updateFetcher.Form>
        </div>
      ) : null}
    </article>
  );
}

export default function AdminMinistriesPage() {
  const { ministries } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<MinistryActionData>();
  const reorderFetcher = useFetcher<MinistryActionData>();
  const createFormRef = useRef<HTMLFormElement>(null);
  const seenCreateResultRef = useRef<object | null>(null);
  const seenReorderResultRef = useRef<object | null>(null);
  const [orderedMinistries, setOrderedMinistries] = useState(ministries);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const isReordering = reorderFetcher.state !== "idle";

  useEffect(() => {
    if (reorderFetcher.state === "idle") {
      setOrderedMinistries(ministries);
    }
  }, [ministries, reorderFetcher.state]);

  useEffect(() => {
    const result = reorderFetcher.data;
    if (
      reorderFetcher.state !== "idle" ||
      !result ||
      result.intent !== "reorder" ||
      seenReorderResultRef.current === result
    ) {
      return;
    }

    seenReorderResultRef.current = result;
    if (result.ok) {
      setReorderAnnouncement("Ministry order saved.");
      toast.success("Ministry order saved.", { role: "status" });
    } else {
      setReorderAnnouncement(result.formError ?? "Could not save ministry order.");
      toast.error(result.formError ?? "Could not save ministry order.", { role: "alert" });
    }
  }, [reorderFetcher.data, reorderFetcher.state]);

  const createErrors =
    createFetcher.data && !createFetcher.data.ok && createFetcher.data.intent === "create"
      ? createFetcher.data.errors
      : undefined;

  useEffect(() => {
    if (createFetcher.state !== "idle") {
      seenCreateResultRef.current = null;
      return;
    }
    if (
      createFetcher.state === "idle" &&
      createFetcher.data?.ok &&
      createFetcher.data.intent === "create" &&
      seenCreateResultRef.current !== createFetcher.data
    ) {
      seenCreateResultRef.current = createFetcher.data;
      createFormRef.current?.reset();
      toast.success("Ministry created.", { role: "status" });
    }
  }, [createFetcher.state, createFetcher.data]);

  const visibleCount = ministries.filter((ministry) => ministry.isActive).length;

  function saveMinistryOrder(nextMinistries: MinistryData[]) {
    setOrderedMinistries(nextMinistries);
    setReorderAnnouncement("Saving ministry order.");
    reorderFetcher.submit(
      {
        intent: "reorder",
        orderedIds: JSON.stringify(nextMinistries.map((ministry) => ministry.id)),
      },
      { method: "post" },
    );
  }

  function handleMinistryDragEnd(event: DragEndEvent) {
    if (event.canceled || isReordering) return;

    const source = event.operation.source;
    if (!isSortable(source) || source.initialIndex === source.index) return;

    const nextMinistries = [...orderedMinistries];
    const [movedMinistry] = nextMinistries.splice(source.initialIndex, 1);
    if (!movedMinistry) return;
    nextMinistries.splice(source.index, 0, movedMinistry);
    saveMinistryOrder(nextMinistries);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PortalHeader
        eyebrow="Admin"
        title="Ministries"
        subtitle="Add and manage the ministry information shown on the public page."
        actions={(
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-sans font-bold text-gray-700">
              {ministries.length} total
            </span>
            <span className="rounded-full bg-green-50 px-3 py-2 text-xs font-sans font-bold text-green-700">
              {visibleCount} visible
            </span>
          </div>
        )}
      />

      <PortalSection className="p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="font-serif text-xl font-bold text-gray-900">Add a ministry</h2>
          <p className="mt-1 text-sm font-sans text-gray-500">
            Common starter ministries are added automatically the first time this page is opened. New ministries are placed at the end of the roster.
          </p>
        </div>

        <createFetcher.Form
          ref={createFormRef}
          method="post"
          encType="multipart/form-data"
          className="space-y-4"
        >
          <input type="hidden" name="intent" value="create" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="create-ministry-name" className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">
                Ministry Name
              </label>
              <input
                id="create-ministry-name"
                type="text"
                name="name"
                placeholder="Example: Couples Ministry"
                aria-invalid={createErrors?.name?.[0] ? true : undefined}
                aria-describedby={describedBy(createErrors?.name?.[0] ? "create-ministry-name-error" : null)}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.name?.[0]} id="create-ministry-name-error" />
            </div>

            <div>
              <label htmlFor="create-ministry-leader" className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">
                Ministry Leader
              </label>
              <input
                id="create-ministry-leader"
                type="text"
                name="leader"
                placeholder="Leader name"
                aria-invalid={createErrors?.leader?.[0] ? true : undefined}
                aria-describedby={describedBy(createErrors?.leader?.[0] ? "create-ministry-leader-error" : null)}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.leader?.[0]} id="create-ministry-leader-error" />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="create-ministry-description" className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">
                Description
              </label>
              <textarea
                id="create-ministry-description"
                name="description"
                rows={3}
                placeholder="What does this ministry do?"
                aria-invalid={createErrors?.description?.[0] ? true : undefined}
                aria-describedby={describedBy(createErrors?.description?.[0] ? "create-ministry-description-error" : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.description?.[0]} id="create-ministry-description-error" />
            </div>

            <div>
              <label htmlFor="create-ministry-imageFile" className="mb-1.5 block text-xs font-sans font-bold uppercase tracking-[0.1em] text-gray-600">
                Ministry Image
              </label>
              <input
                id="create-ministry-imageFile"
                type="file"
                name="imageFile"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-invalid={createErrors?.imageFile?.[0] ? true : undefined}
                aria-describedby={describedBy(createErrors?.imageFile?.[0] ? "create-ministry-imageFile-error" : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <p className="mt-1 text-xs font-sans text-gray-400">
                Upload JPG, PNG, WebP, or GIF up to 5 MB.
              </p>
              <FieldError message={createErrors?.imageFile?.[0]} id="create-ministry-imageFile-error" />
            </div>

          </div>

          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 text-sm font-sans text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
            />
            Show this ministry on the public ministries page
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PendingButton
              type="submit"
              isPending={createFetcher.state !== "idle"}
              pendingText="Creating..."
              className={portalButtonClasses({ variant: "primary", className: "w-full sm:w-auto" })}
            >
              Add Ministry
            </PendingButton>
            {createFetcher.data && !createFetcher.data.ok && createFetcher.data.formError ? (
              <p className="text-sm font-sans text-red-600">{createFetcher.data.formError}</p>
            ) : null}
          </div>
        </createFetcher.Form>
      </PortalSection>

      {ministries.length > 0 ? (
        <section className="space-y-4">
          <PortalSectionHeading
            eyebrow="Roster"
            title="Manage ministries"
            subtitle="Drag ministries into order. Each move saves automatically; hidden ministries keep their place for when they are shown again."
            actions={<span className="w-fit rounded-full bg-gray-100 px-3 py-2 text-xs font-sans font-bold text-gray-700">{ministries.length} {ministries.length === 1 ? "ministry" : "ministries"}</span>}
          />
          <p id="ministry-reorder-help" className="sr-only">
            Use Space or Enter to pick up a ministry, arrow keys to move it, and Space or Enter to drop it. Reordering saves automatically.
          </p>
          <p role="status" aria-live="polite" className="sr-only">{reorderAnnouncement}</p>
          {reorderFetcher.data?.intent === "reorder" && !reorderFetcher.data.ok ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {reorderFetcher.data.formError ?? "Could not save ministry order."}
            </p>
          ) : null}
          <div className="space-y-3">
            <DragDropProvider onDragEnd={handleMinistryDragEnd}>
              {orderedMinistries.map((ministry, index) => (
                <MinistryCard
                  key={ministry.id}
                  ministry={ministry}
                  index={index}
                  total={orderedMinistries.length}
                  isReordering={isReordering}
                />
              ))}
            </DragDropProvider>
          </div>
        </section>
      ) : (
        <EmptyState
          icon="generic"
          title="No ministries yet"
          message="Add your first ministry above and it will appear here for ongoing management."
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
      title="Ministries unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
    />
  );
}
