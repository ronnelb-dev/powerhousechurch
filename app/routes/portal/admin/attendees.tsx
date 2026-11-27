import { Form, useLoaderData, useActionData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { requireAdmin } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { PortalHeader, PortalPage, PortalSection, portalButtonClasses } from "~/components/ui/Portal";

const CATEGORIES = ["ADULT", "YOUNG_PROFESSIONAL", "KIDS"] as const;
const categoryLabel: Record<(typeof CATEGORIES)[number], string> = {
  ADULT: "Adult",
  YOUNG_PROFESSIONAL: "Young Professional",
  KIDS: "Kids",
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const [attendees, cellGroups, unlinkedUsers] = await Promise.all([
    db.attendeeProfile.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, category: true, isActive: true,
        cellGroupId: true, guardianProfileId: true, linkedUserId: true,
        cellGroup: { select: { name: true } },
        linkedUser: { select: { email: true, role: true } },
      },
    }),
    db.cellGroup.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { attendeeProfile: null, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);
  return { attendees, cellGroups, unlinkedUsers };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.getAll("intent").at(-1) ?? "");

  if (intent === "create") {
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const cellGroupId = String(form.get("cellGroupId") ?? "") || null;
    const guardianProfileId = String(form.get("guardianProfileId") ?? "") || null;
    if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50 || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      return { error: "Enter a valid name and category." };
    }
    if (cellGroupId && !(await db.cellGroup.findUnique({ where: { id: cellGroupId }, select: { id: true } }))) return { error: "The selected cell group is unavailable." };
    if (guardianProfileId && category !== "KIDS") return { error: "Only a child attendee can be linked to a guardian." };
    if (guardianProfileId && !(await db.attendeeProfile.findFirst({ where: { id: guardianProfileId, isActive: true, category: { in: ["ADULT", "YOUNG_PROFESSIONAL"] } }, select: { id: true } }))) return { error: "The selected guardian is unavailable." };
    await db.attendeeProfile.create({ data: { firstName, lastName, category, cellGroupId, guardianProfileId } });
    return { success: "Attendee profile created." };
  }

  const id = String(form.get("id") ?? "");
  if (!id) return { error: "Select an attendee profile." };
  if (intent === "deactivate") {
    await db.attendeeProfile.update({ where: { id }, data: { isActive: false } });
    return { success: "Attendee profile deactivated." };
  }
  if (intent === "update") {
    const category = String(form.get("category") ?? "");
    const cellGroupId = String(form.get("cellGroupId") ?? "") || null;
    const linkedUserId = String(form.get("linkedUserId") ?? "") || null;
    const guardianProfileId = String(form.get("guardianProfileId") ?? "") || null;
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) return { error: "Choose a valid category." };
    if (guardianProfileId && guardianProfileId === id) return { error: "An attendee cannot be their own guardian." };
    if (guardianProfileId && category !== "KIDS") return { error: "Only a child attendee can be linked to a guardian." };
    if (guardianProfileId && !(await db.attendeeProfile.findFirst({ where: { id: guardianProfileId, isActive: true, category: { in: ["ADULT", "YOUNG_PROFESSIONAL"] } }, select: { id: true } }))) return { error: "The selected guardian is unavailable." };
    if (cellGroupId && !(await db.cellGroup.findUnique({ where: { id: cellGroupId }, select: { id: true } }))) return { error: "The selected cell group is unavailable." };
    if (linkedUserId) {
      if (!(await db.user.findFirst({ where: { id: linkedUserId, isActive: true }, select: { id: true } }))) return { error: "The selected portal login is unavailable." };
      const linkedProfile = await db.attendeeProfile.findUnique({ where: { linkedUserId }, select: { id: true } });
      if (linkedProfile && linkedProfile.id !== id) return { error: "That login account is already linked to another attendee." };
    }
    await db.attendeeProfile.update({ where: { id }, data: { category, cellGroupId, linkedUserId, guardianProfileId } });
    return { success: "Attendee profile updated." };
  }
  return { error: "Unknown action." };
}

