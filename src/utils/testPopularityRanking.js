import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Booking, Temple } from '../models/index.js';

const testPopularityRanking = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const days = 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  // Top 5 temples overall in range
  const topTemplesAgg = await Booking.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: '$templeId', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'temples',
        localField: '_id',
        foreignField: '_id',
        as: 'temple',
      },
    },
    { $unwind: { path: '$temple', preserveNullAndEmptyArrays: true } },
  ]);

  const topTemples = topTemplesAgg.map((t) => ({
    id: t._id?.toString(),
    name: t.temple?.name || 'Other Shrines',
  }));

  console.log('Top temples:', topTemples.map((t) => t.name));

  // 7 intervals
  const intervalCount = 7;
  const intervalStepMs = (Date.now() - startDate.getTime()) / intervalCount;
  const intervals = [];

  for (let i = 0; i < intervalCount; i++) {
    const iStart = new Date(startDate.getTime() + i * intervalStepMs);
    const iEnd = new Date(startDate.getTime() + (i + 1) * intervalStepMs);
    intervals.push({
      start: iStart,
      end: iEnd,
      label: iEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }

  // Calculate rank for each interval
  const seriesMap = new Map();
  topTemples.forEach((t) => seriesMap.set(t.id, []));

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const counts = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: interval.start, $lt: interval.end },
          bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        },
      },
      { $group: { _id: '$templeId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map();
    counts.forEach((c) => countMap.set(c._id?.toString(), c.count));

    // Rank top temples for this interval
    const rankedThisInterval = topTemples.map((t) => ({
      id: t.id,
      name: t.name,
      count: countMap.get(t.id) || 0,
    }));

    // Sort descending by count
    rankedThisInterval.sort((a, b) => b.count - a.count);

    rankedThisInterval.forEach((item, rIdx) => {
      const arr = seriesMap.get(item.id);
      if (arr) {
        arr.push({
          label: interval.label,
          count: item.count,
          rank: rIdx + 1,
        });
      }
    });
  }

  console.log('\nCalculated Ranks:');
  seriesMap.forEach((ranks, tId) => {
    const t = topTemples.find((x) => x.id === tId);
    console.log(t.name, ranks.map((r) => `[${r.label}: #${r.rank} (${r.count})]`).join(' -> '));
  });

  process.exit(0);
};

testPopularityRanking();
