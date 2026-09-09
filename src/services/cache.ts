// ── AsyncStorage-backed response cache with TTL ───────────────────
// Used for rarely-changing reference data (categories, brands) so the
// mobile app doesn't re-fetch them on every app start / screen mount.
// Pattern: stale-while-revalidate — return cached data immediately if
// present, then refresh in the background if the cache is past its TTL.

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number; // ms since epoch when the entry was stored
}

/**
 * Read a cached value. Returns null if missing, expired, or unparseable.
 * Does NOT refresh the cache — callers decide when to revalidate.
 */
export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > ttlMs) {
      // Stale — caller should refresh. We still return the data so the
      // UI can render instantly while the refresh is in flight.
      return entry.data;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Whether a cached value is fresh (within its TTL). Used to decide if a
 * background refresh is needed after returning cached data synchronously.
 */
export async function isCacheFresh(key: string, ttlMs: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return Date.now() - entry.timestamp <= ttlMs;
  } catch {
    return false;
  }
}

/** Write a value to the cache with the current timestamp. */
export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // AsyncStorage failures are non-fatal — the app still works, just
    // without the cache benefit on the next load.
  }
}

/** Remove a cache entry. */
export async function clearCached(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Stale-while-revalidate helper for a single fetch.
 *
 * 1. If a cached value exists, resolve with it immediately.
 * 2. If the cache is stale (or missing), call `fetcher` and update the
 *    cache. The returned promise resolves with the fresh value.
 * 3. If the cache is fresh, still call `fetcher` in the background to
 *    keep the cache warm, but the returned promise resolves with the
 *    cached value (no waiting).
 *
 * For the common case (cache fresh), this means zero network latency
 * for the caller. For the stale case, the caller gets instant cached
 * data and a silent background refresh.
 */
export async function swr<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const [cached, fresh] = await Promise.all([
    getCached<T>(key, ttlMs),
    isCacheFresh(key, ttlMs),
  ]);

  if (cached && fresh) {
    // Cache is fresh — refresh in the background, return cached now.
    fetcher().then((data) => setCached(key, data)).catch(() => {});
    return cached;
  }

  // Cache is missing or stale — fetch fresh data, cache it, return it.
  const data = await fetcher();
  await setCached(key, data);
  return data;
}
