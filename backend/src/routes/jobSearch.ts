import { Router as ExpressRouter } from 'express'
import { authMiddleware } from '../middleware/auth'
import { User } from '../models/user'
import { UserProfile } from '../models/userProfile'
import { SavedSearch } from '../models/savedSearch'
import { SavedJob } from '../models/savedJob'
import { getProvider, getAvailableProviders } from '../provider-registry'
import { buildJobFitScoringPrompt } from '../prompts/career'
import { cacheGet, cacheSet } from '../utils/jobSearchCache'
import { getRemainingJobScans, JOB_SCAN_LIMITS } from '../utils/plan-limits'

const router = ExpressRouter()

router.use('/career/jobs', authMiddleware)

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

// ── JSearch fetch ─────────────────────────────────────────────────────────────

export async function fetchFromJSearch(query: string, location: string, page: number): Promise<JobResult[]> {
  const params = new URLSearchParams({
    query: location ? `${query} in ${location}` : query,
    page: String(page),
    num_pages: '1',
    date_posted: 'all',
  })

  const resp = await fetch(`https://jsearch.p.rapidapi.com/search?${params.toString()}`, {
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY ?? '',
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  })

  if (!resp.ok) throw new Error(`JSearch error: ${resp.status} ${resp.statusText}`)

  const json = await resp.json() as { data?: any[] }
  return (json.data ?? []).map((j: any): JobResult => {
    let salary: string | undefined
    if (j.job_min_salary && j.job_max_salary) {
      const currency = j.job_salary_currency ?? ''
      salary = `${currency}${j.job_min_salary.toLocaleString()} – ${currency}${j.job_max_salary.toLocaleString()}`
    }
    return {
      id: j.job_id ?? String(Math.random()),
      title: j.job_title ?? '',
      company: j.employer_name ?? '',
      location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
      employmentType: j.job_employment_type ?? '',
      salary,
      description: j.job_description ?? '',
      applyUrl: j.job_apply_link ?? '',
      postedAt: j.job_posted_at_datetime_utc ?? '',
    }
  })
}

// ── Fit scoring ───────────────────────────────────────────────────────────────

