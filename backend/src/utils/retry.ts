const BASE_DELAY_MS = 1000
const DEFAULT_MAX_RETRIES = 3

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const e = err as { status?: number; statusCode?: number }
  const status = e.status ?? e.statusCode
  if (status === 429 || status === 503) return true
  const msg = err.message.toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('rate limit') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource exhausted')
  )
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = DEFAULT_MAX_RETRIES): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === maxRetries || !isRetryable(err)) throw err
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastErr
}
