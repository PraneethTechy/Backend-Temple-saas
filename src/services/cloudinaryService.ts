import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

let isConfigured = false;

const configureCloudinary = (): boolean => {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (cloud_name && api_key && api_secret) {
    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true,
    });
    isConfigured = true;
    return true;
  }

  isConfigured = false;
  return false;
};

/**
 * Checks if Cloudinary is configured with valid credentials.
 * @returns boolean
 */
export const hasCloudinaryConfig = (): boolean => {
  return configureCloudinary();
};

export interface UploadImageResult {
  url: string;
  publicId: string;
}

/**
 * Uploads an image buffer directly to Cloudinary.
 * 
 * @param buffer - File buffer from multer
 * @param folder - Destination folder in Cloudinary
 * @returns Promise resolving to secure URL and public ID
 */
export const uploadImageBufferToCloudinary = async (
  buffer: Buffer,
  folder = 'devasetu/temples'
): Promise<UploadImageResult> => {
  const configured = configureCloudinary();

  if (!configured) {
    // If in automated test mode or mock mode and Cloudinary is not set up
    if (process.env.NODE_ENV === 'test' || process.env.MOCK_CLOUDINARY === 'true') {
      const mockId = `devasetu_test_${Date.now()}`;
      logger.info(`[CloudinaryService:Mock] Simulated image upload: ${mockId}`);
      return {
        url: `https://res.cloudinary.com/devasetu-demo/image/upload/v1700000000/${folder}/${mockId}.webp`,
        publicId: `${folder}/${mockId}`,
      };
    }

    throw ApiError.badRequest(
      'Cloudinary upload is not configured on the server. Please add an image via URL instead, or configure CLOUDINARY credentials in server/.env.'
    );
  }

  return new Promise<UploadImageResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error: any, result?: UploadApiResponse) => {
        if (error) {
          logger.error(`[CloudinaryService] Upload failed: ${error.message}`);

          // If MOCK_CLOUDINARY is enabled in .env, gracefully fallback to simulated mock upload
          if (process.env.MOCK_CLOUDINARY === 'true') {
            const mockId = `devasetu_mock_${Date.now()}`;
            logger.warn(
              `[CloudinaryService:Fallback] Live Cloudinary upload failed (${error.message}). Falling back to simulated mock asset because MOCK_CLOUDINARY=true.`
            );
            return resolve({
              url: `https://res.cloudinary.com/devasetu-demo/image/upload/v1700000000/${folder}/${mockId}.webp`,
              publicId: `${folder}/${mockId}`,
            });
          }

          let errorMessage = error.message;
          const isPermissionDenied =
            error.http_code === 403 ||
            String(error.message).includes('403') ||
            String(error.message).includes('permissions');

          if (isPermissionDenied) {
            errorMessage = `Cloudinary 403 Forbidden: The API key for '${process.env.CLOUDINARY_CLOUD_NAME}' lacks upload ('create') permissions, or the Cloudinary account email is not yet verified. Please verify your Cloudinary email or grant 'Create / Upload' permissions in Cloudinary Settings -> Access Keys, or set MOCK_CLOUDINARY=true in server/.env, or use the 'Image URL' option.`;
          }

          return reject(ApiError.badRequest(`Image upload failed: ${errorMessage}`));
        }

        if (!result) {
          return reject(ApiError.badRequest('Image upload failed: Empty result from Cloudinary'));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Deletes an image from Cloudinary by its publicId.
 * 
 * @param publicId - Cloudinary asset public ID
 * @returns Promise resolving to boolean
 */
export const deleteImageFromCloudinary = async (publicId?: string | null): Promise<boolean> => {
  if (!publicId) return true;

  const configured = configureCloudinary();
  if (!configured) {
    if (process.env.NODE_ENV === 'test' || process.env.MOCK_CLOUDINARY === 'true') {
      logger.info(`[CloudinaryService:Mock] Simulated deletion of ${publicId}`);
      return true;
    }
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error: any) {
    logger.warn(`[CloudinaryService] Failed to delete image ${publicId}: ${error.message}`);
    return false;
  }
};

export default {
  hasCloudinaryConfig,
  uploadImageBufferToCloudinary,
  deleteImageFromCloudinary,
};
