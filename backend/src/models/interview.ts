import mongoose, { Schema, type Document } from 'mongoose'

export interface IInterview extends Document {
  userId: string
  companyName: string
  jobTitle: string
  scheduledAt: Date
  notes?: string
  jobApplicationId?: string
  reminderSent: boolean
  createdAt: Date
}

const InterviewSchema = new Schema<IInterview>({
  userId:           { type: String, required: true, index: true },
  companyName:      { type: String, required: true },
  jobTitle:         { type: String, required: true },
  scheduledAt:      { type: Date, required: true },
  notes:            { type: String },
  jobApplicationId: { type: String },
  reminderSent:     { type: Boolean, default: false },
  createdAt:        { type: Date, default: Date.now },
})

export const Interview = mongoose.model<IInterview>('Interview', InterviewSchema)
