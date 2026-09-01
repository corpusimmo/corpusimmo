/**
 * Minimal in-process rate limiter for the public lead endpoint.
 *
 * Not a security boundary — a distributed deployment needs Upstash/Redis for
 * that — but it stops a single script from filling the CRM in one afternoon,
 * which is the realistic threat for a public unauthenticated write.
 *
 * `globalThis`-backed so Next's hot reload does not reset the window.
 */

const BUCKET_KEY = "__corpusimmoRateLimitBuckets__";

interface Bucket {
  hits: number[];
}

type GlobalWithBuckets = typeof globalThis & { [BUCKET_KEY]?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  const g = globalThis as GlobalWithBuckets;
  const existing = g[BUCKET_KEY];
  if (existing) return existing;
  const created = new Map<string, Bucket>();
  g[BUCKET_KEY] = created;
  return created;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds to wait before retrying, for the `Retry-After` header. */
  retryAfter: number;
}

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const store = buckets();
  const bucket = store.get(key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs);

  if (bucket.hits.length >= options.limit) {
    const oldest = bucket.hits[0] ?? now;
    store.set(key, bucket);
    return { allowed: false, retryAfter: Math.ceil((options.windowMs - (now - oldest)) / 1000) };
  }

  bucket.hits.push(now);
  store.set(key, bucket);

  // Opportunistic cleanup: the map must not grow without bound on a long-lived
  // process.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.hits.every((t) => now - t >= options.windowMs)) store.delete(k);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

/** Best-effort client identity behind a proxy. Never logged in clear. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || request.headers.get("x-real-ip") || "unknown";
}
