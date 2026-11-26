import { describe, expect, it } from "vitest";
import {
  filterAttendanceMembers,
  projectAttendanceMap,
  pruneSelectedIds,
} from "./attendance-ui";

const members = [
  { id: "1", firstName: "Ana", lastName: "Cruz" },
  { id: "2", firstName: "Ben", lastName: "Santos" },
  { id: "3", firstName: "Cara", lastName: "Reyes" },
];

describe("attendance UI helpers", () => {
  it("projects individual and bulk pending submissions", () => {
    const mark = new FormData();
    mark.set("intent", "markAttendance");
    mark.set("userId", "1");
    mark.set("status", "PRESENT");
    const clear = new FormData();
    clear.set("intent", "bulkClearAttendance");
    clear.append("userIds", "2");

    expect(
      projectAttendanceMap(
        { "2": "ABSENT" },
        [{ formData: mark }, { formData: clear }],
      ),
    ).toEqual({ "1": "PRESENT" });
  });

  it("filters by name and projected status", () => {
    const map = { "1": "PRESENT", "2": "ABSENT" } as const;
    expect(filterAttendanceMembers(members, map, "an", "ALL")).toEqual([
      members[0],
      members[1],
    ]);
    expect(filterAttendanceMembers(members, map, "", "UNMARKED")).toEqual([
      members[2],
    ]);
  });

  it("prunes selections that are no longer visible", () => {
    expect(pruneSelectedIds(["1", "2"], [members[1]!])).toEqual(["2"]);
  });
});
