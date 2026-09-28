import { Router } from 'express';
import { submitRegistration } from '../controllers/templeRegistrationController.js';

const router: Router = Router();

// Public route to submit a temple registration application
router.post('/', submitRegistration);

export default router;
