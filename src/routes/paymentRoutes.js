import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  createPaymentOrder,
  verifyPayment,
  getPaymentByBookingId,
} from '../controllers/paymentController.js';

const router = Router();

// Devotee Payment Order Creation
router.post('/create-order', authenticate, createPaymentOrder);

// Devotee Payment Signature Verification
router.post('/verify', authenticate, verifyPayment);

// Payment details by booking ID
router.get('/booking/:bookingId', authenticate, getPaymentByBookingId);

export default router;
