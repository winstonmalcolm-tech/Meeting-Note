import OpenAI from 'openai'

const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'deepseek/deepseek-v4-flash'
]

export interface QAPair {
  question: string
  answer: string
}

export interface InterviewChatOptions {
  provider: string
  targetRole: string
  skills: string
  experience: string
  qaHistory: QAPair[]
  question: string
  onToken: (token: string) => void
  onDone: () => void
}

function buildSystemPrompt(opts: InterviewChatOptions): string {
  const profile = [
    opts.targetRole ? `Role applying for: ${opts.targetRole}` : null,
    opts.skills     ? `Skills: ${opts.skills}`                 : null,
    opts.experience ? `Background: ${opts.experience}`         : null
  ].filter(Boolean).join('\n')

  const history = opts.qaHistory.length > 0
    ? '\nPrevious answers this session:\n' +
      opts.qaHistory.map((qa, i) =>
        `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`
      ).join('\n\n')
    : ''

  return `You are a real-time interview coach. Generate a concise, natural, first-person spoken answer the candidate can say aloud.

${profile}${history}

Rules:
1. Output ONLY the spoken answer — no preamble, no labels, no markdown.
2. Lead with the direct answer in the first sentence. No throat-clearing or lengthy setup.
3. First person, conversational, confident. 2–3 sentences max — only add a second or third sentence if it's a concrete detail that strengthens the answer, not filler.
4. Do not end with a follow-up question or invitation to discuss further unless the question genuinely can't be answered without one.
5. Stay consistent with prior answers. Do not contradict anything said above.
6. Sound like a real person, not a cover letter.`
}

export async function streamInterviewChat(opts: InterviewChatOptions): Promise<void> {
  const systemPrompt = buildSystemPrompt(opts)
  const apiKey = process.env.OPENROUTE_API_KEY
  if (!apiKey) throw new Error('OPENROUTE_API_KEY not set')

  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await (client.chat.completions.create as any)({
    model: FALLBACK_MODELS[0],
    models: FALLBACK_MODELS,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: opts.question }
    ]
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content
    if (token) opts.onToken(token)
  }
  opts.onDone()
}
