import { Schema, model } from 'mongoose'
import type { ExtractionResult } from '../types'

interface IScreenRecording {
  fileId: string          // matches the timestamp-based disk file ID
  sourceName: string
  sourceType: 'screen' | 'window'
  duration: number
  size: number
  withMic: boolean
  createdAt: Date
  status: 'pending' | 'processed' | 'error'
  transcript?: string
  extraction?: ExtractionResult
  errorMessage?: string
  diagrams: unknown[]
}

const schema = new Schema<IScreenRecording>({
  fileId:      { type: String, required: true, unique: true },
  sourceName:  { type: String, required: true },
  sourceType:  { type: String, required: true },
  duration:    { type: Number, required: true },
  size:        { type: Number, required: true },
  withMic:     { type: Boolean, required: true },
  createdAt:   { type: Date, default: Date.now },
  status:      { type: String, default: 'pending' },
  transcript:  { type: String },
  extraction:  { type: Schema.Types.Mixed },
  errorMessage: { type: String },
  diagrams:    { type: [Schema.Types.Mixed], default: [] }
})

export const ScreenRecording = model<IScreenRecording>('ScreenRecording', schema)
