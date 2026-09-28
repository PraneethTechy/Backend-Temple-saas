import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
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

async function runBookingValidationSuite() {
  console.log('\n=============================================================');
  console.log('  DEVASETU — BOOKING FLOW FINAL VALIDATION & DATA INTEGRITY');
  console.log('=============================================================\n');

  try {
    await connectDatabase();
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // [Setup 1] Create Bootstrap Admin
    // -------------------------------------------------------------
    console.log('[Setup 1] Creating admin...');
    const adminEmail = `admin_val_${timestamp}@devasetu.test`;
    const adminPass = 'AdminPass@123456';
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET || 'DevaSetu_Super_Secret_Admin_Bootstrap_Key_2025';

    await request('/auth/create-admin', {
      method: 'POST',
      headers: { 'x-admin-bootstrap-secret': secret },
      body: JSON.stringify({
        name: 'Validation Admin',
        email: adminEmail,
        password: adminPass,
        phone: '9888877777',
      }),
    });

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    });
    const adminToken = adminLogin.data?.data?.token;
    assert(Boolean(adminToken), 'Admin authenticated successfully');

    // -------------------------------------------------------------
    // [Setup 2] Create & Approve Temple A, Temple B, and Inactive Temple
    // -------------------------------------------------------------
    console.log('\n[Setup 2] Creating and approving Temple A & Temple B...');
    // Temple A
    const regARes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Trustee A',
        applicantEmail: `trustee_a_${timestamp}@devasetu.test`,
        applicantPhone: '9876543211',
        authorityDesignation: 'Executive Officer',
        templeName: `Sri Venkateswara Temple ${timestamp}`,
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        address: 'Tirumala Hills',
        pincode: '517504',
        description: 'Venkateswara Temple on Venkata Hill.',
      }),
    });
    const regAId = regARes.data?.data?.registrationId || regARes.data?.data?._id;

    const appARes = await request(`/admin/temple-registrations/${regAId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    const templeAId = appARes.data?.data?.temple?.id || appARes.data?.data?.temple?._id;

    const tempPassA = 'TirumalaAuthPass@2026';
    await request(`/admin/temple-registrations/${regAId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: `trustee_a_${timestamp}@devasetu.test`,
        temporaryPassword: tempPassA,
      }),
    });

    const authALogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `trustee_a_${timestamp}@devasetu.test`, password: tempPassA }),
    });
    const tokenAuthA = authALogin.data?.data?.token;
    assert(Boolean(templeAId && tokenAuthA), 'Temple A active and authority provisioned');

    // Temple B
    const regBRes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Trustee B',
        applicantEmail: `trustee_b_${timestamp}@devasetu.test`,
        applicantPhone: '9876543212',
        authorityDesignation: 'Chief Priest',
        templeName: `Sri Meenakshi Amman ${timestamp}`,
        city: 'Madurai',
        state: 'Tamil Nadu',
        address: 'Madurai Temple Road',
        pincode: '625001',
        description: 'Historic shrine in Madurai.',
      }),
    });
    const regBId = regBRes.data?.data?.registrationId || regBRes.data?.data?._id;

    const appBRes = await request(`/admin/temple-registrations/${regBId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    const templeBId = appBRes.data?.data?.temple?.id || appBRes.data?.data?.temple?._id;

    const tempPassB = 'MeenakshiAuthPass@2026';
    await request(`/admin/temple-registrations/${regBId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: `trustee_b_${timestamp}@devasetu.test`,
        temporaryPassword: tempPassB,
      }),
    });

    const authBLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `trustee_b_${timestamp}@devasetu.test`, password: tempPassB }),
    });
    const tokenAuthB = authBLogin.data?.data?.token;
    assert(Boolean(templeBId && tokenAuthB), 'Temple B active and authority provisioned');

    // Inactive Temple
    const inactiveTemple = await Temple.create({
      name: `Inactive Shrine ${timestamp}`,
      slug: `inactive-shrine-${timestamp}`,
      templeType: 'PILGRIMAGE',
      address: 'Zero Road',
      city: 'Rishikesh',
      state: 'Uttarakhand',
      pincode: '249201',
      description: 'Inactive shrine description for validation testing.',
      status: TEMPLE_STATUS.INACTIVE,
    });

    // -------------------------------------------------------------
    // [Setup 3] Setup Services on Temple A & Temple B
    // -------------------------------------------------------------
    console.log('\n[Setup 3] Setting up services & timeslots...');
    // Service 1 on Temple A (Price ₹500)
    const svcA1Res = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        name: 'Special Abhishekam',
        type: 'POOJA',
        description: 'Sacred abhishekam seva',
        price: 500,
        duration: 45,
        availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        rules: 'Traditional attire mandatory',
      }),
    });
    const svcA1Id = svcA1Res.data?.data?._id;

    // Service on Temple B (Price ₹300)
    const svcBRes = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthB}` },
      body: JSON.stringify({
        name: 'Temple B Darshan',
        type: 'DARSHAN',
        description: 'Temple B special darshan',
        price: 300,
        duration: 30,
        availableDays: ['FRIDAY'],
        rules: 'Standard entry',
      }),
    });
    const svcBId = svcBRes.data?.data?._id;

    // Slot 1 on Temple A + Service 1 (Capacity 10, Booked 7, Mon/Wed/Fri in 2026-10-01..2026-10-15)
    const slotA1 = await TimeSlot.create({
      templeId: templeAId,
      serviceId: svcA1Id,
      startDate: new Date('2026-10-01T00:00:00'),
      endDate: new Date('2026-10-15T00:00:00'),
      availableDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '07:00',
      endTime: '08:00',
      capacity: 10,
      bookedCount: 7, // remaining 3
      isActive: true,
    });
    const slotA1Id = slotA1._id.toString();

    // Slot Single on Temple A + Service 1 (Capacity 1, Booked 0, Friday)
    const slotSingle = await TimeSlot.create({
      templeId: templeAId,
      serviceId: svcA1Id,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-15T23:59:59.999Z'),
      availableDays: ['FRIDAY'],
      startTime: '10:00',
      endTime: '11:00',
      capacity: 1,
      bookedCount: 0,
      isActive: true,
    });
    const slotSingleId = slotSingle._id.toString();

    // Slot on Temple B + Service B
    const slotB = await TimeSlot.create({
      templeId: templeBId,
      serviceId: svcBId,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-15T23:59:59.999Z'),
      availableDays: ['FRIDAY'],
      startTime: '09:00',
      endTime: '10:00',
      capacity: 20,
      bookedCount: 0,
      isActive: true,
    });
    const slotBId = slotB._id.toString();

    // -------------------------------------------------------------
    // [Setup 4] Register Devotee 1 & Devotee 2
    // -------------------------------------------------------------
    console.log('\n[Setup 4] Registering Devotee 1 & Devotee 2...');
    const dev1Email = `devotee1_${timestamp}@devasetu.test`;
    const dev2Email = `devotee2_${timestamp}@devasetu.test`;
    const devPass = 'DevoteePass@123456';

    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ramesh Sharma', email: dev1Email, password: devPass, phone: '9876500001' }),
    });
    const dev1Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: dev1Email, password: devPass }),
    });
    const tokenDev1 = dev1Login.data?.data?.token;
    const userDev1Id = dev1Login.data?.data?.user?._id;

    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Suresh Verma', email: dev2Email, password: devPass, phone: '9876500002' }),
    });
    const dev2Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: dev2Email, password: devPass }),
    });
    const tokenDev2 = dev2Login.data?.data?.token;
    const userDev2Id = dev2Login.data?.data?.user?._id;
    assert(Boolean(tokenDev1 && tokenDev2), 'Devotee 1 and Devotee 2 registered and authenticated');

    // =============================================================
    // TEST 1: Temple -> Service Relation Verification
    // =============================================================
    console.log('\n--- 1. TEMPLE ↔ SERVICE RELATION VERIFICATION ---');
    // Attempt: Temple B with Service A1 (belongs to Temple A)
    const crossTempleRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeBId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Ramesh Sharma', age: 35, gender: 'MALE' }],
      }),
    });
    assert(crossTempleRes.status === 404, 'Test 1: Booking combining Temple B with Temple A service rejected with 404 Not Found');

    // =============================================================
    // TEST 2: Service -> TimeSlot Relation Verification
    // =============================================================
    console.log('\n--- 2. SERVICE ↔ TIMESLOT RELATION VERIFICATION ---');
    // Attempt: Temple A + Service A1 with Slot B (belongs to Temple B)
    const crossSlotRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotBId,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Ramesh Sharma', age: 35, gender: 'MALE' }],
      }),
    });
    assert(crossSlotRes.status === 404, 'Test 2: Booking combining Service A1 with Slot from Temple B rejected with 404 Not Found');

    // =============================================================
    // TEST 3: Date-Range Logic & Weekday Verification
    // =============================================================
    console.log('\n--- 3. DATE-RANGE & WEEKDAY VALIDATION ---');
    // A. Date before startDate (2026-09-30, slot starts 2026-10-01)
    const beforeStartRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-09-30',
        devotees: [{ name: 'Ramesh Sharma', age: 35, gender: 'MALE' }],
      }),
    });
    assert(beforeStartRes.status === 400, 'Test 3A: Date before startDate rejected with 400 Bad Request');

    // B. Date after endDate (2026-10-19 Monday, slot ends 2026-10-15)
    const afterEndRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-19',
        devotees: [{ name: 'Ramesh Sharma', age: 35, gender: 'MALE' }],
      }),
    });
    assert(afterEndRes.status === 400, 'Test 3B: Date after endDate rejected with 400 Bad Request');

    // C. Date inside range but unconfigured weekday (2026-10-06 is a Tuesday; slot is Mon/Wed/Fri)
    const wrongDayRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-06',
        devotees: [{ name: 'Ramesh Sharma', age: 35, gender: 'MALE' }],
      }),
    });
    assert(wrongDayRes.status === 400, 'Test 3C: Date inside range on unconfigured weekday rejected with 400 Bad Request');

    // =============================================================
    // TEST 4: Past Date Protection
    // =============================================================
    console.log('\n--- 4. PAST DATE PROTECTION ---');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const slotBeforePast = await TimeSlot.findById(slotA1Id);
    const bookedBeforePast = slotBeforePast.bookedCount;

    const pastDateRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: yesterdayStr,
        devotees: [{ name: 'Ramesh Sharma', age: 35, gender: 'MALE' }],
      }),
    });
    assert(pastDateRes.status === 400, 'Test 4A: Booking with yesterday date rejected with 400 Bad Request');
    assert(
      pastDateRes.data?.message?.toLowerCase().includes('past'),
      'Test 4B: Error message explicitly explains date cannot be in the past'
    );

    const slotAfterPast = await TimeSlot.findById(slotA1Id);
    assert(
      slotAfterPast.bookedCount === bookedBeforePast,
      'Test 4C: Slot bookedCount strictly unchanged after rejected past-date booking'
    );

    // =============================================================
    // TEST 5: Capacity Progression & Strict Overbooking Prevention
    // =============================================================
    console.log('\n--- 5. CAPACITY PROGRESSION & OVERBOOKING PREVENTION ---');
    // Initial: capacity 10, booked 7 (remaining 3)
    // 5A: Book for quantity 2 -> bookedCount becomes 9
    const bookQty2Res = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02', // Friday in range
        devotees: [
          { name: 'Ramesh Sharma', age: 35, gender: 'MALE' },
          { name: 'Sunita Sharma', age: 32, gender: 'FEMALE' },
        ],
      }),
    });
    assert(bookQty2Res.status === 201, 'Test 5A: Booking for quantity 2 succeeds (201 Created)');
    const bookingQty2 = bookQty2Res.data?.data?.booking;

    const slotAfterQty2 = await TimeSlot.findById(slotA1Id);
    assert(slotAfterQty2.bookedCount === 9, 'Test 5B: Slot bookedCount accurately incremented to 9 (7 -> 9)');

    // 5B: Book for quantity 1 -> bookedCount becomes 10 (Slot is now FULL)
    const bookQty1Res = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev2}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Suresh Verma', age: 28, gender: 'MALE' }],
      }),
    });
    assert(bookQty1Res.status === 201, 'Test 5C: Booking for quantity 1 succeeds (201 Created, slot now FULL)');

    const slotAfterQty1 = await TimeSlot.findById(slotA1Id);
    assert(slotAfterQty1.bookedCount === 10, 'Test 5D: Slot bookedCount reaches capacity 10 (9 -> 10, remaining 0)');

    // 5C: Attempt another booking on full slot -> MUST be rejected with 409 Conflict
    const bookOnFullRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Extra Person', age: 22, gender: 'MALE' }],
      }),
    });
    assert(bookOnFullRes.status === 409, 'Test 5E: Overbooking attempt on full slot rejected with 409 Conflict');

    const slotFinalCheck = await TimeSlot.findById(slotA1Id);
    assert(slotFinalCheck.bookedCount === 10, 'Test 5F: Slot bookedCount strictly capped at 10 (never 11 or 12)');

    // =============================================================
    // TEST 6: Atomic Concurrency Verification (Capacity = 1)
    // =============================================================
    console.log('\n--- 6. ATOMIC CONCURRENCY VERIFICATION (CAPACITY = 1) ---');
    // Two simultaneous requests for the single available seat
    const [reqA, reqB] = await Promise.all([
      request('/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDev1}` },
        body: JSON.stringify({
          templeId: templeAId,
          serviceId: svcA1Id,
          timeSlotId: slotSingleId,
          bookingDate: '2026-10-02',
          devotees: [{ name: 'Pilgrim A', age: 30, gender: 'MALE' }],
        }),
      }),
      request('/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDev2}` },
        body: JSON.stringify({
          templeId: templeAId,
          serviceId: svcA1Id,
          timeSlotId: slotSingleId,
          bookingDate: '2026-10-02',
          devotees: [{ name: 'Pilgrim B', age: 25, gender: 'FEMALE' }],
        }),
      }),
    ]);

    const successCount = [reqA.status, reqB.status].filter((s) => s === 201).length;
    const conflictCount = [reqA.status, reqB.status].filter((s) => s === 409).length;

    assert(successCount === 1, 'Test 6A: Exactly one concurrent request succeeded (201 Created)');
    assert(conflictCount === 1, 'Test 6B: The competing concurrent request received 409 Conflict');

    const slotSingleDoc = await TimeSlot.findById(slotSingleId);
    assert(slotSingleDoc.bookedCount === 1, 'Test 6C: Single capacity slot bookedCount is exactly 1 (never 2)');

    // =============================================================
    // TEST 7: Quantity & Devotees Validation
    // =============================================================
    console.log('\n--- 7. QUANTITY & DEVOTEES VALIDATION ---');
    // Empty devotees array (quantity 0)
    const emptyDevRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [],
      }),
    });
    assert(emptyDevRes.status === 400, 'Test 7A: Quantity 0 (empty devotees) rejected with 400 Bad Request');

    // More than 6 devotees
    const excessDevRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [
          { name: 'D1', age: 20, gender: 'MALE' },
          { name: 'D2', age: 20, gender: 'MALE' },
          { name: 'D3', age: 20, gender: 'MALE' },
          { name: 'D4', age: 20, gender: 'MALE' },
          { name: 'D5', age: 20, gender: 'MALE' },
          { name: 'D6', age: 20, gender: 'MALE' },
          { name: 'D7', age: 20, gender: 'MALE' },
        ],
      }),
    });
    assert(excessDevRes.status === 400, 'Test 7B: Devotees > 6 rejected with 400 Bad Request');

    // =============================================================
    // TEST 8: Price Calculation (Ignore Client Tampered Amount)
    // =============================================================
    console.log('\n--- 8. PRICE CALCULATION & TAMPER PROOFING ---');
    // Booking on Temple B (Price ₹300) with quantity 2
    // Client sends manipulated totalAmount: 1
    const priceTamperRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDev1}` },
      body: JSON.stringify({
        templeId: templeBId,
        serviceId: svcBId,
        timeSlotId: slotBId,
        bookingDate: '2026-10-02',
        totalAmount: 1, // Tampered client amount
        devotees: [
          { name: 'Ramesh Sharma', age: 35, gender: 'MALE' },
          { name: 'Sunita Sharma', age: 32, gender: 'FEMALE' },
        ],
      }),
    });
    assert(priceTamperRes.status === 201, 'Test 8A: Booking with tampered amount processed');
    const createdBookingTamper = priceTamperRes.data?.data?.booking;
    assert(
      createdBookingTamper?.totalAmount === 600,
      `Test 8B: Backend authoritatively computed totalAmount = ₹600 (2 × ₹300), completely ignoring client-sent ₹1`
    );

    // =============================================================
    // TEST 9: Devotee Ownership & Privacy
    // =============================================================
    console.log('\n--- 9. DEVOTEE OWNERSHIP & ISOLATION ---');
    // Devotee 1 views own bookings list
    const myBookingsDev1 = await request('/bookings/my', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(myBookingsDev1.status === 200, 'Test 9A: Devotee 1 retrieves own bookings (200 OK)');
    const dev1List = myBookingsDev1.data?.data?.bookings || [];
    assert(
      dev1List.every((b) => b.userId === userDev1Id),
      'Test 9B: Every booking in Devotee 1 list strictly belongs to Devotee 1'
    );

    // Devotee 2 attempts to view Devotee 1's booking by ID -> 404
    const dev1BookingId = dev1List[0]?._id;
    const crossDevoteeViewRes = await request(`/bookings/${dev1BookingId}`, {
      headers: { Authorization: `Bearer ${tokenDev2}` },
    });
    assert(crossDevoteeViewRes.status === 404, 'Test 9C: Devotee 2 blocked from viewing Devotee 1 booking (404 Not Found)');

    // Devotee 2 attempts to cancel Devotee 1's booking -> 404
    const crossDevoteeCancelRes = await request(`/bookings/${dev1BookingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev2}` },
    });
    assert(crossDevoteeCancelRes.status === 404, 'Test 9D: Devotee 2 blocked from cancelling Devotee 1 booking (404 Not Found)');

    // =============================================================
    // TEST 10: Temple Authority Booking Access & Isolation
    // =============================================================
    console.log('\n--- 10. TEMPLE AUTHORITY ISOLATION ---');
    // Authority A views bookings -> Should ONLY contain Temple A bookings
    const authABookingsRes = await request('/authority/bookings', {
      headers: { Authorization: `Bearer ${tokenAuthA}` },
    });
    assert(authABookingsRes.status === 200, 'Test 10A: Temple Authority A accesses bookings (200 OK)');
    const authABookings = authABookingsRes.data?.data?.bookings || [];
    assert(
      authABookings.every((b) => String(b.templeId) === String(templeAId)),
      'Test 10B: Authority A bookings list strictly contains only Temple A bookings'
    );

    // Authority B views bookings -> Should ONLY contain Temple B bookings
    const authBBookingsRes = await request('/authority/bookings', {
      headers: { Authorization: `Bearer ${tokenAuthB}` },
    });
    const authBBookings = authBBookingsRes.data?.data?.bookings || [];
    assert(
      authBBookings.every((b) => String(b.templeId) === String(templeBId)),
      'Test 10C: Authority B bookings list strictly contains only Temple B bookings'
    );

    // =============================================================
    // TEST 11: Admin Supervisory Booking Access
    // =============================================================
    console.log('\n--- 11. ADMIN SUPERVISORY ACCESS ---');
    const adminBookingsRes = await request('/admin/bookings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminBookingsRes.status === 200, 'Test 11A: Admin retrieves platform-wide bookings (200 OK)');
    const allAdminBookings = adminBookingsRes.data?.data?.bookings || [];
    assert(allAdminBookings.length >= 3, 'Test 11B: Admin sees bookings across multiple temples');
    assert(
      allAdminBookings.every((b) => b.password === undefined && b.passwordHash === undefined),
      'Test 11C: Admin booking view never exposes password or passwordHash'
    );

    // =============================================================
    // TEST 12: Cancellation & Atomic Capacity Restoration
    // =============================================================
    console.log('\n--- 12. CANCELLATION & ATOMIC CAPACITY RESTORATION ---');
    // We cancel bookingQty2 (quantity 2 on slotA1)
    const slotA1BeforeCancel = await TimeSlot.findById(slotA1Id);
    assert(slotA1BeforeCancel.bookedCount === 10, 'Pre-cancel bookedCount is 10 (Full)');

    const cancelRes = await request(`/bookings/${bookingQty2._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(cancelRes.status === 200, 'Test 12A: Devotee cancelled booking successfully (200 OK)');
    assert(cancelRes.data?.data?.bookingStatus === BOOKING_STATUS.CANCELLED, 'Booking status updated to CANCELLED');

    const slotA1AfterCancel = await TimeSlot.findById(slotA1Id);
    assert(
      slotA1AfterCancel.bookedCount === 8,
      'Test 12B: TimeSlot bookedCount atomically restored from 10 to 8 (restored 2 seats)'
    );

    // Attempt to double-cancel -> MUST be rejected with 409 Conflict
    const doubleCancelRes = await request(`/bookings/${bookingQty2._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(doubleCancelRes.status === 409, 'Test 12C: Double-cancellation rejected with 409 Conflict');

    const slotA1AfterDoubleCancel = await TimeSlot.findById(slotA1Id);
    assert(
      slotA1AfterDoubleCancel.bookedCount === 8,
      'Test 12D: Capacity was NOT restored twice (bookedCount strictly remains 8)'
    );

    // =============================================================
    // TEST 13: Notification Verification
    // =============================================================
    console.log('\n--- 13. NOTIFICATION VERIFICATION ---');
    const dev1NotifsRes = await request('/notifications', {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    assert(dev1NotifsRes.status === 200, 'Test 13A: Devotee 1 notifications retrieved');
    const dev1Notifs = dev1NotifsRes.data?.data?.notifications || [];
    assert(dev1Notifs.length > 0, 'Test 13B: Notification exists for Devotee 1');
    const bookingNotif = dev1Notifs.find((n) => n.title.includes('Booking Created'));
    assert(Boolean(bookingNotif), 'Test 13C: Booking Created notification found');
    assert(
      bookingNotif?.userId === userDev1Id,
      'Test 13D: Notification userId strictly matches booking userId'
    );

    // =============================================================
    // TEST 14: Authentication & Role Enforcement (RBAC)
    // =============================================================
    console.log('\n--- 14. AUTHENTICATION & RBAC ENFORCEMENT ---');
    // Unauthenticated booking attempt
    const unauthBooking = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Unauth Devotee', age: 30, gender: 'MALE' }],
      }),
    });
    assert(unauthBooking.status === 401, 'Test 14A: Unauthenticated user cannot create booking (401 Unauthorized)');

    // Admin booking attempt
    const adminBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Admin Booking', age: 30, gender: 'MALE' }],
      }),
    });
    assert(adminBooking.status === 403, 'Test 14B: ADMIN token cannot create devotee booking (403 Forbidden)');

    // Temple Authority booking attempt
    const authorityBooking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuthA}` },
      body: JSON.stringify({
        templeId: templeAId,
        serviceId: svcA1Id,
        timeSlotId: slotA1Id,
        bookingDate: '2026-10-02',
        devotees: [{ name: 'Authority Booking', age: 30, gender: 'MALE' }],
      }),
    });
    assert(authorityBooking.status === 403, 'Test 14C: TEMPLE_AUTHORITY cannot create devotee booking (403 Forbidden)');

    // -------------------------------------------------------------
    // Cleanup temporary test records
    // -------------------------------------------------------------
    console.log('\n[Cleanup] Removing temporary validation test documents...');
    await Booking.deleteMany({ templeId: { $in: [templeAId, templeBId] } });
    await Notification.deleteMany({ userId: { $in: [userDev1Id, userDev2Id] } });
    await TimeSlot.deleteMany({ templeId: { $in: [templeAId, templeBId] } });
    await Service.deleteMany({ templeId: { $in: [templeAId, templeBId] } });
    await Temple.deleteMany({ _id: { $in: [templeAId, templeBId, inactiveTemple._id] } });
    await User.deleteMany({ email: { $in: [adminEmail, `trustee_a_${timestamp}@devasetu.test`, `trustee_b_${timestamp}@devasetu.test`, dev1Email, dev2Email] } });
    console.log('Cleaned up validation test data successfully.');

    console.log('\n=============================================================');
    console.log(`FINAL VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Fatal validation test error:', err);
    process.exit(1);
  }
}

runBookingValidationSuite();
