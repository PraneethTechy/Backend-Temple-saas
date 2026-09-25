import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

let transporterInstance = null;

/**
 * Standard RFC-compliant lightweight syntax validation for email addresses.
 * Does NOT check whether the mailbox physically exists.
 * 
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmailSyntax = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;

  // RFC-compliant light regex: local-part @ domain . tld
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
};

/**
 * Masks an email address for privacy and clean security logging.
 * e.g., "praneethg807@gmail.com" -> "p***7@gmail.com"
 * 
 * @param {string} email
 * @returns {string}
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return 'invalid-email';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

/**
 * Checks whether SMTP credentials are configured in environment variables.
 * 
 * @returns {boolean}
 */
export const isSmtpConfigured = () => {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || '').trim();
  return Boolean(host && user && pass);
};

/**
 * Creates or retrieves the singleton reusable Nodemailer transporter.
 * Does NOT recreate a new transporter for every email.
 * 
 * @returns {nodemailer.Transporter}
 */
export const getTransporter = () => {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt((process.env.SMTP_PORT || '587').trim(), 10);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || '').trim();

  const isGmail = host.toLowerCase().includes('gmail');

  const config = {
    host,
    port: isNaN(port) ? 587 : port,
    // Port 465 requires secure: true; Port 587 uses STARTTLS (secure: false)
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    // Safe network timeouts to prevent hanging on network/firewall glitches
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  };

  // If explicit Gmail SMTP service is detected, ensure standard STARTTLS compliance
  if (isGmail && port === 587) {
    config.requireTLS = true;
  }

  transporterInstance = nodemailer.createTransport(config);
  return transporterInstance;
};

/**
 * Verifies the SMTP transporter connection.
 * Called at server startup in development to provide immediate, clear diagnostics.
 * Does NOT crash the server if SMTP is unavailable.
 * Does NOT expose passwords or sensitive secrets.
 * 
 * @returns {Promise<{ success: boolean, code?: string, message?: string }>}
 */
