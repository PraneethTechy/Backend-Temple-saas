import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/userRole.js';
import {
  getProfile,
  updateProfile,
  getSavedTemples,
  saveTemple,
  unsaveTemple,
  getSavedTempleStatus,
} from '../controllers/userController.js';

const router: Router = Router();

// Profile and devotee endpoints require authentication
router.use(authenticate);

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);

// Saved Temples for DEVOTEE
router.get('/me/saved-temples', requireRole(USER_ROLES.DEVOTEE), getSavedTemples);
router.post('/me/saved-temples/:templeId', requireRole(USER_ROLES.DEVOTEE), saveTemple);
router.delete('/me/saved-temples/:templeId', requireRole(USER_ROLES.DEVOTEE), unsaveTemple);
router.get('/me/saved-temples/:templeId/status', requireRole(USER_ROLES.DEVOTEE), getSavedTempleStatus);

export default router;
