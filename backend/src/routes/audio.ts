import { Router, Request, Response } from 'express'
import { transcribeAudio } from '../transcription/deepgram'
import { authMiddleware } from '../middleware/auth'
import { getRemainingSeconds, recordUsage } from '../utils/plan-limits'

const router = Router()

router.post('/transcribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const buffer = req.body as Buffer
    if (!buffer || buffer.length === 0) {
      res.status(400).json({ error: 'No audio data received' })
      return
    }

    const remaining = await getRemainingSeconds(req.user!.userId)
    if (remaining <= 0) {
      res.status(403).json({
        error: 'Monthly transcription limit reached',
        plan: req.user!.plan,
        code: 'QUOTA_EXCEEDED'
      })
      return
    }

    const { transcript, durationSeconds } = await transcribeAudio(buffer)

    await recordUsage(req.user!.userId, durationSeconds)

    res.json({ transcript })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    console.error('Transcription error:', message)
    res.status(500).json({ error: message })
  }
})

export default router
