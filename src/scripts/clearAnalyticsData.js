import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Booking, Payment } from '../models/index.js';

export const clearAnalyticsData = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Safety Error: Analytics seed cleaner cannot be executed in production environment.');
      process.exit(1);
    }

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log('📦 Connected to MongoDB for analytics cleanup');
    }

    // 1. Locate all seed bookings identified by DVS-SEED- prefix
    const seedBookings = await Booking.find({
      bookingReference: { $regex: /^DVS-SEED-/i },
    }).select('_id bookingReference').lean();

    const bookingIds = seedBookings.map((b) => b._id);

    console.log(`🔍 Found ${bookingIds.length} existing seed bookings to clear.`);

    if (bookingIds.length > 0) {
      // 2. Delete corresponding seed payments
      const paymentResult = await Payment.deleteMany({
        $or: [
          { bookingId: { $in: bookingIds } },
          { providerPaymentId: { $regex: /^pay_seed_/i } },
          { providerOrderId: { $regex: /^order_seed_/i } },
        ],
      });
      console.log(`🗑️  Deleted ${paymentResult.deletedCount} seed payment records.`);

      // 3. Delete seed bookings
      const bookingResult = await Booking.deleteMany({
        _id: { $in: bookingIds },
      });
      console.log(`🗑️  Deleted ${bookingResult.deletedCount} seed booking records.`);
    } else {
      console.log('✨ No seed booking records found to clean.');
    }

    console.log('✅ Analytics test data cleanup completed safely. Real user records were preserved.');
  } catch (error) {
    console.error('❌ Error clearing analytics test data:', error);
    throw error;
  }
};

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  clearAnalyticsData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
