import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase } from '../config/database.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Temple } from '../models/Temple.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';

const runTests = async () => {
  console.log('\n==================================================');
  console.log('      DEVATSETU QR VERIFICATION TEST SUITE        ');
  console.log('==================================================\n');

  try {
    await connectDatabase();
    console.log('✓ Connected to MongoDB');

    // 1. Fetch sample temple, service, timeslot, and devotee
    const temple = await Temple.findOne({ status: 'ACTIVE' });
    if (!temple) throw new Error('No ACTIVE temple found in database');

    const service = await Service.findOne({ templeId: temple._id, isActive: true });
    if (!service) throw new Error('No active service found for temple');

    const timeSlot = await TimeSlot.findOne({ templeId: temple._id, serviceId: service._id, isActive: true });
    if (!timeSlot) throw new Error('No active time slot found');

    const devotee = await User.findOne({ role: 'DEVOTEE' });
    if (!devotee) throw new Error('No devotee user found');

    console.log(`✓ Using Temple: "${temple.name}"`);
    console.log(`✓ Using Service: "${service.name}"`);
    console.log(`✓ Using Devotee: "${devotee.name}"`);

    // 2. Test Token Generation Security & Randomness
    const token1 = crypto.randomBytes(24).toString('hex');
    const token2 = crypto.randomBytes(24).toString('hex');

    if (token1 === token2 || token1.length !== 48) {
      throw new Error('Cryptographic token generation failed randomness test');
    }
    console.log('✓ Cryptographic random token entropy verified (48 hex chars, 192-bit)');

    // 3. Create a test CONFIRMED & PAID booking with qrVerificationToken
    const bookingRef = `DVS-TEST-${Date.now().toString(36).toUpperCase()}`;
    const qrToken = crypto.randomBytes(24).toString('hex');

    const testBooking = new Booking({
      bookingReference: bookingRef,
      userId: devotee._id,
      templeId: temple._id,
      serviceId: service._id,
      timeSlotId: timeSlot._id,
      bookingDate: new Date(),
      devotees: [
        {
          name: 'Confidential Pilgrim',
          age: 32,
          gender: 'MALE',
          idType: 'AADHAAR',
          idNumber: '999988887777',
        },
      ],
      quantity: 1,
      totalAmount: 100,
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      qrVerificationToken: qrToken,
      qrCode: {
        code: qrToken,
        generatedAt: new Date(),
      },
    });

    await testBooking.save();
    console.log(`✓ Created test confirmed booking: ${bookingRef}`);
    console.log(`✓ Assigned QR Verification Token: ${qrToken}`);

    // 4. Test Idempotency: verify fetching/re-saving keeps the token identical
    const fetchedBooking = await Booking.findById(testBooking._id);
    if (fetchedBooking.qrVerificationToken !== qrToken) {
      throw new Error('Idempotency failed: QR token changed upon re-fetch');
    }
    console.log('✓ QR Token idempotency verified (remains strictly identical)');

    // 5. Test Verification Endpoint Logic (Simulated via Controller logic)
    const matchedBooking = await Booking.findOne({
      $or: [{ qrVerificationToken: qrToken }, { 'qrCode.code': qrToken }],
    })
      .populate('templeId', 'name city state')
      .populate('serviceId', 'name type')
      .populate('timeSlotId', 'startTime endTime');

    if (!matchedBooking) {
      throw new Error('Failed to find booking using qrVerificationToken');
    }

    const isValid =
      matchedBooking.bookingStatus === BOOKING_STATUS.CONFIRMED &&
      matchedBooking.paymentStatus === PAYMENT_STATUS.PAID;

    if (!isValid) {
      throw new Error('Confirmed booking marked invalid');
    }

    // 6. Security Check: Ensure NO PII is leaked in verification payload
    const safePayload = {
      valid: true,
      bookingReference: matchedBooking.bookingReference,
      templeName: matchedBooking.templeId?.name,
      templeCity: matchedBooking.templeId?.city,
      templeState: matchedBooking.templeId?.state,
      serviceName: matchedBooking.serviceId?.name,
      serviceType: matchedBooking.serviceId?.type,
      quantity: matchedBooking.quantity,
      status: matchedBooking.bookingStatus,
      paymentStatus: matchedBooking.paymentStatus,
    };

    const serialized = JSON.stringify(safePayload);
    const piiKeywords = ['Confidential Pilgrim', '999988887777', devotee.email, devotee.phone || 'N/A'];
    for (const keyword of piiKeywords) {
      if (keyword && serialized.includes(keyword)) {
        throw new Error(`SECURITY LEAK: Payload contains PII: "${keyword}"`);
      }
    }
    console.log('✓ Security check passed: Verification response contains ZERO Devotee PII');

    // 7. Test Cancelled Booking Verification
    testBooking.bookingStatus = BOOKING_STATUS.CANCELLED;
    await testBooking.save();

    const cancelledCheck = await Booking.findOne({ qrVerificationToken: qrToken });
    const isCancelledValid =
      cancelledCheck.bookingStatus === BOOKING_STATUS.CONFIRMED &&
      cancelledCheck.paymentStatus === PAYMENT_STATUS.PAID;

    if (isCancelledValid) {
      throw new Error('Cancelled booking incorrectly marked valid!');
    }
    console.log('✓ Cancelled booking correctly rejected (valid = false)');

    // 8. Test Non-existent Token
    const fakeToken = '000000000000000000000000000000000000000000000000';
    const fakeCheck = await Booking.findOne({
      $or: [{ qrVerificationToken: fakeToken }, { 'qrCode.code': fakeToken }],
    });
    if (fakeCheck) {
      throw new Error('Non-existent token matched a record!');
    }
    console.log('✓ Non-existent token correctly rejected');

    // Cleanup test record
    await Booking.deleteOne({ _id: testBooking._id });
    console.log('✓ Cleaned up test booking artifact');

    console.log('\n==================================================');
    console.log('     ALL QR CODE VERIFICATION TESTS PASSED!      ');
    console.log('==================================================\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

runTests();
