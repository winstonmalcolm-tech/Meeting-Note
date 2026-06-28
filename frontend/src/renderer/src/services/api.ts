import type { ExtractionResult, Diagram, Collection } from '../types'

const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api`

function activeProvider(): string {
  return localStorage.getItem('ai-provider') ?? 'openrouter'
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mn_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const res = await fetch(`${BASE}/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/webm',
      'X-Provider': activeProvider(),
      ...authHeaders()
    },
    body: blob
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { transcript } = await res.json()
  return transcript as string
}

export async function extractRequirements(transcript: string): Promise<ExtractionResult> {
  const res = await fetch(`${BASE}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider': activeProvider(),
      ...authHeaders()
    },
    body: JSON.stringify({ transcript })
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json() as Promise<ExtractionResult>
}

// ── Requirements ──────────────────────────────────────────────────────────────

export async function createRequirement(data: {
  title: string
  transcript?: string
  extraction: ExtractionResult
}): Promise<string> {
  const res = await fetch(`${BASE}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { id } = await res.json()
  return id as string
}

export async function fetchRequirements(): Promise<import('../types').SavedRequirement[]> {
  const res = await fetch(`${BASE}/requirements`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteRequirement(id: string): Promise<void> {
  await fetch(`${BASE}/requirements/${id}`, { method: 'DELETE', headers: authHeaders() })
}

export async function updateRequirement(
  id: string,
  updates: { title?: string; extraction?: ExtractionResult }
): Promise<void> {
  await fetch(`${BASE}/requirements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates)
  })
}

export async function chatWithRequirement(
  id: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ reply: string; updatedExtraction?: ExtractionResult; diagram?: Diagram }> {
  const res = await fetch(`${BASE}/requirements/${id}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider': activeProvider(),
      ...authHeaders()
    },
    body: JSON.stringify({ message, history })
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json()
}

// ── Screen recording DB ───────────────────────────────────────────────────────

export async function saveScreenRecordingToDB(data: {
  fileId: string
  sourceName: string
  sourceType: string
  duration: number
  size: number
  withMic: boolean
  createdAt: number
  status: string
  transcript?: string
  extraction?: ExtractionResult
  errorMessage?: string
}): Promise<string> {
  const res = await fetch(`${BASE}/screen-recordings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { id } = await res.json()
  return id as string
}

export async function fetchScreenRecordingFromDB(fileId: string): Promise<{
  id: string
  transcript?: string
  extraction?: ExtractionResult
  status?: string
} | null> {
  const res = await fetch(`${BASE}/screen-recordings/by-file/${fileId}`, { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function updateScreenRecordingInDB(
  id: string,
  updates: { transcript?: string; extraction?: ExtractionResult; status?: string }
): Promise<void> {
  await fetch(`${BASE}/screen-recordings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates)
  })
}

export async function chatStateless(
  title: string,
  extraction: ExtractionResult,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
  fileId?: string
): Promise<{ reply: string; updatedExtraction?: ExtractionResult; diagram?: Diagram }> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider': activeProvider(),
      ...authHeaders()
    },
    body: JSON.stringify({ title, extraction, history, message, fileId })
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json()
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function fetchCollections(): Promise<Collection[]> {
  const res = await fetch(`${BASE}/collections`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createCollection(data: { title: string; description?: string }): Promise<string> {
  const res = await fetch(`${BASE}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { id } = await res.json()
  return id as string
}

export async function updateCollection(
  id: string,
  updates: { title?: string; description?: string }
): Promise<void> {
  await fetch(`${BASE}/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates)
  })
}

export async function deleteCollection(id: string): Promise<void> {
  await fetch(`${BASE}/collections/${id}`, { method: 'DELETE', headers: authHeaders() })
}

