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

export interface SavedRequirement {
  id: string
  title: string
  createdAt: number
  transcript?: string
  extraction: ExtractionResult
  diagrams?: Diagram[]
}

export interface Diagram {
  id: string
  title: string
  code: string
  createdAt: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  updatedExtraction?: ExtractionResult
  diagram?: Diagram
}

export type SessionStatus = 'idle' | 'transcribing' | 'extracting' | 'done' | 'error'

export interface ScreenRecordingEntry {
  id: string
  createdAt: number
  duration: number
  size: number
  name?: string
  sourceName: string
  sourceType: 'screen' | 'window' | 'upload'
  withMic: boolean
  fileExt?: string
  status?: 'pending' | 'processed' | 'error'
  transcript?: string
  extraction?: ExtractionResult
  errorMessage?: string
}

export interface RecordingEntry {
  id: string
  createdAt: number
  duration: number
  size: number
  name?: string
  status: 'pending' | 'processed' | 'error'
  provider?: string
  transcript?: string
  extraction?: ExtractionResult
  errorMessage?: string
}

export interface CollectionItem {
  type: 'audio' | 'screen'
  refId: string
  title: string
  addedAt: number
}

export interface Collection {
  id: string
  title: string
  description?: string
  createdAt: number
  items: CollectionItem[]
  summary?: ExtractionResult
  diagrams?: Diagram[]
}
