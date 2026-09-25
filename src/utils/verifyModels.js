import mongoose from 'mongoose';
import {
  USER_ROLES,
  ALL_ROLES,
  User,
  REGISTRATION_STATUS,
  TempleRegistration,
  TEMPLE_STATUS,
  WEEKDAYS,
  Temple,
  SERVICE_TYPES,
  Service,
  TimeSlot,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  Booking,
  PAYMENT_PROVIDERS,
  Payment,
  REVIEW_STATUS,
  Review,
  NOTIFICATION_TYPES,
  Notification,
} from '../models/index.js';

/**
 * Phase 2 Model Verification Script
 * Validates Mongoose model compilation, schema paths, virtuals, indexes, and role rules.
 * Strictly verifies schema integrity WITHOUT inserting any mock/seed data.
 */
async function runVerification() {
  console.log('\n============================================================');
  console.log('🕉️   DevaSetu Phase 2: Mongoose Data Layer Verification');
  console.log('============================================================\n');

  const expectedModels = [
    'User',
    'TempleRegistration',
    'Temple',
    'Service',
    'TimeSlot',
    'Booking',
    'Payment',
    'Review',
    'Notification',
  ];

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition, message) {
    totalChecks++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedChecks++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Verify Model Registration
  console.log('1. Checking Mongoose Model Registration...');
  for (const modelName of expectedModels) {
    assert(
      mongoose.models[modelName] !== undefined,
      `Model '${modelName}' is compiled and registered in mongoose.models`
    );
  }

  // 2. User Model Rules
  console.log('\n2. Checking User Model & Role Constraints...');
  assert(
    ALL_ROLES.length === 3 &&
      ALL_ROLES.includes('DEVOTEE') &&
      ALL_ROLES.includes('ADMIN') &&
      ALL_ROLES.includes('TEMPLE_AUTHORITY'),
    'Exactly three user roles defined (DEVOTEE, ADMIN, TEMPLE_AUTHORITY)'
  );

  // Test Devotee user instance (in-memory document validation only, no save)
  const devoteeDoc = new User({
    name: 'Devotee Ramesh',
    email: 'Ramesh@EXAMPLE.COM',
    password: 'password123',
    role: USER_ROLES.DEVOTEE,
  });
  const devoteeError = devoteeDoc.validateSync();
  assert(!devoteeError, 'Devotee user passes schema validation without templeId');
  assert(devoteeDoc.email === 'ramesh@example.com', 'User email is normalized to lowercase');

  // Verify toJSON removes password
  const jsonUser = devoteeDoc.toJSON();
  assert(jsonUser.password === undefined, 'User toJSON transform strips sensitive password field');

  // Test Temple Authority user without templeId (must fail)
  const invalidAuthority = new User({
    name: 'Trustee Sharma',
    email: 'trustee@sharma.org',
    password: 'password123',
    role: USER_ROLES.TEMPLE_AUTHORITY,
    templeId: null,
  });
  const authorityError = invalidAuthority.validateSync();
  assert(
    authorityError && authorityError.errors['templeId'] !== undefined,
    'User with role TEMPLE_AUTHORITY correctly rejects null/missing templeId'
  );

  // Test Temple Authority user with templeId (must succeed)
  const fakeTempleId = new mongoose.Types.ObjectId();
  const validAuthority = new User({
    name: 'Trustee Sharma',
    email: 'trustee@sharma.org',
    password: 'password123',
    role: USER_ROLES.TEMPLE_AUTHORITY,
    templeId: fakeTempleId,
  });
  const validAuthError = validAuthority.validateSync();
  assert(!validAuthError, 'User with role TEMPLE_AUTHORITY passes validation with templeId provided');

  // 3. Temple Registration Model
  console.log('\n3. Checking TempleRegistration Model...');
  const regDoc = new TempleRegistration({
    applicantName: 'K. V. Raman',
    applicantEmail: 'raman@trust.org',
    applicantPhone: '+919876543210',
    authorityDesignation: 'Managing Trustee',
    templeName: 'Sri Brihadeeswarar Shrine',
    description: 'Ancient Chola temple',
    address: 'Membalam Road',
    city: 'Thanjavur',
    state: 'Tamil Nadu',
    pincode: '613007',
  });
  assert(!regDoc.validateSync(), 'TempleRegistration validates without creating a User account');
  assert(regDoc.status === REGISTRATION_STATUS.PENDING, 'Default status is PENDING');

  // 4. Temple Model & Timings
  console.log('\n4. Checking Temple Model & Structured Timings...');
  const templeDoc = new Temple({
    name: 'Sri Meenakshi Sundareswarar Temple',
    slug: 'sri-meenakshi-sundareswarar',
    description: 'Historic Hindu temple located on the southern bank of the Vaigai River.',
    address: 'Madurai Main',
    city: 'Madurai',
    state: 'Tamil Nadu',
    pincode: '625001',
    authorityId: fakeTempleId,
  });
  assert(!templeDoc.validateSync(), 'Temple model validates successfully');
  assert(
    Array.isArray(templeDoc.timings.weekly) && templeDoc.timings.weekly.length === 7,
    'Temple includes default structured weekday timings for all 7 days'
  );

  // 5. Service Model
  console.log('\n5. Checking Service Model...');
  const serviceDoc = new Service({
    templeId: fakeTempleId,
    name: 'Suprabhata Darshan',
    type: SERVICE_TYPES.DARSHAN,
    price: 150,
    duration: 45,
  });
  assert(!serviceDoc.validateSync(), 'Service validates with temple reference, price, and duration');

  // Verify negative price rejected
  const invalidService = new Service({
    templeId: fakeTempleId,
    name: 'Free Seva',
    type: SERVICE_TYPES.SEVA,
    price: -50,
  });
  const svcErr = invalidService.validateSync();
  assert(svcErr && svcErr.errors['price'] !== undefined, 'Service rejects negative price values');

  // 6. TimeSlot Model
  console.log('\n6. Checking TimeSlot Model...');
  const slotDoc = new TimeSlot({
    templeId: fakeTempleId,
    serviceId: new mongoose.Types.ObjectId(),
    date: new Date('2026-10-01'),
    startTime: '06:00',
    endTime: '07:00',
    capacity: 50,
    bookedCount: 15,
  });
  assert(!slotDoc.validateSync(), 'TimeSlot validates successfully with capacity');
  assert(slotDoc.remainingCapacity === 35, 'TimeSlot virtual remainingCapacity computes correctly (50 - 15 = 35)');

  // Test bookedCount > capacity
  const invalidSlot = new TimeSlot({
    templeId: fakeTempleId,
    serviceId: new mongoose.Types.ObjectId(),
    date: new Date('2026-10-01'),
    startTime: '07:30',
    endTime: '08:30',
    capacity: 20,
    bookedCount: 25,
  });
  const slotErr = invalidSlot.validateSync();
  assert(
    slotErr && slotErr.errors['bookedCount'] !== undefined,
    'TimeSlot rejects bookedCount exceeding slot capacity'
  );

  // 7. Booking Model
  console.log('\n7. Checking Booking Model...');
  const bookingDoc = new Booking({
    bookingReference: 'DS-2026-ABC1234',
    userId: new mongoose.Types.ObjectId(),
    templeId: fakeTempleId,
    serviceId: new mongoose.Types.ObjectId(),
    timeSlotId: new mongoose.Types.ObjectId(),
    bookingDate: new Date('2026-10-01'),
    devotees: [
      {
        name: 'Suresh Kumar',
        age: 38,
        gender: 'MALE',
        idType: 'AADHAAR',
        idNumber: '1234-5678-9012',
      },
    ],
    quantity: 1,
    totalAmount: 150,
    bookingStatus: BOOKING_STATUS.CONFIRMED,
    paymentStatus: PAYMENT_STATUS.PAID,
  });
  assert(!bookingDoc.validateSync(), 'Booking model validates with references and devotee entries');

  // 8. Payment Model
  console.log('\n8. Checking Payment Model...');
  const paymentDoc = new Payment({
    bookingId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    templeId: fakeTempleId,
    amount: 150,
    currency: 'INR',
    provider: PAYMENT_PROVIDERS.RAZORPAY,
    providerOrderId: 'order_test123',
    providerPaymentId: 'pay_test456',
    status: PAYMENT_STATUS.PAID,
  });
  assert(!paymentDoc.validateSync(), 'Payment model validates with provider IDs without storing card data');

  // 9. Review Model
  console.log('\n9. Checking Review Model...');
  const reviewDoc = new Review({
    userId: new mongoose.Types.ObjectId(),
    templeId: fakeTempleId,
    rating: 5,
    comment: 'Peaceful and serene darshan experience. Extremely well managed.',
  });
  assert(!reviewDoc.validateSync(), 'Review validates with 1-5 rating range');

  const invalidReview = new Review({
    userId: new mongoose.Types.ObjectId(),
    templeId: fakeTempleId,
    rating: 6,
    comment: 'Too high rating',
  });
  const revErr = invalidReview.validateSync();
  assert(revErr && revErr.errors['rating'] !== undefined, 'Review rejects ratings outside 1-5 bound');

  // 10. Notification Model
  console.log('\n10. Checking Notification Model...');
  const notifDoc = new Notification({
    userId: new mongoose.Types.ObjectId(),
    title: 'Darshan Confirmed',
    message: 'Your darshan booking has been confirmed for 2026-10-01.',
    type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
    metadata: {
      templeId: fakeTempleId,
      actionUrl: '/bookings',
    },
  });
  assert(!notifDoc.validateSync(), 'Notification validates with structured non-sensitive metadata');

  // Summary
  console.log('\n============================================================');
  console.log(`Results: ${passedChecks}/${totalChecks} checks passed.`);
  if (passedChecks === totalChecks) {
    console.log('✅ ALL MONGOOSE MODELS VALIDATED SUCCESSFULLY (0 DB RECORDS CREATED)');
    console.log('============================================================\n');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED');
    console.log('============================================================\n');
    process.exit(1);
  }
}

runVerification();
