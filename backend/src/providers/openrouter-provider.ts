import OpenAI from 'openai'
import type { AIProvider, ChatMessage } from './interface'
import type { ExtractionResult } from '../types'
import { EXTRACTION_SYSTEM_PROMPT } from '../prompts/extraction'

// Ordered fallback chain: OpenRouter tries each in sequence if the previous is unavailable
const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'deepseek/deepseek-v4-flash'
]

export class OpenRouterProvider implements AIProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  }

  async extract(transcript: string): Promise<ExtractionResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (this.client.chat.completions.create as any)({
      model: FALLBACK_MODELS[0],
      models: FALLBACK_MODELS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: transcript }
      ]
    })
    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenRouter')
    return JSON.parse(content) as ExtractionResult
  }

  async chat(history: ChatMessage[], systemPrompt: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (this.client.chat.completions.create as any)({
      model: FALLBACK_MODELS[0],
      models: FALLBACK_MODELS,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content }))
      ]
    })
    return completion.choices[0]?.message?.content ?? ''
  }
}
