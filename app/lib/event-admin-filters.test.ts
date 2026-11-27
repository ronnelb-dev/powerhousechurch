import { describe, expect, it } from "vitest";
import { matchesAdminEventFilter, type AdminEventSearchItem } from "./event-admin-filters";

const now = new Date("2026-11-27T00:00:00.000Z");

function event(overrides: Partial<AdminEventSearchItem> = {}): AdminEventSearchItem {
  return {
    title: "Community Dinner",
    description: "A meal for the whole church",
    location: "Main Hall",
    startDate: "2026-12-10T10:00:00.000Z",
    isPublished: true,
    ...overrides,
  };
}

describe("matchesAdminEventFilter", () => {
  it("matches all upcoming events by default", () => {
    expect(matchesAdminEventFilter(event(), "all", "", now)).toBe(true);
    expect(matchesAdminEventFilter(event(), "upcoming", "", now)).toBe(true);
  });

  it("matches past events and keeps the start-time boundary consistent", () => {
    expect(
      matchesAdminEventFilter(
        event({ startDate: "2026-11-26T23:59:59.000Z" }),
        "past",
        "",
        now,
      ),
    ).toBe(true);
    expect(matchesAdminEventFilter(event({ startDate: now }), "upcoming", "", now)).toBe(true);
  });

  it("matches drafts regardless of their date", () => {
    expect(matchesAdminEventFilter(event({ isPublished: false }), "drafts", "", now)).toBe(true);
    expect(matchesAdminEventFilter(event(), "drafts", "", now)).toBe(false);
  });

  it("searches the title, location, and description without case sensitivity", () => {
    expect(matchesAdminEventFilter(event(), "all", "dinner", now)).toBe(true);
    expect(matchesAdminEventFilter(event(), "all", "MAIN hall", now)).toBe(true);
    expect(matchesAdminEventFilter(event(), "all", "whole church", now)).toBe(true);
    expect(matchesAdminEventFilter(event(), "all", "worship", now)).toBe(false);
  });

  it("applies the selected event filter and search together", () => {
    expect(matchesAdminEventFilter(event(), "upcoming", "dinner", now)).toBe(true);
    expect(
      matchesAdminEventFilter(
        event({ startDate: "2026-11-26T23:59:59.000Z" }),
        "upcoming",
        "dinner",
        now,
      ),
    ).toBe(false);
  });
});
