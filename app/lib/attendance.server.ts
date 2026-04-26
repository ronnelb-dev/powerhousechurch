import { db } from "./db.server";

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

function getRecentSundays(count: number): Date[] {
  const sundays: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - cursor.getDay());
  cursor.setHours(0, 0, 0, 0);

  for (let index = 0; index < count; index += 1) {
    sundays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 7);
  }

  return sundays;
}

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

  const recentSundays = getRecentSundays(6);
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
    const key = record.date.toISOString().slice(0, 10);
    const existing = attendanceByUser.get(record.userId) ?? new Map<string, string>();
    existing.set(key, record.status);
    attendanceByUser.set(record.userId, existing);
  }

  const needsCare: MemberCare[] = [];

  for (const member of members) {
    const statuses = attendanceByUser.get(member.id) ?? new Map<string, string>();
    let consecutive = 0;

    for (const sunday of recentSundays) {
      const key = sunday.toISOString().slice(0, 10);
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
