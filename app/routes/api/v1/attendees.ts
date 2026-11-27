import { z } from "zod";
import { db } from "~/lib/db.server";
import { requireApiUser } from "~/lib/auth.server";
import { createAttendeeProfile } from "~/lib/attendee-account.server";

const CreateAttendeeSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  category: z.enum(["ADULT", "YOUNG_PROFESSIONAL", "KIDS"]),
  email: z.string().trim().email().optional().nullable(),
  cellGroupId: z.string().trim().min(1).max(100).optional().nullable(),
  guardianProfileId: z.string().trim().min(1).max(100).optional().nullable(),
});
const UpdateAttendeeSchema = z.object({
  id: z.string().min(1).max(100),
  category: z.enum(["ADULT", "YOUNG_PROFESSIONAL", "KIDS"]).optional(),
  cellGroupId: z.string().trim().min(1).max(100).optional().nullable(),
  guardianProfileId: z.string().trim().min(1).max(100).optional().nullable(),
  linkedUserId: z.string().trim().min(1).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "id"), "Provide at least one profile field to update.");

export async function loader({ request }: { request: Request }) {
  const { user } = await requireApiUser(request);
  if (!["ADMIN", "CELL_LEADER", "USHER"].includes(user.role)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  if (user.role === "CELL_LEADER" && !user.cellGroupId) {
    return Response.json({ attendees: [] });
  }

  const attendees = await db.attendeeProfile.findMany({
    where: {
      isActive: true,
      ...(user.role === "CELL_LEADER" ? { cellGroupId: user.cellGroupId! } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      category: true,
      cellGroupId: true,
      cellGroup: { select: { name: true } },
      guardianProfileId: true,
      updatedAt: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return Response.json({ attendees }, { headers: { "Cache-Control": "no-store" } });
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireApiUser(request);
  if (request.method !== "POST" && request.method !== "PATCH") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }
  if (request.method === "PATCH" && user.role !== "ADMIN") {
    return Response.json({ error: "Only admins can update attendee profiles." }, { status: 403 });
  }
  if (request.method === "POST" && !["ADMIN", "USHER"].includes(user.role)) {
    return Response.json({ error: "Only admins and ushers can create attendee profiles." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (request.method === "PATCH") {
    const parsed = UpdateAttendeeSchema.safeParse(payload);
    if (!parsed.success) return Response.json({ error: "Invalid attendee profile update." }, { status: 400 });
    const { id, ...data } = parsed.data;
    if (data.category || data.guardianProfileId !== undefined) {
      const current = await db.attendeeProfile.findUnique({ where: { id }, select: { category: true, guardianProfileId: true } });
      if (!current) return Response.json({ error: "The attendee profile does not exist." }, { status: 404 });
      const nextGuardianId = data.guardianProfileId === undefined ? current.guardianProfileId : data.guardianProfileId;
      if (nextGuardianId && (data.category ?? current.category) !== "KIDS") {
        return Response.json({ error: "Only a child attendee can be linked to a guardian." }, { status: 400 });
      }
    }
    if (data.cellGroupId && !(await db.cellGroup.findUnique({ where: { id: data.cellGroupId }, select: { id: true } }))) {
      return Response.json({ error: "The selected cell group does not exist." }, { status: 400 });
    }
    if (data.guardianProfileId && data.guardianProfileId === id) {
      return Response.json({ error: "An attendee cannot be their own guardian." }, { status: 400 });
    }
    if (data.linkedUserId) {
      const linkedUser = await db.user.findFirst({ where: { id: data.linkedUserId, isActive: true }, select: { id: true } });
      if (!linkedUser) return Response.json({ error: "The selected login account does not exist." }, { status: 400 });
      const existingLink = await db.attendeeProfile.findUnique({ where: { linkedUserId: data.linkedUserId }, select: { id: true } });
      if (existingLink && existingLink.id !== id) {
        return Response.json({ error: "That login account is already linked to another attendee." }, { status: 409 });
      }
    }
    if (data.guardianProfileId && !(await db.attendeeProfile.findFirst({ where: { id: data.guardianProfileId, isActive: true, category: { in: ["ADULT", "YOUNG_PROFESSIONAL"] } }, select: { id: true } }))) {
      return Response.json({ error: "The selected guardian does not exist." }, { status: 400 });
    }
    const attendee = await db.attendeeProfile.update({ where: { id }, data });
    return Response.json({ attendee });
  }

  const parsed = CreateAttendeeSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Enter a name and select an attendee category." }, { status: 400 });
  }
  const { cellGroupId, guardianProfileId } = parsed.data;
  if (cellGroupId && !(await db.cellGroup.findUnique({ where: { id: cellGroupId }, select: { id: true } }))) {
    return Response.json({ error: "The selected cell group does not exist." }, { status: 400 });
  }
  if (parsed.data.category === "KIDS" && parsed.data.email) {
    return Response.json({ error: "Kids are roster-only and do not receive portal logins." }, { status: 400 });
  }
  if (parsed.data.category !== "KIDS" && guardianProfileId) {
    return Response.json({ error: "Only a child attendee can be linked to a guardian." }, { status: 400 });
  }
  if (guardianProfileId && !(await db.attendeeProfile.findFirst({ where: { id: guardianProfileId, isActive: true, category: { in: ["ADULT", "YOUNG_PROFESSIONAL"] } }, select: { id: true } }))) {
    return Response.json({ error: "The selected guardian does not exist or is not eligible." }, { status: 400 });
  }
  const duplicate = await db.attendeeProfile.findFirst({
    where: { isActive: true, firstName: { equals: parsed.data.firstName, mode: "insensitive" }, lastName: { equals: parsed.data.lastName, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) return Response.json({ error: "An attendee with this name already exists." }, { status: 409 });

  try {
    const created = await createAttendeeProfile({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      category: parsed.data.category,
      cellGroupId: cellGroupId || null,
      guardianProfileId: guardianProfileId || null,
      email: parsed.data.email || null,
      appOrigin: new URL(request.url).origin,
    });
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create attendee profile." }, { status: 400 });
  }
}
