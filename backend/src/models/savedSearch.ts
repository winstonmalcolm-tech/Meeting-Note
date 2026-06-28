import mongoose, { Document, Schema } from 'mongoose'

export interface ISavedSearch extends Document {
  userId: mongoose.Types.ObjectId
  query: string
  location: string
  isActive: boolean
  lastRunAt?: Date
  createdAt: Date
}

const SavedSearchSchema = new Schema<ISavedSearch>({
  userId:    { type: Schema.Types.ObjectId, required: true, index: true },
  query:     { type: String, required: true },
  location:  { type: String, default: '' },
  isActive:  { type: Boolean, default: true },
  lastRunAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
})

export const SavedSearch = mongoose.model<ISavedSearch>('SavedSearch', SavedSearchSchema)
