import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, dbMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  dbMock: {
    user: { count: vi.fn() },
    cellGroup: { count: vi.fn(), findUnique: vi.fn() },
    attendance: { count: vi.fn(), findMany: vi.fn() },
    prayerRequest: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    servingInterest: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("~/lib/auth.server", () => ({ requireUser: requireUserMock }));
vi.mock("~/lib/db.server", () => ({ db: dbMock }));

async function loadDashboard() {
  const { loader } = await import("~/routes/portal/dashboard");
  return loader({
    request: new Request("https://church.test/portal/dashboard"),
    params: {},
    context: {},
    unstable_url: new URL("https://church.test/portal/dashboard"),
    unstable_pattern: "/portal/dashboard",
  });
}

describe("portal dashboard loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      user: {
        id: "admin-1",
        firstName: "Alex",
        lastName: "Morgan",
        role: "ADMIN",
        cellGroupId: null,
      },
    });
    dbMock.user.count.mockResolvedValue(120);
    dbMock.cellGroup.count.mockResolvedValue(8);
    dbMock.cellGroup.findUnique.mockResolvedValue(null);
    dbMock.attendance.count.mockResolvedValue(0);
    dbMock.attendance.findMany.mockResolvedValue([]);
    dbMock.prayerRequest.count.mockResolvedValue(0);
    dbMock.prayerRequest.findFirst.mockResolvedValue(null);
    dbMock.prayerRequest.findMany.mockResolvedValue([]);
    dbMock.servingInterest.count.mockResolvedValue(0);
    dbMock.servingInterest.findFirst.mockResolvedValue(null);
    dbMock.servingInterest.findMany.mockResolvedValue([]);
  });

  it("shows admins church-wide counts and the 12-Sunday trend", async () => {
    const { getChurchCalendarDate, getMostRecentSundayDate, calendarDateToUtc } =
      await import("~/lib/calendar-date");
    const latestSunday = calendarDateToUtc(
      getMostRecentSundayDate(getChurchCalendarDate()),
    );
    dbMock.attendance.findMany.mockResolvedValue([
      { date: latestSunday, status: "PRESENT", user: { isActive: true } },
      { date: latestSunday, status: "PRESENT", user: { isActive: true } },
      { date: latestSunday, status: "ABSENT", user: { isActive: true } },
      { date: latestSunday, status: "PRESENT", user: { isActive: false } },
    ]);

    const result = await loadDashboard();

    expect(result.adminSummary).not.toBeNull();
    const adminSummary = result.adminSummary!;
    expect(adminSummary).toMatchObject({ activeMembers: 120, activeGroups: 8 });
    expect(adminSummary.attendanceTrend).toHaveLength(12);
    expect(adminSummary.attendanceTrend.at(-1)).toMatchObject({
      dateKey: latestSunday.toISOString().slice(0, 10),
      presentCount: 2,
      absentCount: 1,
      attendanceRate: 2,
    });
    expect(dbMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "SUNDAY_SERVICE" }) }),
    );
  });

  it("limits cell leaders to their assigned group and its attendance", async () => {
    requireUserMock.mockResolvedValue({
      user: {
        id: "leader-1",
        firstName: "Sam",
        lastName: "Lee",
        role: "CELL_LEADER",
        cellGroupId: "group-a",
      },
    });
    dbMock.user.count.mockResolvedValue(7);
    dbMock.cellGroup.findUnique.mockResolvedValue({
      id: "group-a",
      name: "North Group",
      leaderId: "leader-1",
      meetingDay: "Wednesday",
      meetingTime: "7:00 PM",
      barangay: "North District",
    });
    dbMock.attendance.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5);

    const result = await loadDashboard();

    expect(result.cellGroup).toMatchObject({
      id: "group-a",
      name: "North Group",
      meetingDay: "Wednesday",
      meetingTime: "7:00 PM",
      barangay: "North District",
    });
    expect(result.groupAttendance).toMatchObject({
      presentCount: 3,
      totalMarked: 5,
      memberCount: 7,
      percentage: 43,
    });
    expect(result.adminSummary).toBeNull();
    expect(dbMock.user.count).toHaveBeenCalledWith({
      where: { cellGroupId: "group-a", isActive: true },
    });
    expect(dbMock.attendance.findMany).not.toHaveBeenCalled();
    expect(dbMock.prayerRequest.count).not.toHaveBeenCalled();
  });

  it("shows a member's own latest statuses and attendance without a group", async () => {
    const { getChurchCalendarDate, getMostRecentSundayDate, calendarDateToUtc } =
      await import("~/lib/calendar-date");
    const latestSunday = calendarDateToUtc(
      getMostRecentSundayDate(getChurchCalendarDate()),
    );
    requireUserMock.mockResolvedValue({
      user: {
        id: "member-1",
        firstName: "Taylor",
        lastName: "Reed",
        role: "MEMBER",
        cellGroupId: null,
      },
    });
    dbMock.prayerRequest.count.mockResolvedValue(2);
    dbMock.prayerRequest.findFirst.mockResolvedValue({ status: "ONGOING" });
    dbMock.servingInterest.count.mockResolvedValue(1);
    dbMock.servingInterest.findFirst.mockResolvedValue({ status: "NEW" });
    dbMock.attendance.findMany.mockResolvedValue([
      { date: latestSunday, status: "PRESENT" },
    ]);

    const result = await loadDashboard();

    expect(result.engagementSummary).toEqual({
      prayerRequestCount: 2,
      servingInterestCount: 1,
    });
    expect(result.latestPrayerStatus).toBe("ONGOING");
    expect(result.latestServingStatus).toBe("NEW");
    expect(result.cellGroup).toBeNull();
    expect(result.recentAttendance).toHaveLength(12);
    expect(result.recentAttendance.at(-1)).toEqual({
      date: latestSunday.toISOString().slice(0, 10),
      status: "present",
    });
    expect(dbMock.prayerRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { memberId: "member-1" } }),
    );
    expect(dbMock.servingInterest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "member-1" } }),
    );
    expect(dbMock.user.count).not.toHaveBeenCalled();
    expect(dbMock.cellGroup.count).not.toHaveBeenCalled();
  });

  it("does not query group attendance for a cell leader without an assignment", async () => {
    requireUserMock.mockResolvedValue({
      user: {
        id: "leader-1",
        firstName: "Sam",
        lastName: "Lee",
        role: "CELL_LEADER",
        cellGroupId: null,
      },
    });

    const result = await loadDashboard();

    expect(result.cellGroup).toBeNull();
    expect(result.groupAttendance).toBeNull();
    expect(dbMock.cellGroup.findUnique).not.toHaveBeenCalled();
    expect(dbMock.attendance.count).not.toHaveBeenCalled();
  });
});
