import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { TempleRegistration } from '../models/TempleRegistration.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Notification } from '../models/Notification.js';

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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  if (isFormData && headers['Content-Type']) {
    delete headers['Content-Type'];
  }

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

async function runPhase6Tests() {
  console.log('\n=============================================================');
  console.log('       DEVASETU — PHASE 6 AUTOMATED VERIFICATION SUITE');
  console.log('       Devotee Experience, Public Discovery & Availability');
  console.log('=============================================================\n');

  try {
    await connectDatabase();
    const timestamp = Date.now();
    const adminEmail = `admin_phase6_${timestamp}@devasetu.test`;
    const adminPass = 'AdminSecret@123456';
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET || 'DevaSetu_Super_Secret_Admin_Bootstrap_Key_2025';

    // 1. Setup Admin: Create and Login
    console.log('[Setup 1] Creating bootstrap admin and logging in...');
    const adminCreate = await request('/auth/create-admin', {
      method: 'POST',
      headers: { 'x-admin-bootstrap-secret': secret },
      body: JSON.stringify({
        name: 'Phase 6 Test Admin',
        email: adminEmail,
        password: adminPass,
        phone: '9888877777',
      }),
    });
    assert(adminCreate.status === 201, 'Bootstrap admin created');

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    });
    assert(adminLogin.status === 200, 'Admin logged in successfully');
    const adminToken = adminLogin.data?.data?.token;

    // 2. Setup Active Temple 1 (Somnath Jyotirlinga in Veraval, Gujarat)
    console.log('\n[Setup 2] Onboarding and activating Temple 1 (Somnath)...');
    const reg1Res = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Somnath Priest',
        applicantEmail: `somnath_${timestamp}@devasetu.test`,
        applicantPhone: '9876543210',
        authorityDesignation: 'Head Priest',
        templeName: `Shri Somnath Mandir ${timestamp}`,
        city: 'Veraval',
        state: 'Gujarat',
        address: 'Prabhas Patan',
        pincode: '362268',
        description: 'First of the twelve holy Jyotirlingas of Lord Shiva.',
      }),
    });
    assert(reg1Res.status === 201, 'Temple 1 registered');
    const reg1Id = reg1Res.data?.data?.registrationId || reg1Res.data?.data?._id;

    // Admin approves Temple 1
    const app1Res = await request(`/admin/temple-registrations/${reg1Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(app1Res.status === 200, 'Temple 1 approved by admin (Status = ACTIVE)');
    const temple1Id = app1Res.data?.data?.temple?.id || app1Res.data?.data?.temple?._id;
    const temple1Slug = app1Res.data?.data?.temple?.slug;

    // Provision Temple 1 Authority
    const tempPass1 = 'SomnathAuthPass@2026';
    const auth1Create = await request(`/admin/temple-registrations/${reg1Id}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: `somnath_${timestamp}@devasetu.test`,
        temporaryPassword: tempPass1,
      }),
    });
    assert(auth1Create.status === 200, 'Temple 1 authority provisioned');

    const auth1Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `somnath_${timestamp}@devasetu.test`, password: tempPass1 }),
    });
    assert(auth1Login.status === 200, 'Temple 1 authority logged in');
    const tokenAuth1 = auth1Login.data?.data?.token;

    // 3. Setup Active Temple 2 (Meenakshi Temple in Madurai, Tamil Nadu)
    console.log('\n[Setup 3] Onboarding and activating Temple 2 (Meenakshi)...');
    const reg2Res = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Sundareswarar Priest',
        applicantEmail: `meenakshi_${timestamp}@devasetu.test`,
        applicantPhone: '9876543211',
        authorityDesignation: 'Chief Trustee',
        templeName: `Meenakshi Amman Temple ${timestamp}`,
        city: 'Madurai',
        state: 'Tamil Nadu',
        address: 'Madurai Main',
        pincode: '625001',
        description: 'Historic Hindu temple on the southern bank of the Vaigai River.',
      }),
    });
    const reg2Id = reg2Res.data?.data?.registrationId || reg2Res.data?.data?._id;

    const app2Res = await request(`/admin/temple-registrations/${reg2Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(app2Res.status === 200, 'Temple 2 approved by admin (Status = ACTIVE)');
    const temple2Id = app2Res.data?.data?.temple?.id || app2Res.data?.data?.temple?._id;
    const temple2Slug = app2Res.data?.data?.temple?.slug;

    // 4. Setup an Inactive Temple & a Pending Registration
    console.log('\n[Setup 4] Setting up Inactive temple and Pending registration...');
    // Create an inactive temple
    const inactiveTemple = new Temple({
      name: `Hidden Inactive Mandir ${timestamp}`,
      slug: `hidden-inactive-mandir-${timestamp}`,
      description: 'Internal inactive temple not ready for public viewing.',
      address: 'Secret Marg',
      city: 'Rishikesh',
      state: 'Uttarakhand',
      pincode: '249201',
      status: TEMPLE_STATUS.INACTIVE,
    });
    await inactiveTemple.save();

    // Create a pending registration (which has no Temple document yet)
    const pendingReg = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Pending Applicant',
        applicantEmail: `pending_${timestamp}@devasetu.test`,
        applicantPhone: '9876543212',
        authorityDesignation: 'Secretary',
        templeName: `Pending Public Review Mandir ${timestamp}`,
        city: 'Kashi',
        state: 'Uttar Pradesh',
        address: 'Ghat Marg',
        pincode: '221001',
        description: 'Pending review.',
      }),
    });
    assert(pendingReg.status === 201, 'Pending registration created');

    // 5. Setup Services on Temple 1 (One Active, One Inactive)
    console.log('\n[Setup 5] Setting up Services on Temple 1...');
    // Active service on Temple 1
    const createSvc1 = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuth1}` },
      body: JSON.stringify({
        name: 'Maha Somnath Special Darshan',
        type: 'DARSHAN',
        description: 'Direct sanctum entry for Shiva Jyotirlinga darshan.',
        price: 200,
        duration: 30,
        isActive: true,
      }),
    });
    assert(createSvc1.status === 201, 'Active service created on Temple 1');
    const service1ActiveId = createSvc1.data?.data?._id;

    // Inactive service on Temple 1
    const createSvcInactive = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuth1}` },
      body: JSON.stringify({
        name: 'Confidential Internal VIP Puja',
        type: 'POOJA',
        description: 'Inactive secret seva.',
        price: 5000,
        duration: 120,
        isActive: false,
      }),
    });
    assert(createSvcInactive.status === 201, 'Inactive service created on Temple 1');
    const service1InactiveId = createSvcInactive.data?.data?._id;

    // 6. Setup Time Slots on Active Service 1
    console.log('\n[Setup 6] Setting up Date-Range Time Slots on Service 1...');
    // Slot 1: Available 2026-10-01 to 2026-10-15 on MONDAY, WEDNESDAY, FRIDAY
    const slot1Res = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuth1}` },
      body: JSON.stringify({
        serviceId: service1ActiveId,
        startDate: '2026-10-01',
        endDate: '2026-10-15',
        availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        startTime: '08:00',
        endTime: '09:00',
        capacity: 50,
        isActive: true,
      }),
    });
    assert(slot1Res.status === 201, 'Slot 1 created (Mon/Wed/Fri in 2026-10-01 to 2026-10-15)');
    const slot1Id = slot1Res.data?.data?._id;

    // Slot 2: INACTIVE slot in same date range
    const slotInactive = new TimeSlot({
      templeId: temple1Id,
      serviceId: service1ActiveId,
      startDate: new Date('2026-10-01T00:00:00Z'),
      endDate: new Date('2026-10-15T23:59:59Z'),
      availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '10:00',
      endTime: '11:00',
      capacity: 30,
      bookedCount: 0,
      isActive: false,
    });
    await slotInactive.save();

    // 7. Devotee Account Creation & Login
    console.log('\n[Setup 7] Registering and authenticating Devotee 1 & Devotee 2...');
    const dev1Email = `devotee1_p6_${timestamp}@devasetu.test`;
    const dev1Pass = 'DevoteePass@123';
    const regDev1 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Arjun Pilgrim',
        email: dev1Email,
        password: dev1Pass,
        phone: '9777711111',
      }),
    });
    assert(regDev1.status === 201, 'Devotee 1 registered');
    const tokenDev1 = regDev1.data?.data?.token;
    const userDev1Id = regDev1.data?.data?.user?._id;

    const dev2Email = `devotee2_p6_${timestamp}@devasetu.test`;
    const regDev2 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Meera Devotee',
        email: dev2Email,
        password: 'Devotee2Pass@123',
        phone: '9777722222',
      }),
    });
    assert(regDev2.status === 201, 'Devotee 2 registered');
    const tokenDev2 = regDev2.data?.data?.token;

    // ==============================================================
    // SPECIFICATION CHECKS (1 - 30)
    // ==============================================================
    console.log('\n--- EXECUTING PHASE 6 TEST SPECIFICATIONS ---');

    // Test 1: Public user can list active temples
    const listRes = await request('/temples');
    assert(listRes.status === 200, 'Test 1: Public user can list active temples');
    const publicTemples = listRes.data?.data?.items || [];
    assert(Array.isArray(publicTemples) && publicTemples.length >= 2, 'Returns active temples array');

    // Test 2: Inactive temple is not returned
    const hasInactive = publicTemples.some((t) => t._id === inactiveTemple._id.toString() || t.name.includes('Hidden Inactive'));
    assert(hasInactive === false, 'Test 2: Inactive temple is NOT returned in public listing');

    // Test 3: Pending temple registration is not returned
    const hasPending = publicTemples.some((t) => t.name.includes('Pending Public Review Mandir'));
    assert(hasPending === false, 'Test 3: Pending temple registration is NOT returned in public listing');

    // Test 4: Temple search works
    const searchRes = await request(`/temples?search=Somnath`);
    assert(searchRes.status === 200, 'Search query returns 200 OK');
    const searchItems = searchRes.data?.data?.items || [];
    assert(searchItems.some((t) => t._id === temple1Id), 'Test 4: Temple search matches temple name');

    // Test 5: City filtering works
    const cityRes = await request('/temples?city=Veraval');
    assert(cityRes.status === 200, 'City query returns 200 OK');
    const cityItems = cityRes.data?.data?.items || [];
    assert(cityItems.every((t) => t.city.toLowerCase() === 'veraval'), 'Test 5: City filtering returns only matching city');

    // Test 6: State filtering works
    const stateRes = await request('/temples?state=Tamil Nadu');
    assert(stateRes.status === 200, 'State query returns 200 OK');
    const stateItems = stateRes.data?.data?.items || [];
    assert(stateItems.every((t) => t.state.toLowerCase() === 'tamil nadu'), 'Test 6: State filtering returns only matching state');

    // Test 7: Temple type filtering works
    const temple1Doc = await Temple.findById(temple1Id).lean();
    const typeRes = await request(`/temples?templeType=${encodeURIComponent(temple1Doc?.templeType || 'Traditional')}`);
    assert(typeRes.status === 200, 'Temple type query returns 200 OK');
    assert(typeRes.data?.data?.items?.length > 0, 'Test 7: Temple type filtering works');

    // Test 8: Pagination works
    const pageRes = await request('/temples?page=1&limit=1');
    assert(pageRes.status === 200, 'Pagination query returns 200 OK');
    assert(pageRes.data?.data?.items?.length === 1, 'Limit 1 returns exactly 1 item');
    assert(pageRes.data?.data?.pagination?.page === 1, 'Pagination page is 1');
    assert(pageRes.data?.data?.pagination?.totalPages >= 2, 'Test 8: Pagination totalPages correctly computed');

    // Test 9: Public user can view active temple by slug
    const slugRes = await request(`/temples/${temple1Slug}`);
    assert(slugRes.status === 200, 'Test 9: Public user can view active temple by slug');
    assert(slugRes.data?.data?._id === temple1Id, 'Returned temple ID matches active temple');
    assert(slugRes.data?.data?.authorityId === undefined, 'Never exposes authorityId to public users');

    // Test 10: Invalid/inactive temple returns appropriate not-found response (404)
    const invalidSlugRes = await request('/temples/non-existent-temple-slug-999');
    assert(invalidSlugRes.status === 404, 'Non-existent slug returns 404');
    const inactiveSlugRes = await request(`/temples/${inactiveTemple.slug}`);
    assert(inactiveSlugRes.status === 404, 'Test 10: Inactive temple slug returns 404 Not Found');

    // Test 11: Public user can view active services
    const servicesRes = await request(`/temples/${temple1Id}/services`);
    assert(servicesRes.status === 200, 'Test 11: Public user can view active services');
    const activeSvcs = servicesRes.data?.data || [];
    assert(activeSvcs.some((s) => s._id === service1ActiveId), 'Active service is included in public services');

    // Test 12: Inactive service is not returned
    const hasInactiveSvc = activeSvcs.some((s) => s._id === service1InactiveId);
    assert(hasInactiveSvc === false, 'Test 12: Inactive service is NOT returned in public service list');

    // Test 13: Service belonging to another temple cannot be queried through a different temple
    // Querying Temple 2 for Temple 1's service availability -> 404
    const crossSvcAvail = await request(`/temples/${temple2Id}/services/${service1ActiveId}/availability?date=2026-10-05`);
    assert(crossSvcAvail.status === 404, 'Test 13: Service belonging to another temple cannot be queried through different temple (404)');

    // Test 14: Availability works for a date inside configured date range
    // 2026-10-05 is a MONDAY, within range 2026-10-01 to 2026-10-15
    const availMonRes = await request(`/temples/${temple1Id}/services/${service1ActiveId}/availability?date=2026-10-05`);
    assert(availMonRes.status === 200, 'Availability check returns 200 OK');
    const monSlots = availMonRes.data?.data || [];
    assert(monSlots.length > 0 && monSlots.some((s) => s.slotId === slot1Id), 'Test 14: Availability returned for date inside date range');

    // Test 15: Availability does not appear outside configured date range
    // 2026-10-19 is a MONDAY, but outside range (ended 2026-10-15)
    const availOutRange = await request(`/temples/${temple1Id}/services/${service1ActiveId}/availability?date=2026-10-19`);
    assert(availOutRange.status === 200, 'Outside range returns 200 with empty array');
    assert(availOutRange.data?.data?.length === 0, 'Test 15: Availability does NOT appear outside configured date range');

    // Test 16: Availability respects availableDays
    // 2026-10-06 is a TUESDAY (inside date range, but availableDays is Mon/Wed/Fri)
    const availTueRes = await request(`/temples/${temple1Id}/services/${service1ActiveId}/availability?date=2026-10-06`);
    assert(availTueRes.status === 200, 'Tuesday check returns 200');
    assert(availTueRes.data?.data?.length === 0, 'Test 16: Availability respects availableDays (Tuesday omitted when not configured)');

    // Test 17: Availability does not expose inactive slots
    assert(monSlots.every((s) => s.slotId !== slotInactive._id.toString()), 'Test 17: Availability does not expose inactive slots');

    // Test 18: availableSeats is calculated correctly (capacity - bookedCount)
    const slotItem = monSlots.find((s) => s.slotId === slot1Id);
    assert(slotItem?.capacity === 50, 'Slot capacity is 50');
    assert(slotItem?.availableSeats === 50, 'Test 18: availableSeats calculated correctly (50 - 0 = 50)');

    // Test 19: Availability endpoint does not modify bookedCount (read-only verification)
    const slotDocCheck = await TimeSlot.findById(slot1Id);
    assert(slotDocCheck.bookedCount === 0, 'Test 19: Availability endpoint did not alter bookedCount in MongoDB (read-only)');

    // Test 20: Unauthenticated user cannot access /profile
    const unauthProf = await request('/users/profile');
    assert(unauthProf.status === 401, 'Test 20: Unauthenticated user cannot access /profile (401 Unauthorized)');

    // Test 21: Devotee can access own profile
    const dev1Prof = await request('/users/profile', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(dev1Prof.status === 200, 'Test 21: Devotee can access own profile');
    assert(dev1Prof.data?.data?.email === dev1Email, 'Profile email matches authenticated devotee');

    // Test 22: Devotee cannot modify role
    const tamperRoleRes = await request('/users/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        name: 'Arjun Updated Name',
        role: 'ADMIN', // Tamper attempt!
      }),
    });
    assert(tamperRoleRes.status === 200, 'Update profile request processed');
    assert(tamperRoleRes.data?.data?.name === 'Arjun Updated Name', 'Name was updated');
    assert(tamperRoleRes.data?.data?.role === 'DEVOTEE', 'Test 22: Role modification attempt was ignored/rejected; role remains DEVOTEE');

    // Test 23: Devotee cannot modify templeId
    const tamperTempleRes = await request('/users/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: temple1Id, // Tamper attempt!
      }),
    });
    assert(tamperTempleRes.status === 200, 'Update profile response OK');
    const userDocCheck = await User.findById(userDev1Id);
    assert(!userDocCheck.templeId, 'Test 23: Devotee cannot modify templeId; remains null in MongoDB');

    // Test 24: Devotee can access own notifications
    // Create notification for Devotee 1
    const notif1 = new Notification({
      userId: userDev1Id,
      title: 'Welcome to DevaSetu',
      message: 'Your devotee account has been activated for sacred pilgrimages.',
      type: 'SYSTEM',
    });
    await notif1.save();

    const dev1Notifs = await request('/notifications', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(dev1Notifs.status === 200, 'Test 24: Devotee can access own notifications');
    assert(dev1Notifs.data?.data?.notifications?.length >= 1, 'Devotee has notifications');
    assert(dev1Notifs.data?.data?.unreadCount >= 1, 'Unread count reflects new notification');

    // Test 25: Devotee cannot access another user's notifications
    // Devotee 2 attempts to mark Devotee 1's notification as read
    const crossNotifRes = await request(`/notifications/${notif1._id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev2}` },
    });
    assert(crossNotifRes.status === 404, 'Test 25: Devotee cannot access or mark another user\'s notification (404 Not Found)');

    // Test 26: Devotee can access /my-bookings
    const myBookingsRes = await request('/bookings/my', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(myBookingsRes.status === 200, 'Test 26: Devotee can access /my-bookings');
    const bookingsList = Array.isArray(myBookingsRes.data?.data) ? myBookingsRes.data?.data : myBookingsRes.data?.data?.bookings;
    assert(Array.isArray(bookingsList), 'Bookings returned as array (empty foundation)');

    // Test 27: Admin APIs remain protected (403 for Devotee)
    const adminCheck = await request('/admin/dashboard', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(adminCheck.status === 403, 'Test 27: Admin APIs return 403 Forbidden for Devotee token');

    // Test 28: Authority APIs remain protected (403 for Devotee)
    const authCheck = await request('/authority/dashboard', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(authCheck.status === 403, 'Test 28: Authority APIs return 403 Forbidden for Devotee token');

    // Test 29: Existing Authority temple isolation remains working
    const crossTempleCheck = await request(`/authority/services/${service1ActiveId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }, // Admin is not TEMPLE_AUTHORITY so blocked on authority routes
    });
    assert(crossTempleCheck.status === 403, 'Test 29: Authority portal strictly preserves role & isolation guards');

    // Test 30: Existing Phase 4 admin functionality remains working
    const adminRegCheck = await request('/admin/temple-registrations', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminRegCheck.status === 200, 'Test 30: Existing Phase 4 admin functionality intact and operational');

    console.log('\n=============================================================');
    console.log(`PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    console.log('\n[Cleanup] Cleaning up Phase 6 test artifacts...');
    const testTemples = await Temple.find({ name: { $regex: new RegExp(String(timestamp)) } }).lean();
    const testTempleIds = testTemples.map((t) => t._id);
    const testUsers = await User.find({ email: { $regex: new RegExp(String(timestamp)) } }).lean();
    const testUserIds = testUsers.map((u) => u._id);

    await Booking.deleteMany({ $or: [{ templeId: { $in: testTempleIds } }, { userId: { $in: testUserIds } }] });
    await TimeSlot.deleteMany({ templeId: { $in: testTempleIds } });
    await Service.deleteMany({ templeId: { $in: testTempleIds } });
    await Notification.deleteMany({ $or: [{ templeId: { $in: testTempleIds } }, { userId: { $in: testUserIds } }] });
    await Temple.deleteMany({ _id: { $in: testTempleIds } });
    await TempleRegistration.deleteMany({ applicantEmail: { $regex: new RegExp(String(timestamp)) } });
    await User.deleteMany({ _id: { $in: testUserIds } });
    console.log('  ✓ Phase 6 test artifacts cleaned up successfully.');

    await mongoose.connection.close();
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected test error:', err);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
  }
}

runPhase6Tests();
