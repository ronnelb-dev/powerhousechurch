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
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [{ title: "Manage Cell Groups - Admin" }];

type LoaderData = Awaited<ReturnType<typeof loader>>;
type CellGroupData = LoaderData["cellGroups"][number];
type LeadersData = LoaderData["leaders"];
type CellGroupActionData = {
  ok: boolean;
  intent?: FormDataEntryValue | null;
  cellGroupId?: string;
  formError?: string;
  errors?: Record<string, string[] | undefined>;
};

const cellGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
  leaderId: z.string().trim().min(1, "Please choose a leader."),
  meetingDay: z.string().trim().max(40, "Meeting day is too long.").optional(),
  meetingTime: z.string().trim().max(40, "Meeting time is too long.").optional(),
  barangay: z.string().trim().max(80, "Area is too long.").optional(),
  isActive: z.boolean(),
});

function normalizeField(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : undefined;
}

function parseCellGroupForm(formData: FormData) {
  return cellGroupSchema.safeParse({
    name: formData.get("name"),
    leaderId: formData.get("leaderId"),
    meetingDay: normalizeField(formData.get("meetingDay")),
    meetingTime: normalizeField(formData.get("meetingTime")),
    barangay: normalizeField(formData.get("barangay")),
    isActive: formData.get("isActive") === "on",
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const [cellGroups, leaders] = await Promise.all([
    db.cellGroup.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        leaderId: true,
        meetingDay: true,
        meetingTime: true,
        barangay: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            attendance: true,
            posts: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: { isActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
      },
    }),
  ]);

  const leaderMap = new Map(
    leaders.map((leader) => [
      leader.id,
      `${leader.firstName} ${leader.lastName}`,
    ]),
  );

  return {
    cellGroups: cellGroups.map((group) => ({
      ...group,
      createdAt:
        group.createdAt instanceof Date
          ? group.createdAt.toISOString()
          : group.createdAt,
      leaderName: leaderMap.get(group.leaderId) ?? "Former member",
    })),
    leaders,
  };
}

async function findDuplicateCellGroup(args: {
  name: string;
  excludeId?: string;
}) {
  const { name, excludeId } = args;
  return db.cellGroup.findFirst({
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
    const result = parseCellGroupForm(formData);
    if (!result.success) {
      return {
        ok: false,
        intent,
        errors: result.error.flatten().fieldErrors,
      };
    }

    const leader = await db.user.findUnique({
      where: { id: result.data.leaderId },
      select: { id: true, isActive: true },
    });

    if (!leader?.isActive) {
      return {
        ok: false,
        intent,
        errors: { leaderId: ["Selected leader is no longer active."] },
      };
    }

    const duplicateCellGroup = await findDuplicateCellGroup({
      name: result.data.name,
    });

    if (duplicateCellGroup) {
      return {
        ok: false,
        intent,
        errors: { name: [`A cell group named "${duplicateCellGroup.name}" already exists.`] },
      };
    }

    await db.cellGroup.create({
      data: {
        ...result.data,
        leaderId: leader.id,
      },
    });

    return { ok: true, intent };
  }

  if (intent === "update") {
    const cellGroupId = formData.get("cellGroupId");
    if (typeof cellGroupId !== "string" || !cellGroupId) {
      return { ok: false, intent, formError: "Cell group not found." };
    }

    const result = parseCellGroupForm(formData);
    if (!result.success) {
      return {
        ok: false,
        intent,
        cellGroupId,
        errors: result.error.flatten().fieldErrors,
      };
    }

    const leader = await db.user.findUnique({
      where: { id: result.data.leaderId },
      select: { id: true, isActive: true },
    });

    if (!leader?.isActive) {
      return {
        ok: false,
        intent,
        cellGroupId,
        errors: { leaderId: ["Selected leader is no longer active."] },
      };
    }

    const duplicateCellGroup = await findDuplicateCellGroup({
      name: result.data.name,
      excludeId: cellGroupId,
    });

    if (duplicateCellGroup) {
      return {
        ok: false,
        intent,
        cellGroupId,
        errors: { name: [`A cell group named "${duplicateCellGroup.name}" already exists.`] },
      };
    }

    await db.cellGroup.update({
      where: { id: cellGroupId },
      data: {
        ...result.data,
        leaderId: leader.id,
      },
    });

    return { ok: true, intent, cellGroupId };
  }

  if (intent === "delete") {
    const cellGroupId = formData.get("cellGroupId");
    if (typeof cellGroupId !== "string" || !cellGroupId) {
      return { ok: false, intent, formError: "Cell group not found." };
    }

    const existing = await db.cellGroup.findUnique({
      where: { id: cellGroupId },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false, intent, formError: "Cell group not found." };
    }

    await db.$transaction([
      db.user.updateMany({
        where: { cellGroupId },
        data: { cellGroupId: null },
      }),
      db.attendance.updateMany({
        where: { cellGroupId },
        data: { cellGroupId: null },
      }),
      db.post.updateMany({
        where: { cellGroupId },
        data: { cellGroupId: null },
      }),
      db.cellGroup.delete({
        where: { id: cellGroupId },
      }),
    ]);

    return { ok: true, intent, cellGroupId };
  }

  return { ok: false, formError: "Unknown action." };
}

function FieldError({
  message,
}: {
  message?: string;
}) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-sans text-red-600">{message}</p>;
}