export async function addToCollection(
  id: string,
  item: { type: 'audio' | 'screen'; refId: string; title: string }
): Promise<void> {
  await fetch(`${BASE}/collections/${id}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(item)
  })
}

export async function removeFromCollection(id: string, refId: string): Promise<void> {
  await fetch(`${BASE}/collections/${id}/items/${refId}`, { method: 'DELETE', headers: authHeaders() })
}

export async function synthesizeCollection(
  id: string,
  items: { title: string; extraction: ExtractionResult }[]
): Promise<ExtractionResult> {
  const res = await fetch(`${BASE}/collections/${id}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Provider': activeProvider(), ...authHeaders() },
    body: JSON.stringify({ items })
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { summary } = await res.json()
  return summary as ExtractionResult
}

export async function chatWithCollection(
  id: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ reply: string; updatedSummary?: ExtractionResult; diagram?: Diagram }> {
  const res = await fetch(`${BASE}/collections/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Provider': activeProvider(), ...authHeaders() },
    body: JSON.stringify({ message, history })
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json()
}

// ── User profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  targetRole: string
  skills: string
  experience: string
  resumeText?: string
  resumeHtml?: string
  coverLetterText?: string
  coverLetterHtml?: string
  phone?: string
  linkedinUrl?: string
}

export async function fetchProfile(): Promise<UserProfile> {
  try {
    const res = await fetch(`${BASE}/profile`, { headers: authHeaders() })
    if (!res.ok) return { targetRole: '', skills: '', experience: '' }
    return res.json() as Promise<UserProfile>
  } catch {
    return { targetRole: '', skills: '', experience: '' }
  }
}

export async function saveProfile(data: UserProfile): Promise<void> {
  await fetch(`${BASE}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  })
}

export interface ProvidersResponse {
  reachable: boolean
  available: string[]
}

export async function fetchAvailableProviders(): Promise<ProvidersResponse> {
  try {
    const res = await fetch(`${BASE}/providers`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { reachable: true, available: [] }
    const { available } = await res.json()
    return { reachable: true, available }
  } catch {
    return { reachable: false, available: [] }
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginToBackend(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Login failed' }))
    throw new Error(body.error ?? 'Login failed')
  }
  const { token } = await res.json()
  localStorage.setItem('mn_token', token)
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('mn_token')
}

export async function fetchCurrentPlan(): Promise<{ plan: string | null; planStatus: string }> {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() })
  if (!res.ok) return { plan: null, planStatus: 'pending' }
  const data = await res.json()
  return { plan: data.plan, planStatus: data.planStatus }
}

export interface UserInfo {
  id: string
  name: string
  email: string
  plan: string | null
  planStatus: string
  usageSeconds: number
  usageLimitSeconds: number
  remainingSeconds: number
  cancelAtPeriodEnd: boolean
}

export async function fetchUserInfo(): Promise<UserInfo | null> {
  try {
    const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() })
    if (!res.ok) return null
    return res.json() as Promise<UserInfo>
  } catch {
    return null
  }
}

export function logoutFromBackend(): void {
  localStorage.removeItem('mn_token')
}

// ── Career ────────────────────────────────────────────────────────────────────

export interface JobApplication {
  id: string
  companyName: string
  jobTitle: string
  jobDescription: string
  resumeSnapshot: string
  createdAt: number
  resumeAnalysis?: string
  coverLetter?: string
  decodedJD?: string
}

export interface ApplicationQuota {
  limit: number
  used: number
  remaining: number
}

export async function fetchApplicationQuota(): Promise<ApplicationQuota> {
  const res = await fetch(`${BASE}/career/quota`, { headers: authHeaders() })
  if (!res.ok) return { limit: 0, used: 0, remaining: 0 }
  return res.json() as Promise<ApplicationQuota>
}

