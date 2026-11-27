import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/lib/auth.server", () => ({ requireUser: requireUserMock }));
vi.mock("~/lib/db.server", () => ({ db: {} }));

describe("attendance entry access", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["MEMBER", "ATTENDEE", "CELL_LEADER"])("denies %s", async (role) => {
    requireUserMock.mockResolvedValue({ user: { id: "user_1", role, cellGroupId: "group_1" } });
    const { loader, action } = await import("~/routes/portal/attendance-entry");
    const args = {
      request: new Request("https://church.test/portal/attendance-entry"),
      params: {},
      context: {},
      unstable_url: new URL("https://church.test/portal/attendance-entry"),
      unstable_pattern: "/portal/attendance-entry",
    };

    await expect(loader(args)).rejects.toMatchObject({ status: 403 });
    await expect(action({ ...args, request: new Request("https://church.test/portal/attendance-entry", { method: "POST" }) })).rejects.toMatchObject({ status: 403 });
  });
});
