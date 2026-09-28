import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/userRole.js';
import {
  getDashboardStats,
  getTempleRegistrations,
  getTempleRegistrationById,
  updateRegistrationStatus,
  approveRegistration,
  createAuthorityForRegistration,
  resendAuthorityCredentials,
  rejectRegistration,
  getTemples,
  getTempleById,
  updateTempleStatus,
  updateTempleCategories,
  getAuthorities,
  getUsers,
  updateUserStatus,
  getAdminDevotees,
  updateDevoteeStatus,
  getAdminBookings,
  getAdminPayments,
  getAdminReviews,
  getAdminReviewMetrics,
  updateAdminReviewStatus,
  getAdminTempleReviewInsights,
  createAdminTempleRecommendation,
  getAdminTempleRecommendations,
  getAdminAnalytics,
  getAdminAuditLogs,
  getWebsiteReach,
  getTempleBookingsAnalytics,
  testEmailDelivery,
} from '../controllers/adminController.js';
import {
  createCategory,
  getAdminCategories,
  getAdminCategoryById,
  updateCategory,
  toggleCategoryStatus,
  assignTempleToCategory,
  removeTempleFromCategory,
  getCategorySuggestions,
  reviewCategorySuggestion,
} from '../controllers/adminCategoryController.js';

const router: Router = Router();

// Strict security: All admin routes require valid authentication AND role = ADMIN
router.use(authenticate, requireRole(USER_ROLES.ADMIN));

// 1. Dashboard metrics
router.get('/dashboard', getDashboardStats);

// 2. Temple Registrations
router.get('/temple-registrations', getTempleRegistrations);
router.get('/temple-registrations/:id', getTempleRegistrationById);
router.patch('/temple-registrations/:id/status', updateRegistrationStatus);
router.post('/temple-registrations/:id/approve', approveRegistration);
router.post('/temple-registrations/:id/create-authority', createAuthorityForRegistration);
router.post('/temple-registrations/:id/resend-credentials', resendAuthorityCredentials);
router.post('/temple-registrations/:id/reject', rejectRegistration);

// Diagnostic SMTP test endpoint (Admin only)
router.post('/email/test', testEmailDelivery);

// 3. Temples Management
router.get('/temples', getTemples);
router.get('/temples/:id', getTempleById);
router.patch('/temples/:id/status', updateTempleStatus);
router.patch('/temples/:id/categories', updateTempleCategories);

// 4. Temple Categories Management
router.post('/categories', createCategory);
router.get('/categories', getAdminCategories);
router.get('/categories/:id', getAdminCategoryById);
router.patch('/categories/:id', updateCategory);
router.patch('/categories/:id/status', toggleCategoryStatus);
router.post('/categories/:id/temples/:templeId', assignTempleToCategory);
router.delete('/categories/:id/temples/:templeId', removeTempleFromCategory);

// 5. Category Suggestions Management
router.get('/category-suggestions', getCategorySuggestions);
router.patch('/category-suggestions/:id', reviewCategorySuggestion);

// 6. Temple Authorities
router.get('/authorities', getAuthorities);

// 7. Users Management (Generic & Devotee-specific)
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.get('/devotees', getAdminDevotees);
router.patch('/devotees/:id/status', updateDevoteeStatus);

// 8. Bookings Supervisory Directory
router.get('/bookings', getAdminBookings);

// 9. Payments Monitoring & Reconciliation
router.get('/payments', getAdminPayments);

// 10. Feedback & Reviews Moderation & Insights
router.get('/reviews', getAdminReviews);
router.get('/reviews/metrics', getAdminReviewMetrics);
router.patch('/reviews/:id/status', updateAdminReviewStatus);
router.get('/reviews/insights/:templeId', getAdminTempleReviewInsights);

// 11. Temple Recommendations
router.post('/recommendations', createAdminTempleRecommendation);
router.get('/recommendations', getAdminTempleRecommendations);

// 12. Analytics
router.get('/analytics', getAdminAnalytics);
router.get('/analytics/temple-bookings', getTempleBookingsAnalytics);

// 13. Audit & Activity
router.get('/audit-logs', getAdminAuditLogs);

// 14. Website Reach
router.get('/reach', getWebsiteReach);

export default router;
