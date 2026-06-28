import { Router } from 'express'
import { UserProfile } from '../models/userProfile'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.get('/profile', authMiddleware, async (_req, res) => {
  try {
    const doc = await UserProfile.findOne()
    res.json(doc ?? { targetRole: '', skills: '', experience: '', resumeText: '', resumeHtml: '', coverLetterText: '', coverLetterHtml: '', phone: '', linkedinUrl: '' })
  } catch {
    res.status(500).json({ error: 'Failed to load profile' })
  }
})

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      targetRole = '',
      skills = '',
      experience = '',
      resumeText = '',
      resumeHtml = '',
      coverLetterText = '',
      coverLetterHtml = '',
      phone = '',
      linkedinUrl = '',
    } = req.body as Record<string, string>
    const doc = await UserProfile.findOneAndUpdate(
      {},
      { targetRole, skills, experience, resumeText, resumeHtml, coverLetterText, coverLetterHtml, phone, linkedinUrl, updatedAt: new Date() },
      { new: true, upsert: true }
    )
    res.json(doc)
  } catch {
    res.status(500).json({ error: 'Failed to save profile' })
  }
})

export default router
