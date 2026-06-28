import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { cacheGet, cacheSet } from '../utils/jobSearchCache'

const router = Router()

router.get('/geo/locations', authMiddleware, async (req, res) => {
  try {
    const q = ((req.query.q as string) ?? '').trim()
    if (!q || q.length < 2) {
      res.json([])
      return
    }

    const cacheKey = `geo:${q.toLowerCase()}`
    const cached = cacheGet<string[]>(cacheKey)
    if (cached) { res.json(cached); return }

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'MeetingNote-App/1.0 (job search location autocomplete)' },
      signal: AbortSignal.timeout(4000),
    })

    if (!resp.ok) { res.json([]); return }

    const data = await resp.json() as { features: any[] }

    const results: string[] = []
    const seen = new Set<string>()

    for (const f of data.features ?? []) {
      const p = f.properties ?? {}
      const type: string = p.type ?? p.osm_value ?? ''

      // Keep cities, towns, districts and states — skip streets/POIs
      if (!['city', 'town', 'village', 'district', 'state', 'county'].includes(type)) continue

      const city = p.name as string | undefined
      const country = p.country as string | undefined
      if (!city || !country) continue

      const label = `${city}, ${country}`
      if (!seen.has(label)) {
        seen.add(label)
        results.push(label)
      }
      if (results.length >= 8) break
    }

    cacheSet(cacheKey, results)
    res.json(results)
  } catch {
    res.json([])
  }
})

export default router
