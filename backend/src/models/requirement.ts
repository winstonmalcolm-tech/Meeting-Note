import { Schema, model } from 'mongoose'
import type { ExtractionResult } from '../types'

interface IRequirement {
  title: string
  createdAt: Date
  transcript?: string
  extraction: ExtractionResult
  diagrams: unknown[]
}

const schema = new Schema<IRequirement>({
  title:      { type: String, required: true },
  createdAt:  { type: Date,   default: Date.now },
  transcript: { type: String },
  extraction: { type: Schema.Types.Mixed, required: true },
  diagrams:   { type: [Schema.Types.Mixed], default: [] }
})

export const Requirement = model<IRequirement>('Requirement', schema)
