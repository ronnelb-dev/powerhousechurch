import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, updateUserMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("~/lib/auth.server", () => ({ requireAdmin: requireAdminMock }));
vi.mock("~/lib/db.server", () => ({
  db: { user: { update: updateUserMock } },
}));

async function submitMemberAction(entries: Array<[string, string]>) {
  const { action } = await import("~/routes/portal/admin/members");
  const formData = new FormData();
  entries.forEach(([key, value]) => formData.append(key, value));

  return action({
    request: new Request("https://church.test/portal/admin/members", {
      method: "POST",
      body: formData,
    }),
    params: {},
    context: {},
    unstable_url: new URL("https://church.test/portal/admin/members"),
    unstable_pattern: "/portal/admin/members",
  });
}

describe("admin member role updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } });
    updateUserMock.mockResolvedValue({});
  });

  it("allows admins to assign the usher role", async () => {
    const result = await submitMemberAction([
      ["intent", "updateRole"],
      ["userId", "member_1"],
      ["role", "USHER"],
    ]);

    expect(result).toEqual({ success: "Role updated." });
    expect(updateUserMock).toHaveBeenCalledWith({
      where: { id: "member_1" },
      data: { role: "USHER" },
    });
  });

  it("continues to reject unknown roles", async () => {
    const result = await submitMemberAction([
      ["intent", "updateRole"],
      ["userId", "member_1"],
      ["role", "SUPERUSER"],
    ]);

    expect(result).toEqual({ error: "Invalid role." });
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
