const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api`

export function setToken(token: string): void {
  localStorage.setItem('mn_web_token', token)
}

export function getToken(): string | null {
  return localStorage.getItem('mn_web_token')
}

export function clearToken(): void {
  localStorage.removeItem('mn_web_token')
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export interface MeResponse {
  id: string
  name: string
  email: string
  plan: 'starter' | 'pro' | 'power' | null
  planStatus: 'pending' | 'active' | 'cancelled'
  usageSeconds: number
  usageLimitSeconds: number
  remainingSeconds: number
  usagePeriodStart: string
  cancelAtPeriodEnd: boolean
  subscriptionEndsAt: string | null
  createdAt: string
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  return apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

export async function signup(
  name: string,
  email: string,
  password: string,
  plan: string
): Promise<{ token: string; checkoutUrl: string | null; checkoutError?: string }> {
  return apiFetch<{ token: string; checkoutUrl: string | null; checkoutError?: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, plan })
  })
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me')
}

export async function createCheckout(plan: string): Promise<{ checkoutUrl: string }> {
  return apiFetch<{ checkoutUrl: string }>('/polar/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan })
  })
}

export async function cancelPlan(): Promise<{ endsAt: string | null }> {
  return apiFetch<{ endsAt: string | null }>('/polar/cancel', { method: 'POST' })
}

export async function resumePlan(): Promise<void> {
  await apiFetch('/polar/resume', { method: 'POST' })
}

export async function getCustomerPortalUrl(): Promise<string> {
  const { portalUrl } = await apiFetch<{ portalUrl: string }>('/polar/customer-portal')
  return portalUrl
}

export function logout(): void {
  clearToken()
}
