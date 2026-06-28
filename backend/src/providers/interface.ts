import type { ExtractionResult } from '../types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIProvider {
  extract(transcript: string): Promise<ExtractionResult>
  chat(history: ChatMessage[], systemPrompt: string): Promise<string>
}