export default function AdminAttendeesPage() {
  const { attendees, cellGroups, unlinkedUsers } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cellGroupFilter, setCellGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const activeAttendees = attendees.filter((attendee) => attendee.isActive);
  const guardians = activeAttendees.filter(
    (attendee) => attendee.category === "ADULT" || attendee.category === "YOUNG_PROFESSIONAL",
  );
  const attendeeById = new Map(attendees.map((attendee) => [attendee.id, attendee]));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredAttendees = attendees.filter((attendee) => {
    const fullName = (attendee.firstName + " " + attendee.lastName).toLocaleLowerCase();
    const matchesSearch = !normalizedSearch || fullName.includes(normalizedSearch);
    const matchesCategory = !categoryFilter || attendee.category === categoryFilter;
    const matchesCellGroup =
      !cellGroupFilter ||
      (cellGroupFilter === "unassigned" ? !attendee.cellGroupId : attendee.cellGroupId === cellGroupFilter);
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? attendee.isActive : !attendee.isActive);
    return matchesSearch && matchesCategory && matchesCellGroup && matchesStatus;
  });
  const hasFilters = Boolean(
    normalizedSearch || categoryFilter || cellGroupFilter || statusFilter !== "all",
  );
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setCellGroupFilter("");
    setStatusFilter("all");
  };

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Admin"
        title="Attendee profiles"
        subtitle="Maintain the church roster independently from portal login accounts. Children can have a guardian without a login."
      />
      {result?.error ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {result.error}
        </p>
      ) : null}
      {result?.success ? (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {result.success}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.6fr)] lg:items-start">
        <PortalSection className="h-fit p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-sans font-bold uppercase tracking-[0.12em] text-gray-500">
                Roster management
              </p>
              <h2 className="mt-1 font-sans text-lg font-bold text-gray-900">Add an attendee</h2>
            </div>
            <button
              type="button"
              aria-expanded={isAddFormOpen}
              aria-controls="add-attendee-form"
              onClick={() => setIsAddFormOpen((open) => !open)}
              className={portalButtonClasses({ variant: "secondary", className: "shrink-0 px-3 lg:hidden" })}
            >
              {isAddFormOpen ? "Close" : "Add attendee"}
            </button>
          </div>
          <p className="mb-4 mt-2 text-sm leading-6 text-gray-500">
            A profile does not create a portal account. Add a login later only when this person needs one.
          </p>
          <Form
            id="add-attendee-form"
            method="post"
            className={"gap-3 " + (isAddFormOpen ? "grid" : "hidden lg:grid")}
          >
            <input type="hidden" name="intent" value="create" />
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              First name
              <input name="firstName" required maxLength={50} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              Last name
              <input name="lastName" required maxLength={50} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              Category
              <select name="category" required defaultValue="" className="min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="" disabled>Select category</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel[category]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              Cell group
              <select name="cellGroupId" defaultValue="" className="min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Unassigned</option>
                {cellGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              Guardian <span className="font-normal text-gray-500">Optional, for Kids only</span>
              <select name="guardianProfileId" defaultValue="" className="min-h-11 w-full rounded-lg border border-gray-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">None</option>
                {guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName}</option>)}
              </select>
            </label>
            <button className={portalButtonClasses({ className: "mt-1 min-h-11 w-full" })}>
              Create attendee profile
            </button>
          </Form>
        </PortalSection>

        <PortalSection className="min-w-0 p-0">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
            <h2 className="font-sans text-lg font-bold text-gray-900">Roster</h2>
            <p className="mt-1 text-sm text-gray-500">
              {filteredAttendees.length} shown · {activeAttendees.length} active · {attendees.length} total
            </p>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600 sm:col-span-2 xl:col-span-1">
                Search by name
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Search attendees"
                  className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                Category
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.currentTarget.value)} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="">All categories</option>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel[category]}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                Cell group
                <select value={cellGroupFilter} onChange={(event) => setCellGroupFilter(event.currentTarget.value)} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="">All cell groups</option>
                  {cellGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  <option value="unassigned">Unassigned</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              {hasFilters ? (
                <div className="sm:col-span-2 xl:col-span-4">
                  <button type="button" onClick={clearFilters} className={portalButtonClasses({ variant: "ghost", className: "min-h-11 w-full sm:w-auto" })}>
                    Clear filters
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            Showing {filteredAttendees.length} of {attendees.length} attendee profiles.
          </p>
          <ul className="grid min-w-0 gap-3 p-3 sm:p-4">
            {filteredAttendees.map((attendee) => {
              const currentGuardian = attendee.guardianProfileId
                ? attendeeById.get(attendee.guardianProfileId)
                : undefined;
              const availableGuardians = guardians.filter((guardian) => guardian.id !== attendee.id);
              const hasCurrentGuardianOption = Boolean(
                currentGuardian && !availableGuardians.some(({ id }) => id === currentGuardian.id),
              );
              const inactiveGuardianSuffix = currentGuardian && !currentGuardian.isActive ? " (inactive)" : "";

              return (
                <li
                  key={attendee.id}
                  className={"min-w-0 rounded-xl border p-4 " + (attendee.isActive
                    ? "border-gray-200 bg-white"
                    : "border-gray-200 bg-gray-50")}
                >
                  <Form method="post" className="min-w-0">
                    <input type="hidden" name="intent" value="update" />
                    <input type="hidden" name="id" value={attendee.id} />
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-sans text-base font-bold text-gray-900">
                          {attendee.firstName} {attendee.lastName}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {categoryLabel[attendee.category as (typeof CATEGORIES)[number]] ?? attendee.category}
                          </span>
                          <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (attendee.isActive
                            ? "bg-green-50 text-green-800"
                            : "bg-gray-200 text-gray-700")}>
                            {attendee.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (attendee.linkedUser
                            ? "bg-blue-50 text-blue-800"
                            : "bg-amber-50 text-amber-800")}>
                            {attendee.linkedUser ? "Login linked" : "No login"}
                          </span>
                        </div>
                        {attendee.linkedUser ? (
                          <p className="mt-2 break-all text-xs text-gray-500">
                            {attendee.linkedUser.email ?? attendee.linkedUser.role}
                          </p>
                        ) : null}
                        {currentGuardian ? (
                          <p className="mt-1 break-words text-xs text-gray-500">
                            Guardian: {currentGuardian.firstName} {currentGuardian.lastName}
                          </p>
                        ) : attendee.guardianProfileId ? (
                          <p className="mt-1 text-xs text-gray-500">Guardian linked</p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-xs font-medium text-gray-500">
                        {attendee.cellGroup?.name ?? "Unassigned cell group"}
                      </p>
                    </div>
                    <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                        Category
                        <select name="category" defaultValue={attendee.category ?? ""} required className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                          <option value="" disabled>Select category</option>
                          {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel[category]}</option>)}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                        Cell group
                        <select name="cellGroupId" defaultValue={attendee.cellGroupId ?? ""} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                          <option value="">Unassigned</option>
                          {cellGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                        Guardian <span className="font-normal text-gray-500">Kids only</span>
                        <select name="guardianProfileId" defaultValue={attendee.guardianProfileId ?? ""} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                          <option value="">None</option>
                          {hasCurrentGuardianOption && currentGuardian ? (
                            <option value={currentGuardian.id}>
                              {currentGuardian.firstName} {currentGuardian.lastName}{inactiveGuardianSuffix}
                            </option>
                          ) : null}
                          {availableGuardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName}</option>)}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-semibold text-gray-600">
                        Portal login
                        <select name="linkedUserId" defaultValue={attendee.linkedUserId ?? ""} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-gray-300">
                          <option value="">No linked login</option>
                          {attendee.linkedUserId ? <option value={attendee.linkedUserId}>{attendee.linkedUser?.email ?? attendee.linkedUser?.role ?? "Linked account"}</option> : null}
                          {unlinkedUsers.map((account) => <option key={account.id} value={account.id}>{account.firstName} {account.lastName}{account.email ? " · " + account.email : ""}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button aria-label={"Save " + attendee.firstName + " " + attendee.lastName} className={portalButtonClasses({ variant: "secondary", className: "min-h-11 w-full sm:w-auto" })}>
                        Save changes
                      </button>
                      {attendee.isActive ? (
                        <button
                          formNoValidate
                          name="intent"
                          value="deactivate"
                          aria-label={"Deactivate " + attendee.firstName + " " + attendee.lastName}
                          className={portalButtonClasses({ variant: "ghost", className: "min-h-11 w-full text-red-700 sm:w-auto" })}
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </Form>
                </li>
              );
            })}
            {attendees.length === 0 ? (
              <li className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="font-sans font-semibold text-gray-800">No attendee profiles yet</p>
                <p className="mt-1 text-sm text-gray-500">Add an attendee profile to start the roster.</p>
                <button type="button" onClick={() => setIsAddFormOpen(true)} className={portalButtonClasses({ className: "mt-4 min-h-11 lg:hidden" })}>
                  Add first attendee
                </button>
              </li>
            ) : filteredAttendees.length === 0 ? (
              <li className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="font-sans font-semibold text-gray-800">No attendees match these filters</p>
                <p className="mt-1 text-sm text-gray-500">Try a different name or clear the filters.</p>
                <button type="button" onClick={clearFilters} className={portalButtonClasses({ variant: "secondary", className: "mt-4 min-h-11" })}>
                  Clear filters
                </button>
              </li>
            ) : null}
          </ul>
        </PortalSection>
      </div>
    </PortalPage>
  );
}
