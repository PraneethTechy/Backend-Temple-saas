import logger from '../utils/logger.js';

/**
 * Service abstraction for sending welcome credentials to newly provisioned Temple Authorities.
 * In Phase 4, this acts as a clean boundary. It will be wired to Nodemailer in the dedicated email phase.
 * 
 * IMPORTANT:
 * - Does NOT log or expose plaintext passwords.
 * - Does NOT return secrets to caller APIs.
 * 
 * @param {Object} params
 * @param {string} params.email - Authority email address
 * @param {string} params.name - Authority contact name
 * @param {string} params.templeName - Approved temple name
 * @param {string} params.temporaryPassword - Cryptographically generated temporary password
 * @returns {Promise<{ delivered: boolean, mode: string }>}
 */
export const sendAuthorityWelcomeCredentials = async ({ email, name, templeName, temporaryPassword }) => {
  // In development/pre-email phase: record that credentials are queued for delivery
  logger.info(`[CredentialNotificationService] Authority credential delivery queued for: ${email} (${templeName})`);

  // Intentionally returning a safe status object without exposing temporaryPassword
  return {
    delivered: false,
    mode: 'QUEUED_FOR_EMAIL_PHASE',
    recipient: email,
  };
};

export default {
  sendAuthorityWelcomeCredentials,
};
