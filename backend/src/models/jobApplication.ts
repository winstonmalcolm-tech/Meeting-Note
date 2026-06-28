import mongoose, { Schema, type Document } from 'mongoose'

export interface IJobApplication extends Document {
  userId: string
  companyName: string
  jobTitle: string
  jobDescription: string
  resumeSnapshot: string
  createdAt: Date
  resumeAnalysis?: string
  coverLetter?: string
  decodedJD?: string
}

const JobApplicationSchema = new Schema<IJobApplication>({
  userId:         { type: String, required: true, index: true },
  companyName:    { type: String, required: true },
  jobTitle:       { type: String, required: true },
  jobDescription: { type: String, required: true },
  resumeSnapshot: { type: String, required: true },
  createdAt:      { type: Date, default: Date.now },
  resumeAnalysis: { type: String },
  coverLetter:    { type: String },
  decodedJD:      { type: String },
})

export const JobApplication = mongoose.model<IJobApplication>('JobApplication', JobApplicationSchema)
