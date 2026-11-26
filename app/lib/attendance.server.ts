import { db } from "./db.server";
import {
  calendarDateToUtc,
  getChurchCalendarDate,
  getRecentSundayDates,
  utcDateToCalendarDate,
} from "./calendar-date";

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
};

export function assertAttendanceRole(
  actor: AttendanceActor,
): asserts actor is AttendanceActor & { role: "ADMIN" | "CELL_LEADER" } {
  if (actor.role !== "ADMIN" && actor.role !== "CELL_LEADER") {
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

  const members = await db.user.findMany({
    where: {
      id: { in: userIds },
      isActive: true,
      ...(actor.role === "CELL_LEADER"
        ? { cellGroupId: actor.cellGroupId ?? "__no_group__" }
        : adminMembersOnly
          ? { role: "MEMBER" }
          : {}),
    },
    select: { id: true, cellGroupId: true },
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
          userId: { in: userIds },
          type,
          date: selectedDate,
        },
        select: { userId: true, status: true },
      });
      const statuses = Object.fromEntries(
        existingRecords.map((record) => [record.userId, record.status]),
      );

      if (status) {
        await Promise.all(
          members.map((member) =>
            transaction.attendance.upsert({
              where: {
                userId_type_date: {
                  userId: member.id,
                  type,
                  date: selectedDate,
                },
              },
              update: {
                status,
                markedById: actorId,
                cellGroupId: member.cellGroupId,
              },
              create: {
                userId: member.id,
                type,
                status,
                date: selectedDate,
                markedById: actorId,
                cellGroupId: member.cellGroupId,
              },
            }),
          ),
        );
      } else {
        await transaction.attendance.deleteMany({
          where: {
            userId: { in: userIds },
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
        userId: { in: userIds },
        type,
        date: selectedDate,
      },
      select: { userId: true, status: true },
    });
    previousStatuses = Object.fromEntries(
      existingRecords.map((record) => [record.userId, record.status]),
    );
    const member = members[0];
    if (status) {
      await db.attendance.upsert({
        where: {
          userId_type_date: {
            userId: member.id,
            type,
            date: selectedDate,
          },
        },
        update: {
          status,
          markedById: actorId,
          cellGroupId: member.cellGroupId,
        },
        create: {
          userId: member.id,
          type,
          status,
          date: selectedDate,
          markedById: actorId,
          cellGroupId: member.cellGroupId,
        },
      });
    } else {
      await db.attendance.deleteMany({
        where: {
          userId: member.id,
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

export type MemberCare = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  cellGroupId: string | null;
  cellGroupName: string | null;
  consecutiveMissed: number;
};

/**
 * Returns members in a cell group who have missed 2 or more
 * consecutive Sunday services, ordered by most missed first.
 * This is the "Discipleship Through Visibility" query.
 */
export async function getMembersNeedingCare({
  cellGroupId,
}: {
  cellGroupId?: string;
} = {}) {
  const members = await db.user.findMany({
    where: {
      isActive: true,
      role: "MEMBER",
      ...(cellGroupId ? { cellGroupId } : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      cellGroupId: true,
      cellGroup: { select: { name: true } },
    },
  });

  if (members.length === 0) {
    return [];
  }

  const recentSundayKeys = getRecentSundayDates(6, getChurchCalendarDate());
  const recentSundays = recentSundayKeys.map(calendarDateToUtc);
  const records = await db.attendance.findMany({
    where: {
      userId: { in: members.map((member) => member.id) },
      type: "SUNDAY_SERVICE",
      date: { in: recentSundays },
    },
    select: { userId: true, date: true, status: true },
  });

  const attendanceByUser = new Map<string, Map<string, string>>();
  for (const record of records) {
    const key = utcDateToCalendarDate(record.date);
    const existing = attendanceByUser.get(record.userId) ?? new Map<string, string>();
    existing.set(key, record.status);
    attendanceByUser.set(record.userId, existing);
  }

  const needsCare: MemberCare[] = [];

  for (const member of members) {
    const statuses = attendanceByUser.get(member.id) ?? new Map<string, string>();
    let consecutive = 0;

    for (const key of recentSundayKeys) {
      if (statuses.get(key) === "ABSENT") {
        consecutive++;
      } else {
        break;
      }
    }

    if (consecutive >= 2) {
      needsCare.push({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        cellGroupId: member.cellGroupId,
        cellGroupName: member.cellGroup?.name ?? null,
        consecutiveMissed: consecutive,
      });
    }
  }

  return needsCare.sort(
    (a: MemberCare, b: MemberCare) =>
      b.consecutiveMissed - a.consecutiveMissed ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName)
  );
}
