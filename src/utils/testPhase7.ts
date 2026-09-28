import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { TempleRegistration } from '../models/TempleRegistration.js';
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

async function runPhase7Tests() {
  console.log('\n=============================================================');
  console.log('       DEVASETU — PHASE 7 AUTOMATED VERIFICATION SUITE');
  console.log('       Devotee Booking Engine, Atomic Capacity & Concurrency');
  console.log('=============================================================\n');

  try {
    await connectDatabase();
    const timestamp = Date.now();

    // 1. Setup Admin
    console.log('[Setup 1] Creating bootstrap admin and logging in...');
    const adminEmail = `admin_p7_${timestamp}@devasetu.test`;
    const adminPass = 'AdminSecret@123456';
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET || 'DevaSetu_Super_Secret_Admin_Bootstrap_Key_2025';

    const adminCreate = await request('/auth/create-admin', {
      method: 'POST',
      headers: { 'x-admin-bootstrap-secret': secret },
      body: JSON.stringify({
        name: 'Phase 7 Admin',
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

    // 2. Setup Temple A (Active) & Temple B (Active)
    console.log('\n[Setup 2] Registering, approving, and activating Temple A & B...');
    const regARes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Tirumala Trustee',
        applicantEmail: `tirumala_${timestamp}@devasetu.test`,
        applicantPhone: '9876543210',
        authorityDesignation: 'Executive Officer',
        templeName: `Sri Venkateswara Temple ${timestamp}`,
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        address: 'Tirumala Hills',
        pincode: '517504',
        description: 'Venkateswara Temple on Venkata Hill.',
      }),
    });
    assert(regARes.status === 201, 'Temple A registered');
    const regAId = regARes.data?.data?.registrationId || regARes.data?.data?._id;

    const appARes = await request(`/admin/temple-registrations/${regAId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(appARes.status === 200, 'Temple A approved');
    const templeAId = appARes.data?.data?.temple?.id || appARes.data?.data?.temple?._id;
    const templeASlug = appARes.data?.data?.temple?.slug;

    // Provision Temple A Authority
    const tempPassA = 'TirumalaAuthPass@2026';
    const authACreate = await request(`/admin/temple-registrations/${regAId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: `tirumala_${timestamp}@devasetu.test`,
        temporaryPassword: tempPassA,
      }),
    });
    assert(authACreate.status === 200, 'Temple A authority provisioned');

    const authALogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `tirumala_${timestamp}@devasetu.test`, password: tempPassA }),
    });
    assert(authALogin.status === 200, 'Temple A authority logged in');
    const tokenAuthA = authALogin.data?.data?.token;

    // Temple B (For cross-temple isolation tests)
    const regBRes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Kashi Priest',
        applicantEmail: `kashi_${timestamp}@devasetu.test`,
        applicantPhone: '9876543211',
        authorityDesignation: 'Chief Mahant',
        templeName: `Kashi Vishwanath Mandir ${timestamp}`,
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        address: 'Vishwanath Gali',
        pincode: '221001',
        description: 'Sacred Jyotirlinga of Shiva in Kashi.',
      }),
    });
    const regBId = regBRes.data?.data?.registrationId || regBRes.data?.data?._id;

    const appBRes = await request(`/admin/temple-registrations/${regBId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(appBRes.status === 200, 'Temple B approved');
    const templeBId = appBRes.data?.data?.temple?.id || appBRes.data?.data?.temple?._id;

    // 3. Setup Services & Slots on Temple A
    console.log('\n[Setup 3] Setting up Active & Inactive Services, and Time Slots on Temple A...');
    const svc1Res = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        name: 'Special Entry Darshan',
        type: 'DARSHAN',
        description: 'Quick queue darshan of the deity.',
        price: 300,
        duration: 45,
        isActive: true,
      }),
    });
    assert(svc1Res.status === 201, 'Active service 1 created on Temple A (Price: ₹300)');
    const svc1Id = svc1Res.data?.data?._id;

    // Inactive service on Temple A
    const svcInactiveRes = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        name: 'Discontinued Veda Parayanam',
        type: 'SEVA',
        description: 'Currently suspended seva.',
        price: 1000,
        duration: 60,
        isActive: false,
      }),
    });
    assert(svcInactiveRes.status === 201, 'Inactive service created on Temple A');
    const svcInactiveId = svcInactiveRes.data?.data?._id;

    // Slot 1: Standard slot on Service 1 (Capacity = 50, Oct 1 to Oct 31, 2026, Monday/Wednesday/Friday)
    const slot1Res = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        serviceId: svc1Id,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 50,
        availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      }),
    });
    assert(slot1Res.status === 201, 'Slot 1 created on Service 1 (Capacity: 50, Mon/Wed/Fri)');
    const slot1Id = slot1Res.data?.data?._id;

    // Slot 2 (Race Slot): Capacity = 5 (Oct 1 to Oct 31, 2026, Friday)
    const slotRaceRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        serviceId: svc1Id,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        startTime: '14:00',
        endTime: '15:00',
        capacity: 5,
        availableDays: ['FRIDAY'],
      }),
    });
    assert(slotRaceRes.status === 201, 'Slot 2 created on Service 1 (Capacity: 5, Friday only)');
    const slotRaceId = slotRaceRes.data?.data?._id;

    // Slot 3 (Single Capacity Slot): Capacity = 1 (Oct 1 to Oct 31, 2026, Friday)
    const slotSingleRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        serviceId: svc1Id,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        startTime: '16:00',
        endTime: '17:00',
        capacity: 1,
        availableDays: ['FRIDAY'],
      }),
    });
    assert(slotSingleRes.status === 201, 'Slot 3 created on Service 1 (Capacity: 1, Friday only)');
    const slotSingleId = slotSingleRes.data?.data?._id;

    // 4. Setup Devotees
    console.log('\n[Setup 4] Registering Devotee 1, Devotee 2, and Devotee 3...');
    const dev1Email = `devotee1_p7_${timestamp}@devasetu.test`;
    const dev1Pass = 'DevoteePass@123';
    const regDev1 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Ravi Teja',
        email: dev1Email,
        password: dev1Pass,
        phone: '9888811111',
      }),
    });
    assert(regDev1.status === 201, 'Devotee 1 registered');
    const tokenDev1 = regDev1.data?.data?.token;
    const userDev1Id = regDev1.data?.data?.user?._id;

    const dev2Email = `devotee2_p7_${timestamp}@devasetu.test`;
    const regDev2 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Suresh Kumar',
        email: dev2Email,
        password: 'DevoteePass@123',
        phone: '9888822222',
      }),
    });
    assert(regDev2.status === 201, 'Devotee 2 registered');
    const tokenDev2 = regDev2.data?.data?.token;
    const userDev2Id = regDev2.data?.data?.user?._id;

    const dev3Email = `devotee3_p7_${timestamp}@devasetu.test`;
    const regDev3 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Priya Sundaram',
        email: dev3Email,
        password: 'DevoteePass@123',
        phone: '9888833333',
      }),
    });
    assert(regDev3.status === 201, 'Devotee 3 registered');
    const tokenDev3 = regDev3.data?.data?.token;

    // ==============================================================
    // SPECIFICATION CHECKS (1 - 30)
    // ==============================================================
    console.log('\n--- EXECUTING PHASE 7 TEST SPECIFICATIONS ---');

    // Test 1: Unauthenticated user cannot create booking
    const unauthBooking = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02', // Friday
        devotees: [{ name: 'Test Devotee', age: 30, gender: 'MALE' }],
      }),
    });
    assert(unauthBooking.status === 401, 'Test 1: Unauthenticated user cannot create booking (401 Unauthorized)');

    // Test 2: ADMIN cannot create devotee booking
    const adminBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Test Devotee', age: 30, gender: 'MALE' }],
      }),
    });
    assert(adminBooking.status === 403, 'Test 2: ADMIN cannot create devotee booking (403 Forbidden)');

    // Test 3: TEMPLE_AUTHORITY cannot create devotee booking
    const authBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Test Devotee', age: 30, gender: 'MALE' }],
      }),
    });
    assert(authBooking.status === 403, 'Test 3: TEMPLE_AUTHORITY cannot create devotee booking (403 Forbidden)');

    // Test 4: DEVOTEE can create booking successfully
    // 2026-10-02 is a Friday (valid in Slot 1)
    const validBookingRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [
          { name: 'Ravi Teja', age: 28, gender: 'MALE', idType: 'AADHAAR', idNumber: '998877661234' },
          { name: 'Ananya Teja', age: 26, gender: 'FEMALE', idType: 'AADHAAR', idNumber: '998877665678' },
        ],
      }),
    });
    assert(validBookingRes.status === 201, 'Test 4: DEVOTEE can create booking successfully (201 Created)');
    const createdBooking = validBookingRes.data?.data?.booking;
    const booking1Id = createdBooking?._id;

    // Test 5: userId comes strictly from authenticated user (spoofed userId in body is ignored)
    const spoofedUserIdBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        userId: userDev2Id, // Attempt to spoof Devotee 2
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Spoof Test', age: 25, gender: 'MALE' }],
      }),
    });
    assert(spoofedUserIdBooking.status === 201, 'Booking processed without crash');
    assert(spoofedUserIdBooking.data?.data?.booking?.userId === userDev1Id, 'Test 5: userId comes strictly from authenticated user');

    // Test 6: Client cannot manipulate totalAmount (Backend calculates: 2 devotees * ₹300 = ₹600)
    const manipulatedPriceBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        totalAmount: 1, // Manipulated price
        devotees: [
          { name: 'Price Test 1', age: 30, gender: 'MALE' },
          { name: 'Price Test 2', age: 32, gender: 'FEMALE' },
        ],
      }),
    });
    assert(manipulatedPriceBooking.status === 201, 'Booking accepted');
    assert(manipulatedPriceBooking.data?.data?.booking?.totalAmount === 600, 'Test 6: Backend calculates totalAmount (2 * ₹300 = ₹600), ignoring manipulated input');

    // Test 7: Client cannot book inactive temple
    const inactiveTemple = new Temple({
      name: `Inactive Mandir ${timestamp}`,
      slug: `inactive-mandir-${timestamp}`,
      description: 'Inactive temple.',
      address: 'Test Marg',
      city: 'Rishikesh',
      state: 'Uttarakhand',
      pincode: '249201',
      status: TEMPLE_STATUS.INACTIVE,
    });
    await inactiveTemple.save();

    const inactiveTempleBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: inactiveTemple._id.toString(),
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Test', age: 20, gender: 'MALE' }],
      }),
    });
    assert(inactiveTempleBooking.status === 404, 'Test 7: Client cannot book inactive temple (404 Not Found)');

    // Test 8: Client cannot book inactive service
    const inactiveServiceBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcInactiveId,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Test', age: 20, gender: 'MALE' }],
      }),
    });
    assert(inactiveServiceBooking.status === 404, 'Test 8: Client cannot book inactive service (404 Not Found)');

    // Test 9: Client cannot book another temple's service (Cross-temple rejection)
    const crossTempleSvcBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeBId, // Temple B
        serviceId: svc1Id, // Service belongs to Temple A
        timeSlotId: slot1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Test', age: 20, gender: 'MALE' }],
      }),
    });
    assert(crossTempleSvcBooking.status === 404, 'Test 9: Cross-temple service rejected (404 Not Found)');

    // Test 10: Client cannot book outside TimeSlot date range
    const outsideRangeBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-11-06', // Outside Oct 2026 date range
        devotees: [{ name: 'Test', age: 20, gender: 'MALE' }],
      }),
    });
    assert(outsideRangeBooking.status === 400, 'Test 10: Booking outside configured date range rejected (400 Bad Request)');

    // Test 11: Client cannot book on unavailable weekday
    // 2026-10-06 is a Tuesday (Slot 1 only configured for Mon/Wed/Fri)
    const unavailableDayBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slot1Id,
        bookingDate: '2026-10-06', // Tuesday
        devotees: [{ name: 'Test', age: 20, gender: 'MALE' }],
      }),
    });
    assert(unavailableDayBooking.status === 400, 'Test 11: Booking on unconfigured weekday rejected (400 Bad Request)');

    // Test 12: Booking reference format & uniqueness
    assert(Boolean(createdBooking?.bookingReference), 'Booking reference exists');
    assert(createdBooking.bookingReference.startsWith('DVS-20261002-'), 'Test 12: Booking reference matches format DVS-YYYYMMDD-XXXXXX');

    // Test 13: Initial status is PENDING for both bookingStatus and paymentStatus
    assert(createdBooking?.bookingStatus === BOOKING_STATUS.PENDING, 'Test 13: Initial bookingStatus is PENDING');
    assert(createdBooking?.paymentStatus === PAYMENT_STATUS.PENDING, 'Initial paymentStatus is PENDING');

    // Test 14: Slot bookedCount incremented correctly in MongoDB
    const slotDocAfter = await TimeSlot.findById(slot1Id);
    // createdBooking had 2 devotees + spoofed 1 + manipulated 2 = 5 devotees booked
    assert(slotDocAfter.bookedCount === 5, 'Test 14: TimeSlot bookedCount accurately incremented in MongoDB (5 booked)');

    // Test 15: Devotee ID numbers are properly masked in API responses
    assert(createdBooking.devotees[0].idNumber.startsWith('XXXX-XXXX-'), 'Test 15: Devotee ID numbers are masked (XXXX-XXXX-1234)');
    assert(createdBooking.devotees[0].idNumber.endsWith('1234'), 'Last 4 digits preserved in masked ID');

    // Test 16: Password or hash is NEVER exposed in booking responses
    assert(validBookingRes.data?.data?.booking?.password === undefined, 'Test 16: Password never exposed in booking response');
    assert(validBookingRes.data?.data?.booking?.passwordHash === undefined, 'Password hash never exposed in booking response');

    // ==============================================================
    // CONCURRENCY & RACE CONDITION TESTS (MANDATORY SECTIONS 10, 11, 33)
    // ==============================================================
    console.log('\n--- EXECUTING ATOMIC CONCURRENCY TESTS ---');

    // Test 17 & 18: Concurrency Race Test 1 (Capacity = 5, Simultaneous Requests: 3 + 2 + 1)
    // Date: 2026-10-09 (Friday) on Slot 2 (Capacity: 5)
    console.log('  Testing simultaneous requests: 3 + 2 + 1 on Capacity = 5...');
    const race1Date = '2026-10-09';
    const reqRace3 = request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slotRaceId,
        bookingDate: race1Date,
        devotees: [
          { name: 'Race Devotee 1', age: 25, gender: 'MALE' },
          { name: 'Race Devotee 2', age: 26, gender: 'FEMALE' },
          { name: 'Race Devotee 3', age: 27, gender: 'MALE' },
        ],
      }),
    });

    const reqRace2 = request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev2}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slotRaceId,
        bookingDate: race1Date,
        devotees: [
          { name: 'Race Devotee 4', age: 28, gender: 'FEMALE' },
          { name: 'Race Devotee 5', age: 29, gender: 'MALE' },
        ],
      }),
    });

    const reqRace1 = request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev3}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slotRaceId,
        bookingDate: race1Date,
        devotees: [{ name: 'Race Devotee 6 (Overflow)', age: 30, gender: 'MALE' }],
      }),
    });

    // Execute simultaneously
    const [resRace3, resRace2, resRace1] = await Promise.all([reqRace3, reqRace2, reqRace1]);

    const resultsRace = [resRace3.status, resRace2.status, resRace1.status];
    const successesRace = resultsRace.filter((s) => s === 201).length;
    const conflictsRace = resultsRace.filter((s) => s === 409).length;

    // Exactly 2 of the 3 requests can fit into capacity 5
    assert(successesRace === 2, `Test 17: Exactly 2 requests succeeded (${successesRace}/3 succeeded)`);
    assert(conflictsRace === 1, `Test 18: Overflow request received 409 Conflict (${conflictsRace}/3 conflict)`);

    const expectedBookedCount =
      (resRace3.status === 201 ? 3 : 0) +
      (resRace2.status === 201 ? 2 : 0) +
      (resRace1.status === 201 ? 1 : 0);

    const slotRaceDocAfter = await TimeSlot.findById(slotRaceId);
    assert(
      slotRaceDocAfter.bookedCount === expectedBookedCount && slotRaceDocAfter.bookedCount <= 5,
      `Test 19: TimeSlot bookedCount is exactly ${expectedBookedCount} (Capacity limit 5 strictly enforced, never exceeded)`
    );

    // Test 20: Concurrency Race Test 2 (Capacity = 1, Two Simultaneous Requests: 1 + 1)
    // Date: 2026-10-09 (Friday) on Slot 3 (Capacity: 1)
    console.log('  Testing simultaneous requests: 1 + 1 on Capacity = 1...');
    const singleRaceA = request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slotSingleId,
        bookingDate: race1Date,
        devotees: [{ name: 'Solo Racer A', age: 35, gender: 'MALE' }],
      }),
    });

    const singleRaceB = request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev2}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svc1Id,
        timeSlotId: slotSingleId,
        bookingDate: race1Date,
        devotees: [{ name: 'Solo Racer B', age: 36, gender: 'FEMALE' }],
      }),
    });

    const [resSingleA, resSingleB] = await Promise.all([singleRaceA, singleRaceB]);
    const singleStatuses = [resSingleA.status, resSingleB.status];
    assert(singleStatuses.filter((s) => s === 201).length === 1, 'Test 20: Exactly one solo request succeeded (201)');
    assert(singleStatuses.filter((s) => s === 409).length === 1, 'The other solo request received 409 Conflict');

    const slotSingleDocAfter = await TimeSlot.findById(slotSingleId);
    assert(slotSingleDocAfter.bookedCount === 1, 'Single capacity slot bookedCount is exactly 1 (Never overbooked)');

    // ==============================================================
    // CANCELLATION & ROLLBACK TESTS (SECTIONS 17, 34)
    // ==============================================================
    console.log('\n--- EXECUTING CANCELLATION & CAPACITY RESTORATION TESTS ---');

    // Find a successful booking on Slot 2 (Capacity 5) to cancel, tracking the authentic owner
    let bookingToCancelId = null;
    let cancelQuantity = 0;
    let cancelToken = null;

    if (resRace3.status === 201) {
      bookingToCancelId = resRace3.data?.data?.booking?._id;
      cancelQuantity = 3;
      cancelToken = tokenDev1;
    } else if (resRace2.status === 201) {
      bookingToCancelId = resRace2.data?.data?.booking?._id;
      cancelQuantity = 2;
      cancelToken = tokenDev2;
    } else if (resRace1.status === 201) {
      bookingToCancelId = resRace1.data?.data?.booking?._id;
      cancelQuantity = 1;
      cancelToken = tokenDev3;
    }

    const preCancelSlot = await TimeSlot.findById(slotRaceId);
    assert(preCancelSlot.bookedCount === expectedBookedCount, `Pre-cancel bookedCount is ${expectedBookedCount}`);

    // Test 21: Devotee cancels booking
    const cancelRes = await request(`/bookings/${bookingToCancelId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cancelToken}` },
    });
    assert(cancelRes.status === 200, 'Test 21: Devotee cancelled booking successfully (200 OK)');
    assert(cancelRes.data?.data?.bookingStatus === BOOKING_STATUS.CANCELLED, 'Booking status updated to CANCELLED');

    // Test 22: TimeSlot bookedCount restored
    const postCancelSlot = await TimeSlot.findById(slotRaceId);
    assert(
      postCancelSlot.bookedCount === expectedBookedCount - cancelQuantity,
      `Test 22: TimeSlot bookedCount restored atomically from ${expectedBookedCount} to ${expectedBookedCount - cancelQuantity}`
    );

    // Test 23: Re-cancelling already cancelled booking rejected with 409 Conflict
    const reCancelRes = await request(`/bookings/${bookingToCancelId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cancelToken}` },
    });
    assert(reCancelRes.status === 409, 'Test 23: Re-cancelling already cancelled booking rejected with 409 Conflict');

    // Test 24: Another devotee cannot cancel Devotee 1's booking
    const dev2CancelDev1Booking = await request(`/bookings/${booking1Id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev2}` },
    });
    assert(dev2CancelDev1Booking.status === 404, 'Test 24: Devotee 2 cannot cancel Devotee 1 booking (404 Not Found)');

    // ==============================================================
    // DATA PRIVACY, RBAC & VISIBILITY TESTS (SECTIONS 15, 16, 25, 26)
    // ==============================================================
    console.log('\n--- EXECUTING VISIBILITY & ISOLATION TESTS ---');

    // Test 25: Devotee 1 gets own bookings
    const myBookingsRes = await request('/bookings/my', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(myBookingsRes.status === 200, 'Test 25: Devotee 1 retrieves own bookings list');
    const myBookingsList = myBookingsRes.data?.data?.bookings || [];
    assert(myBookingsList.length > 0, 'My bookings list is non-empty');
    assert(myBookingsList.every((b) => b.userId === userDev1Id), 'Every booking returned belongs to authenticated Devotee 1');

    // Test 26: Devotee cannot view another devotee's booking details
    const crossDevoteeBookingView = await request(`/bookings/${booking1Id}`, {
      headers: { Authorization: `Bearer ${tokenDev2}` },
    });
    assert(crossDevoteeBookingView.status === 404, 'Test 26: Devotee 2 blocked from viewing Devotee 1 booking (404 Not Found)');

    // Test 27: Devotee can view own booking details
    const ownBookingView = await request(`/bookings/${booking1Id}`, {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(ownBookingView.status === 200, 'Test 27: Devotee 1 can view own booking details');
    assert(ownBookingView.data?.data?.bookingReference === createdBooking.bookingReference, 'Booking reference matches');
    assert(ownBookingView.data?.data?.devotees?.[0]?.idNumber?.startsWith('XXXX-XXXX-'), 'Devotee ID number is masked in details view');

    // Test 28: Temple Authority A views bookings for Temple A
    const authBookingsRes = await request('/authority/bookings', {
      headers: { Authorization: `Bearer ${tokenAuthA}` },
    });
    assert(authBookingsRes.status === 200, 'Test 28: Temple Authority retrieves temple bookings');
    const authBookingsList = authBookingsRes.data?.data?.bookings || [];
    assert(authBookingsList.length > 0, 'Authority bookings list contains Temple A bookings');

    // Test 29: Admin can view bookings across temples
    const adminBookingsRes = await request('/admin/bookings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminBookingsRes.status === 200, 'Test 29: Admin retrieves all bookings across temples');
    const adminBookingsList = adminBookingsRes.data?.data?.bookings || [];
    assert(adminBookingsList.length >= authBookingsList.length, 'Admin supervisory view has all bookings');

    // Test 30: Notification was created for Devotee 1
    const notifRes = await request('/notifications', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(notifRes.status === 200, 'Devotee notifications retrieved');
    const notifs = notifRes.data?.data?.notifications || [];
    const bookingNotif = notifs.find((n) => n.metadata?.bookingId === booking1Id);
    assert(Boolean(bookingNotif), 'Test 30: Notification created for devotee with booking reference and actionUrl');
    assert(bookingNotif?.message?.includes('Payment is pending'), 'Notification accurately specifies payment pending');

    console.log('\n=============================================================');
    console.log(`PHASE 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    console.log('\n[Cleanup] Cleaning up Phase 7 test artifacts...');
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
    console.log('  ✓ Phase 7 test artifacts cleaned up successfully.');

    await mongoose.connection.close();
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected test error in Phase 7 suite:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
    process.exit(1);
  }
}

runPhase7Tests();
