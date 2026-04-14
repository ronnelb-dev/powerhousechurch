import { db } from "./db.server";

type MemberCare = {
  id: string;
  firstName: string;
  lastName: string;
  consecutiveMissed: number;
};

/**
 * Returns members in a cell group who have missed 2 or more
 * consecutive Sunday services, ordered by most missed first.
 * This is the "Discipleship Through Visibility" query.
 */
export async function getMembersNeedingCare(cellGroupId: string) {
  // Fetch last 6 Sunday attendance records for all members in the group
  const records = await db.attendance.findMany({
    where: {
      cellGroupId,
      type: "SUNDAY_SERVICE",
    },
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 200, // bounded — never unbounded
  });

  // Group by user
  const byUser = new Map<string, typeof records>();
  for (const record of records) {
    const existing = byUser.get(record.userId) ?? [];
    existing.push(record);
    byUser.set(record.userId, existing);
  }

  const needsCare: MemberCare[] = [];

  for (const [, userRecords] of byUser) {
    // Sort descending — most recent first
    const sorted = userRecords.sort(
      (a: (typeof records)[number], b: (typeof records)[number]) =>
        b.date.getTime() - a.date.getTime()
    );

    // Count consecutive absences from the most recent record
    let consecutive = 0;
    for (const record of sorted) {
      if (record.status === "ABSENT") {
        consecutive++;
      } else {
        break; // streak broken
      }
    }

    if (consecutive >= 2) {
      const user = sorted[0].user;
      needsCare.push({
        id:                user.id,
        firstName:         user.firstName,
        lastName:          user.lastName,
        consecutiveMissed: consecutive,
      });
    }
  }

  // Most concerning members first
  return needsCare.sort(
    (a: MemberCare, b: MemberCare) => b.consecutiveMissed - a.consecutiveMissed
  );
}