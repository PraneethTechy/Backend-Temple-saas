import { Router } from 'express';
import {
  getPublicTemples,
  getPublicTempleBySlug,
  getPublicTempleServices,
  getPublicServiceAvailability,
  getPublicTempleAnnouncements,
  getPublicTempleReviews,
} from '../controllers/templeController.js';

const router: Router = Router();

// Public discovery and listing
router.get('/', getPublicTemples);

// Specific sub-resource routes must be registered before the generic /:slug route
router.get('/:templeId/services', getPublicTempleServices);
router.get('/:templeId/services/:serviceId/availability', getPublicServiceAvailability);
router.get('/:templeId/announcements', getPublicTempleAnnouncements);
router.get('/:templeId/reviews', getPublicTempleReviews);

// Public temple details by slug (or ID)
router.get('/:slug', getPublicTempleBySlug);

export default router;
