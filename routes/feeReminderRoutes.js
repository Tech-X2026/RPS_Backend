import express from 'express';
import {
  getPendingFeeStudents,
  generateWhatsAppLink,
  generateBulkLinks,
} from '../controllers/feeReminderController.js';
import protect from '../middleware/auth.js';
import { adminOnly } from '../middleware/roleGuard.js';

const router = express.Router();

// All fee reminder routes are admin only
router.use(protect, adminOnly);

router.get('/pending', getPendingFeeStudents);
router.post('/whatsapp-link', generateWhatsAppLink);
router.post('/bulk-links', generateBulkLinks);

export default router;
