import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notificationController.js';

const router = Router();

// Notification endpoints require authentication
router.use(authenticate);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);

export default router;
