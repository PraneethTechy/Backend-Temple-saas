import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  Temple,
  TEMPLE_STATUS,
  Service,
  TimeSlot,
  User,
  USER_ROLES,
  Booking,
  BOOKING_STATUS,
  Payment,
  PAYMENT_STATUS,
  PAYMENT_PROVIDERS,
} from '../models/index.js';
import { clearAnalyticsData } from './clearAnalyticsData.js';

// Sample realistic devotee names for booking attendees
const DEVOTEE_NAMES = [
  { name: 'Ramesh Sharma', gender: 'MALE', age: 46 },
  { name: 'Priya Sundaram', gender: 'FEMALE', age: 38 },
  { name: 'Anand Kumar', gender: 'MALE', age: 29 },
  { name: 'Lakshmi Narayanan', gender: 'FEMALE', age: 52 },
  { name: 'Venkatesh Iyer', gender: 'MALE', age: 41 },
  { name: 'Meenakshi Raman', gender: 'FEMALE', age: 34 },
  { name: 'Karthik Subramanian', gender: 'MALE', age: 31 },
  { name: 'Deepa Natarajan', gender: 'FEMALE', age: 27 },
  { name: 'Suresh Krishnan', gender: 'MALE', age: 60 },
  { name: 'Radha Swaminathan', gender: 'FEMALE', age: 58 },
  { name: 'Vijay Raghavan', gender: 'MALE', age: 36 },
  { name: 'Ananya Balaji', gender: 'FEMALE', age: 24 },
  { name: 'Srinivasan Murthy', gender: 'MALE', age: 65 },
  { name: 'Gowri Shankar', gender: 'FEMALE', age: 48 },
  { name: 'Manoj Pillai', gender: 'MALE', age: 33 },
];

const ID_TYPES = ['AADHAAR', 'PASSPORT', 'VOTER_ID', 'OTHER'];

