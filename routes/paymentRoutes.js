import express from 'express';
import {
  createOrder,
  verifyPayment,
  getPaymentLink,
  downloadReceipt,
  manualFeeEntry,
} from '../controllers/paymentController.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Protected routes (admin only)
router.post('/create-order', protect, createOrder);
router.post('/manual-entry', protect, manualFeeEntry);

// Public routes (for payment page)
router.post('/verify', verifyPayment);
router.get('/link/:id', getPaymentLink);
router.get('/receipt/:studentId/:paymentIndex', downloadReceipt);

export default router;
