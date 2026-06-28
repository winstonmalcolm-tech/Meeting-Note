import { Router } from 'express'
import { Requirement } from '../models/requirement'
import { getProvider, getAvailableProviders } from '../provider-registry'
import { chatRateLimiter } from '../utils/rate-limiter'
import { buildChatSystemPrompt } from '../prompts/chat'
import type { ExtractionResult, Diagram } from '../types'
import { authMiddleware } from '../middleware/auth'

function parseMermaid(reply: string): Diagram | undefined {
  const match = reply.match(/```mermaid\s*([\s\S]*?)```/)
  if (!match) return undefined
  const code = match[1].trim()
  const titleMatch = code.match(/^%%\s*Title:\s*(.+)/m)
  return {
    id: Date.now().toString(),
    title: titleMatch ? titleMatch[1].trim() : 'Diagram',
    code,
    createdAt: Date.now()
  }
}

const router = Router()

router.use(authMiddleware)

router.post('/requirements', async (req, res) => {
  try {
    const { title, transcript, extraction } = req.body
    const saved = await Requirement.create({ title, transcript, extraction })
    res.json({ id: saved._id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed'
    res.status(500).json({ error: message })
  }
})

router.get('/requirements', async (_req, res) => {
  try {
    const items = await Requirement.find().sort({ createdAt: -1 }).lean()
    res.json(items.map(({ _id, __v, ...rest }) => ({ id: _id.toString(), ...rest })))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requirements' })
  }
})

router.patch('/requirements/:id', async (req, res) => {
  try {
    const updated = await Requirement.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).lean()
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Update failed' })
  }
})

router.delete('/requirements/:id', async (req, res) => {
  try {
    await Requirement.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' })
  }
})

router.post('/requirements/:id/chat', chatRateLimiter, async (req, res) => {
  try {
    const doc = await Requirement.findById(req.params.id).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })

    const { message, history = [] } = req.body as {
      message: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    const providerName = (req.headers['x-provider'] as string) || getAvailableProviders()[0] || 'openai'
    const provider = getProvider(providerName)
    const systemPrompt = buildChatSystemPrompt(doc.title, doc.extraction)

    const allMessages = [
      ...history,
      { role: 'user' as const, content: message }
    ]

    const reply = await provider.chat(allMessages, systemPrompt)

    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/)
    let updatedExtraction: ExtractionResult | undefined
    if (jsonMatch) {
      try { updatedExtraction = JSON.parse(jsonMatch[1]) } catch { /* ignore */ }
    }

    const diagram = parseMermaid(reply)
    if (diagram) {
      await Requirement.findByIdAndUpdate(req.params.id, { $push: { diagrams: diagram } })
    }

    res.json({ reply, updatedExtraction, diagram })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' })
  }
})

export default router