export const seedAnalyticsData = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Safety Error: Analytics seed generator cannot be executed in production environment.');
      process.exit(1);
    }

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not configured in environment.');
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log('📦 Connected to MongoDB for analytics data generation');
    }

    // 1. Idempotency Check: Safely clear previous seed records first
    console.log('🔄 Checking for existing seed data...');
    await clearAnalyticsData();

    // 2. Discover existing database entities
    console.log('🔍 Discovering active temples, services, time slots, and devotee users...');
    const temples = await Temple.find({
      status: TEMPLE_STATUS.ACTIVE,
    }).select('_id name').lean();

    if (!temples || temples.length === 0) {
      throw new Error('No active temples found in the database. Please create temples first.');
    }

    const services = await Service.find().select('_id name templeId type price').lean();
    if (!services || services.length === 0) {
      throw new Error('No services found in the database. Please add temple services first.');
    }

    const timeSlots = await TimeSlot.find().select('_id templeId serviceId startTime endTime capacity').lean();
    if (!timeSlots || timeSlots.length === 0) {
      throw new Error('No time slots found in the database.');
    }

    const devotees = await User.find({ role: USER_ROLES.DEVOTEE }).select('_id name email phone').lean();
    if (!devotees || devotees.length === 0) {
      throw new Error('No registered devotees found in the database.');
    }

    console.log(
      `✓ Discovered: ${temples.length} temples, ${services.length} services, ${timeSlots.length} slots, ${devotees.length} devotees.`
    );

    // Group services and timeSlots by templeId
    const templeServicesMap = new Map();
    const serviceSlotsMap = new Map();

    services.forEach((s) => {
      const tId = s.templeId?.toString();
      if (tId) {
        if (!templeServicesMap.has(tId)) templeServicesMap.set(tId, []);
        templeServicesMap.get(tId).push(s);
      }
    });

    timeSlots.forEach((slot) => {
      const sId = slot.serviceId?.toString();
      if (sId) {
        if (!serviceSlotsMap.has(sId)) serviceSlotsMap.set(sId, []);
        serviceSlotsMap.get(sId).push(slot);
      }
    });

    // Filter temples that actually have services with time slots
    const availableTemples = temples.filter((t) => {
      const tServices = templeServicesMap.get(t._id.toString()) || [];
      return tServices.some((s) => (serviceSlotsMap.get(s._id.toString()) || []).length > 0);
    });

    if (availableTemples.length === 0) {
      throw new Error('No temples have both configured services and time slots.');
    }

    console.log(`✓ ${availableTemples.length} temples have fully active services and bookable slots.`);

    // 3. Define natural weighting for temples
    // High, Medium, Lower popularity distribution
    const templeWeights = [0.35, 0.25, 0.18, 0.12, 0.07, 0.03];

    // 4. Generate Bookings across the last 45 days
    const totalDays = 45;
    const now = new Date();
    const bookingsToInsert = [];
    const paymentsToInsert = [];

    let bookingCounter = 0;
    const statusCounts = { CONFIRMED: 0, COMPLETED: 0, PENDING: 0, CANCELLED: 0 };
    const paymentCounts = { PAID: 0, PENDING: 0, FAILED: 0 };
    let totalSettledRevenue = 0;

    for (let dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);

      // Algorithmic daily volume variation (more recent days have higher traffic)
      // Days 45..30: 1 to 4 bookings
      // Days 30..15: 3 to 7 bookings
      // Days 15..0:  5 to 13 bookings
      let baseVolume = 2;
      if (dayOffset < 15) baseVolume = 7;
      else if (dayOffset < 30) baseVolume = 4;

      // Add pseudo-random fluctuation
      const dailyBookingsCount = Math.max(1, baseVolume + Math.floor(Math.sin(dayOffset * 1.5) * 3) + (dayOffset % 3));

      for (let b = 0; b < dailyBookingsCount; b++) {
        bookingCounter++;

        // Pick temple using distribution weights
        const rand = Math.random();
        let cumulative = 0;
        let selectedTemple = availableTemples[0];
        for (let i = 0; i < availableTemples.length; i++) {
          cumulative += templeWeights[i] || 0.05;
          if (rand <= cumulative) {
            selectedTemple = availableTemples[i];
            break;
          }
        }

        const tServices = templeServicesMap.get(selectedTemple._id.toString()) || [];
        const validServices = tServices.filter(
          (s) => (serviceSlotsMap.get(s._id.toString()) || []).length > 0
        );

        if (validServices.length === 0) continue;

        // Pick service: Darshans & Poojas naturally get picked slightly more often
        const selectedService = validServices[Math.floor(Math.random() * validServices.length)];
        const slotsForService = serviceSlotsMap.get(selectedService._id.toString()) || [];
        const selectedSlot = slotsForService[Math.floor(Math.random() * slotsForService.length)];

        // Pick a devotee user
        const selectedUser = devotees[Math.floor(Math.random() * devotees.length)];

        // Determine booking time on that day
        const createdAt = new Date(date);
        createdAt.setHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

        // Booking scheduled date: same day or 1-5 days after creation
        const bookingDate = new Date(createdAt);
        bookingDate.setDate(bookingDate.getDate() + (Math.random() > 0.5 ? 1 : 0));

        // Number of devotees in booking (1, 2, or 3)
        const qtyRoll = Math.random();
        const quantity = qtyRoll < 0.65 ? 1 : qtyRoll < 0.9 ? 2 : 3;

        const attendees = [];
        for (let q = 0; q < quantity; q++) {
          const sample = DEVOTEE_NAMES[(bookingCounter + q) % DEVOTEE_NAMES.length];
          attendees.push({
            name: sample.name,
            age: sample.age,
            gender: sample.gender,
            idType: ID_TYPES[q % ID_TYPES.length],
            idNumber: `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          });
        }

        // Realistic Price & Amount
        const unitPrice = selectedService.price > 0 ? selectedService.price : 100;
        const totalAmount = unitPrice * quantity;

        // Realistic status distribution:
        // CONFIRMED: ~65%
        // COMPLETED: ~18% (more frequent in older dates)
        // PENDING: ~12%
        // CANCELLED: ~5%
        let bookingStatus = BOOKING_STATUS.CONFIRMED;
        let paymentStatus = PAYMENT_STATUS.PAID;

        const statusRoll = Math.random();
        if (dayOffset > 7 && statusRoll < 0.25) {
          bookingStatus = BOOKING_STATUS.COMPLETED;
          paymentStatus = PAYMENT_STATUS.PAID;
        } else if (statusRoll < 0.12) {
          bookingStatus = BOOKING_STATUS.PENDING;
          paymentStatus = PAYMENT_STATUS.PENDING;
        } else if (statusRoll < 0.17) {
          bookingStatus = BOOKING_STATUS.CANCELLED;
          paymentStatus = PAYMENT_STATUS.FAILED;
        } else {
          bookingStatus = BOOKING_STATUS.CONFIRMED;
          paymentStatus = PAYMENT_STATUS.PAID;
        }

        statusCounts[bookingStatus]++;
        paymentCounts[paymentStatus]++;
        if (paymentStatus === PAYMENT_STATUS.PAID) {
          totalSettledRevenue += totalAmount;
        }

        // Generate unique identifiable test booking reference
        const dateStr = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
        const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const bookingReference = `DVS-SEED-${dateStr}-${hex}`;
        const qrVerificationToken = crypto.randomBytes(16).toString('hex');

        const bookingId = new mongoose.Types.ObjectId();

        const bookingDoc = {
          _id: bookingId,
          bookingReference,
          userId: selectedUser._id,
          templeId: selectedTemple._id,
          serviceId: selectedService._id,
          timeSlotId: selectedSlot._id,
          bookingDate,
          devotees: attendees,
          quantity,
          totalAmount,
          paymentStatus,
          bookingStatus,
          qrVerificationToken,
          qrCode: {
            code: qrVerificationToken,
            generatedAt: createdAt,
          },
          createdAt,
          updatedAt: createdAt,
        };
        bookingsToInsert.push(bookingDoc);

        // Create corresponding Payment record
        const paymentDoc = {
          _id: new mongoose.Types.ObjectId(),
          bookingId,
          userId: selectedUser._id,
          templeId: selectedTemple._id,
          amount: totalAmount,
          currency: 'INR',
          provider: PAYMENT_PROVIDERS.RAZORPAY,
          providerOrderId: `order_seed_${dateStr}_${hex}`,
          providerPaymentId: paymentStatus === 'PAID' ? `pay_seed_${dateStr}_${hex}` : null,
          status: paymentStatus,
          createdAt,
          updatedAt: createdAt,
        };
        paymentsToInsert.push(paymentDoc);
      }
    }

    console.log(`💾 Inserting ${bookingsToInsert.length} bookings into MongoDB...`);
    await Booking.insertMany(bookingsToInsert, { ordered: false });

    console.log(`💾 Inserting ${paymentsToInsert.length} payments into MongoDB...`);
    await Payment.insertMany(paymentsToInsert, { ordered: false });

    console.log('\n============================================================');
    console.log('✨ DEVASETU ANALYTICS TEST DATA GENERATED SUCCESSFULLY');
    console.log('============================================================');
    console.log(`• Total Bookings Created:  ${bookingsToInsert.length}`);
    console.log(`• Temples Represented:     ${availableTemples.length}`);
    console.log(`• Services Represented:    ${services.length}`);
    console.log(`• Time Range:              Last ${totalDays} days`);
    console.log('• Booking Statuses:');
    console.log(`    - CONFIRMED: ${statusCounts.CONFIRMED}`);
    console.log(`    - COMPLETED: ${statusCounts.COMPLETED}`);
    console.log(`    - PENDING:   ${statusCounts.PENDING}`);
    console.log(`    - CANCELLED: ${statusCounts.CANCELLED}`);
    console.log('• Payment Statuses:');
    console.log(`    - PAID:    ${paymentCounts.PAID}`);
    console.log(`    - PENDING: ${paymentCounts.PENDING}`);
    console.log(`    - FAILED:  ${paymentCounts.FAILED}`);
    console.log(`• Total Settled Revenue:   ₹${totalSettledRevenue.toLocaleString('en-IN')}`);
    console.log('• Re-run / Safety:         Identified by "DVS-SEED-" prefix.');
    console.log('• Clear Command:           npm run clear:analytics');
    console.log('============================================================\n');

    return {
      totalBookings: bookingsToInsert.length,
      templesUsed: availableTemples.length,
      servicesUsed: services.length,
      dateRangeDays: totalDays,
      statusCounts,
      paymentCounts,
      totalSettledRevenue,
    };
  } catch (error) {
    console.error('❌ Error generating analytics test data:', error);
    throw error;
  }
};

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedAnalyticsData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
