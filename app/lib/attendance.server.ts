import type { Prisma } from "@prisma/client";
import { db } from "./db.server";
import { calendarDateToUtc } from "./calendar-date";

export const ATTENDANCE_TYPES = ["SUNDAY_SERVICE", "CELL_GROUP"] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT"] as const;

export type AttendanceType = (typeof ATTENDANCE_TYPES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type AttendanceActor = {
  id: string;
  role: string;
  cellGroupId: string | null;
};
export type AttendanceMember = {
  id: string;
  cellGroupId: string | null;
  linkedUserId: string | null;
  category: string | null;
};

export function assertAttendanceRole(
  actor: AttendanceActor,
): asserts actor is AttendanceActor & { role: "ADMIN" | "CELL_LEADER" | "USHER" } {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "CELL_LEADER" &&
    actor.role !== "USHER"
  ) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export async function resolveAttendanceMembers({
  actor,
  userIds,
  adminMembersOnly = true,
}: {
  actor: AttendanceActor;
  userIds: string[];
  adminMembersOnly?: boolean;
}): Promise<AttendanceMember[] | null> {
  assertAttendanceRole(actor);
  if (actor.role === "CELL_LEADER" && !actor.cellGroupId) {
    throw new Response("Forbidden", { status: 403 });
  }

  const scopeFilters: Prisma.AttendeeProfileWhereInput[] = [
    {
      OR: [
        { id: { in: userIds } },
        { linkedUserId: { in: userIds } },
      ],
    },
  ];
  if (actor.role === "ADMIN" && adminMembersOnly) {
    scopeFilters.push({
      OR: [
        { linkedUserId: null },
        { linkedUser: { is: { role: { in: ["MEMBER", "ATTENDEE"] } } } },
      ],
    });
  }
  const members = await db.attendeeProfile.findMany({
    where: {
      isActive: true,
      AND: scopeFilters,
      ...(actor.role === "CELL_LEADER"
        ? { cellGroupId: actor.cellGroupId ?? "__no_group__" }
        : {}),
    },
    select: { id: true, cellGroupId: true, linkedUserId: true, category: true },
  });

  if (members.length !== userIds.length) {
    if (actor.role === "CELL_LEADER") {
      throw new Response("Forbidden", { status: 403 });
    }
    return null;
  }

  return members;
}

export async function updateAttendanceRecords({
  actorId,
  members,
  date,
  type,
  status,
  atomic,
}: {
  actorId: string;
  members: AttendanceMember[];
  date: string;
  type: AttendanceType;
  status: AttendanceStatus | null;
  atomic: boolean;
}) {
  const selectedDate = calendarDateToUtc(date);
  const userIds = members.map((member) => member.id);
  let previousStatuses: Record<string, string> = {};

  if (atomic) {
    previousStatuses = await db.$transaction(async (transaction) => {
      const existingRecords = await transaction.attendance.findMany({
        where: {
          attendeeProfileId: { in: userIds },
          type,
          date: selectedDate,
        },
        select: { attendeeProfileId: true, status: true },
      });
      const statuses = Object.fromEntries(
        existingRecords.map((record) => [record.attendeeProfileId, record.status]),
      );

      if (status) {
        await Promise.all(
          members.map((member) =>
            transaction.attendance.upsert({
              where: {
                attendeeProfileId_type_date: {
                  attendeeProfileId: member.id,
                  type,
                  date: selectedDate,
                },
              },
              update: {
                status,
                markedById: actorId,
                cellGroupId: member.cellGroupId,
                userId: member.linkedUserId,
                categorySnapshot: member.category,
              },
              create: {
                attendeeProfileId: member.id,
                userId: member.linkedUserId,
                type,
                status,
                date: selectedDate,
                markedById: actorId,
                cellGroupId: member.cellGroupId,
                categorySnapshot: member.category,
              },
            }),
          ),
        );
      } else {
        await transaction.attendance.deleteMany({
          where: {
            attendeeProfileId: { in: userIds },
            type,
            date: selectedDate,
          },
        });
      }

      return statuses;
    });
  } else if (members[0]) {
    const existingRecords = await db.attendance.findMany({
      where: {
        attendeeProfileId: { in: userIds },
        type,
        date: selectedDate,
      },
      select: { attendeeProfileId: true, status: true },
    });
    previousStatuses = Object.fromEntries(
      existingRecords.map((record) => [record.attendeeProfileId, record.status]),
    );
    const member = members[0];
    if (status) {
      await db.attendance.upsert({
        where: {
          attendeeProfileId_type_date: {
            attendeeProfileId: member.id,
            type,
            date: selectedDate,
          },
        },
        update: {
          status,
          markedById: actorId,
          cellGroupId: member.cellGroupId,
          userId: member.linkedUserId,
          categorySnapshot: member.category,
        },
        create: {
          attendeeProfileId: member.id,
          userId: member.linkedUserId,
          type,
          status,
          date: selectedDate,
          markedById: actorId,
          cellGroupId: member.cellGroupId,
          categorySnapshot: member.category,
        },
      });
    } else {
      await db.attendance.deleteMany({
        where: {
          attendeeProfileId: member.id,
          type,
          date: selectedDate,
        },
      });
    }
  }

  return {
    affectedIds: status
      ? userIds
      : userIds.filter((userId) => previousStatuses[userId] !== undefined),
    previousStatuses,
  };
}
