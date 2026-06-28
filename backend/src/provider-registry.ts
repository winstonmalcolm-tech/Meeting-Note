import type { AIProvider, ChatMessage } from './providers/interface'
import { OpenRouterProvider } from './providers/openrouter-provider'
import type { ProviderName } from './types'
import { withRetry } from './utils/retry'
import type { ExtractionResult } from './types'

class RetryingProvider implements AIProvider {
  constructor(private inner: AIProvider) {}

  extract(transcript: string): Promise<ExtractionResult> {
    return withRetry(() => this.inner.extract(transcript))
  }

  chat(history: ChatMessage[], systemPrompt: string): Promise<string> {
    return withRetry(() => this.inner.chat(history, systemPrompt))
  }
}

export function getAvailableProviders(): ProviderName[] {
  const available: ProviderName[] = []
  if (process.env.OPENROUTE_API_KEY) available.push('openrouter')
  return available
}

export function getProvider(name: string): AIProvider {
  if (name !== 'openrouter') throw new Error(`Unknown provider: "${name}". Valid options: openrouter`)
  if (!process.env.OPENROUTE_API_KEY) throw new Error('OPENROUTE_API_KEY is not set')
  return new RetryingProvider(new OpenRouterProvider(process.env.OPENROUTE_API_KEY))
}
