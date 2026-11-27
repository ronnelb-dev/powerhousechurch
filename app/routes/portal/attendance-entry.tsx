import { useEffect, useMemo, useState } from "react";
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { MetaFunction } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { createAttendeeProfile, resendAttendeeSetupEmail } from "~/lib/attendee-account.server";
import { recordAdminAuditEvent } from "~/lib/admin-audit.server";
import { updateAttendanceRecords, type AttendanceStatus, type AttendanceType } from "~/lib/attendance.server";
import { calendarDateToUtc, getChurchCalendarDate, isCalendarDate } from "~/lib/calendar-date";
import { PortalHeader, PortalPage, PortalSection, portalButtonClasses } from "~/components/ui/Portal";

export const meta: MetaFunction = () => [{ title: "Attendance & Check-in — Powerhouse Church Portal" }];

const CATEGORIES = ["ADULT", "YOUNG_PROFESSIONAL", "KIDS"] as const;
const categoryName: Record<string, string> = {
  ADULT: "Adult",
  YOUNG_PROFESSIONAL: "Young Professional",
  KIDS: "Kids",
};
const isEntryRole = (role: string) => role === "ADMIN" || role === "USHER";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await requireUser(request);
  if (!isEntryRole(user.role)) throw new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const selectedId = url.searchParams.get("selected") ?? "";
  const today = getChurchCalendarDate();
  const requestedDate = url.searchParams.get("date") ?? "";
  const date = isCalendarDate(requestedDate) && requestedDate <= today ? requestedDate : today;
  const requestedType = url.searchParams.get("type");
  const type: AttendanceType = requestedType === "CELL_GROUP" ? "CELL_GROUP" : "SUNDAY_SERVICE";
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const includeRoster = terms.length === 0;
  const attendeeWhere = {
    isActive: true,
    ...(terms.length ? {
      AND: terms.map((term) => ({ OR: [
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
      ] })),
    } : { id: "__no_search__" }),
  };
  const [matches, selected, groups, guardians, roster] = await Promise.all([
    terms.length ? db.attendeeProfile.findMany({
      where: attendeeWhere,
      take: 10,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, category: true, cellGroupId: true, guardianProfileId: true,
        linkedUser: { select: { username: true, isEmailVerified: true, role: true } },
        cellGroup: { select: { id: true, name: true, leaderId: true } } },
    }) : Promise.resolve([]),
    selectedId ? db.attendeeProfile.findFirst({
      where: { id: selectedId, isActive: true },
      select: { id: true, firstName: true, lastName: true, category: true, cellGroupId: true,
        cellGroup: { select: { id: true, name: true, leaderId: true } },
        linkedUser: { select: { username: true, isEmailVerified: true, role: true } } },
    }) : Promise.resolve(null),
    db.cellGroup.findMany({
      where: { isActive: true, leaderId: { not: "" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, leaderId: true },
    }),
    db.attendeeProfile.findMany({
      where: { isActive: true, category: { in: ["ADULT", "YOUNG_PROFESSIONAL"] } },
      take: 500,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    includeRoster ? db.attendeeProfile.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        category: true,
        cellGroup: { select: { id: true, name: true, leaderId: true } },
      },
    }) : Promise.resolve([]),
  ]);
  const attendanceDate = calendarDateToUtc(date);
  const attendanceRecords = roster.length ? await db.attendance.findMany({
    where: { attendeeProfileId: { in: roster.map((profile) => profile.id) }, type, date: attendanceDate },
    select: { attendeeProfileId: true, status: true },
  }) : [];
  const attendanceMap = Object.fromEntries(attendanceRecords.map((record) => [record.attendeeProfileId, record.status]));
  const leaderIds = [...new Set([...groups.map((g) => g.leaderId), ...(selected?.cellGroup?.leaderId ? [selected.cellGroup.leaderId] : []), ...matches.map((m) => m.cellGroup?.leaderId).filter((id): id is string => Boolean(id)), ...roster.map((profile) => profile.cellGroup?.leaderId).filter((id): id is string => Boolean(id))])];
  const leaders = leaderIds.length ? await db.user.findMany({ where: { id: { in: leaderIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const leaderNames = new Map(leaders.map((leader) => [leader.id, `${leader.firstName} ${leader.lastName}`.trim()]));
  const withLeader = (profile: typeof selected | (typeof matches)[number] | null) => profile ? {
    ...profile,
    cellLeaderName: profile.cellGroup?.leaderId ? leaderNames.get(profile.cellGroup.leaderId) ?? "Assigned leader" : "Unassigned",
  } : null;
  const rosterWithLeader = roster.map((profile) => ({
    ...profile,
    cellLeaderName: profile.cellGroup?.leaderId ? leaderNames.get(profile.cellGroup.leaderId) ?? "Assigned leader" : "Unassigned",
  }));
  return {
    q, matches: matches.map((match) => withLeader(match)!), selected: withLeader(selected), groups: groups.map((group) => ({ ...group, leaderName: leaderNames.get(group.leaderId) ?? "Cell leader" })), guardians,
    date, type, roster: rosterWithLeader, attendanceMap, today,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { user } = await requireUser(request);
  if (!isEntryRole(user.role)) throw new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "create") {
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const email = String(form.get("email") ?? "").trim();
    const cellGroupId = String(form.get("cellGroupId") ?? "") || null;
    const guardianProfileId = String(form.get("guardianProfileId") ?? "") || null;
    if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50 || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) return { error: "Enter a first name, last name, and attendee category." };
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address or leave it blank." };
    if (category === "KIDS" && email) return { error: "Kids are roster-only and do not receive portal logins. Leave the email blank." };
    if (category !== "KIDS" && guardianProfileId) return { error: "Only a child attendee can be linked to a guardian." };
    if (cellGroupId && !(await db.cellGroup.findFirst({ where: { id: cellGroupId, isActive: true }, select: { id: true } }))) return { error: "Choose an active cell group." };
    if (guardianProfileId && !(await db.attendeeProfile.findFirst({ where: { id: guardianProfileId, isActive: true, category: { in: ["ADULT", "YOUNG_PROFESSIONAL"] } }, select: { id: true } }))) return { error: "Choose an active Adult or Young Professional guardian." };
    const duplicate = await db.attendeeProfile.findFirst({
      where: { isActive: true, firstName: { equals: firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return { error: "An attendee with this name is already on the roster. Search and select the existing profile to avoid a duplicate." };
    try {
      const created = await createAttendeeProfile({
        firstName, lastName, category: category as (typeof CATEGORIES)[number], cellGroupId, guardianProfileId, email: email || null,
        appOrigin: new URL(request.url).origin,
      });
      const group = cellGroupId ? await db.cellGroup.findUnique({ where: { id: cellGroupId }, select: { name: true, leaderId: true } }) : null;
      const leader = group ? await db.user.findUnique({ where: { id: group.leaderId }, select: { firstName: true, lastName: true } }) : null;
      await recordAdminAuditEvent({ request, actorId: user.id, actorRole: user.role, action: "attendee.create", entityType: "attendeeProfile", entityId: created.attendee.id, summary: `Created attendee profile for ${firstName} ${lastName}`, details: { category, cellGroupId, linkedLogin: Boolean(created.username) } });
      return { created: { ...created.attendee, cellLeaderName: leader ? `${leader.firstName} ${leader.lastName}`.trim() : "Unassigned" }, username: created.username, inviteSent: created.inviteSent };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not create this attendee. Please try again." };
    }
  }

  if (intent === "resend-setup") {
    const attendeeProfileId = String(form.get("attendeeProfileId") ?? "");
    try {
      await resendAttendeeSetupEmail({ attendeeProfileId, appOrigin: new URL(request.url).origin });
      return { notice: "Account setup email sent." };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not send the setup email." };
    }
  }

  if (intent === "bulk-mark-present") {
    const attendeeProfileIds = [...new Set(form.getAll("attendeeProfileIds").map(String).filter(Boolean))];
    const date = String(form.get("date") ?? "");
    const type = String(form.get("type") ?? "");
    if (!attendeeProfileIds.length) return { error: "Select at least one unmarked attendee." };
    if (!isCalendarDate(date) || date > getChurchCalendarDate()) return { error: "Choose a valid date that is not in the future." };
    if (type !== "SUNDAY_SERVICE" && type !== "CELL_GROUP") return { error: "Choose a valid gathering." };

    const profiles = await db.attendeeProfile.findMany({
      where: { id: { in: attendeeProfileIds }, isActive: true },
      select: { id: true, firstName: true, lastName: true, cellGroupId: true, linkedUserId: true, category: true },
    });
    if (profiles.length !== attendeeProfileIds.length) return { error: "Some selected attendees are unavailable. Refresh the list and try again." };
    const alreadyMarked = await db.attendance.findMany({
      where: { attendeeProfileId: { in: attendeeProfileIds }, type, date: calendarDateToUtc(date) },
      select: { attendeeProfileId: true },
    });
    if (alreadyMarked.length) return { error: "Some selected attendees already have an attendance status. Refresh the list and try again." };

    await updateAttendanceRecords({
      actorId: user.id,
      members: profiles.map(({ id, cellGroupId, linkedUserId, category }) => ({ id, cellGroupId, linkedUserId, category })),
      date,
      type: type as AttendanceType,
      status: "PRESENT",
      atomic: true,
    });
    await recordAdminAuditEvent({
      request,
      actorId: user.id,
      actorRole: user.role,
      action: "attendance.mark.bulk",
      entityType: "attendance",
      entityId: `${type}:${date}:bulk`,
      summary: `Marked ${profiles.length} attendees present for ${date}`,
      details: { attendeeProfileIds, attendanceType: type, date, status: "PRESENT" },
    });
    return { marked: `Marked ${profiles.length} attendee${profiles.length === 1 ? "" : "s"} present.` };
  }

  if (intent === "mark") {
    const attendeeProfileId = String(form.get("attendeeProfileId") ?? "");
    const date = String(form.get("date") ?? "");
    const type = String(form.get("type") ?? "");
    const status = String(form.get("status") ?? "");
    if (!isCalendarDate(date) || date > getChurchCalendarDate()) return { error: "Choose a valid date that is not in the future." };
    if (type !== "SUNDAY_SERVICE" && type !== "CELL_GROUP") return { error: "Choose a valid gathering." };
    if (status !== "PRESENT" && status !== "ABSENT") return { error: "Choose Present or Absent." };
    const profile = await db.attendeeProfile.findFirst({ where: { id: attendeeProfileId, isActive: true }, select: { id: true, firstName: true, lastName: true, category: true, cellGroupId: true, linkedUserId: true } });
    if (!profile) return { error: "This attendee is unavailable. Search and select them again." };
    const saved = await updateAttendanceRecords({ actorId: user.id, members: [{ id: profile.id, cellGroupId: profile.cellGroupId, linkedUserId: profile.linkedUserId, category: profile.category }], date, type: type as AttendanceType, status: status as AttendanceStatus, atomic: false });
    await recordAdminAuditEvent({ request, actorId: user.id, actorRole: user.role, action: "attendance.mark", entityType: "attendance", entityId: `${profile.id}:${type}:${date}`, summary: `Marked ${profile.firstName} ${profile.lastName} ${status.toLowerCase()} for ${date}`, details: { attendeeProfileId, attendanceType: type, date, status, previousStatuses: saved.previousStatuses } });
    return { marked: `${profile.firstName} ${profile.lastName} marked ${status === "PRESENT" ? "present" : "absent"}.`, selectedId: profile.id };
  }
  return { error: "Unknown action." };
}

export default function AttendanceEntryPage() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const searcher = useFetcher<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(data.q);
  const [selectedId, setSelectedId] = useState(data.selected?.id ?? "");
  const [date, setDate] = useState(data.date);
  const [type, setType] = useState<AttendanceType>(data.type);
  const [rosterQuery, setRosterQuery] = useState("");
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
  const [debouncedSearchPending, setDebouncedSearchPending] = useState(false);
  useEffect(() => setQuery(data.q), [data.q]);
  useEffect(() => setSelectedId(data.selected?.id ?? ""), [data.selected?.id]);
  useEffect(() => {
    setDate(data.date);
    setType(data.type);
    setSelectedRosterIds([]);
  }, [data.date, data.type]);
  useEffect(() => {
    if (result && "created" in result && result.created) setSelectedId(result.created.id);
  }, [result]);
  useEffect(() => {
    if (result && "marked" in result) setSelectedRosterIds([]);
  }, [result]);
  useEffect(() => {
    const normalizedQuery = query.trim();
    setDebouncedSearchPending(false);
    if (!normalizedQuery) return;

    const loadingTimer = window.setTimeout(() => setDebouncedSearchPending(true), 150);
    const searchTimer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: normalizedQuery, date, type });
      searcher.load(`/portal/attendance-entry?${params}`);
    }, 250);
    return () => {
      window.clearTimeout(loadingTimer);
      window.clearTimeout(searchTimer);
    };
  }, [date, query, type]);
  const matches = searcher.data?.matches ?? data.matches;
  const isCurrentSearchResultReady =
    searcher.state === "idle" && searcher.data?.q === query.trim();
  const isSearchLoading =
    Boolean(query.trim()) &&
    !isCurrentSearchResultReady &&
    (debouncedSearchPending || searcher.state !== "idle");
  const selected = (result && "created" in result ? result.created : null) ?? searcher.data?.selected ?? data.selected;
  const selectedProfile = selected && selected.id === selectedId
    ? selected
    : matches.find((match) => match.id === selectedId) ?? (data.selected?.id === selectedId ? data.selected : null);
  const isSubmitting = navigation.state === "submitting";
  const isBusy = navigation.state !== "idle";
  const normalizedRosterQuery = rosterQuery.trim().toLocaleLowerCase();
  const unmarkedRoster = useMemo(() => data.roster.filter((attendee) => {
    if (data.attendanceMap[attendee.id]) return false;
    if (!normalizedRosterQuery) return true;
    const searchable = `${attendee.firstName} ${attendee.lastName} ${attendee.cellGroup?.name ?? ""} ${attendee.cellLeaderName} ${categoryName[attendee.category ?? ""] ?? ""}`.toLocaleLowerCase();
    return searchable.includes(normalizedRosterQuery);
  }), [data.attendanceMap, data.roster, normalizedRosterQuery]);
  useEffect(() => {
    const visibleIds = new Set(unmarkedRoster.map((attendee) => attendee.id));
    setSelectedRosterIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [unmarkedRoster]);
  const selectedRosterSet = new Set(selectedRosterIds);
  const allVisibleRosterSelected = unmarkedRoster.length > 0 && unmarkedRoster.every((attendee) => selectedRosterSet.has(attendee.id));
  const updateAttendanceFilters = (nextDate: string, nextType: AttendanceType) => {
    setDate(nextDate);
    setType(nextType);
    const params = new URLSearchParams({ date: nextDate, type: nextType });
    navigate(`/portal/attendance-entry?${params}`);
  };
  const toggleVisibleRoster = () => {
    const visibleIds = unmarkedRoster.map((attendee) => attendee.id);
    setSelectedRosterIds((current) => allVisibleRosterSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  return (
    <PortalPage>
      <PortalHeader eyebrow="Usher & Admin" title="Attendance & Check-in" subtitle="Find an existing attendee or register someone new. Creating a profile never marks attendance; choose Present or Absent after selecting a person." />
      {result && "error" in result ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{result.error}</p> : null}
      {result && "notice" in result ? <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{result.notice}</p> : null}
      {result && "marked" in result ? <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{result.marked}</p> : null}
      {result && "created" in result && result.created ? <p role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Profile created for {result.created.firstName} {result.created.lastName}. {result.username ? `Username: ${result.username}. ${result.inviteSent ? "Setup email sent." : "Setup email could not be sent; you can resend it below."}` : "No portal login was created."} Select Present or Absent below to record attendance.</p> : null}
      <PortalSection className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-gray-700">Gathering<select value={type} disabled={isBusy} onChange={(event) => updateAttendanceFilters(date, event.target.value as AttendanceType)} className="min-h-12 rounded-xl border border-gray-300 bg-white px-3 disabled:opacity-60"><option value="SUNDAY_SERVICE">Sunday Service</option><option value="CELL_GROUP">Cell Group</option></select></label>
          <label className="grid gap-1 text-sm font-semibold text-gray-700">Date<input type="date" max={data.today} value={date} disabled={isBusy} onChange={(event) => updateAttendanceFilters(event.target.value, type)} className="min-h-12 rounded-xl border border-gray-300 bg-white px-3 disabled:opacity-60" /></label>
        </div>
        <p className="mt-2 text-sm text-gray-500">The same gathering and date apply to quick check-in and the unmarked list.</p>
      </PortalSection>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
        <div className="grid gap-5">
          <PortalSection>
            <h2 className="text-lg font-bold text-gray-900">Find an attendee</h2>
            <label htmlFor="attendee-search" className="mt-3 block text-sm font-semibold text-gray-700">Search by first or last name</label>
            <div className="relative mt-1">
              <input id="attendee-search" autoComplete="off" value={query} onChange={(event) => { setSelectedId(""); setQuery(event.target.value); }} placeholder="Start typing a name…" aria-controls="attendee-search-results" aria-expanded={Boolean(query.trim())} className="min-h-12 w-full rounded-xl border border-gray-300 px-4 pr-12 text-base shadow-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100" />
              {isSearchLoading ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-red-700" /></span> : null}
            </div>
            {query.trim() ? <div id="attendee-search-results" className="mt-2 overflow-hidden rounded-xl border border-gray-200" role="listbox" aria-label="Matching attendees" aria-busy={isSearchLoading}>
              <div>
                {isSearchLoading ? <>
                  <p role="status" aria-live="polite" className="sr-only">Searching attendees…</p>
                  <div aria-hidden="true" className="space-y-1 bg-white p-3">
                    {[0, 1, 2].map((row) => <div key={row} className="flex min-h-12 animate-pulse flex-col justify-center gap-2 border-b border-gray-100 px-1 last:border-0"><span className="h-3 w-2/5 rounded bg-gray-200" /><span className="h-2.5 w-3/5 rounded bg-gray-100" /></div>)}
                  </div>
                </> : matches.length ? matches.map((match) => <button key={match.id} type="button" role="option" aria-selected={selectedId === match.id} onClick={() => { setSelectedId(match.id); const params = new URLSearchParams({ q: query.trim(), selected: match.id, date, type }); searcher.load(`/portal/attendance-entry?${params}`); }} className={`flex min-h-14 w-full flex-col items-start gap-0.5 border-b border-gray-100 px-4 py-2 text-left last:border-b-0 hover:bg-red-50 ${selectedId === match.id ? "bg-red-50" : "bg-white"}`}><span className="font-semibold text-gray-900">{match.firstName} {match.lastName}</span><span className="text-xs text-gray-500">{categoryName[match.category ?? ""] ?? "Category not set"} · {match.cellLeaderName}</span></button>) : <p role="status" className="px-4 py-3 text-sm text-gray-500">No active match. Add a new attendee using the form.</p>}
              </div>
            </div> : <p className="mt-2 text-sm text-gray-500">Suggestions show the attendee’s category and cell leader. Select a match to avoid creating a duplicate.</p>}
          </PortalSection>
          {selectedProfile ? <PortalSection className="border-red-100 bg-red-50/40">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-red-700">Selected attendee</p><h2 className="mt-1 text-xl font-bold text-gray-900">{selectedProfile.firstName} {selectedProfile.lastName}</h2><p className="mt-1 text-sm text-gray-600">{categoryName[selectedProfile.category ?? ""] ?? "Category not set"} · {selectedProfile.cellLeaderName ?? "Unassigned"}</p></div><button type="button" onClick={() => { setSelectedId(""); setQuery(""); }} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-gray-600 hover:bg-white">Change</button></div>
            {"linkedUser" in selectedProfile && selectedProfile.linkedUser?.role === "ATTENDEE" && !selectedProfile.linkedUser.isEmailVerified ? <Form method="post" className="mt-4"><input type="hidden" name="intent" value="resend-setup" /><input type="hidden" name="attendeeProfileId" value={selectedProfile.id} /><button className={portalButtonClasses({ variant: "secondary", className: "min-h-10" })}>Resend account setup email</button></Form> : null}
            <Form method="post" className="mt-4 grid grid-cols-2 gap-3"><input type="hidden" name="intent" value="mark" /><input type="hidden" name="attendeeProfileId" value={selectedProfile.id} /><input type="hidden" name="date" value={date} /><input type="hidden" name="type" value={type} /><button name="status" value="PRESENT" disabled={isSubmitting} className="min-h-14 rounded-xl bg-green-700 px-4 text-base font-bold text-white shadow-sm hover:bg-green-800 disabled:opacity-60">✓ Present</button><button name="status" value="ABSENT" disabled={isSubmitting} className="min-h-14 rounded-xl border border-gray-300 bg-white px-4 text-base font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-60">Absent</button></Form>
          </PortalSection> : null}
          <PortalSection>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-bold text-gray-900">Unmarked attendees</h2><p className="mt-1 text-sm text-gray-500">{unmarkedRoster.length}{normalizedRosterQuery ? " matching" : ""} unmarked attendee{unmarkedRoster.length === 1 ? "" : "s"} for {type === "SUNDAY_SERVICE" ? "Sunday Service" : "Cell Group"} on {date}.</p></div>
              <label className="grid w-full gap-1 text-sm font-semibold text-gray-700 sm:max-w-xs">Search this list<input value={rosterQuery} onChange={(event) => setRosterQuery(event.target.value)} placeholder="Name, category, or cell leader" className="min-h-11 rounded-xl border border-gray-300 px-3 font-normal" /></label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-gray-100 py-3">
              <label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={allVisibleRosterSelected} onChange={toggleVisibleRoster} disabled={!unmarkedRoster.length || isBusy} className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-600" />Select all visible ({unmarkedRoster.length})</label>
              <span className="text-sm text-gray-500">{selectedRosterIds.length} selected</span>
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="bulk-mark-present" />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="type" value={type} />
              <div className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto">
                {unmarkedRoster.length ? unmarkedRoster.map((attendee) => <label key={attendee.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-1 py-2 hover:bg-gray-50">
                  <input type="checkbox" name="attendeeProfileIds" value={attendee.id} checked={selectedRosterSet.has(attendee.id)} onChange={() => setSelectedRosterIds((current) => current.includes(attendee.id) ? current.filter((id) => id !== attendee.id) : [...current, attendee.id])} disabled={isBusy} className="h-4 w-4 shrink-0 rounded border-gray-300 text-red-700 focus:ring-red-600" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-gray-900">{attendee.firstName} {attendee.lastName}</span><span className="block truncate text-xs text-gray-500">{categoryName[attendee.category ?? ""] ?? "Category not set"} · {attendee.cellLeaderName}</span></span>
                </label>) : <p role="status" className="py-8 text-center text-sm text-gray-500">{!data.roster.length ? "No active attendees are on the roster yet." : data.roster.some((attendee) => !data.attendanceMap[attendee.id]) ? "No unmarked attendees match your search." : "Everyone on the roster has an attendance status for this gathering and date."}</p>}
              </div>
              <button type="submit" disabled={!selectedRosterIds.length || isBusy} className="mt-4 min-h-12 w-full rounded-xl bg-green-700 px-4 text-base font-bold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{isBusy ? "Saving…" : `✓ Mark ${selectedRosterIds.length || "selected"} present`}</button>
            </Form>
          </PortalSection>
        </div>
        <PortalSection>
          <h2 className="text-lg font-bold text-gray-900">Quick registration</h2><p className="mb-4 mt-1 text-sm leading-5 text-gray-500">Add a roster profile first. Email is optional; Adults and Young Professionals with an email receive a username and one-time setup link.</p>
          <Form method="post" className="grid gap-3"><input type="hidden" name="intent" value="create" />
            <label className="grid gap-1 text-sm font-semibold text-gray-700">First name<input name="firstName" required maxLength={50} autoComplete="given-name" className="min-h-12 rounded-xl border border-gray-300 px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">Last name<input name="lastName" required maxLength={50} autoComplete="family-name" className="min-h-12 rounded-xl border border-gray-300 px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">Category<select name="category" required defaultValue="" className="min-h-12 rounded-xl border border-gray-300 bg-white px-3 font-normal"><option value="" disabled>Select category</option><option value="ADULT">Adult</option><option value="YOUNG_PROFESSIONAL">Young Professional</option><option value="KIDS">Kids</option></select></label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">Cell leader / group <select name="cellGroupId" defaultValue="" className="min-h-12 rounded-xl border border-gray-300 bg-white px-3 font-normal"><option value="">Unassigned</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.leaderName} · {group.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">Email <span className="text-xs font-normal text-gray-500">Optional. Leave blank for roster-only access.</span><input name="email" type="email" autoComplete="email" className="min-h-12 rounded-xl border border-gray-300 px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">Guardian <span className="text-xs font-normal text-gray-500">Optional, for a child’s roster record.</span><select name="guardianProfileId" defaultValue="" className="min-h-12 rounded-xl border border-gray-300 bg-white px-3 font-normal"><option value="">No guardian</option>{data.guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName}</option>)}</select></label>
            <button disabled={isSubmitting} className={portalButtonClasses({ className: "mt-1 min-h-12" })}>{isSubmitting ? "Saving…" : "Create attendee profile"}</button>
          </Form>
          {result && "created" in result && result.username && !result.inviteSent ? <Form method="post" className="mt-3"><input type="hidden" name="intent" value="resend-setup" /><input type="hidden" name="attendeeProfileId" value={result.created.id} /><button className={portalButtonClasses({ variant: "secondary", className: "w-full" })}>Retry setup email</button></Form> : null}
        </PortalSection>
      </div>
    </PortalPage>
  );
}
