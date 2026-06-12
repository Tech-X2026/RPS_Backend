import express from 'express';
import {
  getDefaulters,
  getDefaulterStats,
  exportDefaulters,
} from '../controllers/defaulterController.js';
import protect from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/', getDefaulters);
router.get('/stats', getDefaulterStats);
router.get('/export', exportDefaulters);

export default router;
