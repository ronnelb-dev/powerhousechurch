import { describe, expect, it } from "vitest";
import { validateMinistryOrder } from "./ministry-order";

describe("validateMinistryOrder", () => {
  it("keeps the requested order when every ministry is included", () => {
    expect(validateMinistryOrder(["hidden", "visible-b", "visible-a"], [
      "visible-a",
      "hidden",
      "visible-b",
    ])).toEqual(["hidden", "visible-b", "visible-a"]);
  });

  it.each([
    ["a duplicate ID", ["a", "a"]],
    ["a missing ministry", ["a"]],
    ["an unknown ministry", ["a", "unknown"]],
    ["a non-string ID", ["a", 2]],
    ["a blank ID", ["a", ""]],
    ["a non-array payload", "a,b"],
  ])("rejects %s", (_caseName, submittedIds) => {
    expect(validateMinistryOrder(submittedIds, ["a", "b"])).toBeNull();
  });
});
