import mongoose, { Schema } from 'mongoose'
import type { ExtractionResult } from '../types'

interface IExtractionCache {
  transcriptHash: string
  extraction: ExtractionResult
  provider: string
  createdAt: Date
}

const ExtractionCacheSchema = new Schema<IExtractionCache>({
  transcriptHash: { type: String, required: true, unique: true, index: true },
  extraction:     { type: Schema.Types.Mixed, required: true },
  provider:       { type: String, required: true },
  createdAt:      { type: Date, default: Date.now }
})

export const ExtractionCache = mongoose.model<IExtractionCache>('ExtractionCache', ExtractionCacheSchema)
