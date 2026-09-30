import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Temple } from '../models/Temple.js';
import { TempleCategory } from '../models/TempleCategory.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { User } from '../models/User.js';

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { hasCloudinaryConfig } = await import('../services/cloudinaryService.js');
  console.log('Cloudinary Configured:', hasCloudinaryConfig());

  const temples = await Temple.find().select('name slug status').lean();
  console.log(`\nTotal Temples in DB: ${temples.length}`);
  temples.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.status}] ${t.name} (${t.slug})`);
  });

  const categories = await TempleCategory.find().select('name slug isActive').lean();
  console.log(`\nTotal Categories: ${categories.length}`);
  categories.forEach((c) => {
    console.log(`  - [${c.slug}] ${c.name} (Active: ${c.isActive})`);
  });

  const servicesCount = await Service.countDocuments();
  const slotsCount = await TimeSlot.countDocuments();
  const authoritiesCount = await User.countDocuments({ role: 'TEMPLE_AUTHORITY' });
  console.log(`\nTotal Services: ${servicesCount}`);
  console.log(`Total TimeSlots: ${slotsCount}`);
  console.log(`Total Temple Authorities: ${authoritiesCount}`);

  await mongoose.disconnect();
}

checkDb().catch(console.error);
