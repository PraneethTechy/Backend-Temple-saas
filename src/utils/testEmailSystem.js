import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  isValidEmailSyntax,
  maskEmail,
  sendEmail,
  verifySmtpConnection,
  sendAuthorityCredentialEmail,
} from '../services/emailService.js';

async function runEmailSystemTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING DEVASETU NODEMAILER SYSTEM VALIDATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS]: ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL]: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Syntax Validation Rules (Valid vs Malformed)
  // -------------------------------------------------------------------------
  console.log('--- Test Suite 1: Email Address Syntax Validation ---');
  assert(isValidEmailSyntax('test@gmail.com') === true, 'Valid: test@gmail.com');
  assert(isValidEmailSyntax('abc@company.com') === true, 'Valid: abc@company.com');
  assert(isValidEmailSyntax('temple123@yahoo.com') === true, 'Valid: temple123@yahoo.com');
  assert(isValidEmailSyntax('user.name+tag@sub.domain.org') === true, 'Valid: user.name+tag@sub.domain.org');

  assert(isValidEmailSyntax('abc') === false, 'Invalid: abc (no @ or domain)');
  assert(isValidEmailSyntax('abc@') === false, 'Invalid: abc@ (no domain)');
  assert(isValidEmailSyntax('@gmail.com') === false, 'Invalid: @gmail.com (no local part)');
  assert(isValidEmailSyntax('abc@@gmail.com') === false, 'Invalid: abc@@gmail.com (double @)');
  assert(isValidEmailSyntax('abc@gmail') === false, 'Invalid: abc@gmail (no TLD)');
  assert(isValidEmailSyntax('') === false, 'Invalid: empty string');
  assert(isValidEmailSyntax(null) === false, 'Invalid: null');

  // -------------------------------------------------------------------------
  // TEST 2: Email Masking (Privacy & Log Safety)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Privacy Email Masking ---');
  const masked1 = maskEmail('praneethg807@gmail.com');
  assert(masked1 === 'p***7@gmail.com', `Masking praneethg807@gmail.com -> ${masked1}`);
  const masked2 = maskEmail('contact@temple.org');
  assert(masked2 === 'c***t@temple.org', `Masking contact@temple.org -> ${masked2}`);

  // -------------------------------------------------------------------------
  // TEST 3: Invalid Email Syntax Does NOT Crash and Returns Structured Result
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Malformed Email Structured Handling ---');
  const invalidResult = await sendEmail({
    to: 'invalid-email-address',
    subject: 'Test Subject',
    text: 'Test Body',
  });
  assert(invalidResult.success === false, 'Invalid email returns success: false');
  assert(invalidResult.status === 'INVALID_EMAIL', `Status is INVALID_EMAIL (got: ${invalidResult.status})`);
  assert(typeof invalidResult.error === 'string', 'Error message is provided');

  // -------------------------------------------------------------------------
  // TEST 4: SMTP Connection Verification Diagnostics
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Transporter Verification ---');
  const verifyResult = await verifySmtpConnection();
  assert(typeof verifyResult === 'object', 'verifySmtpConnection returns structured result');
  // With existing .env, it should report connection status without throwing
  console.log('verifySmtpConnection result:', {
    success: verifyResult.success,
    code: verifyResult.code || null,
  });

  // -------------------------------------------------------------------------
  // TEST 5: Structured Dispatch with Real/Development Addresses
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Structured Send Handling (EAUTH / Sent) ---');
  const testSendResult = await sendAuthorityCredentialEmail({
    email: 'test-pilgrim@example.com',
    name: 'Sri Krishna Trust',
    templeName: 'Somnath Temple',
    username: 'test-pilgrim@example.com',
    temporaryPassword: 'TempPassword!2026',
  });

  assert(typeof testSendResult === 'object', 'sendAuthorityCredentialEmail returns structured object');
  assert('success' in testSendResult, 'Result has "success" boolean');
  assert('status' in testSendResult, `Result has "status" (got: ${testSendResult.status})`);
  // If SMTP password is not an App Password, it gracefully returns SMTP_AUTH_ERROR without crashing
  if (!testSendResult.success) {
    assert(
      testSendResult.status === 'SMTP_AUTH_ERROR' ||
      testSendResult.status === 'SMTP_CONNECTION_ERROR' ||
      testSendResult.status === 'EMAIL_SEND_FAILED',
      `Recognized failure category: ${testSendResult.status}`
    );
    assert(!JSON.stringify(testSendResult).includes(process.env.SMTP_PASSWORD), 'Password is NOT exposed in result');
  } else {
    assert(testSendResult.status === 'SENT', 'Sent status is SENT');
    assert(Boolean(testSendResult.messageId), 'Message ID is present');
  }

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runEmailSystemTests();
