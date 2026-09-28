import logger from '../utils/logger.js';

export interface SendAuthorityWelcomeCredentialsParams {
  email: string;
  name: string;
  templeName: string;
  temporaryPassword?: string;
}

export interface SendAuthorityWelcomeCredentialsResult {
  delivered: boolean;
  mode: string;
  recipient: string;
}

/**
 * Service abstraction for sending welcome credentials to newly provisioned Temple Authorities.
 * In Phase 4, this acts as a clean boundary. It will be wired to Nodemailer in the dedicated email phase.
 * 
 * IMPORTANT:
 * - Does NOT log or expose plaintext passwords.
 * - Does NOT return secrets to caller APIs.
 */
export const sendAuthorityWelcomeCredentials = async ({
  email,
  templeName,
}: SendAuthorityWelcomeCredentialsParams): Promise<SendAuthorityWelcomeCredentialsResult> => {
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
