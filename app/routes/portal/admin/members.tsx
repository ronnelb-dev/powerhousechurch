// app/routes/portal/admin/members.tsx
// Admin member management with bulk reassignment, attendance marking, and CSV export.

import { useEffect, useRef, useState } from "react";
import {
  useLoaderData,
  useFetcher,
  Form,
  Link,
  isRouteErrorResponse,
  useRouteError,
  useActionData,
  useNavigation,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import type { Prisma } from "@prisma/client";
import { PendingButton } from "~/components/ui/PendingButton";
import { useToast } from "~/components/ui/ToastProvider";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Manage Members — Admin" },
];

const PER_PAGE = 25;

function buildMembersWhere({
  search,
  cellGroupId,
  activeStatus,
}: {
  search: string;
  cellGroupId: string;
  activeStatus: string;
}): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (cellGroupId === "unassigned") {
    where.cellGroupId = null;
  } else if (cellGroupId) {
    where.cellGroupId = cellGroupId;
  }

  if (activeStatus === "active") where.isActive = true;
  if (activeStatus === "inactive") where.isActive = false;

  return where;
}

function getSelectedUserIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("selectedUserIds")
        .map((value) => String(value))
        .filter(Boolean),
    ),
  );
}

function toCsvRow(values: Array<string | null | undefined>) {
  return values.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",");
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const cellGroupId = url.searchParams.get("cellGroupId") ?? "";
  const activeStatus = url.searchParams.get("activeStatus") ?? "active";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const where = buildMembersWhere({ search, cellGroupId, activeStatus });

  const [members, total, cellGroups] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        cellGroup: { select: { id: true, name: true } },
      },
    }),
    db.user.count({ where }),
    db.cellGroup.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    members: members.map((member) => ({
      ...member,
      createdAt:
        member.createdAt instanceof Date
          ? member.createdAt.toISOString()
          : member.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    cellGroups,
    filters: {
      search,
      cellGroupId,
      activeStatus,
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (intent === "updateRole") {
    const role = String(formData.get("role") ?? "");
    if (!["ADMIN", "CELL_LEADER", "MEMBER"].includes(role)) {
      return { error: "Invalid role." };
    }
    await db.user.update({ where: { id: userId }, data: { role } });
    return { success: "Role updated." };
  }

  if (intent === "assignCellGroup") {
    const cellGroupId = String(formData.get("cellGroupId") ?? "");
    await db.user.update({
      where: { id: userId },
      data: { cellGroupId: cellGroupId || null },
    });
    return { success: "Cell group updated." };
  }

  if (intent === "toggleActive") {
    const current = await db.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (!current) return { error: "User not found." };
    await db.user.update({
      where: { id: userId },
      data: { isActive: !current.isActive },
    });
    return { success: "Member status updated." };
  }

  if (intent === "bulkAssignCellGroup") {
    const selectedUserIds = getSelectedUserIds(formData);
    const targetCellGroupId = String(formData.get("bulkCellGroupId") ?? "");

    if (selectedUserIds.length === 0) {
      return { error: "Select at least one member first." };
    }

    await db.user.updateMany({
      where: { id: { in: selectedUserIds } },
      data: { cellGroupId: targetCellGroupId || null },
    });

    return {
      success: `Reassigned ${selectedUserIds.length} member${selectedUserIds.length === 1 ? "" : "s"}.`,
    };
  }

  if (intent === "bulkMarkPresent") {
    const selectedUserIds = getSelectedUserIds(formData);
    const date = String(formData.get("attendanceDate") ?? "");
    const type = String(formData.get("attendanceType") ?? "SUNDAY_SERVICE");

    if (selectedUserIds.length === 0) {
      return { error: "Select at least one member first." };
    }

    if (!["SUNDAY_SERVICE", "CELL_GROUP"].includes(type)) {
      return { error: "Invalid attendance type." };
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    if (!date || Number.isNaN(selectedDate.getTime())) {
      return { error: "Choose a valid attendance date." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      return { error: "Cannot mark attendance for a future date." };
    }

    const members = await db.user.findMany({
      where: { id: { in: selectedUserIds } },
      select: { id: true, cellGroupId: true },
    });

    if (members.length !== selectedUserIds.length) {
      return { error: "Some selected members could not be found." };
    }

    await db.$transaction(
      members.map((member) =>
        db.attendance.upsert({
          where: {
            userId_type_date: {
              userId: member.id,
              type,
              date: selectedDate,
            },
          },
          update: {
            status: "PRESENT",
            markedById: user.id,
          },
          create: {
            userId: member.id,
            type,
            status: "PRESENT",
            date: selectedDate,
            markedById: user.id,
            cellGroupId: member.cellGroupId ?? undefined,
          },
        }),
      ),
    );

    return {
      success: `Marked ${members.length} member${members.length === 1 ? "" : "s"} present.`,
    };
  }

  if (intent === "bulkExportMembers") {
    const selectedUserIds = getSelectedUserIds(formData);
    const search = String(formData.get("search") ?? "");
    const cellGroupId = String(formData.get("filterCellGroupId") ?? "");
    const activeStatus = String(formData.get("activeStatus") ?? "active");

    const where: Prisma.UserWhereInput =
      selectedUserIds.length > 0
        ? { id: { in: selectedUserIds } }
        : buildMembersWhere({ search, cellGroupId, activeStatus });

    const members = await db.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        cellGroup: { select: { name: true } },
      },
    });

    const csv = [
      "Last Name,First Name,Email,Phone,Role,Status,Cell Group,Joined",
      ...members.map((member) =>
        toCsvRow([
          member.lastName,
          member.firstName,
          member.email,
          member.phone,
          member.role,
          member.isActive ? "Active" : "Inactive",
          member.cellGroup?.name ?? "Unassigned",
          member.createdAt.toISOString().slice(0, 10),
        ]),
      ),
    ].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="members-export.csv"',
      },
    });
  }

  return { error: "Unknown intent." };
}

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "CELL_LEADER", label: "Cell Leader" },
  { value: "ADMIN", label: "Admin" },
];

