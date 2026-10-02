import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("~/lib/db.server", () => ({
  db: {
    cellGroup: { findMany },
  },
}));

describe("public cell groups", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("loads public group details without querying portal member counts", async () => {
    findMany.mockResolvedValue([
      {
        id: "group_1",
        name: "Harbor Group",
        meetingDay: "Wednesday",
        meetingTime: "7:00 PM",
        barangay: "Poblacion",
      },
    ]);

    const { loader } = await import("./cell-groups");
    const result = await loader();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        meetingDay: true,
        meetingTime: true,
        barangay: true,
      },
    });
    expect(result.cellGroups[0]).not.toHaveProperty("_count");
  });
});
