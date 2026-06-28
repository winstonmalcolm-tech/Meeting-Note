import mongoose, { Schema, type Document } from 'mongoose'

export interface INotification extends Document {
  userId: string
  title: string
  body: string
  type: 'interview_reminder' | 'job_search_results'
  refId?: string
  read: boolean
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>({
  userId:    { type: String, required: true, index: true },
  title:     { type: String, required: true },
  body:      { type: String, required: true },
  type:      { type: String, enum: ['interview_reminder', 'job_search_results'], required: true },
  refId:     { type: String },
  read:      { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema)
