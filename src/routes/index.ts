import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import templeRegistrationRoutes from './templeRegistrationRoutes.js';
import adminRoutes from './adminRoutes.js';
import authorityRoutes from './authorityRoutes.js';
import templeRoutes from './templeRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import userRoutes from './userRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import visitPlanRoutes from './visitPlanRoutes.js';
import reviewRoutes from './reviewRoutes.js';

const router: Router = Router();

// Health check route mounted at /api/health
router.use('/health', healthRoutes);

// Authentication & Session routes mounted at /api/auth
router.use('/auth', authRoutes);

// Public Temple Registration submission mounted at /api/temple-registrations
router.use('/temple-registrations', templeRegistrationRoutes);

// Public Temple Discovery & Availability routes mounted at /api/temples
router.use('/temples', templeRoutes);

// Public Temple Category Discovery mounted at /api/categories
router.use('/categories', categoryRoutes);

// Devotee / User Profile routes mounted at /api/users
router.use('/users', userRoutes);

// Devotee Bookings foundation mounted at /api/bookings
router.use('/bookings', bookingRoutes);

// Devotee Payments mounted at /api/payments
router.use('/payments', paymentRoutes);

// Devotee Notifications mounted at /api/notifications
router.use('/notifications', notificationRoutes);

// Devotee Visit Planning mounted at /api/visit-plans
router.use('/visit-plans', visitPlanRoutes);

// Devotee Reviews & Public Community Experiences mounted at /api/reviews
router.use('/reviews', reviewRoutes);

// Admin Control Center mounted at /api/admin
router.use('/admin', adminRoutes);

// Temple Authority Interface mounted at /api/authority
router.use('/authority', authorityRoutes);

export default router;
