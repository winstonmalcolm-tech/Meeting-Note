const TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, expiresAt: Date.now() + TTL_MS })
}
