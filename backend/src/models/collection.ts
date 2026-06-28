import { Schema, model } from 'mongoose'
import type { ExtractionResult, Diagram } from '../types'

export interface ICollectionItem {
  type: 'audio' | 'screen'
  refId: string
  title: string
  addedAt: Date
}

export interface ICollection {
  title: string
  description?: string
  createdAt: Date
  items: ICollectionItem[]
  summary?: ExtractionResult
  diagrams: Diagram[]
}

const itemSchema = new Schema<ICollectionItem>(
  {
    type:    { type: String, required: true },
    refId:   { type: String, required: true },
    title:   { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

const collectionSchema = new Schema<ICollection>({
  title:       { type: String, required: true },
  description: { type: String },
  createdAt:   { type: Date, default: Date.now },
  items:       { type: [itemSchema], default: [] },
  summary:     { type: Schema.Types.Mixed },
  diagrams:    { type: [Schema.Types.Mixed], default: [] }
})

export const Collection = model<ICollection>('Collection', collectionSchema)
