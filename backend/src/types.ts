export interface Feature {
  title: string
  description: string
  dataFlow: string[]
  decisions: string[]
  openQuestions: string[]
}

export interface ExtractionResult {
  summary: string
  requirements: {
    functional: string[]
    nonFunctional: string[]
  }
  features: Feature[]
  decisions: string[]
  openQuestions: string[]
}

export type ProviderName = 'openrouter'

export interface Diagram {
  id: string
  title: string
  code: string   // Mermaid syntax
  createdAt: number
}
