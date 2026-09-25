import { Router } from 'express';
import {
  getPublicCategories,
  getPublicCategoryBySlug,
} from '../controllers/categoryController.js';

const router = Router();

// Public Category Discovery
router.get('/', getPublicCategories);
router.get('/:slug', getPublicCategoryBySlug);

export default router;
