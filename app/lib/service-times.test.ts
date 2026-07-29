import { describe, expect, it } from "vitest";

import {
  getMidweekServices,
  getServiceSchedule,
  getSundayServices,
} from "./service-times";

describe("service times", () => {
  it("uses one consistent Sunday fallback schedule", () => {
    expect(getSundayServices({})).toEqual([
      {
        label: "Sunday Service",
        time: "9:00 AM",
        detail: "First Service",
      },
      {
        label: "Sunday Service",
        time: "2:00 PM",
        detail: "Youth Service",
      },
    ]);
    expect(getServiceSchedule({}).sunday).toEqual(getSundayServices({}));
  });

  it("uses configured Sunday times when present", () => {
    expect(
      getSundayServices({
        "service.sunday1": "8:00 AM",
        "service.sunday2": "4:00 PM",
      }).map((service) => service.time),
    ).toEqual(["8:00 AM", "4:00 PM"]);
  });

  it("keeps the existing midweek fallback behavior", () => {
    expect(getServiceSchedule({}).midweek).toEqual(getMidweekServices({}));
  });
});
