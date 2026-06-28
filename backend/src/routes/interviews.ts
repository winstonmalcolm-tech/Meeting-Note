import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { Interview } from '../models/interview'

const router = Router()

router.use('/career/interviews', authMiddleware)

router.get('/career/interviews', async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user!.userId }).sort({ scheduledAt: 1 })
    res.json(interviews.map(serialize))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch interviews' })
  }
})

router.post('/career/interviews', async (req, res) => {
  try {
    const { companyName, jobTitle, scheduledAt, notes, jobApplicationId } = req.body as {
      companyName: string
      jobTitle: string
      scheduledAt: string
      notes?: string
      jobApplicationId?: string
    }

    if (!companyName?.trim() || !jobTitle?.trim() || !scheduledAt) {
      res.status(400).json({ error: 'companyName, jobTitle and scheduledAt are required' })
      return
    }

    const interview = await Interview.create({
      userId: req.user!.userId,
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      scheduledAt: new Date(scheduledAt),
      notes,
      jobApplicationId,
    })

    res.status(201).json(serialize(interview))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create interview' })
  }
})

router.patch('/career/interviews/:id', async (req, res) => {
  try {
    const { companyName, jobTitle, scheduledAt, notes } = req.body as Record<string, string>
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      {
        ...(companyName && { companyName }),
        ...(jobTitle && { jobTitle }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt), reminderSent: false }),
        ...(notes !== undefined && { notes }),
      },
      { new: true }
    )
    if (!interview) { res.status(404).json({ error: 'Interview not found' }); return }
    res.json(serialize(interview))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update interview' })
  }
})

router.delete('/career/interviews/:id', async (req, res) => {
  try {
    const result = await Interview.deleteOne({ _id: req.params.id, userId: req.user!.userId })
    if (result.deletedCount === 0) { res.status(404).json({ error: 'Interview not found' }); return }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete interview' })
  }
})

function serialize(i: any) {
  return {
    id: i._id.toString(),
    companyName: i.companyName,
    jobTitle: i.jobTitle,
    scheduledAt: i.scheduledAt instanceof Date ? i.scheduledAt.toISOString() : i.scheduledAt,
    notes: i.notes,
    jobApplicationId: i.jobApplicationId,
    createdAt: i.createdAt instanceof Date ? i.createdAt.getTime() : i.createdAt,
  }
}

export default router
