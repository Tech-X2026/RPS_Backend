import express from 'express';
import protect from '../middleware/auth.js';
import { getActiveSession, createOrUpdateSession } from '../controllers/sessionController.js';

const router = express.Router();

router.get('/', protect, getActiveSession);
router.post('/', protect, createOrUpdateSession);

export default router;
