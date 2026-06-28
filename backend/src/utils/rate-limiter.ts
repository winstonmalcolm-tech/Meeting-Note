import type { Request, Response, NextFunction } from 'express'

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20

const windows = new Map<string, number[]>()

// Clean up stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of windows) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS)
    if (fresh.length === 0) windows.delete(key)
    else windows.set(key, fresh)
  }
}, 5 * 60_000)

export function chatRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const timestamps = (windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'Too many requests — please slow down.' })
    return
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  next()
}
