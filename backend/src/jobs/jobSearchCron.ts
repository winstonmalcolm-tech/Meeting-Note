import cron from 'node-cron'
import { SavedSearch } from '../models/savedSearch'
import { SavedJob } from '../models/savedJob'
import { User } from '../models/user'
import { Notification } from '../models/notification'
import { UserProfile } from '../models/userProfile'
import { fetchFromJSearch, scoreFit } from '../routes/jobSearch'
import { getAvailableProviders } from '../provider-registry'

// Runs every day at 8:00 AM server time
export function startJobSearchCron() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Running daily job search refresh…')
    try {
      await runJobSearchRefresh()
    } catch (err) {
      console.error('[cron] Job search refresh failed:', err instanceof Error ? err.message : err)
    }
  })
  console.log('[cron] Job search refresh scheduled (daily at 8:00 AM)')
}

export async function runJobSearchRefresh() {
  const searches = await SavedSearch.find({ isActive: true })
  if (searches.length === 0) return

  console.log(`[cron] Refreshing ${searches.length} saved search(es)…`)

  // Group by userId so we can send one notification per user
  const newJobsByUser = new Map<string, number>()

  for (const search of searches) {
    try {
      const userId = search.userId.toString()

      // Fetch latest jobs from JSearch (page 1 — most recent)
      const jobs = await fetchFromJSearch(search.query, search.location, 1)

      // Score against user's resume if available
      let scoredJobs = jobs
      const profile = await UserProfile.findOne({ userId: search.userId }).select('resumeText')
      if (profile?.resumeText?.trim()) {
        const provider = getAvailableProviders()[0] ?? 'gemini'
        scoredJobs = await scoreFit(jobs, profile.resumeText, provider)
      }

      // Save only jobs not already in the DB for this user (unique index on userId+jobId)
      let newCount = 0
      for (const job of scoredJobs) {
        try {
          await SavedJob.create({
            userId: search.userId,
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
          newCount++
        } catch {
          // Duplicate — already seen from a previous run
        }
      }

      await SavedSearch.updateOne({ _id: search._id }, { lastRunAt: new Date() })

      if (newCount > 0) {
        newJobsByUser.set(userId, (newJobsByUser.get(userId) ?? 0) + newCount)
        console.log(`[cron] Saved ${newCount} new job(s) for search "${search.query}" (user ${userId})`)
      }
    } catch (err) {
      console.error(`[cron] Failed to refresh search ${search._id}:`, err instanceof Error ? err.message : err)
    }
  }

  // Send one consolidated notification per user who got new jobs
  for (const [userId, count] of newJobsByUser.entries()) {
    try {
      const title = 'New jobs found'
      const body = `${count} new job${count !== 1 ? 's' : ''} match your saved searches. Open the app to review.`

      await Notification.create({ userId, title, body, type: 'job_search_results', refId: userId })

    } catch (err) {
      console.error(`[cron] Failed to notify user ${userId}:`, err instanceof Error ? err.message : err)
    }
  }
}
