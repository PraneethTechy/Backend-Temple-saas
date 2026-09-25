import { connectDatabase } from '../config/database.js';
import mongoose from 'mongoose';
import Temple from '../models/Temple.js';
import Service from '../models/Service.js';
import TimeSlot from '../models/TimeSlot.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import TempleRegistration from '../models/TempleRegistration.js';
import Notification from '../models/Notification.js';

async function audit() {
  await connectDatabase();

  const allTemples = await Temple.find().lean();
  const testTemples = allTemples.filter(t => /\d{10,}$/.test(t.name) || t.slug.includes('mandir-') || t.slug.includes('temple-'));
  const legitimateTemples = allTemples.filter(t => !(/\d{10,}$/.test(t.name)));

  console.log('=== AUDIT REPORT ===');
  console.log('Total Temples:', allTemples.length);
  console.log('Timestamped Test Temples:', testTemples.length);
  console.log('Legitimate Temples:', legitimateTemples.length);

  for (const t of legitimateTemples) {
    const svcs = await Service.countDocuments({ templeId: t._id });
    const slots = await TimeSlot.countDocuments({ templeId: t._id });
    const bks = await Booking.countDocuments({ templeId: t._id });
    console.log(`- ${t.name} (${t.city}, ${t.state}) -> svcs: ${svcs}, slots: ${slots}, bookings: ${bks}`);
  }

  const testUsers = await User.countDocuments({ email: { $regex: /@devasetu\.test$/ } });
  const realUsers = await User.countDocuments({ email: { $not: /@devasetu\.test$/ } });
  console.log('Test Users (@devasetu.test):', testUsers);
  console.log('Real Users:', realUsers);

  const testRegs = await TempleRegistration.countDocuments({ applicantEmail: { $regex: /@devasetu\.test$/ } });
  const realRegs = await TempleRegistration.countDocuments({ applicantEmail: { $not: /@devasetu\.test$/ } });
  console.log('Test Registrations (@devasetu.test):', testRegs);
  console.log('Real Registrations:', realRegs);

  await mongoose.disconnect();
}

audit().catch(console.error);
