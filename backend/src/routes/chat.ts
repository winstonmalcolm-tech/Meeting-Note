import { Router } from 'express'
import { getProvider, getAvailableProviders } from '../provider-registry'
import { chatRateLimiter } from '../utils/rate-limiter'
import { buildChatSystemPrompt } from '../prompts/chat'
import { ScreenRecording } from '../models/screenRecording'
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

// Chat for screen recordings. Pass fileId to auto-persist generated diagrams.
router.post('/chat', authMiddleware, chatRateLimiter, async (req, res) => {
  try {
    const { title, extraction, history = [], message, fileId } = req.body as {
      title: string
      extraction: ExtractionResult
      history: Array<{ role: 'user' | 'assistant'; content: string }>
      message: string
      fileId?: string
    }

    if (!extraction || !message?.trim()) {
      res.status(400).json({ error: 'extraction and message are required' })
      return
    }

    const providerName = (req.headers['x-provider'] as string) || getAvailableProviders()[0] || 'openai'
    const provider = getProvider(providerName)
    const systemPrompt = buildChatSystemPrompt(title ?? 'Recording', extraction)

    const allMessages = [...history, { role: 'user' as const, content: message }]
    const reply = await provider.chat(allMessages, systemPrompt)

    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/)
    let updatedExtraction: ExtractionResult | undefined
    if (jsonMatch) {
      try { updatedExtraction = JSON.parse(jsonMatch[1]) } catch { /* ignore */ }
    }

    const diagram = parseMermaid(reply)
    if (diagram && fileId) {
      await ScreenRecording.findOneAndUpdate({ fileId }, { $push: { diagrams: diagram } })
    }

    res.json({ reply, updatedExtraction, diagram })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' })
  }
})

export default router
