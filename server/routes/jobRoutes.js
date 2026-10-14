import express from 'express';
import {
  getAllJobs,
  getJobById,
  createOrUpdateJob,
  updateJob,
  deleteJob
} from '../controllers/jobController.js';

const router = express.Router();

router.route('/')
  .get(getAllJobs)
  .post(createOrUpdateJob);

router.route('/:id')
  .get(getJobById)
  .patch(updateJob)
  .delete(deleteJob);

export default router;
