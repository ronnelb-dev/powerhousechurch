import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, dbMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  dbMock: {
    user: { findMany: vi.fn(), count: vi.fn() },
    cellGroup: { findMany: vi.fn() },
  },
}));

vi.mock("~/lib/auth.server", () => ({ requireUser: requireUserMock }));
vi.mock("~/lib/db.server", () => ({ db: dbMock }));

const { loader } = await import("~/routes/portal/directory");

function loadDirectory(query = "") {
  const request = new Request(`https://church.test/portal/directory${query}`);
  return loader({
    request,
    params: {},
    context: {},
    unstable_url: new URL(request.url),
    unstable_pattern: "/portal/directory",
  });
}

describe("member directory loader", () => {
  const members = [
    {
      id: "member-1",
      firstName: "Alex",
      lastName: "Morgan",
      gender: "MALE",
      role: "MEMBER",
      email: "alex@example.test",
      phone: "+15550101",
      cellGroup: { id: "group-1", name: "North Group" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockImplementation(async (_request: Request) => ({
      user: {
        id: "viewer-1",
        role: "MEMBER",
        cellGroupId: null,
      },
    }));
    dbMock.user.findMany.mockResolvedValue(members);
    dbMock.user.count.mockResolvedValue(41);
    dbMock.cellGroup.findMany.mockResolvedValue([
      { id: "group-1", name: "North Group" },
    ]);
  });

  it("lists active members alphabetically in 20-member pages", async () => {
    const result = await loadDirectory();

    expect(dbMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: 0,
        take: 20,
      }),
    );
    expect(dbMock.user.count).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toMatchObject({ total: 41, page: 1, totalPages: 3 });
  });

  it("combines name, group, and gender filters while preserving page inputs", async () => {
    const result = await loadDirectory(
      "?search=alex&cellGroupId=group-1&gender=MALE&page=2",
    );

    expect(dbMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          cellGroupId: "group-1",
          gender: "MALE",
          OR: [
            { firstName: { contains: "alex", mode: "insensitive" } },
            { lastName: { contains: "alex", mode: "insensitive" } },
          ],
        },
        skip: 20,
        take: 20,
      }),
    );
    expect(result.filters).toEqual({
      search: "alex",
      cellGroupId: "group-1",
      gender: "MALE",
    });
  });

  it("keeps unassigned filtering and contact details admin-only", async () => {
    requireUserMock.mockImplementation(async (_request: Request) => ({
      user: { id: "viewer-1", role: "ADMIN", cellGroupId: null },
    }));

    const adminResult = await loadDirectory("?cellGroupId=UNASSIGNED");

    expect(dbMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, cellGroupId: null } }),
    );
    expect(adminResult.members[0]).toMatchObject({
      email: "alex@example.test",
      phone: "+15550101",
    });
    expect(adminResult.isAdmin).toBe(true);

    requireUserMock.mockImplementation(async (_request: Request) => ({
      user: { id: "viewer-1", role: "MEMBER", cellGroupId: null },
    }));
    const memberResult = await loadDirectory();

    expect(memberResult.members[0]).toMatchObject({ email: null, phone: null });
    expect(memberResult.isAdmin).toBe(false);
  });

  it("passes all supported role values through for role badges", async () => {
    dbMock.user.findMany.mockResolvedValue(
      ["ADMIN", "CELL_LEADER", "USHER", "MEMBER", "ATTENDEE"].map(
        (role, index) => ({ ...members[0], id: `member-${index}`, role }),
      ),
    );

    const result = await loadDirectory();

    expect(result.members.map((member) => member.role)).toEqual([
      "ADMIN",
      "CELL_LEADER",
      "USHER",
      "MEMBER",
      "ATTENDEE",
    ]);
  });
});
