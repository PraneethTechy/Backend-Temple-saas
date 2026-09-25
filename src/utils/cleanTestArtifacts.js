import { connectDatabase } from '../config/database.js';
import mongoose from 'mongoose';
import Temple from '../models/Temple.js';
import Service from '../models/Service.js';
import TimeSlot from '../models/TimeSlot.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import TempleRegistration from '../models/TempleRegistration.js';
import Notification from '../models/Notification.js';

export async function cleanTestArtifacts() {
  await connectDatabase();

  console.log('=== CLEANING TEST SUITE ARTIFACTS FROM MONGODB ===');

  // 1. Find all test temples (created by test suites with timestamp suffixes or test names)
  const allTemples = await Temple.find().lean();
  const testTemples = allTemples.filter(
    (t) => /\d{10,}$/.test(t.name) || t.name.startsWith('Hidden Inactive') || t.name.startsWith('Inactive Mandir')
  );
  const testTempleIds = testTemples.map((t) => t._id);
  console.log(`Found ${testTempleIds.length} test-runner temple documents to remove.`);

  // 2. Find all test users (with @devasetu.test domain)
  const testUsers = await User.find({
    $or: [{ email: { $regex: /@devasetu\.test$/ } }, { email: { $regex: /_17\d{11}@/ } }],
  }).lean();
  const testUserIds = testUsers.map((u) => u._id);
  console.log(`Found ${testUserIds.length} test-runner user documents to remove.`);

  // 3. Find all test registrations (with @devasetu.test domain)
  const testRegs = await TempleRegistration.find({
    $or: [{ applicantEmail: { $regex: /@devasetu\.test$/ } }, { applicantEmail: { $regex: /_17\d{11}@/ } }],
  }).lean();
  const testRegIds = testRegs.map((r) => r._id);
  console.log(`Found ${testRegIds.length} test-runner registration documents to remove.`);

  // 4. Delete related test bookings, time slots, services, notifications
  const bookingDel = await Booking.deleteMany({
    $or: [{ templeId: { $in: testTempleIds } }, { userId: { $in: testUserIds } }],
  });
  console.log(`Deleted ${bookingDel.deletedCount} test booking documents.`);

  const slotDel = await TimeSlot.deleteMany({ templeId: { $in: testTempleIds } });
  console.log(`Deleted ${slotDel.deletedCount} test time slot documents.`);

  const svcDel = await Service.deleteMany({ templeId: { $in: testTempleIds } });
  console.log(`Deleted ${svcDel.deletedCount} test service documents.`);

  const notifDel = await Notification.deleteMany({
    $or: [{ userId: { $in: testUserIds } }, { templeId: { $in: testTempleIds } }],
  });
  console.log(`Deleted ${notifDel.deletedCount} test notification documents.`);

  // 5. Delete test temples, users, registrations
  const templeDel = await Temple.deleteMany({ _id: { $in: testTempleIds } });
  console.log(`Deleted ${templeDel.deletedCount} test temple documents.`);

  const userDel = await User.deleteMany({ _id: { $in: testUserIds } });
  console.log(`Deleted ${userDel.deletedCount} test user documents.`);

  const regDel = await TempleRegistration.deleteMany({ _id: { $in: testRegIds } });
  console.log(`Deleted ${regDel.deletedCount} test registration documents.`);

  // 6. Verify remaining documents
  const remainingTemples = await Temple.find().lean();
  console.log('\n=== REMAINING LEGITIMATE TEMPLES ===');
  console.log(`Total remaining temples: ${remainingTemples.length}`);
  remainingTemples.forEach((t) => {
    console.log(`- ${t.name} (${t.city}, ${t.state}) [Status: ${t.status}]`);
  });

  const remainingUsers = await User.countDocuments();
  console.log(`Total remaining users: ${remainingUsers}`);

  await mongoose.disconnect();
}

cleanTestArtifacts().catch(console.error);
