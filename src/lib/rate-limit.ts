const stores = new Map<string, Map<string, { count: number; firstAttempt: number }>>()

export function checkRateLimit(
  storeName: string,
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  if (!stores.has(storeName)) stores.set(storeName, new Map())
  const store = stores.get(storeName)!
  const entry = store.get(key)

  if (entry) {
    const elapsed = Date.now() - entry.firstAttempt
    if (elapsed >= windowMs) {
      store.delete(key)
      return { allowed: true }
    }
    if (entry.count >= maxAttempts) {
      return { allowed: false, retryAfterMs: windowMs - elapsed }
    }
  }

  return { allowed: true }
}

export function recordRateLimitHit(storeName: string, key: string) {
  if (!stores.has(storeName)) stores.set(storeName, new Map())
  const store = stores.get(storeName)!
  const existing = store.get(key)
  store.set(key, {
    count: (existing?.count || 0) + 1,
    firstAttempt: existing?.firstAttempt || Date.now(),
  })
}
