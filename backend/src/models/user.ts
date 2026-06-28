import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  plan: 'starter' | 'pro' | 'power' | null
  planStatus: 'pending' | 'active' | 'cancelled'
  polarSubscriptionId?: string
  polarCustomerId?: string
  usageSeconds: number
  usagePeriodStart: Date
  applicationUsageCount: number
  applicationUsagePeriodStart: Date
  fcmTokens: string[]
  cancelAtPeriodEnd: boolean
  subscriptionEndsAt?: Date
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  plan: { type: String, enum: ['starter', 'pro', 'power', null], default: null },
  planStatus: { type: String, enum: ['pending', 'active', 'cancelled'], default: 'pending' },
  polarSubscriptionId: { type: String },
  polarCustomerId: { type: String },
  usageSeconds: { type: Number, default: 0 },
  usagePeriodStart: { type: Date, default: Date.now },
  applicationUsageCount: { type: Number, default: 0 },
  applicationUsagePeriodStart: { type: Date, default: Date.now },
  fcmTokens: { type: [String], default: [] },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  subscriptionEndsAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

export const User = mongoose.model<IUser>('User', UserSchema)
