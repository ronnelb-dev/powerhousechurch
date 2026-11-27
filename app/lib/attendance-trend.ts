import { utcDateToCalendarDate } from "~/lib/calendar-date";

export type AttendanceTrendPoint = {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  presentCount: number;
  absentCount: number;
  markedCount: number;
  unmarkedCount: number;
  attendanceRate: number;
};

export function buildAttendanceTrend({
  sundaySeries,
  records,
  totalMembers,
}: {
  sundaySeries: Date[];
  records: Array<{
    date: Date;
    status: string;
    user?: { isActive: boolean } | null;
    attendeeProfile?: { isActive: boolean } | null;
  }>;
  totalMembers: number;
}): AttendanceTrendPoint[] {
  const bucket = new Map<
    string,
    { presentCount: number; absentCount: number; markedCount: number }
  >();

  for (const record of records) {
    if (!(record.attendeeProfile?.isActive ?? record.user?.isActive)) continue;
    const key = utcDateToCalendarDate(record.date);
    const counts = bucket.get(key) ?? {
      presentCount: 0,
      absentCount: 0,
      markedCount: 0,
    };
    if (record.status === "PRESENT") {
      counts.presentCount += 1;
      counts.markedCount += 1;
    } else if (record.status === "ABSENT") {
      counts.absentCount += 1;
      counts.markedCount += 1;
    }
    bucket.set(key, counts);
  }

  return sundaySeries.map((sunday) => {
    const dateKey = utcDateToCalendarDate(sunday);
    const counts = bucket.get(dateKey) ?? {
      presentCount: 0,
      absentCount: 0,
      markedCount: 0,
    };
    return {
      dateKey,
      shortLabel: sunday.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
      fullLabel: sunday.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      presentCount: counts.presentCount,
      absentCount: counts.absentCount,
      markedCount: counts.markedCount,
      unmarkedCount: Math.max(totalMembers - counts.markedCount, 0),
      attendanceRate:
        totalMembers > 0
          ? Math.round((counts.presentCount / totalMembers) * 100)
          : 0,
    };
  });
}