function CellGroupEditor({
  cellGroup,
  leaders,
  layout = "desktop",
}: {
  cellGroup: CellGroupData;
  leaders: LeadersData;
  layout?: "desktop" | "mobile";
}) {
  const updateFetcher = useFetcher<CellGroupActionData>();
  const deleteFetcher = useFetcher<CellGroupActionData>();

  const updateErrors =
    updateFetcher.data &&
    !updateFetcher.data.ok &&
    updateFetcher.data.intent === "update" &&
    updateFetcher.data.cellGroupId === cellGroup.id
      ? updateFetcher.data.errors
      : undefined;

  const isSaving = updateFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";
  const isMobile = layout === "mobile";

  return (
    <div className="space-y-3">
      <updateFetcher.Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="update" />
        <input type="hidden" name="cellGroupId" value={cellGroup.id} />

        <div>
          <label className="mb-1 block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
            Group Name
          </label>
          <input
            type="text"
            name="name"
            defaultValue={cellGroup.name}
            placeholder="Cell group name"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <FieldError message={updateErrors?.name?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
            Leader
          </label>
          <select
            name="leaderId"
            defaultValue={cellGroup.leaderId}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.firstName} {leader.lastName} ({leader.role})
              </option>
            ))}
          </select>
          <FieldError message={updateErrors?.leaderId?.[0]} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
              Meeting Day
            </label>
            <input
              type="text"
              name="meetingDay"
              defaultValue={cellGroup.meetingDay ?? ""}
              placeholder="Meeting day"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <FieldError message={updateErrors?.meetingDay?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
              Meeting Time
            </label>
            <input
              type="text"
              name="meetingTime"
              defaultValue={cellGroup.meetingTime ?? ""}
              placeholder="Meeting time"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <FieldError message={updateErrors?.meetingTime?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
              Area / Barangay
            </label>
            <input
              type="text"
              name="barangay"
              defaultValue={cellGroup.barangay ?? ""}
              placeholder="Area / barangay"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <FieldError message={updateErrors?.barangay?.[0]} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-sans font-bold text-gray-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={cellGroup.isActive}
            className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
          />
          Active and visible in the public directory
        </label>

        <div className={`flex gap-2 ${isMobile ? "flex-col" : "flex-row items-center"}`}>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-red-700 px-4 py-2.5 text-xs font-sans font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>

          <deleteFetcher.Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="cellGroupId" value={cellGroup.id} />
            <button
              type="submit"
              disabled={isDeleting}
              className="rounded-lg border border-red-200 px-4 py-2.5 text-xs font-sans font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </deleteFetcher.Form>
        </div>

        {updateFetcher.data && !updateFetcher.data.ok && updateFetcher.data.formError ? (
          <p className="text-xs font-sans text-red-600">{updateFetcher.data.formError}</p>
        ) : null}
        {updateFetcher.data?.ok && updateFetcher.data.cellGroupId === cellGroup.id ? (
          <p className="text-xs font-sans text-green-600">Cell group updated.</p>
        ) : null}
        {deleteFetcher.data && !deleteFetcher.data.ok && deleteFetcher.data.formError ? (
          <p className="text-xs font-sans text-red-600">{deleteFetcher.data.formError}</p>
        ) : null}
      </updateFetcher.Form>
    </div>
  );
}

function CellGroupRow({
  cellGroup,
  leaders,
}: {
  cellGroup: CellGroupData;
  leaders: LeadersData;
}) {
  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="px-4 py-4">
        <div>
          <p className="text-sm font-sans font-bold text-gray-900">{cellGroup.name}</p>
          <p className="mt-1 text-xs font-sans text-gray-500">
            Created{" "}
            {new Date(cellGroup.createdAt).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="mt-2 text-xs font-sans text-gray-500">
            {cellGroup._count.members} members, {cellGroup._count.attendance} attendance{" "}
            records, {cellGroup._count.posts} posts
          </p>
        </div>
      </td>
      <td className="px-4 py-4">
        <CellGroupEditor cellGroup={cellGroup} leaders={leaders} />
      </td>
      <td className="px-4 py-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-sans font-bold text-gray-800">{cellGroup.leaderName}</p>
          <p className="mt-1 text-xs font-sans text-gray-500">
            {cellGroup.isActive ? "Active" : "Inactive"}
          </p>
          <p className="mt-3 text-xs font-sans text-gray-500">
            Deleting a cell group removes its member, post, and attendance links so the rest of the data stays intact.
          </p>
        </div>
      </td>
    </tr>
  );
}