export async function scoreFit(jobs: JobResult[], resume: string, providerName: string): Promise<JobResult[]> {
  if (!resume.trim() || jobs.length === 0) return jobs
  try {
    const provider = getProvider(providerName)
    const prompt = buildJobFitScoringPrompt(
      resume,
      jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, description: j.description }))
    )
    const raw = await provider.chat([{ role: 'user', content: 'Score these jobs.' }], prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return jobs
    const scores = JSON.parse(match[0]) as { id: string; score: number; reason: string }[]
    const byId = new Map(scores.map((s) => [s.id, s]))
    return jobs.map((j) => {
      const s = byId.get(j.id)
      return s ? { ...j, fitScore: s.score, fitReason: s.reason } : j
    })
  } catch {
    return jobs
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serializeSearch(s: any) {
  return {
    id:        s._id.toString(),
    query:     s.query,
    location:  s.location,
    isActive:  s.isActive,
    lastRunAt: s.lastRunAt ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.getTime() : s.createdAt,
  }
}

function serializeJob(j: any) {
  return {
    id:            j._id.toString(),
    savedSearchId: j.savedSearchId.toString(),
    jobId:         j.jobId,
    title:         j.title,
    company:       j.company,
    location:      j.location,
    salary:        j.salary,
    description:   j.description,
    applyUrl:      j.applyUrl,
    postedAt:      j.postedAt,
    fitScore:      j.fitScore,
    fitReason:     j.fitReason,
    status:        j.status,
    discoveredAt:  j.discoveredAt instanceof Date ? j.discoveredAt.getTime() : j.discoveredAt,
  }
}

async function requireJobScanPlan(res: any, userId: string): Promise<boolean> {
  const user = await User.findById(userId).select('plan planStatus')
  if (!user || user.planStatus !== 'active' || !user.plan || user.plan === 'starter') {
    res.status(403).json({ error: 'Pro or Power plan required' })
    return false
  }
  return true
}

// ── Quota ─────────────────────────────────────────────────────────────────────

router.get('/career/jobs/quota', async (req, res) => {
  try {
    const quota = await getRemainingJobScans(req.user!.userId)
    res.json(quota)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch quota' })
  }
})

// ── Saved Searches ────────────────────────────────────────────────────────────

// Create a saved search + run initial fetch immediately
router.post('/career/jobs/searches', async (req, res) => {
  try {
    const userId = req.user!.userId
    if (!await requireJobScanPlan(res, userId)) return

    const quota = await getRemainingJobScans(userId)
    if (quota.remaining <= 0) {
      res.status(429).json({ error: `Saved search limit reached (${quota.limit}). Delete an existing search or upgrade your plan.` })
      return
    }

    const { query, location = '' } = req.body as { query: string; location?: string }
    if (!query?.trim()) {
      res.status(400).json({ error: 'query is required' })
      return
    }

    const search = await SavedSearch.create({
      userId,
      query: query.trim(),
      location: location.trim(),
    })

    // Run initial fetch and save results
    const cacheKey = `jsearch:${query.trim()}:${location.trim()}:1`
    let jobs = cacheGet<JobResult[]>(cacheKey) ?? await fetchFromJSearch(query.trim(), location.trim(), 1)
    cacheSet(cacheKey, jobs)

    // Score against resume if available
    const profile = await UserProfile.findOne({ userId }).select('resumeText')
    if (profile?.resumeText?.trim()) {
      const providerName = (req.headers['x-provider'] as string) || getAvailableProviders()[0] || 'gemini'
      jobs = await scoreFit(jobs, profile.resumeText, providerName)
    }

    // Persist as SavedJob records (skip duplicates via unique index)
    const savedJobs: any[] = []
    for (const job of jobs) {
      try {
        const saved = await SavedJob.create({
          userId,
          savedSearchId: search._id,
          jobId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary,
          description: job.description,
          applyUrl: job.applyUrl,
          postedAt: job.postedAt,
          fitScore: job.fitScore,
          fitReason: job.fitReason,
        })
        savedJobs.push(saved)
      } catch {
        // Duplicate — already saved from another search
      }
    }

    await SavedSearch.updateOne({ _id: search._id }, { lastRunAt: new Date() })

    res.status(201).json({
      search: serializeSearch(search),
      jobs: savedJobs.map(serializeJob),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create search' })
  }
})

router.get('/career/jobs/searches', async (req, res) => {
  try {
    const searches = await SavedSearch.find({ userId: req.user!.userId, isActive: true }).sort({ createdAt: -1 })
    res.json(searches.map(serializeSearch))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch searches' })
  }
})

router.delete('/career/jobs/searches/:id', async (req, res) => {
  try {
    const userId = req.user!.userId
    const result = await SavedSearch.deleteOne({ _id: req.params.id, userId })
    if (result.deletedCount === 0) { res.status(404).json({ error: 'Search not found' }); return }
    // Clean up associated job results
    await SavedJob.deleteMany({ savedSearchId: req.params.id, userId })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete search' })
  }
})

// ── Saved Job Results ─────────────────────────────────────────────────────────

router.get('/career/jobs/results', async (req, res) => {
  try {
    const userId = req.user!.userId
    const status = req.query.status as string | undefined
    const filter: any = { userId }
    if (status && ['new', 'kept', 'dismissed'].includes(status)) filter.status = status

    const jobs = await SavedJob.find(filter).sort({ discoveredAt: -1 })
    res.json(jobs.map(serializeJob))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch results' })
  }
})

router.patch('/career/jobs/results/:id', async (req, res) => {
  try {
    const userId = req.user!.userId
    const { status } = req.body as { status: 'kept' | 'dismissed' }
    if (!['kept', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'status must be "kept" or "dismissed"' })
      return
    }
    const job = await SavedJob.findOneAndUpdate(
      { _id: req.params.id, userId },
      { status },
      { new: true }
    )
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    res.json(serializeJob(job))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update job' })
  }
})

export default router
