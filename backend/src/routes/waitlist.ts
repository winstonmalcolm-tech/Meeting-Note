import { Router } from 'express'
import { WaitlistEntry } from '../models/waitlist'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/waitlist', async (req, res) => {
  const { email } = req.body as { email?: string }

  if (!email || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address.' })
    return
  }

  try {
    await WaitlistEntry.create({ email: email.trim() })
    res.json({ success: true })
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "You're already on the list! We'll be in touch." })
      return
    }
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

export default router
