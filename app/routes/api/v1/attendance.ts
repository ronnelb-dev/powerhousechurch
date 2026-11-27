import { z } from "zod";
import { db } from "~/lib/db.server";
import { requireApiUser } from "~/lib/auth.server";
import {
  assertAttendanceRole,
  resolveAttendanceMembers,
  updateAttendanceRecords,
} from "~/lib/attendance.server";
import { getChurchCalendarDate, calendarDateToUtc, isCalendarDate } from "~/lib/calendar-date";

const AttendanceQuerySchema = z.object({
  date: z.string().refine(isCalendarDate),
  type: z.enum(["SUNDAY_SERVICE", "CELL_GROUP"]),
});
const AttendanceWriteSchema = z.object({
  attendeeProfileIds: z.array(z.string().min(1).max(100)).min(1).max(500),
  date: z.string().refine(isCalendarDate),
  type: z.enum(["SUNDAY_SERVICE", "CELL_GROUP"]),
  status: z.enum(["PRESENT", "ABSENT"]).nullable(),
});

export async function loader({ request }: { request: Request }) {
  const { user } = await requireApiUser(request);
  assertAttendanceRole(user);
  const url = new URL(request.url);
  const parsed = AttendanceQuerySchema.safeParse({
    date: url.searchParams.get("date") ?? getChurchCalendarDate(),
    type: url.searchParams.get("type") ?? "SUNDAY_SERVICE",
  });
  if (!parsed.success) return Response.json({ error: "Invalid date or attendance type." }, { status: 400 });

  const date = calendarDateToUtc(parsed.data.date);
  const attendees = await db.attendeeProfile.findMany({
    where: {
      isActive: true,
      ...(user.role === "CELL_LEADER" ? { cellGroupId: user.cellGroupId ?? "__no_group__" } : {}),
      ...(user.role === "ADMIN" ? {
        OR: [
          { linkedUserId: null },
          { linkedUser: { is: { role: { in: ["MEMBER", "ATTENDEE"] } } } },
        ],
      } : {}),
    },
    select: { id: true, firstName: true, lastName: true, category: true, cellGroupId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const records = await db.attendance.findMany({
    where: { attendeeProfileId: { in: attendees.map(({ id }) => id) }, type: parsed.data.type, date },
    select: { attendeeProfileId: true, status: true, categorySnapshot: true },
  });
  const statuses = new Map(records.map((record) => [record.attendeeProfileId, { status: record.status, category: record.categorySnapshot }]));
  return Response.json({
    date: parsed.data.date,
    type: parsed.data.type,
    attendees: attendees.map((attendee) => ({
      ...attendee,
      status: statuses.get(attendee.id)?.status ?? null,
      categoryAtTime: statuses.get(attendee.id)?.category ?? attendee.category,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireApiUser(request);
  assertAttendanceRole(user);
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });

  const parsed = AttendanceWriteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid attendance update." }, { status: 400 });
  if (parsed.data.date > getChurchCalendarDate()) {
    return Response.json({ error: "Cannot mark attendance for a future date." }, { status: 400 });
  }
  if (new Set(parsed.data.attendeeProfileIds).size !== parsed.data.attendeeProfileIds.length) {
    return Response.json({ error: "Duplicate attendee profiles were submitted." }, { status: 400 });
  }

  const members = await resolveAttendanceMembers({ actor: user, userIds: parsed.data.attendeeProfileIds });
  if (!members) return Response.json({ error: "Some attendees are unavailable or inactive." }, { status: 404 });
  const result = await updateAttendanceRecords({
    actorId: user.id,
    members,
    date: parsed.data.date,
    type: parsed.data.type,
    status: parsed.data.status,
    atomic: parsed.data.attendeeProfileIds.length > 1,
  });
  return Response.json({ ok: true, affectedIds: result.affectedIds, status: parsed.data.status });
}