export const verifySmtpConnection = async () => {
  if (process.env.MOCK_EMAIL === 'true') {
    console.log('[EMAIL SMTP]: MOCK_EMAIL is enabled. Simulated delivery mode active.');
    return { success: true, message: 'Mock email enabled' };
  }

  if (!isSmtpConfigured()) {
    console.warn('EMAIL SMTP: Configuration missing or incomplete (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).');
    console.warn('EMAIL SMTP: Outgoing emails cannot be dispatched until SMTP credentials are provided in server/.env.');
    return {
      success: false,
      code: 'MISSING_CONFIG',
      message: 'SMTP configuration is incomplete in server/.env',
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('EMAIL SMTP: connection successful');
    return { success: true };
  } catch (error) {
    console.error('EMAIL SMTP: connection failed');
    console.error(`Error code: ${error.code || error.responseCode || 'UNKNOWN'}`);
    console.error(`Error message: ${error.message}`);
    if (error.code === 'EAUTH' || error.responseCode === 535 || error.responseCode === 534) {
      console.warn('EMAIL SMTP HINT: For Gmail SMTP, you must use a Google App Password (16 characters) instead of your regular Google account password.');
    }
    return {
      success: false,
      code: error.code || String(error.responseCode) || 'UNKNOWN',
      message: error.message,
    };
  }
};

/**
 * Centralized, robust email dispatch function.
 * 
 * Guarantees:
 * - Syntax validation before calling sendMail
 * - Does NOT swallow Nodemailer errors silently
 * - Categorizes errors into standardized status codes:
 *   - SENT
 *   - INVALID_EMAIL
 *   - SMTP_AUTH_ERROR
 *   - RECIPIENT_REJECTED
 *   - SMTP_CONNECTION_ERROR
 *   - EMAIL_SEND_FAILED
 * - Never returns SMTP passwords or secrets
 * - Masked email logging
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} [options.html] - HTML content
 * @returns {Promise<{ success: boolean, status: string, messageId?: string, response?: string, error?: string, code?: string }>}
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const maskedTo = maskEmail(to);

  // 1. Lightweight syntax validation
  if (!isValidEmailSyntax(to)) {
    logger.warn(`[EMAIL] Rejected: Recipient email address has invalid syntax (${maskedTo})`);
    return {
      success: false,
      status: 'INVALID_EMAIL',
      error: `The recipient email address "${to}" has invalid syntax.`,
    };
  }

  // 2. Check mock mode
  if (process.env.MOCK_EMAIL === 'true' || process.env.NODE_ENV === 'test') {
    logger.info(`[EMAIL:Mock] Simulated email sent to: ${maskedTo} | Subject: "${subject}"`);
    return {
      success: true,
      status: 'SENT',
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      response: '250 Mock email accepted',
    };
  }

  // 3. Check SMTP configuration
  if (!isSmtpConfigured()) {
    logger.warn(`[EMAIL] Failed: SMTP credentials are not configured. Cannot dispatch email to ${maskedTo}.`);
    return {
      success: false,
      status: 'SMTP_CONNECTION_ERROR',
      error: 'SMTP configuration is incomplete in server/.env (SMTP_HOST, SMTP_USER, or SMTP_PASSWORD missing).',
    };
  }

  const senderUser = (process.env.SMTP_USER || '').trim();
  const fromAddress = process.env.SMTP_FROM || `"DevaSetu" <${senderUser}>`;

  logger.info(`[EMAIL] Preparing email`);
  logger.info(`[EMAIL] Recipient: ${maskedTo}`);
  logger.info(`[EMAIL] SMTP configured: true`);
  logger.info(`[EMAIL] Sending email...`);

  try {
    const transporter = getTransporter();

    const mailOptions = {
      from: fromAddress,
      to: to.trim(),
      subject,
      text,
      html: html || undefined,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`[EMAIL] SMTP accepted message`);
    logger.info(`[EMAIL] Message ID: ${info.messageId}`);

    return {
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    const errorCode = error.code || (error.responseCode ? String(error.responseCode) : 'UNKNOWN');
    const errorMessage = error.message || 'Unknown SMTP error';

    let status = 'EMAIL_SEND_FAILED';

    if (
      errorCode === 'EAUTH' ||
      error.responseCode === 535 ||
      error.responseCode === 534 ||
      errorMessage.toLowerCase().includes('username and password not accepted') ||
      errorMessage.toLowerCase().includes('application-specific password required') ||
      errorMessage.toLowerCase().includes('invalid login')
    ) {
      status = 'SMTP_AUTH_ERROR';
    } else if (
      errorCode === 'EENVELOPE' ||
      error.responseCode === 550 ||
      error.responseCode === 553 ||
      (Array.isArray(error.rejected) && error.rejected.length > 0)
    ) {
      status = 'RECIPIENT_REJECTED';
    } else if (
      errorCode === 'ECONNECTION' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ESOCKET'
    ) {
      status = 'SMTP_CONNECTION_ERROR';
    }

    logger.error(`[EMAIL] Failed`);
    logger.error(`[EMAIL] Status: ${status}`);
    logger.error(`[EMAIL] Code: ${errorCode}`);
    logger.error(`[EMAIL] Message: ${errorMessage}`);

    return {
      success: false,
      status,
      code: errorCode,
      error: errorMessage,
    };
  }
};

/**
 * Sends Temple Authority login credentials via styled HTML email.
 * Preserves the existing DevaSetu credential email template and design.
 * 
 * @param {Object} params
 * @param {string} params.email - Recipient email address
 * @param {string} params.name - Authority representative name
 * @param {string} params.templeName - Approved temple name
 * @param {string} params.username - Login username / email
 * @param {string} params.temporaryPassword - Generated temporary password
 * @returns {Promise<{ success: boolean, status: string, messageId?: string, error?: string }>}
 */
export const sendAuthorityCredentialEmail = async ({
  email,
  name,
  templeName,
  username,
  temporaryPassword,
}) => {
  if (!email || !temporaryPassword) {
    return {
      success: false,
      status: 'INVALID_EMAIL',
      error: 'Recipient email and temporary password are required to send credentials.',
    };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const loginUrl = `${clientUrl.replace(/\/+$/, '')}/login`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevaSetu Temple Authority Credentials</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF8F3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2D241E;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(183, 121, 31, 0.08);
      border: 1px solid #EAE4D9;
    }
    .header {
      background: linear-gradient(135deg, #7A2E2E 0%, #B7791F 100%);
      padding: 36px 30px;
      text-align: center;
      color: #FFFFFF;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      font-size: 13px;
      opacity: 0.9;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 30px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #7A2E2E;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      background: #FEF3C7;
      color: #92400E;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .credentials-box {
      background-color: #FAF8F3;
      border: 1px solid #EAE4D9;
      border-left: 4px solid #B7791F;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .cred-row {
      margin-bottom: 12px;
    }
    .cred-row:last-child {
      margin-bottom: 0;
    }
    .cred-label {
      font-size: 11px;
      color: #6B5E55;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .cred-value {
      font-size: 15px;
      font-family: 'Courier New', Courier, monospace;
      font-weight: 700;
      color: #2D241E;
      background: #FFFFFF;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #E5DFD5;
      display: inline-block;
      min-width: 220px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0 24px;
    }
    .cta-button {
      background: #B7791F;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 14px 32px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
      display: inline-block;
      box-shadow: 0 4px 12px rgba(183, 121, 31, 0.25);
    }
    .notice-box {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 12px;
      color: #92400E;
      margin: 20px 0;
    }
    .footer {
      background: #FAF8F3;
      padding: 24px 30px;
      text-align: center;
      font-size: 11px;
      color: #8C7E74;
      border-top: 1px solid #EAE4D9;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DevaSetu</h1>
      <p>Temple Services & Darshan Management Platform</p>
    </div>
    <div class="content">
      <div class="greeting">Dear ${name || 'Temple Representative'},</div>
      <div class="badge">Registration Approved</div>
      <p>
        We are pleased to inform you that your temple registration for <strong>${templeName}</strong> has been officially approved by the DevaSetu administration.
      </p>
      <p>
        Your administrative <strong>Temple Authority</strong> account has been provisioned. You can now manage your temple's public profile, darshan services, time slots, and devotee bookings.
      </p>

      <div class="credentials-box">
        <div class="cred-row">
          <div class="cred-label">Login Username / Email</div>
          <div class="cred-value">${username || email}</div>
        </div>
        <div class="cred-row">
          <div class="cred-label">Temporary Password</div>
          <div class="cred-value">${temporaryPassword}</div>
        </div>
      </div>

      <div class="notice-box">
        <strong>Important Security Notice:</strong> This is a temporary password. For platform security, you will be required to set a new, private password immediately upon your first sign-in before accessing the authority portal.
      </div>

      <div class="button-container">
        <a href="${loginUrl}" class="cta-button" target="_blank">Sign In to DevaSetu Portal</a>
      </div>

      <p style="font-size: 12px; color: #6B5E55;">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${loginUrl}" style="color: #B7791F; word-break: break-all;">${loginUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p><strong>DevaSetu Platform Administration</strong></p>
      <p>Connecting Devotees to Sacred Divine Shrines</p>
      <p style="margin-top: 8px;">This is an automated administrative notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
DevaSetu - Temple Services & Darshan Management Platform

Dear ${name || 'Temple Representative'},

Your temple registration for "${templeName}" has been approved by the DevaSetu administration.

Your Temple Authority login credentials:
- Username: ${username || email}
- Temporary Password: ${temporaryPassword}
- Login URL: ${loginUrl}

Security Notice: For platform security, you will be required to change your temporary password immediately upon your first sign-in.

Regards,
DevaSetu Team
`;

  return sendEmail({
    to: email,
    subject: 'Your DevaSetu Temple Authority Account Credentials',
    text: textContent,
    html: htmlContent,
  });
};

export default {
  isValidEmailSyntax,
  maskEmail,
  isSmtpConfigured,
  getTransporter,
  verifySmtpConnection,
  sendEmail,
  sendAuthorityCredentialEmail,
};
