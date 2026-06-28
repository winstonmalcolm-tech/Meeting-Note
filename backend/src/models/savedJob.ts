import mongoose, { Document, Schema } from 'mongoose'

export interface ISavedJob extends Document {
  userId: mongoose.Types.ObjectId
  savedSearchId: mongoose.Types.ObjectId
  jobId: string           // external JSearch job_id — used for deduplication
  title: string
  company: string
  location: string
  salary?: string
  description: string
  applyUrl: string
  postedAt: string
  fitScore?: number
  fitReason?: string
  status: 'new' | 'kept' | 'dismissed'
  discoveredAt: Date
}

const SavedJobSchema = new Schema<ISavedJob>({
  userId:        { type: Schema.Types.ObjectId, required: true, index: true },
  savedSearchId: { type: Schema.Types.ObjectId, required: true, index: true },
  jobId:         { type: String, required: true },
  title:         { type: String, default: '' },
  company:       { type: String, default: '' },
  location:      { type: String, default: '' },
  salary:        { type: String },
  description:   { type: String, default: '' },
  applyUrl:      { type: String, default: '' },
  postedAt:      { type: String, default: '' },
  fitScore:      { type: Number },
  fitReason:     { type: String },
  status:        { type: String, enum: ['new', 'kept', 'dismissed'], default: 'new' },
  discoveredAt:  { type: Date, default: Date.now },
})

// Prevent duplicates: same external job for the same user (across all searches)
SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true })

export const SavedJob = mongoose.model<ISavedJob>('SavedJob', SavedJobSchema)
