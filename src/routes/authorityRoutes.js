import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/userRole.js';
import {
  getDashboard,
  getTemple,
  updateTemple,
  getGallery,
  addGalleryImage,
  uploadGalleryImage,
  deleteGalleryImage,
  setGalleryThumbnail,
  setGalleryBanner,
  updateGalleryOrder,
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getTimeSlots,
  getTimeSlotById,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getBookings,
  getDevotees,
  getAnalytics,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getAuthorityRecommendations,
  updateAuthorityRecommendationStatus,
} from '../controllers/authorityController.js';
import {
  getAuthorityAnnouncements,
  createAuthorityAnnouncement,
  updateAuthorityAnnouncement,
  deleteAuthorityAnnouncement,
} from '../controllers/authorityAnnouncementController.js';
import { submitCategorySuggestion } from '../controllers/categoryController.js';
import { uploadImage } from '../middleware/uploadMiddleware.js';

const router = Router();

// All authority routes strictly require valid authentication and TEMPLE_AUTHORITY role
router.use(authenticate, requireRole(USER_ROLES.TEMPLE_AUTHORITY));

// --- Dashboard ---
router.get('/dashboard', getDashboard);

// --- Temple Profile Management ---
router.get('/temple', getTemple);
router.patch('/temple', updateTemple);

// --- Category Suggestions ---
router.post('/category-suggestions', submitCategorySuggestion);

// --- Gallery Management ---
router.get('/gallery', getGallery);
router.post('/gallery', addGalleryImage);
router.post(
  '/gallery/upload',
  uploadImage.fields([
    { name: 'images', maxCount: 20 },
    { name: 'image', maxCount: 20 },
  ]),
  uploadGalleryImage
);
router.patch('/gallery/order', updateGalleryOrder);
router.patch('/gallery/:imageId/thumbnail', setGalleryThumbnail);
router.patch('/temple/gallery/:imageId/thumbnail', setGalleryThumbnail);
router.patch('/gallery/:imageId/banner', setGalleryBanner);
router.patch('/temple/gallery/:imageId/banner', setGalleryBanner);
router.delete('/gallery/:imageId', deleteGalleryImage);
router.delete('/temple/gallery/:imageId', deleteGalleryImage);

// --- Services Management ---
router.get('/services', getServices);
router.post('/services', createService);
router.get('/services/:id', getServiceById);
router.patch('/services/:id', updateService);
router.delete('/services/:id', deleteService);

// --- Time Slots Management ---
router.get('/time-slots', getTimeSlots);
router.post('/time-slots', createTimeSlot);
router.get('/time-slots/:id', getTimeSlotById);
router.patch('/time-slots/:id', updateTimeSlot);
router.delete('/time-slots/:id', deleteTimeSlot);

// --- Bookings & Devotees (Read-Only) ---
router.get('/bookings', getBookings);
router.get('/devotees', getDevotees);

// --- Analytics ---
router.get('/analytics', getAnalytics);

// --- Notifications ---
router.get('/notifications', getNotifications);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationRead);

// --- Temple Recommendations Feedback Loop ---
router.get('/recommendations', getAuthorityRecommendations);
router.patch('/recommendations/:id/status', updateAuthorityRecommendationStatus);

// --- Temple Announcements Management ---
router.get('/announcements', getAuthorityAnnouncements);
router.post('/announcements', createAuthorityAnnouncement);
router.patch('/announcements/:id', updateAuthorityAnnouncement);
router.delete('/announcements/:id', deleteAuthorityAnnouncement);

export default router;
