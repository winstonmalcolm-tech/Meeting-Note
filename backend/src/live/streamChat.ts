import OpenAI from 'openai'

const LIVE_SYSTEM_PROMPT = `You are a concise meeting assistant. You listen to spoken conversation and provide brief, helpful responses.
Keep answers short (2-4 sentences max) unless a longer explanation is genuinely needed.
Focus on answering questions asked or surfacing key insights from what was just said.`

const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'deepseek/deepseek-v4-flash'
]

export async function streamChat(
  _provider: string,
  utterances: string[],
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  const context = utterances.slice(-5).join('\n')
  const message = `Recent meeting speech:\n${context}\n\nRespond helpfully to what was just said.`
  await streamOpenRouter(message, onToken, onDone)
}

async function streamOpenRouter(
  message: string,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  const apiKey = process.env.OPENROUTE_API_KEY
  if (!apiKey) throw new Error('OPENROUTE_API_KEY not set')

  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await (client.chat.completions.create as any)({
    model: FALLBACK_MODELS[0],
    models: FALLBACK_MODELS,
    stream: true,
    messages: [
      { role: 'system', content: LIVE_SYSTEM_PROMPT },
      { role: 'user', content: message }
    ]
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content
    if (token) onToken(token)
  }
  onDone()
}
