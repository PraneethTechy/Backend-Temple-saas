import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Temple } from '../models/Temple.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';
import { TempleRegistration } from '../models/TempleRegistration.js';
import { Booking } from '../models/Booking.js';

const ALLOWED_TEMPLE_SLUGS = [
  'arunachaleswarar-temple-tiruvannamalai',
  'ramanathaswamy-temple-rameswaram',
  'subramania-swamy-temple-tiruchendur',
  'dhandayuthapani-temple-palani',
  'brihadeeswarar-temple-thanjavur',
  'meenakshi-sundareswarar-temple-madurai',
  'sri-suryanarayana-swamy-temple',
  'tirumala-venkateswara-temple',
  'samayapuram-mariamman-temple',
  'kamakshi-amman-temple',
  'srikalahasteeswara-temple',
];

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const testTemples = await Temple.find({ slug: { $nin: ALLOWED_TEMPLE_SLUGS } });
  console.log(`Found ${testTemples.length} temporary test temples to clean up:`);

  for (const t of testTemples) {
    console.log(` - Removing test temple: ${t.name} (${t.slug})`);
    await Service.deleteMany({ templeId: t._id });
    await TimeSlot.deleteMany({ templeId: t._id });
    await Booking.deleteMany({ templeId: t._id });
    await TempleRegistration.deleteMany({ createdTempleId: t._id });
    await User.deleteMany({ templeId: t._id, role: 'TEMPLE_AUTHORITY' });
    await Temple.deleteOne({ _id: t._id });
  }

  // Also clean up any orphan test users from testPhase7
  await User.deleteMany({ email: /phase7test|testdevotee/i });
  await TempleRegistration.deleteMany({ applicantEmail: /phase7test/i });

  const remainingTemples = await Temple.find().select('name slug status').lean();
  console.log(`\nRemaining Temples Count: ${remainingTemples.length}`);
  remainingTemples.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.status}] ${t.name} (${t.slug})`);
  });

  await mongoose.disconnect();
}

cleanup().catch(console.error);
