/**
 * Process-memory cache with TTL and in-flight deduplication.
 *
 * Why both: a single map pan over Nantes can trigger a dozen concurrent
 * requests for the same `insee:year` CSV (2.2 MB). A plain TTL cache still
 * lets all twelve start before the first one lands. Storing the *promise*
 * collapses them into one network round-trip.
 *
 * This is deliberately a per-process cache, not a distributed one: it sits
 * under `next: { revalidate }` (shared HTTP cache) and only exists to absorb
 * bursts inside one lambda. It must therefore stay bounded — an unbounded Map
 * of parsed CSVs would be a memory leak in a long-lived server.
 *
 * Lives in `lib/dvf` because DVF is the primary consumer, but the primitive is
 * generic and `lib/geo/communes.ts` reuses it.
 */

export interface AsyncCacheOptions {
  /** Time to live for a *resolved* value, in milliseconds. */
  ttlMs: number;
  /** Hard cap on retained entries; least-recently-used are evicted first. */
  maxEntries: number;
}

interface CacheEntry<T> {
  /** Present once the load settled; the promise is kept for in-flight dedup. */
  value?: T;
  promise?: Promise<T>;
  expiresAt: number;
  lastUsed: number;
}

export interface AsyncCache<T> {
  /** Resolves from cache, joins an in-flight load, or starts a new one. */
  get(key: string, load: () => Promise<T>): Promise<T>;
  peek(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

export function createAsyncCache<T>(options: AsyncCacheOptions): AsyncCache<T> {
  const entries = new Map<string, CacheEntry<T>>();
  const { ttlMs, maxEntries } = options;

  function evictIfNeeded(): void {
    if (entries.size <= maxEntries) return;
    // Small maps (tens of entries) — a linear scan beats maintaining an LRU list.
    let oldestKey: string | undefined;
    let oldestUsed = Number.POSITIVE_INFINITY;
    for (const [key, entry] of entries) {
      // Never evict a load someone is currently awaiting.
      if (entry.promise && entry.value === undefined) continue;
      if (entry.lastUsed < oldestUsed) {
        oldestUsed = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) entries.delete(oldestKey);
  }

  return {
    get(key, load) {
      const now = Date.now();
      const existing = entries.get(key);

      if (existing && existing.expiresAt > now) {
        existing.lastUsed = now;
        if (existing.promise) return existing.promise;
        if (existing.value !== undefined) return Promise.resolve(existing.value);
      }

      const entry: CacheEntry<T> = { expiresAt: now + ttlMs, lastUsed: now };
      const promise = load().then(
        (value) => {
          entry.value = value;
          entry.expiresAt = Date.now() + ttlMs;
          return value;
        },
        (error: unknown) => {
          // A failed load must not be cached: the next caller retries.
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        },
      );
      entry.promise = promise;
      entries.set(key, entry);
      evictIfNeeded();
      return promise;
    },

    peek(key) {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= Date.now()) return undefined;
      entry.lastUsed = Date.now();
      return entry.value;
    },

    set(key, value) {
      const now = Date.now();
      entries.set(key, { value, expiresAt: now + ttlMs, lastUsed: now });
      evictIfNeeded();
    },

    delete(key) {
      entries.delete(key);
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    },
  };
}

/** One day: closed mutations never change, only the yearly millésime does. */
export const DVF_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Roughly 30 commune-years of parsed rows. A large commune-year is ~6 000
 * normalised transactions, so the ceiling sits around 180 k objects — a few
 * tens of MB, acceptable for a Node server, and evicted LRU beyond that.
 */
export const DVF_MAX_CACHED_COMMUNE_YEARS = 30;