function CellGroupMobileCard({
  cellGroup,
  leaders,
}: {
  cellGroup: CellGroupData;
  leaders: LeadersData;
}) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-sans font-bold text-gray-900">{cellGroup.name}</h3>
          <p className="mt-1 text-xs font-sans text-gray-500">
            Created{" "}
            {new Date(cellGroup.createdAt).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-sans font-bold uppercase tracking-[0.12em] ${
            cellGroup.isActive
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {cellGroup.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-sans sm:grid-cols-4">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-gray-400">Members</p>
          <p className="mt-1 font-bold text-gray-800">{cellGroup._count.members}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-gray-400">Attendance</p>
          <p className="mt-1 font-bold text-gray-800">{cellGroup._count.attendance}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-gray-400">Posts</p>
          <p className="mt-1 font-bold text-gray-800">{cellGroup._count.posts}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-gray-400">Leader</p>
          <p className="mt-1 font-bold text-gray-800">{cellGroup.leaderName}</p>
        </div>
      </div>

      <p className="mt-4 text-xs font-sans leading-5 text-gray-500">
        Deleting a cell group removes its member, post, and attendance links so the rest of the data stays intact.
      </p>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <CellGroupEditor cellGroup={cellGroup} leaders={leaders} layout="mobile" />
      </div>
    </article>
  );
}

export default function AdminCellGroupsPage() {
  const { cellGroups, leaders } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<CellGroupActionData>();
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
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">Cell Groups</h1>
          <p className="mt-1 text-sm font-sans text-gray-500">
            Add, update, and remove groups from one place.
          </p>
        </div>
        <div className="w-fit rounded-full bg-red-50 px-4 py-2 text-xs font-sans font-bold uppercase tracking-[0.14em] text-red-700">
          {cellGroups.length} total groups
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="font-serif text-xl font-bold text-gray-900">Add Cell Group</h2>
          <p className="mt-1 text-sm font-sans text-gray-500">
            Choose a leader, set the meeting details, and decide whether it should appear publicly.
          </p>
        </div>

        {leaders.length === 0 ? (
          <EmptyState
            icon="members"
            title="No active leaders available"
            message="Create or reactivate a member first so you can assign them as a cell group leader."
          />
        ) : (
          <createFetcher.Form ref={createFormRef} method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Group Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Example: Northside Friday Fellowship"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <FieldError message={createErrors?.name?.[0]} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Leader
                </label>
                <select
                  name="leaderId"
                  defaultValue=""
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="" disabled>
                    Select a leader
                  </option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.firstName} {leader.lastName} ({leader.role})
                    </option>
                  ))}
                </select>
                <FieldError message={createErrors?.leaderId?.[0]} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Meeting Day
                </label>
                <input
                  type="text"
                  name="meetingDay"
                  placeholder="Friday"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <FieldError message={createErrors?.meetingDay?.[0]} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Meeting Time
                </label>
                <input
                  type="text"
                  name="meetingTime"
                  placeholder="6:30 PM"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <FieldError message={createErrors?.meetingTime?.[0]} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                  Area / Barangay
                </label>
                <input
                  type="text"
                  name="barangay"
                  placeholder="Poblacion"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <FieldError message={createErrors?.barangay?.[0]} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-sans text-gray-700">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
              />
              Publish this group in the public cell group directory
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={createFetcher.state !== "idle"}
                className="rounded-lg bg-red-700 px-5 py-3 text-sm font-sans font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
              >
                {createFetcher.state !== "idle" ? "Creating..." : "Add Cell Group"}
              </button>
              {createFetcher.data?.ok ? (
                <p className="text-sm font-sans text-green-600">Cell group created.</p>
              ) : null}
              {createFetcher.data && !createFetcher.data.ok && createFetcher.data.formError ? (
                <p className="text-sm font-sans text-red-600">{createFetcher.data.formError}</p>
              ) : null}
            </div>
          </createFetcher.Form>
        )}
      </section>

      {cellGroups.length > 0 ? (
        <>
          <section className="space-y-4 lg:hidden">
            {cellGroups.map((cellGroup) => (
              <CellGroupMobileCard
                key={cellGroup.id}
                cellGroup={cellGroup}
                leaders={leaders}
              />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm" aria-label="Cell group management">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Overview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Manage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {cellGroups.map((cellGroup) => (
                  <CellGroupRow
                    key={cellGroup.id}
                    cellGroup={cellGroup}
                    leaders={leaders}
                  />
                ))}
              </tbody>
            </table>
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          icon="members"
          title="No cell groups yet"
          message="Create your first group above and it will appear here for ongoing management."
        />
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <EmptyState
      icon="members"
      title="Cell groups unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh the page."}
    />
  );
}
