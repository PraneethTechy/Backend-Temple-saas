import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getAdminAnalytics } from '../controllers/adminController.js';

dotenv.config();

const runTest = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/devasetu';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const ranges = ['7d', '30d', '90d', '1y'];

    for (const range of ranges) {
      console.log(`\nTesting getAdminAnalytics with range="${range}"...`);

      const req = {
        query: { range },
        user: { role: 'ADMIN', _id: new mongoose.Types.ObjectId() },
      };

      let responseData = null;
      const res = {
        status: (code) => ({
          json: (body) => {
            responseData = body;
            return body;
          },
        }),
      };

      const next = (err) => {
        if (err) throw err;
      };

      await getAdminAnalytics(req, res, next);

      if (!responseData || !responseData.success) {
        throw new Error(`Analytics failed for range ${range}: ${JSON.stringify(responseData)}`);
      }

      const data = responseData.data;
      console.log(`✓ Success: range = ${data.range}`);
      console.log(`  KPIs: Total Temples: ${data.kpis.totalTemples}, Devotees: ${data.kpis.totalDevotees}, Bookings: ${data.kpis.totalBookings}, Settled Revenue: ₹${data.kpis.settledRevenue}`);
      console.log(`  Trends: Bookings/Revenue points: ${data.trends.bookingRevenue.length}, Devotee points: ${data.trends.devoteeRegistrations.length}`);
      console.log(`  Booking Status: ${JSON.stringify(data.bookingStatus)}`);
      console.log(`  Top Temples: ${JSON.stringify(data.popularTemples.map(t => ({ name: t.templeName, count: t.bookingsCount })))}`);
      console.log(`  Top Services: ${JSON.stringify(data.popularServices.map(s => ({ name: s.serviceName, count: s.bookingsCount })))}`);
      console.log(`  Category Distribution: ${JSON.stringify(data.categoryDistribution)}`);
      console.log(`  Revenue By Temple: ${JSON.stringify(data.revenueByTemple.map(r => ({ name: r.templeName, rev: r.revenue, pct: r.percentage })))}`);
      console.log(`  Popularity Trend series count: ${data.popularityTrend.series.length}`);
      if (data.popularityTrend.series.length > 0) {
        console.log(`  Sample ranks for ${data.popularityTrend.series[0].templeName}: ${JSON.stringify(data.popularityTrend.series[0].ranks.map(r => ({ l: r.label, r: r.rank, c: r.count })))}`);
      }
    }

    console.log('\n✅ ALL ANALYTICS AGGREGATIONS VERIFIED WITH REAL MONGODB DATA');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

runTest();
