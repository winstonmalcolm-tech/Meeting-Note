import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { User } from '../models/user'
import { Notification } from '../models/notification'

const router = Router()

router.use('/notifications', authMiddleware)

// Flutter/mobile registers its FCM token here on login
router.post('/notifications/device-token', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token?.trim()) {
      res.status(400).json({ error: 'token is required' })
      return
    }

    // Add token if not already stored (avoid duplicates)
    await User.updateOne(
      { _id: req.user!.userId },
      { $addToSet: { fcmTokens: token } }
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to register token' })
  }
})

// Remove a token (called on logout from mobile)
router.delete('/notifications/device-token', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token) { res.status(400).json({ error: 'token is required' }); return }

    await User.updateOne({ _id: req.user!.userId }, { $pull: { fcmTokens: token } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove token' })
  }
})

// Desktop polls this on app focus to check for pending notifications
router.get('/notifications/pending', async (req, res) => {
  try {
    const pending = await Notification.find({ userId: req.user!.userId, read: false })
      .sort({ createdAt: -1 })
      .limit(20)

    res.json(pending.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      body: n.body,
      type: n.type,
      refId: n.refId,
      createdAt: n.createdAt instanceof Date ? n.createdAt.getTime() : n.createdAt,
    })))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch notifications' })
  }
})

// Desktop marks notifications as read after showing them
router.post('/notifications/mark-read', async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' })
      return
    }

    await Notification.updateMany(
      { _id: { $in: ids }, userId: req.user!.userId },
      { read: true }
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to mark notifications' })
  }
})

export default router
