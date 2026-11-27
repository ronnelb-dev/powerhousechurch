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
  USHER: {
    label: "Usher",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  MEMBER: {
    label: "Member",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  ATTENDEE: {
    label: "Attendee",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_LABELS[role] ?? ROLE_LABELS.MEMBER!;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 font-sans text-xs font-bold ${config.className}`}
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
  const hasActiveFilters = Boolean(
    filters.search || filters.cellGroupId || filters.gender,
  );
  const firstResult = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const lastResult = Math.min(page * PER_PAGE, total);
  const selectedGroup =
    filters.cellGroupId === "UNASSIGNED"
      ? "Unassigned"
      : cellGroups.find((group) => group.id === filters.cellGroupId)?.name;
  const activeFilters = [
    filters.search ? "Name: " + filters.search : null,
    filters.cellGroupId ? "Group: " + (selectedGroup ?? "Selected group") : null,
    filters.gender
      ? "Gender: " +
        (filters.gender === "MALE"
          ? "Male"
          : filters.gender === "FEMALE"
            ? "Female"
            : filters.gender)
      : null,
  ].filter((filter): filter is string => filter !== null);

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Members Portal"
        title="Member Directory"
        subtitle="Find active members by name, cell group, or gender."
      />

      <PortalSection className="mb-5 p-4 sm:p-5">
        <Form
          key={location.search}
          method="get"
          role="search"
          aria-label="Search and filter members"
          aria-busy={isRefreshing}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1.6fr)_minmax(12rem,1fr)_minmax(10rem,0.8fr)]">
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="directory-search"
                className="mb-1.5 block text-xs font-sans font-bold text-gray-600"
              >
                Search by name
              </label>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                  id="directory-search"
                  type="search"
                  name="search"
                  defaultValue={filters.search}
                  placeholder="Search members…"
                  className="min-h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 font-sans text-sm text-gray-700 placeholder-gray-400 transition-colors focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="directory-group"
                className="mb-1.5 block text-xs font-sans font-bold text-gray-600"
              >
                Cell group
              </label>
              <select
                id="directory-group"
                name="cellGroupId"
                defaultValue={filters.cellGroupId}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-700 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                <option value="">All groups</option>
                {cellGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
                <option value="UNASSIGNED">Unassigned</option>
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="directory-gender"
                className="mb-1.5 block text-xs font-sans font-bold text-gray-600"
              >
                Gender
              </label>
              <select
                id="directory-gender"
                name="gender"
                defaultValue={filters.gender}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-700 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                <option value="">All genders</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-sans text-gray-500">
              Filters apply when you select Search.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {hasActiveFilters ? (
                <Link
                  to="/portal/directory"
                  className={portalButtonClasses({
                    variant: "secondary",
                    className: "w-full sm:w-auto",
                  })}
                >
                  Clear filters
                </Link>
              ) : null}
              <button
                type="submit"
                className={portalButtonClasses({
                  className: "w-full sm:w-auto",
                })}
              >
                Search
              </button>
            </div>
          </div>
        </Form>
      </PortalSection>

      <section
        aria-label="Directory results"
        aria-busy={isRefreshing}
        className="relative"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p
            className="text-sm font-sans font-semibold text-gray-700"
            aria-live="polite"
            aria-atomic="true"
          >
            {total === 0
              ? "No matching members"
              : "Showing " +
                firstResult +
                "–" +
                lastResult +
                " of " +
                total +
                " active " +
                (total === 1 ? "member" : "members")}
          </p>
          {activeFilters.length > 0 ? (
            <ul
              className="flex min-w-0 flex-wrap gap-1.5"
              aria-label="Applied filters"
            >
              {activeFilters.map((filter) => (
                <li
                  key={filter}
                  className="max-w-full break-words rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-sans text-gray-600"
                >
                  {filter}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative">
          {isRefreshing ? (
            <DirectoryListSkeleton overlay={members.length > 0} />
          ) : null}
          {members.length > 0 ? (
            <ul
              role="list"
              aria-label="Member results"
              className={[
                "grid gap-3 lg:grid-cols-2",
                isRefreshing ? "pointer-events-none opacity-40" : "",
              ].join(" ")}
            >
              {members.map((member) => {
                const initials =
                  (member.firstName?.[0] ?? "") + (member.lastName?.[0] ?? "");
                const genderLabel =
                  member.gender === "MALE"
                    ? "Male"
                    : member.gender === "FEMALE"
                      ? "Female"
                      : "Not provided";
                return (
                  <li key={member.id} className="min-w-0">
                    <article className="h-full min-w-0 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 sm:p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-100 bg-red-50 font-sans text-sm font-bold text-red-700"
                          aria-hidden="true"
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="min-w-0 break-words font-sans text-sm font-bold text-gray-900">
                              {member.firstName} {member.lastName}
                            </h2>
                            <RoleBadge role={member.role} />
                          </div>
                          <p className="mt-1 break-words font-sans text-xs leading-5 text-gray-500">
                            {member.cellGroup?.name ?? "Unassigned"}
                            <span aria-hidden="true"> · </span>
                            {genderLabel}
                          </p>
                          {isAdmin && (member.email || member.phone) ? (
                            <div className="mt-3 flex min-w-0 flex-col gap-1 border-t border-gray-100 pt-2 font-sans text-xs text-gray-600 sm:flex-row sm:flex-wrap sm:gap-x-3">
                              {member.email ? (
                                <a
                                  href={"mailto:" + member.email}
                                  className="min-w-0 break-all underline decoration-gray-300 underline-offset-2 transition-colors hover:text-red-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                                >
                                  {member.email}
                                </a>
                              ) : null}
                              {member.phone ? (
                                <a
                                  href={"tel:" + member.phone}
                                  className="min-w-0 break-all underline decoration-gray-300 underline-offset-2 transition-colors hover:text-red-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                                >
                                  {member.phone}
                                </a>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : isRefreshing ? null : (
            <EmptyState
              icon="members"
              title={
                hasActiveFilters ? "No matching members" : "No active members yet"
              }
              message={
                hasActiveFilters
                  ? "No active members match your search and filters. Try adjusting them or clear all filters."
                  : "Active members will appear here when they join the church directory."
              }
              action={
                hasActiveFilters
                  ? { label: "Clear filters", to: "/portal/directory" }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {totalPages > 1 && (
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          aria-label="Directory pagination"
        >
          {page > 1 ? (
            <Link
              to={directoryPageUrl({ filters, page: page - 1 })}
              className="inline-flex min-h-11 min-w-28 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 font-sans text-sm font-bold text-gray-700 transition-colors hover:border-red-300 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <span aria-hidden="true">← </span>Previous
            </Link>
          ) : null}
          <span
            className="px-3 font-sans text-sm text-gray-500"
            aria-live="polite"
          >
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              to={directoryPageUrl({ filters, page: page + 1 })}
              className="inline-flex min-h-11 min-w-28 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 font-sans text-sm font-bold text-gray-700 transition-colors hover:border-red-300 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Next<span aria-hidden="true"> →</span>
            </Link>
          ) : null}
        </nav>
      )}
    </PortalPage>
  );
}

function DirectoryListSkeleton({ overlay }: { overlay: boolean }) {
  return (
    <div
      className={[
        "grid gap-3 rounded-xl border border-gray-100 bg-gray-50/95 p-3 shadow-sm backdrop-blur-sm sm:p-4 lg:grid-cols-2",
        overlay ? "absolute inset-0 z-10" : "relative",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-label="Refreshing member results"
    >
      <span className="sr-only">Refreshing member results</span>
      <div className="contents" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-red-100 motion-safe:animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 max-w-full rounded bg-gray-200 motion-safe:animate-pulse" />
                <div className="h-3 w-32 max-w-full rounded bg-gray-100 motion-safe:animate-pulse" />
                <div className="h-3 w-48 max-w-full rounded bg-gray-100 motion-safe:animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
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
