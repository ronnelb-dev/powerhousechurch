// app/routes/portal/admin/members.tsx
// Admin member management: search, edit role, assign cell group, deactivate.

import {
  useLoaderData,
  useFetcher,
  Form,
  Link,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";

export const meta: MetaFunction = () => [
  { title: "Manage Members — Admin" },
];

const PER_PAGE = 25;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url    = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where = search
    ? {
        OR: [
          { firstName: { contains: search } },
          { lastName:  { contains: search } },
          { email:     { contains: search } },
        ],
      }
    : {};

  const [members, total, cellGroups] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true,
        isActive: true, createdAt: true,
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
    members: members.map((m) => ({
      ...m,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    cellGroups,
    search,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent   = formData.get("intent") as string;
  const userId   = formData.get("userId") as string;

  if (intent === "updateRole") {
    const role = formData.get("role") as string;
    if (!["ADMIN", "CELL_LEADER", "MEMBER"].includes(role)) {
      return { error: "Invalid role." };
    }
    await db.user.update({ where: { id: userId }, data: { role } });
    return { success: true };
  }

  if (intent === "assignCellGroup") {
    const cellGroupId = formData.get("cellGroupId") as string;
    await db.user.update({
      where: { id: userId },
      data:  { cellGroupId: cellGroupId || null },
    });
    return { success: true };
  }

  if (intent === "toggleActive") {
    const current = await db.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (!current) return { error: "User not found." };
    await db.user.update({
      where: { id: userId },
      data:  { isActive: !current.isActive },
    });
    return { success: true };
  }

  return { error: "Unknown intent." };
}

const ROLE_OPTIONS = [
  { value: "MEMBER",      label: "Member"      },
  { value: "CELL_LEADER", label: "Cell Leader" },
  { value: "ADMIN",       label: "Admin"       },
];

function MemberRow({
  member,
  cellGroups,
}: {
  member: ReturnType<typeof useLoaderData<typeof loader>>["members"][0];
  cellGroups: { id: string; name: string }[];
}) {
  const fetcher = useFetcher();

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50 transition-colors
                    ${!member.isActive ? "opacity-50" : ""}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100
                          flex items-center justify-center text-xs font-bold
                          text-red-700 font-sans flex-shrink-0">
            {member.firstName[0]}{member.lastName[0]}
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

      {/* Role selector */}
      <td className="py-3 px-4">
        <fetcher.Form method="post">
          <input type="hidden" name="intent"  value="updateRole" />
          <input type="hidden" name="userId"  value={member.id} />
          <select
            name="role"
            defaultValue={member.role}
            onChange={(e) => fetcher.submit(e.currentTarget.form!)}
            className="text-xs font-sans border border-gray-200 rounded-lg px-2 py-1.5
                       bg-white text-gray-700 cursor-pointer focus:outline-none
                       focus:ring-2 focus:ring-red-300"
            aria-label={`Change role for ${member.firstName} ${member.lastName}`}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </fetcher.Form>
      </td>

      {/* Cell group selector */}
      <td className="py-3 px-4">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="assignCellGroup" />
          <input type="hidden" name="userId" value={member.id} />
          <select
            name="cellGroupId"
            defaultValue={member.cellGroup?.id ?? ""}
            onChange={(e) => fetcher.submit(e.currentTarget.form!)}
            className="text-xs font-sans border border-gray-200 rounded-lg px-2 py-1.5
                       bg-white text-gray-700 cursor-pointer focus:outline-none
                       focus:ring-2 focus:ring-red-300"
            aria-label={`Assign cell group for ${member.firstName} ${member.lastName}`}
          >
            <option value="">Unassigned</option>
            {cellGroups.map((cg) => (
              <option key={cg.id} value={cg.id}>{cg.name}</option>
            ))}
          </select>
        </fetcher.Form>
      </td>

      {/* Join date */}
      <td className="py-3 px-4 text-xs text-gray-400 font-sans">
        {new Date(member.createdAt).toLocaleDateString("en-PH", {
          month: "short", day: "numeric", year: "numeric",
        })}
      </td>

      {/* Activate / Deactivate */}
      <td className="py-3 px-4">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="toggleActive" />
          <input type="hidden" name="userId" value={member.id} />
          <button
            type="submit"
            className={[
              "text-xs font-sans font-bold px-3 py-1.5 rounded-lg border transition-all",
              "focus:outline-none focus:ring-2",
              member.isActive
                ? "text-red-600 border-red-200 hover:bg-red-50 focus:ring-red-300"
                : "text-green-600 border-green-200 hover:bg-green-50 focus:ring-green-300",
            ].join(" ")}
          >
            {member.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </fetcher.Form>
      </td>
    </tr>
  );
}

export default function AdminMembersPage() {
  const { members, total, page, totalPages, cellGroups, search } =
    useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">
            Members
          </h1>
          <p className="text-sm text-gray-400 font-sans">{total} total members</p>
        </div>
        <Link
          to="/auth/register"
          className="px-4 py-2.5 bg-red-700 text-white font-sans font-bold text-sm
                     rounded-lg hover:bg-red-800 transition-colors focus:outline-none
                     focus:ring-2 focus:ring-red-400"
        >
          + Add Member
        </Link>
      </div>

      {/* Search */}
      <Form method="get" className="mb-6 flex gap-3">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="flex-1 px-4 py-2.5 text-sm font-sans border border-gray-200
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          aria-label="Search members"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-red-700 text-white text-sm font-bold font-sans
                     rounded-lg hover:bg-red-800 transition-colors"
        >
          Search
        </button>
        {search && (
          <Link
            to="/portal/admin/members"
            className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700
                       border border-gray-200 rounded-lg transition-colors"
          >
            Clear
          </Link>
        )}
      </Form>

      {/* Table */}
      {members.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Member list">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-sans font-bold
                                 uppercase tracking-widest text-gray-400">
                    Member
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-sans font-bold
                                 uppercase tracking-widest text-gray-400">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-sans font-bold
                                 uppercase tracking-widest text-gray-400">
                    Cell Group
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-sans font-bold
                                 uppercase tracking-widest text-gray-400">
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="members"
          title="No members found"
          message={search ? "Try a different search term." : "No members registered yet."}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Members pagination">
          {page > 1 && (
            <Link
              to={`/portal/admin/members?search=${search}&page=${page - 1}`}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-sans
                         font-bold text-gray-600 hover:border-red-300 hover:text-red-700
                         transition-all"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-gray-400 font-sans px-3">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              to={`/portal/admin/members?search=${search}&page=${page + 1}`}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-sans
                         font-bold text-gray-600 hover:border-red-300 hover:text-red-700
                         transition-all"
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