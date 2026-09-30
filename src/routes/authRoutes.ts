import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  getMe,
  logout,
  createAdmin,
  changePassword,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router: Router = Router();

// Public Authentication Routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', logout);

// Protected Admin Bootstrap (Secret Header Required)
router.post('/create-admin', createAdmin);

// Protected User Session Routes
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

export default router;
