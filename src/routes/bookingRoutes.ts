import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/userRole.js';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  verifyBookingByToken,
} from '../controllers/bookingController.js';

const router: Router = Router();

// Public Gate Verification Route (Unauthenticated - for phone camera & gate scanner verification)
router.get('/verify/:token', verifyBookingByToken);

// Devotee bookings endpoints (Authenticated DEVOTEE only)
router.use(authenticate, requireRole(USER_ROLES.DEVOTEE));

// Create a new devotee booking
router.post('/', createBooking);

// Get current devotee bookings
router.get('/my', getMyBookings);

// Get specific booking details
router.get('/:id', getBookingById);

// Cancel a pending booking
router.patch('/:id/cancel', cancelBooking);

export default router;
