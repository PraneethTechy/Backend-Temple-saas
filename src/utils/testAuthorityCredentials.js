import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Enable mock email delivery during test if real SMTP is not set
if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
  process.env.MOCK_EMAIL = 'true';
}

const API_BASE = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, message, details = null) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`, details ? JSON.stringify(details, null, 2) : '');
    failed++;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🏛️   DEVASETU: TEMPLE AUTHORITY CREDENTIAL CREATION & EMAIL TESTS');
  console.log('=============================================================\n');

  try {
    const timestamp = Date.now();
    const adminEmail = `admin_cred_${timestamp}@devasetu.test`;
    const adminPass = 'AdminSecret@123456';
    const devoteeEmail = `devotee_cred_${timestamp}@devasetu.test`;
    const devoteePass = 'DevoteePass@123456';

    const secret = process.env.ADMIN_BOOTSTRAP_SECRET || 'DevaSetu_Super_Secret_Admin_Bootstrap_Key_2025';

    // 1. Setup Admin
    console.log('[Setup 1] Provisioning Admin...');
    const adminCreateRes = await request('/auth/create-admin', {
      method: 'POST',
      headers: { 'x-admin-bootstrap-secret': secret },
      body: JSON.stringify({
        name: 'Credential Test Admin',
        email: adminEmail,
        password: adminPass,
      }),
    });
    assert(adminCreateRes.status === 201, 'Bootstrap Admin created', adminCreateRes.data);

    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    });
    assert(adminLoginRes.status === 200, 'Admin logged in', adminLoginRes.data);
    const adminToken = adminLoginRes.data.data.token;

    // 2. Setup Devotee
    console.log('[Setup 2] Registering regular Devotee...');
    const devoteeRegRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Devotee Test User',
        email: devoteeEmail,
        password: devoteePass,
        phone: '9876543210',
      }),
    });
    assert(devoteeRegRes.status === 201, 'Devotee registered', devoteeRegRes.data);

    const devoteeLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: devoteeEmail, password: devoteePass }),
    });
    const devoteeToken = devoteeLoginRes.data.data.token;

    // 3. Submit Public Temple Registration
    console.log('\n[Step 1] Submitting Public Temple Registration...');
    const applicantEmail = `authority_lead_${timestamp}@devasetu.test`;
    const templeRegRes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Mahant Rajeshwar',
        applicantEmail,
        applicantPhone: '+91 9988776655',
        authorityDesignation: 'Chief Trustee',
        templeName: `Sri Dakshineswar Mandir ${timestamp}`,
        templeType: 'Traditional Heritage',
        address: 'Mayapur Road',
        city: 'Kolkata',
        state: 'West Bengal',
        pincode: '700035',
        description: 'Historic sacred temple dedicated to Goddess Bhavatarini on the Hooghly.',
      }),
    });
    assert(templeRegRes.status === 201, 'Temple Registration submitted (PENDING)', templeRegRes.data);
    const regId = templeRegRes.data.data.registrationId || templeRegRes.data.data._id;

    // 4. Test RBAC: Devotee & Unauthenticated Cannot Approve or Create Authority
    console.log('\n[Security 1] RBAC Protection on Credential Endpoints...');
    const unauthRes = await request(`/admin/temple-registrations/${regId}/create-authority`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword: 'TempPassword@123' }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated user blocked with 401');

    const devoteeRes = await request(`/admin/temple-registrations/${regId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devoteeToken}` },
      body: JSON.stringify({ temporaryPassword: 'TempPassword@123' }),
    });
    assert(devoteeRes.status === 403, 'Devotee user blocked with 403 (ADMIN role required)');

    // 5. Cannot create authority on PENDING registration
    console.log('\n[Security 2] Enforce Approved State before Authority Creation...');
    const prematureRes = await request(`/admin/temple-registrations/${regId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ temporaryPassword: 'TempPassword@123' }),
    });
    assert(prematureRes.status === 400, 'Blocked creating authority on unapproved registration (400 Bad Request)');

    // 6. Admin Approves Temple
    console.log('\n[Step 2] Admin Approves Temple Registration...');
    const approveRes = await request(`/admin/temple-registrations/${regId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(approveRes.status === 200, 'Temple Registration approved successfully', approveRes.data);
    assert(approveRes.data.data.status === 'APPROVED', 'Registration status is APPROVED');
    const createdTempleId = approveRes.data.data.temple.id;
    assert(Boolean(createdTempleId), 'Temple document created and assigned');

    // 7. Admin Creates Authority Account & Sends Credentials
    console.log('\n[Step 3] Admin Creates Authority Account & Dispatches Credentials...');
    const initialTempPassword = `DS@TempAlpha${timestamp}!`;
    const createAuthRes = await request(`/admin/temple-registrations/${regId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: applicantEmail,
        temporaryPassword: initialTempPassword,
      }),
    });
    assert(createAuthRes.status === 200, 'Authority account created & credentials dispatched', createAuthRes.data);

    // Verify Password Security Requirements: Plaintext password is NEVER returned in response
    assert(!createAuthRes.data?.data?.password, 'API response does NOT contain plaintext password');
    assert(!createAuthRes.data?.data?.temporaryPassword, 'API response does NOT contain temporaryPassword');
    assert(!createAuthRes.data?.data?.passwordHash, 'API response does NOT contain passwordHash');
    assert(createAuthRes.data?.data?.authority?.role === 'TEMPLE_AUTHORITY', 'Authority role is TEMPLE_AUTHORITY');
    assert(createAuthRes.data?.data?.authority?.mustChangePassword === true, 'mustChangePassword is true');
    assert(createAuthRes.data?.data?.templeId === createdTempleId, 'Authority assigned correct templeId');
    const authorityUserId = createAuthRes.data.data.authority.id;

    // 8. Connect to MongoDB and verify password is cryptographically hashed (NEVER plaintext)
    console.log('\n[Security 3] Verifying Database Security in MongoDB...');
    const mongooseConn = await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    const userDoc = await mongooseConn.connection.db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(authorityUserId) });
    assert(Boolean(userDoc), 'Authority User exists in MongoDB');
    assert(userDoc.password !== initialTempPassword, 'Password is NOT stored as plaintext in MongoDB');
    const isBcryptHash = await bcrypt.compare(initialTempPassword, userDoc.password);
    assert(isBcryptHash === true, 'Password is stored as valid bcrypt hash matching temporary password');

    // 9. Duplicate Account Protection: Cannot create duplicate authority for same temple or email
    console.log('\n[Security 4] Duplicate Account Protection...');
    const duplicateRes = await request(`/admin/temple-registrations/${regId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ temporaryPassword: 'AnotherTempPassword@123' }),
    });
    assert(duplicateRes.status === 409, 'Duplicate authority creation blocked with 409 Conflict', duplicateRes.data);

    // 10. Authority Login with Temporary Password
    console.log('\n[Step 4] Authority Signs in with Temporary Password...');
    const authLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: applicantEmail,
        password: initialTempPassword,
      }),
    });
    assert(authLoginRes.status === 200, 'Authority signs in successfully with temporary password', authLoginRes.data);
    assert(authLoginRes.data.data.user.role === 'TEMPLE_AUTHORITY', 'Authenticated user role is TEMPLE_AUTHORITY');
    assert(authLoginRes.data.data.user.mustChangePassword === true, 'mustChangePassword flag is true');
    const authorityToken = authLoginRes.data.data.token;

    // 11. Resend Credentials Flow
    console.log('\n[Step 5] Admin Resends Credentials (Password Regeneration)...');
    const newTempPassword = `DS@NewRegenSecret${timestamp}#`;
    const resendRes = await request(`/admin/temple-registrations/${regId}/resend-credentials`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        temporaryPassword: newTempPassword,
      }),
    });
    assert(resendRes.status === 200, 'Admin resends credentials successfully', resendRes.data);

    // Verify old temporary password stops working
    const oldLoginAttempt = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: applicantEmail,
        password: initialTempPassword,
      }),
    });
    assert(oldLoginAttempt.status === 401, 'Old temporary password invalidated and rejected with 401');

    // Verify new temporary password works
    const newLoginAttempt = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: applicantEmail,
        password: newTempPassword,
      }),
    });
    assert(newLoginAttempt.status === 200, 'New temporary password succeeds with 200', newLoginAttempt.data);
    assert(newLoginAttempt.data.data.user.mustChangePassword === true, 'mustChangePassword remains true after resend');
    const freshAuthorityToken = newLoginAttempt.data.data.token;

    // 12. Authority Changes Temporary Password to Permanent
    console.log('\n[Step 6] Authority Changes Temporary Password...');
    const permanentPassword = 'MySecretPermanentPass@999';
    const changePassRes = await request('/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshAuthorityToken}` },
      body: JSON.stringify({
        currentPassword: newTempPassword,
        newPassword: permanentPassword,
      }),
    });
    assert(changePassRes.status === 200, 'Authority changes password successfully', changePassRes.data);

    // Verify authority login with permanent password
    const permLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: applicantEmail,
        password: permanentPassword,
      }),
    });
    assert(permLoginRes.status === 200, 'Authority logs in with permanent password', permLoginRes.data);
    assert(permLoginRes.data.data.user.mustChangePassword === false, 'mustChangePassword is now false');
    const activePortalToken = permLoginRes.data.data.token;

    // 13. Authority Can Access Assigned Temple Portal
    console.log('\n[Step 7] Accessing Authority Portal & Verifying Temple Isolation...');
    const dashRes = await request('/authority/dashboard', {
      headers: { Authorization: `Bearer ${activePortalToken}` },
    });
    assert(dashRes.status === 200, 'Authority accesses /authority/dashboard', dashRes.data);

    const templeRes = await request('/authority/temple', {
      headers: { Authorization: `Bearer ${activePortalToken}` },
    });
    assert(templeRes.status === 200, 'Authority accesses assigned temple profile', templeRes.data);
    assert(templeRes.data.data._id === createdTempleId, 'Assigned templeId matches approved temple');

    // 14. Temple Isolation Check: Authority cannot access admin dashboard
    const adminCheckRes = await request('/admin/dashboard', {
      headers: { Authorization: `Bearer ${activePortalToken}` },
    });
    assert(adminCheckRes.status === 403, 'Authority strictly forbidden from Admin endpoints (403)');

    await mongoose.disconnect();

    console.log('\n=============================================================');
    console.log(`Results: ${passed} passed, ${failed} failed.`);
    console.log('=============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with error:', error);
    process.exit(1);
  }
}

runTests();
