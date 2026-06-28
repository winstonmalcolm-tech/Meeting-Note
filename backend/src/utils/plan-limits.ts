import { User } from '../models/user'
import { SavedSearch } from '../models/savedSearch'

export const PLAN_LIMITS_SECONDS: Record<string, number> = {
  starter: 5 * 3600,   // 18,000s
  pro:     15 * 3600,  // 54,000s
  power:   40 * 3600,  // 144,000s
}

// Max number of concurrent active saved job searches per plan
export const JOB_SCAN_LIMITS: Record<string, number> = {
  starter: 0,
  pro:     5,
  power:   15,
}

export async function getRemainingSeconds(userId: string): Promise<number> {
  const user = await User.findById(userId)
  if (!user || !user.plan || user.planStatus !== 'active') return 0

  const now = new Date()
  const periodStart = new Date(user.usagePeriodStart)
  const daysSincePeriodStart = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSincePeriodStart >= 30) {
    await User.updateOne({ _id: userId }, { usageSeconds: 0, usagePeriodStart: now })
    return PLAN_LIMITS_SECONDS[user.plan] ?? 0
  }

  const limit = PLAN_LIMITS_SECONDS[user.plan] ?? 0
  return Math.max(limit - user.usageSeconds, 0)
}

export async function recordUsage(userId: string, seconds: number): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { usageSeconds: Math.ceil(seconds) } })
}

// Quota = max active saved searches. Computed live from document count — no monthly reset.
export async function getRemainingJobScans(userId: string): Promise<{ limit: number; used: number; remaining: number }> {
  const user = await User.findById(userId).select('plan planStatus')
  if (!user || user.planStatus !== 'active' || !user.plan || user.plan === 'starter') {
    return { limit: 0, used: 0, remaining: 0 }
  }
  const limit = JOB_SCAN_LIMITS[user.plan] ?? 0
  const used = await SavedSearch.countDocuments({ userId, isActive: true })
  return { limit, used, remaining: Math.max(0, limit - used) }
}
