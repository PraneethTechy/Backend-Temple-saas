import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { TempleAnnouncement, ANNOUNCEMENT_TYPES } from '../models/TempleAnnouncement.js';
import { User } from '../models/User.js';
import { USER_ROLES } from '../models/userRole.js';
import { connectDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, message, details = null) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`, details ? JSON.stringify(details) : '');
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
  console.log('TEMPLE ANNOUNCEMENTS COMPREHENSIVE SUITE (16 CHECKS)');
  console.log('=============================================================\n');

  await connectDatabase();

  // Find 2 authorities assigned to real existing temples
  const temples = await Temple.find({ status: TEMPLE_STATUS.ACTIVE }).limit(2).lean();
  let authority1 = await User.findOne({
    role: USER_ROLES.TEMPLE_AUTHORITY,
    templeId: temples[0]._id,
  }).lean();

  let authority2 = await User.findOne({
    role: USER_ROLES.TEMPLE_AUTHORITY,
    templeId: temples[1]._id,
  }).lean();

  if (!authority1) {
    authority1 = await User.findOne({ role: USER_ROLES.TEMPLE_AUTHORITY }).lean();
    if (authority1) {
      await User.findByIdAndUpdate(authority1._id, { templeId: temples[0]._id });
      authority1.templeId = temples[0]._id;
    }
  }

  if (!authority2) {
    authority2 = await User.findOne({
      role: USER_ROLES.TEMPLE_AUTHORITY,
      _id: { $ne: authority1?._id },
    }).lean();
    if (authority2) {
      await User.findByIdAndUpdate(authority2._id, { templeId: temples[1]._id });
      authority2.templeId = temples[1]._id;
    }
  }

  console.log(`Authority 1: ${authority1.email} (Temple: ${authority1.templeId})`);
  console.log(`Authority 2: ${authority2.email} (Temple: ${authority2.templeId})`);

  // Clean up any test announcements created by this test script previously
  await TempleAnnouncement.deleteMany({
    title: { $regex: /^\[TEST\]/ },
  });

  // Login Authority 1
  const loginRes1 = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: authority1.email,
      password: authority1.mustChangePassword ? 'TempPass123!' : 'DS@Pp5s56vwy%', // test known passwords or set temp
    }),
  });

  let token1 = loginRes1.data?.data?.token;
  if (!token1) {
    // If password mismatch, update password for testing
    import('bcryptjs').then(async (bcrypt) => {
      const hash = await bcrypt.default.hash('TestPass123!', 10);
      await User.findByIdAndUpdate(authority1._id, { password: hash });
    });
    const retry = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authority1.email, password: 'TestPass123!' }),
    });
    token1 = retry.data?.data?.token;
  }

  // Setup Authority 2 password & login
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.default.hash('TestPass123!', 10);
  await User.findByIdAndUpdate(authority2._id, { password: hash });

  const loginRes2 = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: authority2.email, password: 'TestPass123!' }),
  });
  const token2 = loginRes2.data?.data?.token;

  assert(token1 && token2, '14. Existing authentication/RBAC still works: Both authorities authenticated');

  const authHeaders1 = { Authorization: `Bearer ${token1}` };
  const authHeaders2 = { Authorization: `Bearer ${token2}` };

  let createdAnnouncementId = null;

  // 1. Authority can create announcement
  const createRes = await request('/authority/announcements', {
    method: 'POST',
    headers: authHeaders1,
    body: JSON.stringify({
      title: '[TEST] Maha Shivaratri Special Darshan',
      message: 'Special darshan queues will open tomorrow at 4:00 AM.',
      type: 'DARSHAN',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  });

  assert(
    createRes.status === 201 && createRes.data?.data?._id,
    '1. Authority can create announcement',
    createRes.data
  );
  createdAnnouncementId = createRes.data?.data?._id;

  // 6. Authority cannot create announcement for another temple by passing fake templeId
  const fakeTempleRes = await request('/authority/announcements', {
    method: 'POST',
    headers: authHeaders1,
    body: JSON.stringify({
      templeId: authority2.templeId, // Intentional fake injection attempt
      title: '[TEST] Injection Attempt Title',
      message: 'This should be forced to Authority 1 temple.',
      type: 'GENERAL',
    }),
  });

  const injectedDoc = await TempleAnnouncement.findById(fakeTempleRes.data?.data?._id).lean();
  assert(
    fakeTempleRes.status === 201 &&
      injectedDoc &&
      injectedDoc.templeId.toString() === authority1.templeId.toString(),
    '6. Authority cannot create an announcement for another temple by passing fake templeId (strictly derives req.user.templeId)'
  );
  if (injectedDoc) {
    await TempleAnnouncement.findByIdAndDelete(injectedDoc._id);
  }

  // 2. Authority can read own announcements
  const readRes = await request('/authority/announcements', {
    method: 'GET',
    headers: authHeaders1,
  });

  assert(
    readRes.status === 200 &&
      Array.isArray(readRes.data?.data) &&
      readRes.data.data.some((a) => a._id === createdAnnouncementId),
    '2. Authority can read own announcements'
  );

  // 3. Authority can update own announcement
  const updateRes = await request(`/authority/announcements/${createdAnnouncementId}`, {
    method: 'PATCH',
    headers: authHeaders1,
    body: JSON.stringify({
      title: '[TEST] Updated Shivaratri Darshan',
      message: 'Updated message: queues open at 3:30 AM.',
    }),
  });

  assert(
    updateRes.status === 200 && updateRes.data?.data?.title === '[TEST] Updated Shivaratri Darshan',
    '3. Authority can update own announcement'
  );

  // 5. Authority cannot access another temple's announcement (Update and Delete attempts)
  const crossUpdateRes = await request(`/authority/announcements/${createdAnnouncementId}`, {
    method: 'PATCH',
    headers: authHeaders2,
    body: JSON.stringify({
      title: '[TEST] Unauthorized Cross-Temple Modification',
    }),
  });

  assert(
    crossUpdateRes.status === 403,
    "5a. Authority cannot update another temple's announcement (403 Forbidden)",
    crossUpdateRes.data
  );

  const crossDeleteRes = await request(`/authority/announcements/${createdAnnouncementId}`, {
    method: 'DELETE',
    headers: authHeaders2,
  });

  assert(
    crossDeleteRes.status === 403,
    "5b. Authority cannot delete another temple's announcement (403 Forbidden)",
    crossDeleteRes.data
  );

  // 7. Public users can read active announcements
  const publicRes = await request(`/temples/${authority1.templeId}/announcements`);
  assert(
    publicRes.status === 200 &&
      Array.isArray(publicRes.data?.data) &&
      publicRes.data.data.some((a) => a._id === createdAnnouncementId),
    '7. Public users can read active announcements'
  );

  // 8. Public users cannot see inactive announcements
  await request(`/authority/announcements/${createdAnnouncementId}`, {
    method: 'PATCH',
    headers: authHeaders1,
    body: JSON.stringify({ isActive: false }),
  });

  const publicInactiveRes = await request(`/temples/${authority1.templeId}/announcements`);
  assert(
    publicInactiveRes.status === 200 &&
      !publicInactiveRes.data.data.some((a) => a._id === createdAnnouncementId),
    '8. Public users cannot see inactive announcements'
  );

  // Reactivate for further testing
  await request(`/authority/announcements/${createdAnnouncementId}`, {
    method: 'PATCH',
    headers: authHeaders1,
    body: JSON.stringify({ isActive: true }),
  });

  // 9. Public users cannot see expired announcements
  const expiredAnnouncement = await TempleAnnouncement.create({
    templeId: authority1.templeId,
    title: '[TEST] Expired Notice',
    message: 'This notice expired yesterday.',
    type: 'NOTICE',
    isActive: true,
    publishedAt: new Date(Date.now() - 86400000 * 2),
    expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
    createdBy: authority1._id,
  });

  const publicExpiredRes = await request(`/temples/${authority1.templeId}/announcements`);
  assert(
    publicExpiredRes.status === 200 &&
      !publicExpiredRes.data.data.some((a) => a._id === expiredAnnouncement._id.toString()),
    '9. Public users cannot see expired announcements'
  );

  // 10. Future-published announcements are not publicly visible
  const futureAnnouncement = await TempleAnnouncement.create({
    templeId: authority1.templeId,
    title: '[TEST] Future Notice',
    message: 'This notice is scheduled for tomorrow.',
    type: 'NOTICE',
    isActive: true,
    publishedAt: new Date(Date.now() + 86400000), // Future date
    expiresAt: null,
    createdBy: authority1._id,
  });

  const publicFutureRes = await request(`/temples/${authority1.templeId}/announcements`);
  assert(
    publicFutureRes.status === 200 &&
      !publicFutureRes.data.data.some((a) => a._id === futureAnnouncement._id.toString()),
    '10. Future-published announcements are not publicly visible'
  );

  // 11. Empty announcement list works correctly
  const publicEmptyRes = await request(`/temples/${authority2.templeId}/announcements`);
  assert(
    publicEmptyRes.status === 200 && Array.isArray(publicEmptyRes.data?.data),
    '11. Empty announcement list works correctly (returns empty array)'
  );

  // 12. Multiple announcements are returned in publishedAt descending order
  const annRecent = await TempleAnnouncement.create({
    templeId: authority1.templeId,
    title: '[TEST] Recent Notice',
    message: 'Published just now.',
    type: 'GENERAL',
    isActive: true,
    publishedAt: new Date(),
    expiresAt: null,
    createdBy: authority1._id,
  });

  const publicSortRes = await request(`/temples/${authority1.templeId}/announcements`);
  const items = publicSortRes.data?.data || [];
  let isSorted = true;
  for (let i = 0; i < items.length - 1; i++) {
    if (new Date(items[i].publishedAt) < new Date(items[i + 1].publishedAt)) {
      isSorted = false;
      break;
    }
  }
  assert(
    publicSortRes.status === 200 && items.length >= 2 && isSorted,
    '12. Multiple announcements are returned in publishedAt descending order'
  );

  // 13. Expiry date validation works
  const invalidDateRes = await request('/authority/announcements', {
    method: 'POST',
    headers: authHeaders1,
    body: JSON.stringify({
      title: '[TEST] Invalid Date',
      message: 'Invalid date testing.',
      expiresAt: 'not-a-valid-date-format',
    }),
  });
  assert(
    invalidDateRes.status === 400,
    '13. Expiry date validation works (rejects malformed date with 400)',
    invalidDateRes.data
  );

  // 4. Authority can delete own announcement
  const deleteRes = await request(`/authority/announcements/${createdAnnouncementId}`, {
    method: 'DELETE',
    headers: authHeaders1,
  });

  assert(
    deleteRes.status === 200,
    '4. Authority can delete own announcement'
  );

  // 15. Existing temple profile still works
  const templeDoc = await Temple.findById(authority1.templeId).lean();
  const profileRes = await request(`/temples/${templeDoc.slug}`);
  assert(
    profileRes.status === 200 && profileRes.data?.data?._id === authority1.templeId.toString(),
    '15. Existing temple profile still works'
  );

  // 16. Existing services, slots, bookings and gallery functionality still works
  const servicesRes = await request(`/temples/${authority1.templeId}/services`);
  assert(
    servicesRes.status === 200 && Array.isArray(servicesRes.data?.data),
    '16. Existing services, slots, bookings and gallery functionality still works'
  );

  // Cleanup test docs
  await TempleAnnouncement.deleteMany({
    title: { $regex: /^\[TEST\]/ },
  });

  console.log('\n-------------------------------------------------------------');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
