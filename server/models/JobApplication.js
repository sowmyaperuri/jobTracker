import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema(
  {
    jobTitle: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    location: {
      type: String,
      default: '',
      trim: true
    },
    jobUrl: {
      type: String,
      required: [true, 'Job URL is required'],
      trim: true
    },
    salary: {
      type: String,
      default: '',
      trim: true
    },
    jobType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship', ''],
      default: 'Full-Time'
    },
    status: {
      type: String,
      enum: ['Wishlist', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'],
      default: 'Applied'
    },
    appliedDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    description: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    confidenceScores: {
      jobTitle: { type: Number, default: 0 },
      companyName: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      salary: { type: Number, default: 0 },
      jobUrl: { type: Number, default: 1.0 }
    }
  },
  {
    timestamps: true
  }
);

// Add index on jobUrl for fast deduplication lookups
jobApplicationSchema.index({ jobUrl: 1 });

export const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);
