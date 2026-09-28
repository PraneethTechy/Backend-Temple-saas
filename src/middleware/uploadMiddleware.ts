import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { ApiError } from '../utils/apiError.js';

// Memory storage to process image buffer without storing files on disk
const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type '${file.mimetype}'. Only JPG, JPEG, PNG, and WEBP image formats are supported.`
      ) as unknown as null,
      false
    );
  }
};

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

export default uploadImage;
