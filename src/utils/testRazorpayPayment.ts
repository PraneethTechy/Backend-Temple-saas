import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';
import { USER_ROLES } from '../models/userRole.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';
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

// Generate valid test signature using test secret
function generateTestSignature(orderId, paymentId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runPaymentTests() {
  console.log('\n=============================================================');
  console.log('💳  DevaSetu — Task 2: Razorpay TEST MODE Payment Suite');
  console.log('=============================================================\n');

  await connectDatabase();

  const timestamp = Date.now();
  const testIds = [];

  let devoteeA, devoteeB, authorityUser, adminUser;
  let temple, service, timeSlot, bookingA, bookingB;
  let tokenA, tokenB, tokenAuth, tokenAdmin;

  try {
    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    // 1. Create Temple
    temple = await Temple.create({
      name: `Payment Temple ${timestamp}`,
      slug: `payment-temple-${timestamp}`,
      description: 'Temple for Razorpay test flow validation.',
      address: 'Temple Crossway',
      city: 'Ujjain',
      state: 'Madhya Pradesh',
      pincode: '456001',
      status: TEMPLE_STATUS.ACTIVE,
    });
    testIds.push({ model: Temple, id: temple._id });

    // 2. Create Temple Authority
    authorityUser = await User.create({
      name: `Authority Pay ${timestamp}`,
      email: `authpay_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.TEMPLE_AUTHORITY,
      templeId: temple._id,
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: authorityUser._id });

    temple.authorityId = authorityUser._id;
    await temple.save();

    // 3. Create Service (Price = 250 INR)
    service = await Service.create({
      templeId: temple._id,
      name: `Special Archana Seva ${timestamp}`,
      type: 'POOJA',
      price: 250,
      duration: 30,
      capacity: 50,
      isActive: true,
    });
    testIds.push({ model: Service, id: service._id });

    // 4. Create TimeSlot
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const tomorrowDay = dayNames[tomorrow.getDay()];

    timeSlot = await TimeSlot.create({
      templeId: temple._id,
      serviceId: service._id,
      startTime: '09:00',
      endTime: '09:30',
      capacity: 10,
      bookedCount: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      availableDays: [tomorrowDay],
      isActive: true,
    });
    testIds.push({ model: TimeSlot, id: timeSlot._id });

    // 5. Create Devotee A and Devotee B
    devoteeA = await User.create({
      name: `Devotee Alpha ${timestamp}`,
      email: `alpha_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.DEVOTEE,
      phone: '9876543210',
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: devoteeA._id });

    devoteeB = await User.create({
      name: `Devotee Beta ${timestamp}`,
      email: `beta_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.DEVOTEE,
      phone: '9876543211',
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: devoteeB._id });

    // 6. Create Admin
    adminUser = await User.create({
      name: `Admin Pay ${timestamp}`,
      email: `adminpay_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.ADMIN,
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: adminUser._id });

    // Login users
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: devoteeA.email, password: 'TestPass@123' }),
    });
    tokenA = loginA.data?.data?.token;

    const loginB = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: devoteeB.email, password: 'TestPass@123' }),
    });
    tokenB = loginB.data?.data?.token;

    const loginAuth = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authorityUser.email, password: 'TestPass@123' }),
    });
    tokenAuth = loginAuth.data?.data?.token;

    const loginAdmin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminUser.email, password: 'TestPass@123' }),
    });
    tokenAdmin = loginAdmin.data?.data?.token;

    // Create Booking for Devotee A (2 devotees * 250 = 500 INR)
    const bookingDateStr = tomorrow.toISOString().split('T')[0];
    const bookingPayload = {
      templeId: temple._id.toString(),
      serviceId: service._id.toString(),
      timeSlotId: timeSlot._id.toString(),
      bookingDate: bookingDateStr,
      devotees: [
        { name: 'Alpha One', age: 30, gender: 'MALE', idType: 'AADHAAR', idNumber: '123456789012' },
        { name: 'Alpha Two', age: 28, gender: 'FEMALE', idType: 'AADHAAR', idNumber: '987654321098' },
      ],
    };

    const bookRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(bookingPayload),
    });
    assert(bookRes.status === 201, 'Devotee A booking created with status PENDING', bookRes.data);
    bookingA = await Booking.findById(bookRes.data?.data?.booking?._id);
    testIds.push({ model: Booking, id: bookingA._id });

    // 1. Create Razorpay order for valid booking
    console.log('\n[Test 1: Create Razorpay order for valid booking]');
    const orderRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bookingId: bookingA._id.toString() }),
    });
    assert(orderRes.status === 200, 'Razorpay order created with 200 OK', orderRes.data);
    assert(orderRes.data?.data?.orderId?.startsWith('order_'), 'Returned valid Razorpay order ID (order_...)');
    assert(orderRes.data?.data?.amount === 50000, 'Amount in paise is exactly 50000 (500 INR)');
    assert(orderRes.data?.data?.keyId === process.env.RAZORPAY_KEY_ID, 'Safe Key ID returned to client');

    const razorpayOrderId = orderRes.data?.data?.orderId;

    // 2. Reject unauthenticated payment request
    console.log('\n[Test 2: Reject unauthenticated payment request]');
    const unauthRes = await request('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ bookingId: bookingA._id.toString() }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401');

    // 3. Reject non-devotee payment request
    console.log('\n[Test 3: Reject non-devotee payment request (Authority/Admin)]');
    const authPayRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAuth}` },
      body: JSON.stringify({ bookingId: bookingA._id.toString() }),
    });
    assert(authPayRes.status === 403, 'Temple authority payment creation rejected with 403');

    const adminPayRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ bookingId: bookingA._id.toString() }),
    });
    assert(adminPayRes.status === 403, 'Admin payment creation rejected with 403');

    // 4. Reject booking belonging to another user
    console.log('\n[Test 4: Reject payment for booking belonging to another user]');
    const crossUserRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }, // Devotee B tries to pay for Devotee A
      body: JSON.stringify({ bookingId: bookingA._id.toString() }),
    });
    assert(crossUserRes.status === 403, 'Cross-user payment attempt rejected with 403');

    // 5 & 6. Backend calculates amount from database & ignores frontend amount
    console.log('\n[Test 5 & 6: Backend calculates price authoritatively; frontend cannot manipulate]');
    const manipulatedOrderRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bookingId: bookingA._id.toString(), amount: 1, totalAmount: 1 }), // Malicious attempt to pay ₹1
    });
    assert(manipulatedOrderRes.status === 200, 'Order created successfully');
    assert(manipulatedOrderRes.data?.data?.amount === 50000, 'Frontend manipulated amount ignored; backend charged ₹500 (50000 paise)');
    razorpayOrderId = manipulatedOrderRes.data?.data?.orderId;

    // 7. Razorpay order ID stored correctly with status PENDING
    console.log('\n[Test 7: Razorpay order ID stored correctly in Payment record with status PENDING]');
    const paymentRecord1 = await Payment.findOne({ bookingId: bookingA._id });
    assert(paymentRecord1 != null, 'Payment document exists in MongoDB');
    assert(paymentRecord1.status === PAYMENT_STATUS.PENDING, 'Payment status is PENDING');
    assert(paymentRecord1.providerOrderId === razorpayOrderId, 'Payment providerOrderId matches Razorpay order ID');
    assert(paymentRecord1.amount === 500, 'Payment amount is 500');
    testIds.push({ model: Payment, id: paymentRecord1._id });

    // 8. Invalid Razorpay signature rejected
    console.log('\n[Test 8: Invalid Razorpay signature rejected]');
    const fakePaymentId = 'pay_fake123456789';
    const invalidVerifyRes = await request('/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        bookingId: bookingA._id.toString(),
        razorpayPaymentId: fakePaymentId,
        razorpayOrderId: razorpayOrderId,
        razorpaySignature: 'invalid_forged_signature_hash_000000',
      }),
    });
    assert(invalidVerifyRes.status === 400, 'Invalid signature rejected with 400 Bad Request');
    const bookingAfterFail = await Booking.findById(bookingA._id);
    assert(bookingAfterFail.bookingStatus === BOOKING_STATUS.PENDING, 'Booking remains PENDING after verification failure');
    assert(bookingAfterFail.paymentStatus === PAYMENT_STATUS.PENDING, 'Payment status remains PENDING');

    // 9 & 10. Valid signature marks payment PAID and confirms booking
    console.log('\n[Test 9 & 10: Valid Razorpay signature marks payment PAID and confirms booking]');
    const validPaymentId = 'pay_test_' + Date.now();
    const validSignature = generateTestSignature(
      razorpayOrderId,
      validPaymentId,
      process.env.RAZORPAY_KEY_SECRET
    );

    const validVerifyRes = await request('/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        bookingId: bookingA._id.toString(),
        razorpayPaymentId: validPaymentId,
        razorpayOrderId: razorpayOrderId,
        razorpaySignature: validSignature,
      }),
    });
    assert(validVerifyRes.status === 200, 'Payment verification succeeded with 200 OK', validVerifyRes.data);
    assert(validVerifyRes.data?.data?.booking?.bookingStatus === BOOKING_STATUS.CONFIRMED, 'Response confirms bookingStatus: CONFIRMED');
    assert(validVerifyRes.data?.data?.booking?.paymentStatus === PAYMENT_STATUS.PAID, 'Response confirms paymentStatus: PAID');

    const bookingAfterSuccess = await Booking.findById(bookingA._id);
    assert(bookingAfterSuccess.bookingStatus === BOOKING_STATUS.CONFIRMED, 'MongoDB booking status updated to CONFIRMED');
    assert(bookingAfterSuccess.paymentStatus === PAYMENT_STATUS.PAID, 'MongoDB payment status updated to PAID');

    const paymentAfterSuccess = await Payment.findOne({ bookingId: bookingA._id });
    assert(paymentAfterSuccess.status === PAYMENT_STATUS.PAID, 'MongoDB payment record status updated to PAID');
    assert(paymentAfterSuccess.providerPaymentId === validPaymentId, 'Provider payment ID stored correctly');

    // 11. Duplicate verification is safe/idempotent
    console.log('\n[Test 11: Duplicate verification is idempotent]');
    const dupVerifyRes = await request('/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        bookingId: bookingA._id.toString(),
        razorpayPaymentId: validPaymentId,
        razorpayOrderId: razorpayOrderId,
        razorpaySignature: validSignature,
      }),
    });
    assert(dupVerifyRes.status === 200, 'Duplicate verification returns 200 OK without errors');

    // 12. Already-paid booking cannot be paid again
    console.log('\n[Test 12: Already-paid booking returns existing state]');
    const payAgainRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bookingId: bookingA._id.toString() }),
    });
    assert(payAgainRes.status === 200, 'Create order on already-paid booking handled safely');
    assert(payAgainRes.data?.data?.status === PAYMENT_STATUS.PAID, 'Informs client that booking is already paid');

    // 13. Payment failure does not confirm booking
    console.log('\n[Test 13: Failed payment record does not confirm booking]');
    const bookingBRes = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        templeId: temple._id.toString(),
        serviceId: service._id.toString(),
        timeSlotId: timeSlot._id.toString(),
        bookingDate: bookingDateStr,
        devotees: [
          { name: 'Beta One', age: 40, gender: 'MALE', idType: 'AADHAAR', idNumber: '555544443333' },
        ],
      }),
    });
    bookingB = await Booking.findById(bookingBRes.data?.data?.booking?._id);
    testIds.push({ model: Booking, id: bookingB._id });

    const orderBRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ bookingId: bookingB._id.toString() }),
    });
    const orderBId = orderBRes.data?.data?.orderId;

    // Fail verification on Booking B
    await request('/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        bookingId: bookingB._id.toString(),
        razorpayPaymentId: 'pay_failed_123',
        razorpayOrderId: orderBId,
        razorpaySignature: 'bad_signature_xyz',
      }),
    });
    const bookingBCheck = await Booking.findById(bookingB._id);
    assert(bookingBCheck.bookingStatus === BOOKING_STATUS.PENDING, 'Booking B remains PENDING');
    assert(bookingBCheck.paymentStatus === PAYMENT_STATUS.PENDING, 'Payment B remains PENDING');

    // 14. Payment secret never appears in API responses
    console.log('\n[Test 14: Payment secret never appears in any API response]');
    const orderResponseStr = JSON.stringify(orderRes.data);
    const verifyResponseStr = JSON.stringify(validVerifyRes.data);
    const secret = process.env.RAZORPAY_KEY_SECRET;
    assert(!orderResponseStr.includes(secret), 'Secret NOT exposed in create-order response');
    assert(!verifyResponseStr.includes(secret), 'Secret NOT exposed in verify response');

    // 15. Cross-user payment verification rejected
    console.log('\n[Test 15: Cross-user payment verification rejected]');
    const crossVerifyRes = await request('/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }, // Devotee A tries to verify Devotee B's booking
      body: JSON.stringify({
        bookingId: bookingB._id.toString(),
        razorpayPaymentId: 'pay_random',
        razorpayOrderId: orderBId,
        razorpaySignature: 'sig',
      }),
    });
    assert(crossVerifyRes.status === 403, 'Cross-user verification blocked with 403');

    // 16. Notification created only after successful verification
    console.log('\n[Test 16: Notification created after successful verification]');
    const notifs = await Notification.find({
      userId: devoteeA._id,
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      'metadata.bookingId': bookingA._id,
    });
    assert(notifs.length >= 1, 'Devotee A received confirmation notification after successful payment');
    assert(notifs[0].title === 'Booking Confirmed', 'Notification title is "Booking Confirmed"');
    assert(notifs[0].message.includes('confirmed'), 'Notification message mentions confirmation');
    for (const n of notifs) {
      testIds.push({ model: Notification, id: n._id });
    }

  } catch (err) {
    console.error('Unexpected payment test error:', err);
    failed++;
  } finally {
    // Automated Cleanup
    console.log('\n[Cleanup]: Purging payment test records from database...');
    for (const item of testIds) {
      try {
        await item.model.findByIdAndDelete(item.id);
      } catch (e) {}
    }
    // Also clean any leftover payments for these bookings
    if (bookingA) await Payment.deleteMany({ bookingId: bookingA._id });
    if (bookingB) await Payment.deleteMany({ bookingId: bookingB._id });
    console.log('✓ Cleanup complete.');
    await mongoose.disconnect();

    console.log('\n-------------------------------------------------------------');
    console.log(`Payment Tests Finished: ${passed} Passed, ${failed} Failed`);
    console.log('-------------------------------------------------------------\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPaymentTests();