function MemberRow({
  member,
  cellGroups,
  checked,
  onCheckedChange,
}: {
  member: ReturnType<typeof useLoaderData<typeof loader>>["members"][0];
  cellGroups: { id: string; name: string }[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const fetcher = useFetcher();
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || typeof fetcher.data !== "object") {
      return;
    }

    const message =
      "error" in fetcher.data && fetcher.data.error
        ? fetcher.data.error
        : "success" in fetcher.data && fetcher.data.success
        ? fetcher.data.success
        : null;

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: "error" in fetcher.data && fetcher.data.error ? "error" : "success",
      message,
    });
  }, [fetcher.data, fetcher.state, showToast]);

  return (
    <tr
      className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${
        !member.isActive ? "opacity-50" : ""
      }`}
    >
      <td className="py-3 px-4 align-top">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.currentTarget.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
          aria-label={`Select ${member.firstName} ${member.lastName}`}
        />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
                       border border-red-100 bg-red-50 font-sans text-xs font-bold text-red-700"
          >
            {member.firstName[0]}
            {member.lastName[0]}
          </div>
          <div>
            <p className="text-sm font-sans font-bold text-gray-800">
              {member.firstName} {member.lastName}
            </p>
            <p className="text-xs text-gray-400 font-sans">
              {member.email ?? member.phone ?? "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="updateRole" />
          <input type="hidden" name="userId" value={member.id} />
          <select
            name="role"
            defaultValue={member.role}
            onChange={(event) => fetcher.submit(event.currentTarget.form!)}
            disabled={fetcher.state !== "idle"}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs
                       text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
            aria-label={`Change role for ${member.firstName} ${member.lastName}`}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </fetcher.Form>
      </td>
      <td className="py-3 px-4">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="assignCellGroup" />
          <input type="hidden" name="userId" value={member.id} />
          <select
            name="cellGroupId"
            defaultValue={member.cellGroup?.id ?? ""}
            onChange={(event) => fetcher.submit(event.currentTarget.form!)}
            disabled={fetcher.state !== "idle"}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs
                       text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
            aria-label={`Assign cell group for ${member.firstName} ${member.lastName}`}
          >
            <option value="">Unassigned</option>
            {cellGroups.map((cellGroup) => (
              <option key={cellGroup.id} value={cellGroup.id}>
                {cellGroup.name}
              </option>
            ))}
          </select>
        </fetcher.Form>
      </td>
      <td className="py-3 px-4 text-xs text-gray-400 font-sans">
        {new Date(member.createdAt).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </td>
      <td className="py-3 px-4">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="toggleActive" />
          <input type="hidden" name="userId" value={member.id} />
          <PendingButton
            type="submit"
            isPending={fetcher.state !== "idle"}
            pendingText={member.isActive ? "Updating..." : "Restoring..."}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs font-sans font-bold transition-all",
              "focus:outline-none focus:ring-2",
              member.isActive
                ? "border-red-200 text-red-600 hover:bg-red-50 focus:ring-red-300"
                : "border-green-200 text-green-600 hover:bg-green-50 focus:ring-green-300",
            ].join(" ")}
          >
            {member.isActive ? "Deactivate" : "Reactivate"}
          </PendingButton>
        </fetcher.Form>
      </td>
    </tr>
  );
}

function MemberMobileCard({
  member,
  cellGroups,
  checked,
  onCheckedChange,
}: {
  member: ReturnType<typeof useLoaderData<typeof loader>>["members"][0];
  cellGroups: { id: string; name: string }[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const fetcher = useFetcher();
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || typeof fetcher.data !== "object") {
      return;
    }

    const message =
      "error" in fetcher.data && fetcher.data.error
        ? fetcher.data.error
        : "success" in fetcher.data && fetcher.data.success
        ? fetcher.data.success
        : null;

    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: "error" in fetcher.data && fetcher.data.error ? "error" : "success",
      message,
    });
  }, [fetcher.data, fetcher.state, showToast]);

  return (
    <article
      className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${
        !member.isActive ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.currentTarget.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
          aria-label={`Select ${member.firstName} ${member.lastName}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full
                         border border-red-100 bg-red-50 font-sans text-xs font-bold text-red-700"
            >
              {member.firstName[0]}
              {member.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="break-words text-sm font-sans font-bold text-gray-800">
                {member.firstName} {member.lastName}
              </p>
              <p className="mt-1 break-all text-xs font-sans text-gray-400">
                {member.email ?? member.phone ?? "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-sans font-bold uppercase tracking-[0.12em] ${
                    member.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {member.isActive ? "Active" : "Inactive"}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-600">
                  Joined{" "}
                  {new Date(member.createdAt).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <fetcher.Form method="post" className="space-y-1">
              <input type="hidden" name="intent" value="updateRole" />
              <input type="hidden" name="userId" value={member.id} />
              <label className="block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Role
              </label>
              <select
                name="role"
                defaultValue={member.role}
                onChange={(event) => fetcher.submit(event.currentTarget.form!)}
                disabled={fetcher.state !== "idle"}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm
                           text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
                aria-label={`Change role for ${member.firstName} ${member.lastName}`}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </fetcher.Form>

            <fetcher.Form method="post" className="space-y-1">
              <input type="hidden" name="intent" value="assignCellGroup" />
              <input type="hidden" name="userId" value={member.id} />
              <label className="block text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Cell Group
              </label>
              <select
                name="cellGroupId"
                defaultValue={member.cellGroup?.id ?? ""}
                onChange={(event) => fetcher.submit(event.currentTarget.form!)}
                disabled={fetcher.state !== "idle"}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm
                           text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
                aria-label={`Assign cell group for ${member.firstName} ${member.lastName}`}
              >
                <option value="">Unassigned</option>
                {cellGroups.map((cellGroup) => (
                  <option key={cellGroup.id} value={cellGroup.id}>
                    {cellGroup.name}
                  </option>
                ))}
              </select>
            </fetcher.Form>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="toggleActive" />
              <input type="hidden" name="userId" value={member.id} />
              <PendingButton
                type="submit"
                isPending={fetcher.state !== "idle"}
                pendingText={member.isActive ? "Updating..." : "Restoring..."}
                className={[
                  "w-full rounded-lg border px-3 py-2.5 text-sm font-sans font-bold transition-all",
                  "focus:outline-none focus:ring-2",
                  member.isActive
                    ? "border-red-200 text-red-600 hover:bg-red-50 focus:ring-red-300"
                    : "border-green-200 text-green-600 hover:bg-green-50 focus:ring-green-300",
                ].join(" ")}
              >
                {member.isActive ? "Deactivate Member" : "Reactivate Member"}
              </PendingButton>
            </fetcher.Form>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AdminMembersPage() {
  const { members, total, page, totalPages, cellGroups, filters } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const feedback =
    actionData && typeof actionData === "object" && ("error" in actionData || "success" in actionData)
      ? actionData
      : null;
  const { showToast } = useToast();
  const lastToastRef = useRef<string | null>(null);

  const isSubmitting = navigation.state === "submitting";
  const allOnPageSelected =
    members.length > 0 && members.every((member) => selectedIds.includes(member.id));
  const selectedCount = selectedIds.length;
  const today = new Date().toISOString().slice(0, 10);

  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.cellGroupId) query.set("cellGroupId", filters.cellGroupId);
  if (filters.activeStatus) query.set("activeStatus", filters.activeStatus);

  function toggleMember(memberId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, memberId] : current.filter((id) => id !== memberId),
    );
  }

  function toggleAllOnPage(checked: boolean) {
    setSelectedIds(checked ? members.map((member) => member.id) : []);
  }

  useEffect(() => {
    const message = feedback?.error ?? feedback?.success ?? null;
    if (!message || lastToastRef.current === message) {
      return;
    }

    lastToastRef.current = message;
    showToast({
      tone: feedback?.error ? "error" : "success",
      message,
    });
  }, [feedback, showToast]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-1 font-serif text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-400 font-sans">{total} matching members</p>
        </div>
        <Link
          to="/auth/register"
          className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white
                     transition-colors hover:bg-red-800 focus:outline-none focus:ring-2
                     focus:ring-red-400"
        >
          + Add Member
        </Link>
      </div>

      <Form method="get" className="mb-6 rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="Search by name or email…"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm
                       font-sans focus:outline-none focus:ring-2 focus:ring-red-300"
            aria-label="Search members"
          />
          <select
            name="cellGroupId"
            defaultValue={filters.cellGroupId}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm
                       font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            aria-label="Filter members by cell group"
          >
            <option value="">All cell groups</option>
            <option value="unassigned">Unassigned</option>
            {cellGroups.map((cellGroup) => (
              <option key={cellGroup.id} value={cellGroup.id}>
                {cellGroup.name}
              </option>
            ))}
          </select>
          <select
            name="activeStatus"
            defaultValue={filters.activeStatus}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm
                       font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            aria-label="Filter members by active status"
          >
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">Active and inactive</option>
          </select>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white
                         transition-colors hover:bg-red-800"
            >
              Filter
            </button>
            {(filters.search || filters.cellGroupId || filters.activeStatus !== "active") && (
              <Link
                to="/portal/admin/members"
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold
                           text-gray-500 transition-colors hover:text-gray-700"
              >
                Clear
              </Link>
            )}
          </div>
        </div>
      </Form>

      <Form method="post" className="mb-6 rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
        {selectedIds.map((memberId) => (
          <input key={memberId} type="hidden" name="selectedUserIds" value={memberId} />
        ))}
        <input type="hidden" name="search" value={filters.search} />
        <input type="hidden" name="filterCellGroupId" value={filters.cellGroupId} />
        <input type="hidden" name="activeStatus" value={filters.activeStatus} />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-gray-800">Bulk Actions</h2>
            <p className="text-sm text-gray-400 font-sans">
              {selectedCount > 0
                ? `${selectedCount} member${selectedCount === 1 ? "" : "s"} selected on this page.`
                : "Select members to reassign or mark present. Export uses the selection or the current filters."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={selectedCount === 0}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold
                       text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50"
          >
            Clear Selection
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              Mark All Present
            </p>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                name="attendanceDate"
                defaultValue={today}
                max={today}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm
                           font-sans focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <select
                name="attendanceType"
                defaultValue="SUNDAY_SERVICE"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm
                           font-sans text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="SUNDAY_SERVICE">Sunday Service</option>
                <option value="CELL_GROUP">Midweek Service</option>
              </select>
            </div>
            <PendingButton
              type="submit"
              name="intent"
              value="bulkMarkPresent"
              disabled={selectedCount === 0}
              isPending={isSubmitting}
              pendingText="Saving..."
              className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white
                         transition-colors hover:bg-red-800 disabled:opacity-50"
            >
              Mark Selected Present
            </PendingButton>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              Reassign Cell Group
            </p>
            <select
              name="bulkCellGroupId"
              defaultValue=""
              className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5
                         text-sm font-sans text-gray-700 focus:outline-none focus:ring-2
                         focus:ring-red-300"
            >
              <option value="">Unassigned</option>
              {cellGroups.map((cellGroup) => (
                <option key={cellGroup.id} value={cellGroup.id}>
                  {cellGroup.name}
                </option>
              ))}
            </select>
            <PendingButton
              type="submit"
              name="intent"
              value="bulkAssignCellGroup"
              disabled={selectedCount === 0}
              isPending={isSubmitting}
              pendingText="Updating..."
              className="w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm
                         font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Reassign Selected
            </PendingButton>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              Export Members
            </p>
            <p className="mb-3 text-sm text-gray-500 font-sans">
              Downloads selected members, or all members matching the current filters when nothing is selected.
            </p>
            <button
              type="submit"
              name="intent"
              value="bulkExportMembers"
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm
                         font-bold text-gray-700 transition-colors hover:border-red-300
                         hover:text-red-700"
            >
              Export CSV
            </button>
          </div>
        </div>
      </Form>

      {members.length > 0 ? (
        <>
          <section className="mb-4 rounded-xl border border-gray-100 bg-white p-4 lg:hidden">
            <label className="flex items-center gap-3 text-sm font-sans font-bold text-gray-700">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(event) => toggleAllOnPage(event.currentTarget.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
                aria-label="Select all members on this page"
              />
              Select all members on this page
            </label>
          </section>

          <div className="space-y-4 lg:hidden">
            {members.map((member) => (
              <MemberMobileCard
                key={member.id}
                member={member}
                cellGroups={cellGroups}
                checked={selectedIds.includes(member.id)}
                onCheckedChange={(checked) => toggleMember(member.id, checked)}
              />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white lg:block">
            <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Member list">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-3 px-4 text-left">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={(event) => toggleAllOnPage(event.currentTarget.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-300"
                      aria-label="Select all members on this page"
                    />
                  </th>
                  <th
                    className="py-3 px-4 text-left text-xs font-bold uppercase tracking-widest
                               text-gray-400"
                  >
                    Member
                  </th>
                  <th
                    className="py-3 px-4 text-left text-xs font-bold uppercase tracking-widest
                               text-gray-400"
                  >
                    Role
                  </th>
                  <th
                    className="py-3 px-4 text-left text-xs font-bold uppercase tracking-widest
                               text-gray-400"
                  >
                    Cell Group
                  </th>
                  <th
                    className="py-3 px-4 text-left text-xs font-bold uppercase tracking-widest
                               text-gray-400"
                  >
                    Joined
                  </th>
                  <th className="py-3 px-4" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    cellGroups={cellGroups}
                    checked={selectedIds.includes(member.id)}
                    onCheckedChange={(checked) => toggleMember(member.id, checked)}
                  />
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon="members"
          title="No members found"
          message={
            filters.search || filters.cellGroupId || filters.activeStatus !== "active"
              ? "Try adjusting your filters."
              : "No members registered yet."
          }
        />
      )}

      {totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-center gap-2"
          aria-label="Members pagination"
        >
          {page > 1 && (
            <Link
              to={`/portal/admin/members?${new URLSearchParams({
                ...Object.fromEntries(query.entries()),
                page: String(page - 1),
              }).toString()}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold
                         text-gray-600 transition-all hover:border-red-300 hover:text-red-700"
            >
              ← Prev
            </Link>
          )}
          <span className="px-3 text-sm text-gray-400 font-sans">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              to={`/portal/admin/members?${new URLSearchParams({
                ...Object.fromEntries(query.entries()),
                page: String(page + 1),
              }).toString()}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold
                         text-gray-600 transition-all hover:border-red-300 hover:text-red-700"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <EmptyState
      icon="members"
      title="Members unavailable"
      message={isRouteErrorResponse(error) ? error.data : "Please refresh."}
    />
  );
}
