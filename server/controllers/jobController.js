import { JobApplication } from '../models/JobApplication.js';

/**
 * @desc   Get all job applications (sorted by appliedDate descending)
 * @route  GET /api/applications
 */
export async function getAllJobs(req, res) {
  try {
    const jobs = await JobApplication.find().sort({ appliedDate: -1, createdAt: -1 });
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * @desc   Get single job application by ID
 * @route  GET /api/applications/:id
 */
export async function getJobById(req, res) {
  try {
    const job = await JobApplication.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job application not found' });
    }
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * @desc   Create or update job application (Upsert by jobUrl)
 * @route  POST /api/applications
 */
export async function createOrUpdateJob(req, res) {
  try {
    const { jobUrl, jobTitle, companyName } = req.body;

    if (!jobUrl || !jobTitle || !companyName) {
      return res.status(400).json({ 
        success: false, 
        error: 'jobUrl, jobTitle, and companyName are required fields' 
      });
    }

    // Upsert logic: Update if jobUrl exists, else insert new record
    const job = await JobApplication.findOneAndUpdate(
      { jobUrl },
      { ...req.body },
      { new: true, upsert: true, runValidators: true }
    );

    console.log(`✅ [JobTrack] Saved: "${job.jobTitle}" @ ${job.companyName}`);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * @desc   Update existing job application by ID
 * @route  PATCH /api/applications/:id
 */
export async function updateJob(req, res) {
  try {
    const job = await JobApplication.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job application not found' });
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * @desc   Delete job application by ID
 * @route  DELETE /api/applications/:id
 */
export async function deleteJob(req, res) {
  try {
    const job = await JobApplication.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job application not found' });
    }

    res.status(200).json({ success: true, message: 'Job application deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
