import mongoose, { Schema, type Document } from 'mongoose'

export interface IUserProfile extends Document {
  targetRole: string
  skills: string
  experience: string
  resumeText: string
  resumeHtml: string
  coverLetterText: string
  coverLetterHtml: string
  phone: string
  linkedinUrl: string
  updatedAt: Date
}

const UserProfileSchema = new Schema<IUserProfile>({
  targetRole:       { type: String, default: '' },
  skills:           { type: String, default: '' },
  experience:       { type: String, default: '' },
  resumeText:       { type: String, default: '' },
  resumeHtml:       { type: String, default: '' },
  coverLetterText:  { type: String, default: '' },
  coverLetterHtml:  { type: String, default: '' },
  phone:            { type: String, default: '' },
  linkedinUrl:      { type: String, default: '' },
  updatedAt:        { type: Date,   default: Date.now }
})

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema)
