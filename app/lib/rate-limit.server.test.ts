import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter, getClientIpAddress } from "~/lib/rate-limit.server";

describe("createMemoryRateLimiter", () => {
  it("blocks requests after the configured limit until the window resets", () => {
    const limiter = createMemoryRateLimiter();
    const now = 1_000;

    const first = limiter.consume({
      bucket: "contact",
      key: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      now,
    });
    const second = limiter.consume({
      bucket: "contact",
      key: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      now: now + 1_000,
    });
    const third = limiter.consume({
      bucket: "contact",
      key: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      now: now + 2_000,
    });
    const afterReset = limiter.consume({
      bucket: "contact",
      key: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      now: now + 61_000,
    });

    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect(afterReset.ok).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });
});

describe("getClientIpAddress", () => {
  it("prefers the first forwarded IP address", () => {
    const request = new Request("https://church.test/contact", {
      headers: {
        "x-forwarded-for": "203.0.113.5, 198.51.100.10",
        "x-real-ip": "198.51.100.20",
      },
    });

    expect(getClientIpAddress(request)).toBe("203.0.113.5");
  });
});
