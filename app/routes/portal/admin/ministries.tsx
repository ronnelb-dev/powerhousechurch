import {
  useFetcher,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect, useRef } from "react";
import type { MetaFunction } from "react-router";
import { z } from "zod";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { ensureSampleMinistries } from "~/lib/ministries.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [{ title: "Manage Ministries — Admin" }];

type LoaderData = Awaited<ReturnType<typeof loader>>;
type MinistryData = LoaderData["ministries"][number];
type MinistryActionData = {
  ok: boolean;
  intent?: FormDataEntryValue | null;
  ministryId?: string;
  formError?: string;
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
  imageUrl: z.string().trim().url("Image URL must be valid.").optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0, "Sort order must be 0 or higher."),
  isActive: z.boolean(),
});

function parseMinistryForm(formData: FormData) {
  return ministrySchema.safeParse({
    name: formData.get("name"),
    leader: formData.get("leader"),
    description: formData.get("description"),
    imageUrl: typeof formData.get("imageUrl") === "string" ? formData.get("imageUrl") : "",
    sortOrder: formData.get("sortOrder"),
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

    await db.ministry.create({
      data: {
        ...result.data,
        imageUrl: result.data.imageUrl || null,
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

    await db.ministry.update({
      where: { id: ministryId },
      data: {
        ...result.data,
        imageUrl: result.data.imageUrl || null,
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

  return { ok: false, formError: "Unknown action." };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-sans text-red-600">{message}</p>;
}

function MinistryRow({
  ministry,
}: {
  ministry: MinistryData;
}) {
  const updateFetcher = useFetcher<MinistryActionData>();
  const deleteFetcher = useFetcher<MinistryActionData>();

  const updateErrors =
    updateFetcher.data &&
    !updateFetcher.data.ok &&
    updateFetcher.data.intent === "update" &&
    updateFetcher.data.ministryId === ministry.id
      ? updateFetcher.data.errors
      : undefined;

  const isSaving = updateFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-sans font-bold text-gray-900">{ministry.name}</p>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-sans font-bold border",
                ministry.isActive
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500",
              ].join(" ")}
            >
              {ministry.isActive ? "Visible" : "Hidden"}
            </span>
          </div>
          <p className="mt-1 text-xs font-sans text-gray-500">Led by {ministry.leader}</p>
          <p className="mt-3 text-sm font-sans leading-6 text-gray-600">
            {ministry.description}
          </p>
          <p className="mt-3 text-xs font-sans text-gray-400">
            Order #{ministry.sortOrder} · Created{" "}
            {new Date(ministry.createdAt).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </td>
      <td className="px-4 py-4">
        <updateFetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="ministryId" value={ministry.id} />

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <input
                type="text"
                name="name"
                defaultValue={ministry.name}
                placeholder="Ministry name"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.name?.[0]} />
            </div>

            <div>
              <input
                type="text"
                name="leader"
                defaultValue={ministry.leader}
                placeholder="Leader name"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.leader?.[0]} />
            </div>

            <div className="md:col-span-2">
              <textarea
                name="description"
                rows={4}
                defaultValue={ministry.description}
                placeholder="Describe this ministry"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.description?.[0]} />
            </div>

            <div>
              <input
                type="url"
                name="imageUrl"
                defaultValue={ministry.imageUrl ?? ""}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.imageUrl?.[0]} />
            </div>

            <div>
              <input
                type="number"
                min="0"
                step="1"
                name="sortOrder"
                defaultValue={ministry.sortOrder}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={updateErrors?.sortOrder?.[0]} />
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-red-700 px-4 py-2 text-xs font-sans font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
            {updateFetcher.data && !updateFetcher.data.ok && updateFetcher.data.formError ? (
              <p className="text-xs font-sans text-red-600">{updateFetcher.data.formError}</p>
            ) : null}
            {updateFetcher.data?.ok && updateFetcher.data.ministryId === ministry.id ? (
              <p className="text-xs font-sans text-green-600">Ministry updated.</p>
            ) : null}
          </div>
        </updateFetcher.Form>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-sans text-gray-500">
            Delete removes this ministry from the public page and the admin list.
          </p>
          <deleteFetcher.Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="ministryId" value={ministry.id} />
            <button
              type="submit"
              disabled={isDeleting}
              onClick={(event) => {
                if (!confirm(`Delete "${ministry.name}"?`)) {
                  event.preventDefault();
                }
              }}
              className="rounded-lg border border-red-200 px-4 py-2 text-xs font-sans font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </deleteFetcher.Form>
          {deleteFetcher.data && !deleteFetcher.data.ok && deleteFetcher.data.formError ? (
            <p className="text-xs font-sans text-red-600">{deleteFetcher.data.formError}</p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function AdminMinistriesPage() {
  const { ministries } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<MinistryActionData>();
  const createFormRef = useRef<HTMLFormElement>(null);

  const createErrors =
    createFetcher.data && !createFetcher.data.ok && createFetcher.data.intent === "create"
      ? createFetcher.data.errors
      : undefined;

  useEffect(() => {
    if (createFetcher.state === "idle" && createFetcher.data?.ok && createFetcher.data.intent === "create") {
      createFormRef.current?.reset();
    }
  }, [createFetcher.state, createFetcher.data]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">Ministries</h1>
          <p className="mt-1 text-sm font-sans text-gray-500">
            Add, edit, hide, and delete ministries that appear on the public ministries page.
          </p>
        </div>
        <div className="rounded-full bg-red-50 px-4 py-2 text-xs font-sans font-bold uppercase tracking-[0.14em] text-red-700">
          {ministries.length} total ministries
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="font-serif text-xl font-bold text-gray-900">Add Ministry</h2>
          <p className="mt-1 text-sm font-sans text-gray-500">
            Common starter ministries are added automatically the first time this page is opened.
          </p>
        </div>

        <createFetcher.Form ref={createFormRef} method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Ministry Name
              </label>
              <input
                type="text"
                name="name"
                placeholder="Example: Couples Ministry"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.name?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Ministry Leader
              </label>
              <input
                type="text"
                name="leader"
                placeholder="Leader name"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.leader?.[0]} />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                placeholder="What does this ministry do?"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.description?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Image URL
              </label>
              <input
                type="url"
                name="imageUrl"
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.imageUrl?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                step="1"
                name="sortOrder"
                defaultValue={ministries.length + 1}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <FieldError message={createErrors?.sortOrder?.[0]} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-sans text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
            />
            Show this ministry on the public ministries page
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createFetcher.state !== "idle"}
              className="rounded-lg bg-red-700 px-5 py-3 text-sm font-sans font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              {createFetcher.state !== "idle" ? "Creating..." : "Add Ministry"}
            </button>
            {createFetcher.data?.ok ? (
              <p className="text-sm font-sans text-green-600">Ministry created.</p>
            ) : null}
            {createFetcher.data && !createFetcher.data.ok && createFetcher.data.formError ? (
              <p className="text-sm font-sans text-red-600">{createFetcher.data.formError}</p>
            ) : null}
          </div>
        </createFetcher.Form>
      </section>

      {ministries.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm" aria-label="Ministry management">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Overview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Manage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Delete
                  </th>
                </tr>
              </thead>
              <tbody>
                {ministries.map((ministry) => (
                  <MinistryRow key={ministry.id} ministry={ministry} />
                ))}
              </tbody>
            </table>
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
