import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/userRole.js';
import {
  getUpcomingBookingsWithPlans,
  getVisitPlanByBookingId,
  generateVisitPlan,
  autocompletePlaces,
  getPlaceDetailsById,
} from '../controllers/visitPlanController.js';

const router: Router = Router();

// Devotee protected endpoints only
router.use(authenticate, requireRole(USER_ROLES.DEVOTEE));

// 1. Google Places (New) autocomplete and details endpoints
router.get('/places/autocomplete', autocompletePlaces);
router.get('/places/details/:placeId', getPlaceDetailsById);

// 2. Get current devotee's upcoming confirmed bookings with any saved visit plans
router.get('/', getUpcomingBookingsWithPlans);

// 3. Get saved visit plan for a specific booking
router.get('/:bookingId', getVisitPlanByBookingId);

// 4. Generate or recalculate visit plan
router.post('/:bookingId/generate', generateVisitPlan);

export default router;
