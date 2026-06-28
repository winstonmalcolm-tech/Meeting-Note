import { Router } from 'express'
import OpenAI from 'openai'
import { authMiddleware } from '../middleware/auth'

const router = Router()

const SYSTEM_PROMPT = `You are an expert interview coach helping candidates across all professions and disciplines.
Analyze the screenshot and provide a complete answer or solution to the question, problem, or task shown.

Adapt your response to what is on screen:
- For coding problems or technical tasks: use proper markdown formatting — fenced code blocks (\`\`\`language ... \`\`\`), headers, and bullet points where they improve clarity. Show working code with explanations.
- For behavioural, verbal, or open-ended questions: write in natural, conversational language that flows like someone speaking confidently. Use light structure if it helps (brief bullets are fine), but keep it human and direct — not robotic or overly formal.

Always be concise. The response should be easy to read at a glance and immediately actionable.`

const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'deepseek/deepseek-v4-flash'
]

router.post('/solve-screen', authMiddleware, async (req, res) => {
  try {
    const { imageBase64 } = req.body as { imageBase64: string }
    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 is required' })
      return
    }

    const answer = await solveWithOpenRouter(imageBase64)
    res.json({ answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to solve screen'
    res.status(500).json({ error: message })
  }
})

async function solveWithOpenRouter(imageBase64: string): Promise<string> {
  const apiKey = process.env.OPENROUTE_API_KEY
  if (!apiKey) throw new Error('OPENROUTE_API_KEY not set')

  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completion = await (client.chat.completions.create as any)({
    model: FALLBACK_MODELS[0],
    models: FALLBACK_MODELS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'high' }
          },
          { type: 'text', text: 'Analyze the screen and give me the best answer or solution.' }
        ]
      }
    ]
  })
  return completion.choices[0]?.message?.content ?? ''
}

export default router
