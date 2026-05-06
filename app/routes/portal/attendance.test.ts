import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const recordAdminAuditEventMock = vi.fn();
const dbMock = {
  user: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
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
    dbMock.attendance.findMany.mockResolvedValue([]);
    dbMock.attendance.findUnique.mockResolvedValue(null);
    dbMock.attendance.upsert.mockResolvedValue({});
    recordAdminAuditEventMock.mockResolvedValue(undefined);
  });

  it("uses the selected member cell group when marking one member", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { id: "member_1", cellGroupId: "cg-member" },
    ]);
    const { action } = await import("~/routes/portal/attendance");
    const formData = new FormData();
    formData.set("intent", "markAttendance");
    formData.set("date", "2025-04-06");
    formData.set("type", "SUNDAY_SERVICE");
    formData.set("userId", "member_1");
    formData.set("status", "PRESENT");

    const result = await action({
      request: new Request("https://church.test/portal/attendance", {
        method: "POST",
        body: formData,
      }),
      params: {},
      context: {},
      unstable_url: new URL("https://church.test/portal/attendance"),
      unstable_pattern: "/portal/attendance",
    });

    expect(result).toEqual({
      success: "Marked member present.",
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
        }),
      }),
    );
  });

  it("uses each selected member cell group when bulk marking attendance", async () => {
    dbMock.user.findMany.mockResolvedValue([
      { id: "member_1", cellGroupId: "cg-alpha" },
      { id: "member_2", cellGroupId: "cg-beta" },
    ]);
    const { action } = await import("~/routes/portal/attendance");
    const formData = new FormData();
    formData.set("intent", "bulkMarkAbsent");
    formData.set("date", "2025-04-06");
    formData.set("type", "SUNDAY_SERVICE");
    formData.append("userIds", "member_1");
    formData.append("userIds", "member_2");

    const result = await action({
      request: new Request("https://church.test/portal/attendance", {
        method: "POST",
        body: formData,
      }),
      params: {},
      context: {},
      unstable_url: new URL("https://church.test/portal/attendance"),
      unstable_pattern: "/portal/attendance",
    });

    expect(result).toEqual({
      success: "Marked 2 members absent.",
    });
    expect(dbMock.attendance.upsert).toHaveBeenCalledTimes(2);
    expect(dbMock.attendance.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "member_1",
          cellGroupId: "cg-alpha",
        }),
        update: expect.objectContaining({
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
        update: expect.objectContaining({
          cellGroupId: "cg-beta",
        }),
      }),
    );
  });
});
