import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const recordAdminAuditEventMock = vi.fn();
const dbMock = {
  user: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  cellGroup: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("~/lib/auth.server", () => ({
  requireUser: requireUserMock,
}));

vi.mock("~/lib/db.server", () => ({
  db: dbMock,
}));

vi.mock("~/lib/admin-audit.server", () => ({
  recordAdminAuditEvent: recordAdminAuditEventMock,
}));

async function submitAttendance(entries: Array<[string, string]>) {
  const { action } = await import("~/routes/portal/attendance");
  const formData = new FormData();
  entries.forEach(([key, value]) => formData.append(key, value));

  return action({
    request: new Request("https://church.test/portal/attendance", {
      method: "POST",
      body: formData,
    }),
    params: {},
    context: {},
    unstable_url: new URL("https://church.test/portal/attendance"),
    unstable_pattern: "/portal/attendance",
  });
}

describe("portal attendance action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      user: {
        id: "admin_1",
        role: "ADMIN",
        cellGroupId: "cg-admin",
      },
    });
    dbMock.user.findMany.mockResolvedValue([
      { id: "member_1", cellGroupId: "cg-member" },
    ]);
    dbMock.attendance.findMany.mockResolvedValue([]);
    dbMock.attendance.upsert.mockResolvedValue({});
    dbMock.attendance.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.cellGroup.findMany.mockResolvedValue([]);
    dbMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof dbMock) => Promise<unknown>) =>
        callback(dbMock),
    );
    recordAdminAuditEventMock.mockResolvedValue(undefined);
  });

  it("normalizes invalid loader filters to safe church defaults", async () => {
    const { getChurchCalendarDate } = await import("~/lib/calendar-date");
    const { loader } = await import("~/routes/portal/attendance");

    const result = await loader({
      request: new Request(
        "https://church.test/portal/attendance?date=2025-02-30&type=OTHER&cellGroupId=missing",
      ),
      params: {},
      context: {},
      unstable_url: new URL(
        "https://church.test/portal/attendance?date=2025-02-30&type=OTHER&cellGroupId=missing",
      ),
      unstable_pattern: "/portal/attendance",
    });

    expect(result).toMatchObject({
      date: getChurchCalendarDate(),
      type: "SUNDAY_SERVICE",
      selectedCellGroupId: "",
    });
    expect(result.filterNotice).toContain("selected date was invalid");
    expect(result.filterNotice).toContain("attendance type was invalid");
    expect(result.filterNotice).toContain("cell group is unavailable");
  });

  it("uses the selected member cell group when marking one member", async () => {
    const result = await submitAttendance([
      ["intent", "markAttendance"],
      ["date", "2025-04-06"],
      ["type", "SUNDAY_SERVICE"],
      ["userId", "member_1"],
      ["status", "PRESENT"],
    ]);

    expect(result).toEqual({
      ok: true,
      message: "Marked member present.",
      affectedIds: ["member_1"],
      status: "PRESENT",
    });
    expect(dbMock.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          markedById: "admin_1",
          cellGroupId: "cg-member",
        }),
        create: expect.objectContaining({
          userId: "member_1",
          markedById: "admin_1",
          cellGroupId: "cg-member",
          date: new Date("2025-04-06T00:00:00.000Z"),
        }),
      }),
    );
  });

  it("uses one transaction and each member cell group when bulk marking", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { id: "member_1", cellGroupId: "cg-alpha" },
      { id: "member_2", cellGroupId: "cg-beta" },
    ]);

    const result = await submitAttendance([
      ["intent", "bulkMarkAbsent"],
      ["date", "2025-04-06"],
      ["type", "SUNDAY_SERVICE"],
      ["userIds", "member_1"],
      ["userIds", "member_2"],
    ]);

    expect(result).toEqual({
      ok: true,
      message: "Marked 2 members absent.",
      affectedIds: ["member_1", "member_2"],
      status: "ABSENT",
    });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.attendance.upsert).toHaveBeenCalledTimes(2);
    expect(dbMock.attendance.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "member_1",
          cellGroupId: "cg-alpha",
        }),
      }),
    );
    expect(dbMock.attendance.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "member_2",
          cellGroupId: "cg-beta",
        }),
      }),
    );
  });

  it("clears a marked member and audits the previous status", async () => {
    dbMock.attendance.findMany.mockResolvedValue([
      { userId: "member_1", status: "PRESENT" },
    ]);

    const result = await submitAttendance([
      ["intent", "clearAttendance"],
      ["date", "2025-04-06"],
      ["type", "SUNDAY_SERVICE"],
      ["userId", "member_1"],
    ]);

    expect(result).toEqual({
      ok: true,
      message: "Cleared attendance for member.",
      affectedIds: ["member_1"],
      status: null,
    });
    expect(dbMock.attendance.deleteMany).toHaveBeenCalled();
    expect(recordAdminAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "attendance.clear",
        details: expect.objectContaining({
          previousStatuses: { member_1: "PRESENT" },
          nextStatus: null,
        }),
      }),
    );
  });

  it("treats clearing an unmarked member as a harmless no-op", async () => {
    const result = await submitAttendance([
      ["intent", "clearAttendance"],
      ["date", "2025-04-06"],
      ["type", "SUNDAY_SERVICE"],
      ["userId", "member_1"],
    ]);

    expect(result).toEqual({
      ok: true,
      message: "The selected member was already unmarked.",
      affectedIds: [],
      status: null,
    });
    expect(recordAdminAuditEventMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "unknown intent",
      [
        ["intent", "surprise"],
        ["date", "2025-04-06"],
        ["type", "SUNDAY_SERVICE"],
        ["userId", "member_1"],
      ],
    ],
    [
      "impossible date",
      [
        ["intent", "markAttendance"],
        ["date", "2025-02-30"],
        ["type", "SUNDAY_SERVICE"],
        ["userId", "member_1"],
        ["status", "PRESENT"],
      ],
    ],
    [
      "invalid type",
      [
        ["intent", "markAttendance"],
        ["date", "2025-04-06"],
        ["type", "OTHER"],
        ["userId", "member_1"],
        ["status", "PRESENT"],
      ],
    ],
    [
      "invalid status",
      [
        ["intent", "markAttendance"],
        ["date", "2025-04-06"],
        ["type", "SUNDAY_SERVICE"],
        ["userId", "member_1"],
        ["status", "LATE"],
      ],
    ],
    [
      "blank member",
      [
        ["intent", "markAttendance"],
        ["date", "2025-04-06"],
        ["type", "SUNDAY_SERVICE"],
        ["userId", ""],
        ["status", "PRESENT"],
      ],
    ],
    [
      "duplicate bulk members",
      [
        ["intent", "bulkMarkPresent"],
        ["date", "2025-04-06"],
        ["type", "SUNDAY_SERVICE"],
        ["userIds", "member_1"],
        ["userIds", "member_1"],
      ],
    ],
  ])("rejects %s", async (_label, entries) => {
    const result = await submitAttendance(entries as Array<[string, string]>);
    expect(result).toMatchObject({ ok: false });
    expect(dbMock.attendance.upsert).not.toHaveBeenCalled();
  });

  it("rejects future church dates", async () => {
    const result = await submitAttendance([
      ["intent", "markAttendance"],
      ["date", "2999-01-01"],
      ["type", "SUNDAY_SERVICE"],
      ["userId", "member_1"],
      ["status", "PRESENT"],
    ]);
    expect(result).toEqual({
      ok: false,
      error: "Cannot mark attendance for a future date.",
    });
  });

  it("rejects unavailable or inactive admin selections", async () => {
    dbMock.user.findMany.mockResolvedValue([]);
    const result = await submitAttendance([
      ["intent", "markAttendance"],
      ["date", "2025-04-06"],
      ["type", "SUNDAY_SERVICE"],
      ["userId", "member_1"],
      ["status", "PRESENT"],
    ]);
    expect(result).toEqual({
      ok: false,
      error: "Some selected members are unavailable or inactive.",
    });
  });

  it("rejects members and cross-group leader submissions", async () => {
    requireUserMock.mockResolvedValueOnce({
      user: { id: "member_actor", role: "MEMBER", cellGroupId: "cg-alpha" },
    });
    await expect(
      submitAttendance([
        ["intent", "markAttendance"],
        ["date", "2025-04-06"],
        ["type", "SUNDAY_SERVICE"],
        ["userId", "member_1"],
        ["status", "PRESENT"],
      ]),
    ).rejects.toMatchObject({ status: 403 });

    requireUserMock.mockResolvedValueOnce({
      user: { id: "leader_1", role: "CELL_LEADER", cellGroupId: "cg-alpha" },
    });
    dbMock.user.findMany.mockResolvedValueOnce([]);
    await expect(
      submitAttendance([
        ["intent", "markAttendance"],
        ["date", "2025-04-06"],
        ["type", "CELL_GROUP"],
        ["userId", "member_outside"],
        ["status", "ABSENT"],
      ]),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does not audit when an atomic bulk mutation fails", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { id: "member_1", cellGroupId: "cg-alpha" },
      { id: "member_2", cellGroupId: "cg-beta" },
    ]);
    dbMock.$transaction.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      submitAttendance([
        ["intent", "bulkMarkPresent"],
        ["date", "2025-04-06"],
        ["type", "SUNDAY_SERVICE"],
        ["userIds", "member_1"],
        ["userIds", "member_2"],
      ]),
    ).rejects.toThrow("database unavailable");
    expect(recordAdminAuditEventMock).not.toHaveBeenCalled();
  });
});
