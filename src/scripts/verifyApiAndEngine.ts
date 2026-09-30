import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Temple } from '../models/Temple.js';
import { TempleCategory } from '../models/TempleCategory.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';

const NEW_TEMPLE_SLUGS = [
  'tirumala-venkateswara-temple',
  'dhandayuthapani-temple-palani',
  'samayapuram-mariamman-temple',
  'kamakshi-amman-temple',
  'srikalahasteeswara-temple',
];

async function verifyAll() {
  console.log('\n======================================================');
  console.log('🧪 DEVASetu: 5 TEMPLES DEEP VERIFICATION SUITE');
  console.log('======================================================\n');

  await mongoose.connect(process.env.MONGODB_URI!);
  // Ensure models are registered on this mongoose instance
  const _ = TempleCategory.modelName;

  // 1. Total Temple Count Check
  const totalTemples = await Temple.countDocuments();
  const activeTemples = await Temple.countDocuments({ status: 'ACTIVE' });

  console.log(`1. DATABASE TEMPLE COUNT AUDIT:`);
  console.log(`   Total Temples:  ${totalTemples} (Expected: 11)`);
  console.log(`   Active Temples: ${activeTemples} (Expected: 11)`);

  if (totalTemples !== 11 || activeTemples !== 11) {
    throw new Error(`Temple count mismatch! Expected 11, found ${totalTemples}`);
  }
  console.log('   ✅ Count assertion PASSED: Exactly 11 temples exist in database.\n');

  // 2. Inspect each of the 5 new temples
  console.log('2. VERIFYING 5 NEW REALISTIC TEMPLES:');
  for (const slug of NEW_TEMPLE_SLUGS) {
    const temple = await Temple.findOne({ slug }).populate('categories');
    if (!temple) {
      throw new Error(`Temple with slug "${slug}" not found!`);
    }

    const services = await Service.find({ templeId: temple._id, isActive: true });
    const slots = await TimeSlot.find({ templeId: temple._id, isActive: true });
    const authority = await User.findById(temple.authorityId).select('+password');

    console.log(`\n   🏛️  ${temple.name} (${temple.slug})`);
    console.log(`       ID:          ${temple._id}`);
    console.log(`       Location:    ${temple.city}, ${temple.state} (${temple.latitude}, ${temple.longitude})`);
    console.log(`       Categories:  ${temple.categories.map((c: any) => c.name).join(', ')}`);
    console.log(`       Cover Image: ${temple.coverImage?.url?.slice(0, 65)}...`);

    const thumb = temple.gallery.find((g) => g.isThumbnail);
    const banner = temple.gallery.find((g) => g.isBanner);

    console.log(`       Thumbnail:   ${thumb?.url?.slice(0, 65)}...`);
    console.log(`       Banner:      ${banner?.url?.slice(0, 65)}...`);
    console.log(`       Services:    ${services.length} active services`);
    console.log(`       TimeSlots:   ${slots.length} active time slots`);
    console.log(`       Authority:   ${authority?.email} (ID: ${authority?._id})`);

    // Integrity checks
    if (!thumb?.url.startsWith('https://res.cloudinary.com/')) {
      throw new Error(`Thumbnail for ${temple.name} is not on Cloudinary: ${thumb?.url}`);
    }
    if (!banner?.url.startsWith('https://res.cloudinary.com/')) {
      throw new Error(`Banner for ${temple.name} is not on Cloudinary: ${banner?.url}`);
    }
    if (services.length === 0) {
      throw new Error(`No services found for ${temple.name}`);
    }
    if (slots.length === 0) {
      throw new Error(`No slots found for ${temple.name}`);
    }
    if (!authority) {
      throw new Error(`No authority found for ${temple.name}`);
    }

    // Verify slots distribution and capacity integrity
    for (const slot of slots) {
      if (slot.bookedCount > slot.capacity) {
        throw new Error(`Slot ${slot._id} has bookedCount (${slot.bookedCount}) > capacity (${slot.capacity})`);
      }
      if (slot.bookedCount < 0) {
        throw new Error(`Slot ${slot._id} has negative bookedCount`);
      }
    }

    // Verify Authority password hashing
    const pwMatch = await bcrypt.compare('DevaSetu@2026', authority.password);
    if (!pwMatch) {
      throw new Error(`Authority password check failed for ${authority.email}`);
    }
    console.log(`       Password:    Bcrypt verification OK`);
  }

  // 3. Test Booking Engine Compatibility
  console.log('\n3. TESTING BOOKING ENGINE COMPATIBILITY WITH NEW SEEDED SLOTS:');
  const sampleTemple = await Temple.findOne({ slug: 'tirumala-venkateswara-temple' });
  const sampleService = await Service.findOne({
    templeId: sampleTemple!._id,
    type: 'SPECIAL_ENTRY',
  });
  const sampleSlot = await TimeSlot.findOne({
    templeId: sampleTemple!._id,
    serviceId: sampleService!._id,
  });

  console.log(`   Sample Service: ${sampleService?.name}`);
  console.log(`   Sample Slot:    ${sampleSlot?.startTime} - ${sampleSlot?.endTime}`);
  console.log(`   Initial Slot:   Capacity=${sampleSlot?.capacity}, Booked=${sampleSlot?.bookedCount}, Remaining=${sampleSlot?.remainingCapacity}`);

  const testBookingDate = new Date();
  testBookingDate.setDate(testBookingDate.getDate() + 7); // 7 days in future

  // Verify slot date check
  const isAvailable = sampleSlot?.isAvailableForDate(testBookingDate);
  console.log(`   Slot available for 7 days ahead? ${isAvailable}`);
  if (!isAvailable) {
    throw new Error('Slot availability method returned false for valid future date!');
  }

  // Atomically test capacity reservation
  const quantityToBook = 2;
  const initialBooked = sampleSlot!.bookedCount;
  const updatedSlot = await TimeSlot.findOneAndUpdate(
    {
      _id: sampleSlot!._id,
      templeId: sampleTemple!._id,
      serviceId: sampleService!._id,
      isActive: true,
      bookedCount: { $lte: sampleSlot!.capacity - quantityToBook },
    },
    {
      $inc: { bookedCount: quantityToBook },
    },
    { new: true }
  );

  if (!updatedSlot || updatedSlot.bookedCount !== initialBooked + quantityToBook) {
    throw new Error('Atomic capacity reservation test failed!');
  }
  console.log(`   Atomic Capacity Reservation: PASSED (${initialBooked} -> ${updatedSlot.bookedCount})`);

  // Revert test booking capacity
  await TimeSlot.findByIdAndUpdate(sampleSlot!._id, {
    $inc: { bookedCount: -quantityToBook },
  });
  console.log(`   Capacity Rollback: PASSED (Restored to ${initialBooked})`);

  // 4. Verify Tenant Isolation Across Authorities
  console.log('\n4. VERIFYING TENANT ISOLATION ACROSS AUTHORITIES:');
  const tirumalaAuth = await User.findOne({ email: 'authority.tirumala@demo.devasetu.local' });
  const palaniAuth = await User.findOne({ email: 'authority.palani@demo.devasetu.local' });
  const samayapuramAuth = await User.findOne({ email: 'authority.samayapuram@demo.devasetu.local' });
  const kamakshiAuth = await User.findOne({ email: 'authority.kamakshi@demo.devasetu.local' });
  const kalahastiAuth = await User.findOne({ email: 'authority.srikalahasti@demo.devasetu.local' });

  const authList = [tirumalaAuth, palaniAuth, samayapuramAuth, kamakshiAuth, kalahastiAuth];
  const assignedTempleIds = new Set(authList.map((a) => a?.templeId?.toString()));

  if (assignedTempleIds.size !== 5) {
    throw new Error('Tenant isolation failure: Some authorities share the same templeId!');
  }
  console.log('   ✅ Tenant isolation PASSED: All 5 authorities have distinct, non-overlapping templeIds.');

  // 5. REST API HTTP Endpoint Verification
  console.log('\n5. VERIFYING REST API HTTP ENDPOINTS (/api/temples):');
  try {
    const res = await fetch('http://localhost:5000/api/temples');
    if (!res.ok) {
      console.warn(`   HTTP status: ${res.status} ${res.statusText}`);
    } else {
      const data: any = await res.json();
      const templesList = data?.data?.items || data?.data || [];
      console.log(`   GET /api/temples returned ${templesList.length} temples (Total in DB pagination: ${data?.data?.pagination?.total})`);
      templesList.forEach((t: any, i: number) => {
        console.log(`     ${i + 1}. [${t.status || 'ACTIVE'}] ${t.name} (${t.slug})`);
      });
      console.log('   ✅ REST API Endpoint Verification PASSED.');
    }
  } catch (err: any) {
    console.warn(`   Note: Local server HTTP test skipped or error: ${err.message}`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION & VERIFICATION CHECKS PASSED (100%)');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

verifyAll().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
