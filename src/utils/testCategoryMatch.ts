import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Booking } from '../models/index.js';

const testCategoryMatch = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29);
  startDate.setHours(0, 0, 0, 0);

  const totalBookings = await Booking.countDocuments({ createdAt: { $gte: startDate } });
  console.log('Total bookings in 30d:', totalBookings);

  // Category distribution with primary category (1 per booking)
  const catAgg = await Booking.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $lookup: {
        from: 'temples',
        localField: 'templeId',
        foreignField: '_id',
        as: 'temple',
      },
    },
    { $unwind: { path: '$temple', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        primaryCatId: {
          $arrayElemAt: [{ $ifNull: ['$temple.categories', []] }, 0],
        },
      },
    },
    {
      $lookup: {
        from: 'templecategories',
        localField: 'primaryCatId',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$category.name', 'Other Shrines'] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  console.log('Category aggregation:');
  let sumCats = 0;
  catAgg.forEach((c) => {
    console.log(`  ${c._id}: ${c.count}`);
    sumCats += c.count;
  });
  console.log('Sum of category bookings:', sumCats);
  console.log('Matches total bookings EXACTLY?', sumCats === totalBookings);
  process.exit(0);
};

testCategoryMatch();