export async function createJobApplication(data: {
  companyName: string
  jobTitle: string
  jobDescription: string
  resumeSnapshot: string
}): Promise<JobApplication> {
  const res = await fetch(`${BASE}/career/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json() as Promise<JobApplication>
}

export async function fetchJobApplications(): Promise<JobApplication[]> {
  const res = await fetch(`${BASE}/career/applications`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<JobApplication[]>
}

export async function fetchJobApplication(id: string): Promise<JobApplication> {
  const res = await fetch(`${BASE}/career/applications/${id}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<JobApplication>
}

export async function deleteJobApplication(id: string): Promise<void> {
  await fetch(`${BASE}/career/applications/${id}`, { method: 'DELETE', headers: authHeaders() })
}

export async function runResumeAnalysis(id: string): Promise<string> {
  const res = await fetch(`${BASE}/career/applications/${id}/analyze-resume`, {
    method: 'POST',
    headers: { 'X-Provider': activeProvider(), ...authHeaders() },
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { analysis } = await res.json()
  return analysis as string
}

export async function runCoverLetter(id: string): Promise<string> {
  const res = await fetch(`${BASE}/career/applications/${id}/cover-letter`, {
    method: 'POST',
    headers: { 'X-Provider': activeProvider(), ...authHeaders() },
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { letter } = await res.json()
  return letter as string
}

export async function runJDDecoder(id: string): Promise<string> {
  const res = await fetch(`${BASE}/career/applications/${id}/decode-jd`, {
    method: 'POST',
    headers: { 'X-Provider': activeProvider(), ...authHeaders() },
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { decoded } = await res.json()
  return decoded as string
}

export async function parseResumeFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('resume', file)
  const res = await fetch(`${BASE}/career/resume/parse`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { text } = await res.json()
  return text as string
}

export interface JobResult {
  id: string
  title: string
  company: string
  location: string
  employmentType: string
  salary?: string
  description: string
  applyUrl: string
  postedAt: string
  fitScore?: number
  fitReason?: string
}

export interface JobScanQuota {
  limit: number
  used: number
  remaining: number
}

export interface SavedSearch {
  id: string
  query: string
  location: string
  isActive: boolean
  lastRunAt: number | null
  createdAt: number
}

export interface SavedJob {
  id: string
  savedSearchId: string
  jobId: string
  title: string
  company: string
  location: string
  salary?: string
  description: string
  applyUrl: string
  postedAt: string
  fitScore?: number
  fitReason?: string
  status: 'new' | 'kept' | 'dismissed'
  discoveredAt: number
}

export async function fetchJobScanQuota(): Promise<JobScanQuota> {
  const res = await fetch(`${BASE}/career/jobs/quota`, { headers: authHeaders() })
  if (!res.ok) return { limit: 0, used: 0, remaining: 0 }
  return res.json() as Promise<JobScanQuota>
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const res = await fetch(`${BASE}/career/jobs/searches`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<SavedSearch[]>
}

export async function createSavedSearch(query: string, location: string): Promise<{ search: SavedSearch; jobs: SavedJob[] }> {
  const res = await fetch(`${BASE}/career/jobs/searches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Provider': activeProvider(), ...authHeaders() },
    body: JSON.stringify({ query, location }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json() as Promise<{ search: SavedSearch; jobs: SavedJob[] }>
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await fetch(`${BASE}/career/jobs/searches/${id}`, { method: 'DELETE', headers: authHeaders() })
}

export async function fetchSavedJobs(status?: 'new' | 'kept' | 'dismissed'): Promise<SavedJob[]> {
  const params = status ? `?status=${status}` : ''
  const res = await fetch(`${BASE}/career/jobs/results${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<SavedJob[]>
}

export async function updateSavedJobStatus(id: string, status: 'kept' | 'dismissed'): Promise<SavedJob> {
  const res = await fetch(`${BASE}/career/jobs/results/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json() as Promise<SavedJob>
}

// ── Interviews ────────────────────────────────────────────────────────────────

export interface Interview {
  id: string
  companyName: string
  jobTitle: string
  scheduledAt: string
  notes?: string
  jobApplicationId?: string
  createdAt: number
}

export async function fetchInterviews(): Promise<Interview[]> {
  const res = await fetch(`${BASE}/career/interviews`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<Interview[]>
}

export async function createInterview(data: {
  companyName: string
  jobTitle: string
  scheduledAt: string
  notes?: string
  jobApplicationId?: string
}): Promise<Interview> {
  const res = await fetch(`${BASE}/career/interviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json() as Promise<Interview>
}

export async function updateInterview(id: string, data: Partial<Omit<Interview, 'id' | 'createdAt'>>): Promise<Interview> {
  const res = await fetch(`${BASE}/career/interviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  return res.json() as Promise<Interview>
}

export async function deleteInterview(id: string): Promise<void> {
  await fetch(`${BASE}/career/interviews/${id}`, { method: 'DELETE', headers: authHeaders() })
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  title: string
  body: string
  type: string
  refId?: string
  createdAt: number
}

export async function fetchPendingNotifications(): Promise<AppNotification[]> {
  const res = await fetch(`${BASE}/notifications/pending`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json() as Promise<AppNotification[]>
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  await fetch(`${BASE}/notifications/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ids }),
  })
}

export async function runLinkedInOptimizer(data: {
  targetRole?: string
  headline?: string
  summary?: string
  skills?: string
  experience?: string
}): Promise<string> {
  const res = await fetch(`${BASE}/career/linkedin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Provider': activeProvider(), ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error)
  }
  const { suggestions } = await res.json()
  return suggestions as string
}
