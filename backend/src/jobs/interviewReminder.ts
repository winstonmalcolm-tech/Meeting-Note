import cron from 'node-cron'
import { Interview } from '../models/interview'
import { User } from '../models/user'
import { Notification } from '../models/notification'
// Runs every day at 9:00 AM server time
export function startInterviewReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[cron] Running interview reminder check…')
    try {
      await sendReminders()
    } catch (err) {
      console.error('[cron] Interview reminder failed:', err instanceof Error ? err.message : err)
    }
  })
  console.log('[cron] Interview reminder job scheduled (daily at 9:00 AM)')
}

export async function sendReminders() {
  const now = new Date()

  // Window: interviews scheduled between tomorrow 00:00 and tomorrow 23:59
  const tomorrowStart = new Date(now)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  tomorrowStart.setHours(0, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setHours(23, 59, 59, 999)

  const upcoming = await Interview.find({
    scheduledAt: { $gte: tomorrowStart, $lte: tomorrowEnd },
    reminderSent: false,
  })

  if (upcoming.length === 0) {
    console.log('[cron] No upcoming interviews to notify.')
    return
  }

  console.log(`[cron] Found ${upcoming.length} interview(s) to notify.`)

  for (const interview of upcoming) {
    try {
      const user = await User.findById(interview.userId).select('fcmTokens')
      if (!user) continue

      const time = interview.scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      const title = 'Interview tomorrow'
      const body = `${interview.companyName} — ${interview.jobTitle} at ${time}`

      // Create in-app notification for desktop polling
      await Notification.create({
        userId: interview.userId,
        title,
        body,
        type: 'interview_reminder',
        refId: interview._id.toString(),
      })

      // Mark reminder as sent so we don't fire again
      await Interview.updateOne({ _id: interview._id }, { reminderSent: true })

      console.log(`[cron] Notified user ${interview.userId} for interview at ${interview.companyName}`)
    } catch (err) {
      console.error(`[cron] Failed to notify for interview ${interview._id}:`, err instanceof Error ? err.message : err)
    }
  }
}
