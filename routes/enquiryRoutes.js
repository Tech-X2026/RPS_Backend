import express from 'express';
import {
  createEnquiry,
  getEnquiries,
  getNewEnquiryCount,
  updateEnquiryStatus,
  deleteEnquiry,
} from '../controllers/enquiryController.js';
import protect from '../middleware/auth.js';
import { adminOnly } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/new/count', protect, adminOnly, getNewEnquiryCount);
router.route('/').post(createEnquiry).get(protect, adminOnly, getEnquiries);
router.route('/:id').put(protect, adminOnly, updateEnquiryStatus).delete(protect, adminOnly, deleteEnquiry);

export default router;
