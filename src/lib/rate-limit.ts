// Fixed-window in-memory rate limiter. Suitable for a single Node instance.
// For multi-instance deployments swap the store for Redis/Upstash (see docs/DEPLOYMENT.md).
import { RateLimitError } from "./errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    current.count += 1;
    if (current.count > limit) {
      throw new RateLimitError(Math.ceil((current.resetAt - now) / 1000));
    }
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}
