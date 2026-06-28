import { Router } from 'express'
import { ScreenRecording } from '../models/screenRecording'
import type { ExtractionResult } from '../types'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

// Upsert by fileId — creates on first process, updates on re-process
router.post('/screen-recordings', async (req, res) => {
  try {
    const { fileId, sourceName, sourceType, duration, size, withMic, createdAt, status, transcript, extraction, errorMessage } = req.body

    const doc = await ScreenRecording.findOneAndUpdate(
      { fileId },
      { fileId, sourceName, sourceType, duration, size, withMic, createdAt: new Date(createdAt), status, transcript, extraction, errorMessage },
      { upsert: true, new: true }
    ).lean()

    res.json({ id: doc!._id.toString() })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Save failed' })
  }
})

// Fetch single record by fileId
router.get('/screen-recordings/by-file/:fileId', async (req, res) => {
  try {
    const doc = await ScreenRecording.findOne({ fileId: req.params.fileId }).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    const { _id, __v, ...rest } = doc as any
    res.json({ id: _id.toString(), ...rest })
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' })
  }
})

// Patch by MongoDB id
router.patch('/screen-recordings/:id', async (req, res) => {
  try {
    const updated = await ScreenRecording.findByIdAndUpdate(
      req.params.id,
      { $set: req.body as Partial<{ transcript: string; extraction: ExtractionResult; status: string }> },
      { new: true }
    ).lean()
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Update failed' })
  }
})

export default router
