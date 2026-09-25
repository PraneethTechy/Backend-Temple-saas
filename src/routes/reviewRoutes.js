import { Router } from 'express';
import {
  getPublicReviews,
  getDevoteeEligibleBookings,
  submitDevoteeReview,
} from '../controllers/reviewController.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/userRole.js';
import uploadImage from '../middleware/uploadMiddleware.js';

const router = Router();

// Public: Get Approved Reviews (Supports optional authentication to also show author's own pending reviews)
router.get('/', optionalAuthenticate, getPublicReviews);

// Devotee Only: Get eligible bookings to review
router.get(
  '/eligible-bookings',
  authenticate,
  requireRole(USER_ROLES.DEVOTEE),
  getDevoteeEligibleBookings
);

// Devotee Only: Submit a new review with up to 5 photos
router.post(
  '/',
  authenticate,
  requireRole(USER_ROLES.DEVOTEE),
  uploadImage.array('photos', 5),
  submitDevoteeReview
);


export default router;
