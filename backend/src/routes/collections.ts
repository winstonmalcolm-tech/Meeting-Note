import { Router } from 'express'
import { Collection } from '../models/collection'
import { getProvider, getAvailableProviders } from '../provider-registry'
import { chatRateLimiter } from '../utils/rate-limiter'
import {
  buildCollectionChatSystemPrompt,
  buildSynthesisSystemPrompt,
  buildSynthesisUserMessage
} from '../prompts/collectionChat'
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

// List all collections (items included)
router.get('/collections', async (_req, res) => {
  try {
    const cols = await Collection.find().sort({ createdAt: -1 }).lean()
    res.json(cols.map((c) => ({
      id: (c._id as { toString(): string }).toString(),
      title: c.title,
      description: c.description,
      createdAt: c.createdAt,
      items: c.items.map((i) => ({ ...i, addedAt: i.addedAt })),
      summary: c.summary,
      diagrams: c.diagrams ?? []
    })))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch collections' })
  }
})

// Create collection
router.post('/collections', async (req, res) => {
  try {
    const { title, description } = req.body as { title: string; description?: string }
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
    const col = await Collection.create({ title: title.trim(), description })
    res.status(201).json({ id: col._id.toString() })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create collection' })
  }
})

// Update collection title / description
router.patch('/collections/:id', async (req, res) => {
  try {
    const { title, description } = req.body as { title?: string; description?: string }
    const update: Record<string, unknown> = {}
    if (title !== undefined) update.title = title.trim()
    if (description !== undefined) update.description = description
    await Collection.findByIdAndUpdate(req.params.id, { $set: update })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to update collection' })
  }
})

// Delete collection
router.delete('/collections/:id', async (req, res) => {
  try {
    await Collection.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete collection' })
  }
})

// Add item to collection
router.post('/collections/:id/items', async (req, res) => {
  try {
    const { type, refId, title } = req.body as { type: 'audio' | 'screen'; refId: string; title: string }
    if (!type || !refId || !title) return res.status(400).json({ error: 'type, refId, title required' })

    // Remove existing entry for this refId first (idempotent upsert)
    await Collection.findByIdAndUpdate(req.params.id, { $pull: { items: { refId } } })
    await Collection.findByIdAndUpdate(req.params.id, {
      $push: { items: { type, refId, title, addedAt: new Date() } }
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to add item' })
  }
})

// Remove item from collection
router.delete('/collections/:id/items/:refId', async (req, res) => {
  try {
    await Collection.findByIdAndUpdate(req.params.id, {
      $pull: { items: { refId: req.params.refId } }
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to remove item' })
  }
})

// Synthesize a collection-level summary from individual recording extractions
router.post('/collections/:id/synthesize', chatRateLimiter, async (req, res) => {
  try {
    const { items } = req.body as { items: { title: string; extraction: ExtractionResult }[] }
    if (!items?.length) return res.status(400).json({ error: 'items array is required' })

    const providerName = (req.headers['x-provider'] as string) || getAvailableProviders()[0] || 'openrouter'
    const provider = getProvider(providerName)

    const userMessage = buildSynthesisUserMessage(items)
    const reply = await provider.chat(
      [{ role: 'user', content: userMessage }],
      buildSynthesisSystemPrompt()
    )

    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/)
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON' })

    const summary: ExtractionResult = JSON.parse(jsonMatch[1])
    await Collection.findByIdAndUpdate(req.params.id, { $set: { summary } })
    res.json({ summary })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Synthesis failed' })
  }
})

// Chat backed by the collection's stored summary
router.post('/collections/:id/chat', chatRateLimiter, async (req, res) => {
  try {
    const col = await Collection.findById(req.params.id).lean()
    if (!col) return res.status(404).json({ error: 'Collection not found' })
    if (!col.summary) return res.status(400).json({ error: 'Generate a collection summary first' })

    const { message, history = [] } = req.body as {
      message: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' })

    const providerName = (req.headers['x-provider'] as string) || getAvailableProviders()[0] || 'openrouter'
    const provider = getProvider(providerName)
    const systemPrompt = buildCollectionChatSystemPrompt(col.title, col.summary)

    const allMessages = [...history, { role: 'user' as const, content: message }]
    const reply = await provider.chat(allMessages, systemPrompt)

    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/)
    let updatedSummary: ExtractionResult | undefined
    if (jsonMatch) {
      try {
        updatedSummary = JSON.parse(jsonMatch[1]) as ExtractionResult
        await Collection.findByIdAndUpdate(req.params.id, { $set: { summary: updatedSummary } })
      } catch { /* ignore malformed JSON */ }
    }

    const diagram = parseMermaid(reply)
    if (diagram) {
      await Collection.findByIdAndUpdate(req.params.id, { $push: { diagrams: diagram } })
    }

    res.json({ reply, updatedSummary, diagram })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' })
  }
})

export default router
