import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenRouterClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENROUTE_API_KEY) {
      throw new Error('OPENROUTE_API_KEY is not set in environment')
    }
    _client = new OpenAI({ apiKey: process.env.OPENROUTE_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
  }
  return _client
}
