type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

export type MemoryRateLimiter = {
  consume(args: {
    bucket: string;
    key: string;
    limit: number;
    windowMs: number;
    now?: number;
  }): RateLimitResult;
  reset(): void;
};

function createStore() {
  return new Map<string, RateLimitEntry>();
}

export function createMemoryRateLimiter(
  store: Map<string, RateLimitEntry> = createStore(),
): MemoryRateLimiter {
  return {
    consume({ bucket, key, limit, windowMs, now = Date.now() }) {
      const storageKey = `${bucket}:${key}`;
      const current = store.get(storageKey);

      if (!current || current.resetAt <= now) {
        const next: RateLimitEntry = {
          count: 1,
          resetAt: now + windowMs,
        };
        store.set(storageKey, next);
        return {
          ok: true,
          limit,
          remaining: Math.max(limit - next.count, 0),
          retryAfterSeconds: 0,
          resetAt: next.resetAt,
        };
      }

      if (current.count >= limit) {
        return {
          ok: false,
          limit,
          remaining: 0,
          retryAfterSeconds: Math.max(
            Math.ceil((current.resetAt - now) / 1000),
            1,
          ),
          resetAt: current.resetAt,
        };
      }

      current.count += 1;
      store.set(storageKey, current);
      return {
        ok: true,
        limit,
        remaining: Math.max(limit - current.count, 0),
        retryAfterSeconds: 0,
        resetAt: current.resetAt,
      };
    },
    reset() {
      store.clear();
    },
  };
}

export function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return "unknown";
}

declare global {
  // eslint-disable-next-line no-var
  var __publicSubmissionRateLimiter__:
    | MemoryRateLimiter
    | undefined;
  // eslint-disable-next-line no-var
  var __authRateLimiter__:
    | MemoryRateLimiter
    | undefined;
}

export const publicSubmissionRateLimiter =
  global.__publicSubmissionRateLimiter__ ??
  createMemoryRateLimiter();

if (!global.__publicSubmissionRateLimiter__) {
  global.__publicSubmissionRateLimiter__ = publicSubmissionRateLimiter;
}

export const authRateLimiter =
  global.__authRateLimiter__ ??
  createMemoryRateLimiter();

if (!global.__authRateLimiter__) {
  global.__authRateLimiter__ = authRateLimiter;
}
