import mongoose, { Schema, type Document } from 'mongoose'

export interface IWaitlistEntry extends Document {
  email: string
  createdAt: Date
}

const WaitlistSchema = new Schema<IWaitlistEntry>({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now }
})

export const WaitlistEntry = mongoose.model<IWaitlistEntry>('WaitlistEntry', WaitlistSchema)
