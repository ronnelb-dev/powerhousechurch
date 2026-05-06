// app/routes/portal/directory.tsx
import {
  useLoaderData,
  Form,
  Link,
  useLocation,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import type { Prisma } from "@prisma/client";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { EmptyState } from "~/components/ui/EmptyState";
import {
  PortalHeader,
  PortalPage,
  PortalSection,
  portalButtonClasses,
} from "~/components/ui/Portal";

export const meta: MetaFunction = () => [
  { title: "Member Directory — Powerhouse Church Portal" },
];

const PER_PAGE = 20;

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  const url = new URL(request.url);

  const search = url.searchParams.get("search") ?? "";
  const cellGroupId = url.searchParams.get("cellGroupId") ?? "";
  const gender = url.searchParams.get("gender") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const where: Prisma.UserWhereInput = { isActive: true };

  if (cellGroupId === "UNASSIGNED") {
    where.cellGroupId = null;
  } else if (cellGroupId) {
    where.cellGroupId = cellGroupId;
  }

  if (gender) {
    where.gender = gender;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

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
        gender: true,
        role: true,
        email: true,
        phone: true,
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
      email: user.role === "ADMIN" ? member.email : null,
      phone: user.role === "ADMIN" ? member.phone : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
    cellGroups,
    filters: { search, cellGroupId, gender },
    isAdmin: user.role === "ADMIN",
  };
}

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  ADMIN: {
    label: "Admin",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  CELL_LEADER: {
    label: "Cell Leader",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  MEMBER: {
    label: "Member",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_LABELS[role] ?? ROLE_LABELS.MEMBER!;
  return (
    <span
      className={`text-xs font-sans font-bold border px-2.5 py-0.5 rounded-full ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function directoryPageUrl({
  filters,
  page,
}: {
  filters: ReturnType<typeof useLoaderData<typeof loader>>["filters"];
  page: number;
}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.cellGroupId) params.set("cellGroupId", filters.cellGroupId);
  if (filters.gender) params.set("gender", filters.gender);
  params.set("page", String(page));
  return `/portal/directory?${params.toString()}`;
}

export default function DirectoryPage() {
  const { members, total, page, totalPages, cellGroups, filters, isAdmin } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const location = useLocation();
  const isRefreshing =
    navigation.state === "loading" &&
    navigation.location?.pathname === location.pathname;

  return (
    <PortalPage className="max-w-4xl">
      <PortalHeader
        eyebrow="Members Portal"
        title="Member Directory"
        subtitle={`${total} ${total === 1 ? "member" : "members"} in the church family.`}
      />

      {/* Filters */}
      <PortalSection className="mb-5 p-4 sm:p-5">
        <Form method="get" className="flex flex-wrap gap-3" role="search">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="Search by name…"
            className="w-full pl-9 pr-4 py-2.5 text-sm font-sans border border-gray-200
                       rounded-lg bg-white text-gray-700 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
            aria-label="Search members"
          />
        </div>

        {/* Cell group */}
        <select
          name="cellGroupId"
          defaultValue={filters.cellGroupId}
          className="text-sm font-sans px-4 py-2.5 border border-gray-200
                     rounded-lg bg-white text-gray-700 focus:outline-none
                     focus:ring-2 focus:ring-red-300 cursor-pointer"
          aria-label="Filter by cell group"
        >
          <option value="">All Groups</option>
          {cellGroups.map((cg) => (
            <option key={cg.id} value={cg.id}>
              {cg.name}
            </option>
          ))}
          <option value="UNASSIGNED">Unassigned</option>
        </select>

        {/* Gender */}
        <select
          name="gender"
          defaultValue={filters.gender}
          className="text-sm font-sans px-4 py-2.5 border border-gray-200
                     rounded-lg bg-white text-gray-700 focus:outline-none
                     focus:ring-2 focus:ring-red-300 cursor-pointer"
          aria-label="Filter by gender"
        >
          <option value="">All Genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>

        <button
          type="submit"
          className={portalButtonClasses()}
        >
          Search
        </button>

        {(filters.search || filters.cellGroupId || filters.gender) && (
          <Link
            to="/portal/directory"
            className={portalButtonClasses({ variant: "ghost" })}
          >
            Clear ×
          </Link>
        )}
      </Form>
      </PortalSection>

      {/* Member list */}
      <div className="relative">
        {isRefreshing ? <DirectoryListSkeleton /> : null}
        {members.length > 0 ? (
          <PortalSection
            className={`overflow-hidden p-0 ${isRefreshing ? "pointer-events-none opacity-40" : ""}`}
          >
            <ul role="list" aria-label="Member list">
              {members.map((member, i) => {
                const initials = (member.firstName?.[0] ?? "") + (member.lastName?.[0] ?? "");
                return (
                  <li
                    key={member.id}
                    className={[
                      "flex items-center gap-4 px-5 py-4",
                      i < members.length - 1 ? "border-b border-gray-100" : "",
                    ].join(" ")}
                  >
                    <div
                      className="w-10 h-10 rounded-full bg-red-50 border border-red-100
                                 flex items-center justify-center text-sm font-bold
                                 text-red-700 font-sans flex-shrink-0"
                      aria-hidden="true"
                    >
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-sans font-bold text-gray-800">
                          {member.firstName} {member.lastName}
                        </p>
                        <RoleBadge role={member.role} />
                      </div>
                      <p className="text-xs text-gray-400 font-sans">
                        {member.cellGroup?.name ?? "Unassigned"} ·{" "}
                        {member.gender === "MALE" ? "Male" : "Female"}
                      </p>
                      {isAdmin && (member.email || member.phone) && (
                        <p className="text-xs text-gray-400 font-sans mt-0.5">
                          {member.email && (
                            <a
                              href={`mailto:${member.email}`}
                              className="hover:text-red-700 transition-colors"
                            >
                              {member.email}
                            </a>
                          )}
                          {member.email && member.phone && " · "}
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="hover:text-red-700 transition-colors"
                            >
                              {member.phone}
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </PortalSection>
      ) : (
        <EmptyState
          icon="members"
          title="No members found"
          message="Try adjusting your search or filters."
          action={{ label: "Clear filters", to: "/portal/directory" }}
        />
      )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-2"
          aria-label="Directory pagination"
        >
          {page > 1 && (
            <Link
              to={directoryPageUrl({ filters, page: page - 1 })}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm
                         font-sans font-bold text-gray-600 hover:border-red-300
                         hover:text-red-700 transition-all"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm font-sans text-gray-400 px-3">
            {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              to={directoryPageUrl({ filters, page: page + 1 })}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm
                         font-sans font-bold text-gray-600 hover:border-red-300
                         hover:text-red-700 transition-all"
            >
              Next →
          </Link>
        )}
      </nav>
      )}
    </PortalPage>
  );
}

function DirectoryListSkeleton() {
  return (
    <div
      className="absolute inset-x-0 top-0 z-10 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label="Refreshing member list"
    >
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-red-100 motion-safe:animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-gray-200 motion-safe:animate-pulse" />
              <div className="h-3 w-56 max-w-full rounded bg-gray-100 motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Refreshing member list</span>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8">
      <EmptyState
        icon="members"
        title="Directory unavailable"
        message={
          isRouteErrorResponse(error) ? error.data : "Please refresh the page."
        }
      />
    </div>
  );
}
