import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDateToUtc,
  getChurchCalendarDate,
  getMostRecentSundayDate,
  getRecentSundayDates,
  isCalendarDate,
  utcDateToCalendarDate,
} from "./calendar-date";

describe("calendar date helpers", () => {
  it("strictly validates real Gregorian dates", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("2026-4-01")).toBe(false);
  });

  it("uses Asia/Manila when UTC is still on the previous day", () => {
    expect(getChurchCalendarDate(new Date("2026-07-28T16:30:00.000Z"))).toBe(
      "2026-07-29",
    );
    expect(getChurchCalendarDate(new Date("2026-07-29T15:59:59.999Z"))).toBe(
      "2026-07-29",
    );
    expect(getChurchCalendarDate(new Date("2026-07-29T16:00:00.000Z"))).toBe(
      "2026-07-30",
    );
  });

  it("converts calendar dates to canonical UTC midnight", () => {
    const date = calendarDateToUtc("2026-07-29");
    expect(date.toISOString()).toBe("2026-07-29T00:00:00.000Z");
    expect(utcDateToCalendarDate(date)).toBe("2026-07-29");
  });

  it("performs date and Sunday arithmetic without local timezone drift", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(getMostRecentSundayDate("2026-07-29")).toBe("2026-07-26");
    expect(getRecentSundayDates(3, "2026-07-29")).toEqual([
      "2026-07-26",
      "2026-07-19",
      "2026-07-12",
    ]);
  });

  it("throws when asked to convert an invalid date", () => {
    expect(() => calendarDateToUtc("2026-02-30")).toThrow(RangeError);
  });
});
