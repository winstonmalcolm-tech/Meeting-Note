import { Router, Request, Response } from 'express'
import { createHash } from 'crypto'
import { getProvider, getAvailableProviders } from '../provider-registry'
import { ExtractionCache } from '../models/extractionCache'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/extract', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body as { transcript: string }
    if (!transcript?.trim()) {
      res.status(400).json({ error: 'No transcript provided' })
      return
    }

    const providerName = (req.headers['x-provider'] as string) || getAvailableProviders()[0] || 'openai'
    const transcriptHash = createHash('sha256').update(transcript).digest('hex')

    const cached = await ExtractionCache.findOne({ transcriptHash }).lean()
    if (cached) {
      res.json(cached.extraction)
      return
    }

    const result = await getProvider(providerName).extract(transcript)

    ExtractionCache.create({ transcriptHash, extraction: result, provider: providerName }).catch(() => {})

    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('Extraction error:', message)
    res.status(500).json({ error: message })
  }
})

export default router
