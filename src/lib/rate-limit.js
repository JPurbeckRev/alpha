export function createMemoryRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  const map = new Map();

  return {
    check(key) {
      const now = Date.now();
      const entry = map.get(key);

      if (!entry || entry.resetAt <= now) {
        const next = { count: 1, resetAt: now + windowMs };
        map.set(key, next);
        return { allowed: true, remaining: max - 1, resetAt: next.resetAt };
      }

      if (entry.count >= max) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
      }

      entry.count += 1;
      return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
    },
  };
}
