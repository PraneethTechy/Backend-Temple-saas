import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Temple } from '../models/Temple.js';
import { User } from '../models/User.js';

const NEW_TEMPLES = [
  { slug: 'tirumala-venkateswara-temple', email: 'authority.tirumala@demo.devasetu.local' },
  { slug: 'dhandayuthapani-temple-palani', email: 'authority.palani@demo.devasetu.local' },
  { slug: 'samayapuram-mariamman-temple', email: 'authority.samayapuram@demo.devasetu.local' },
  { slug: 'kamakshi-amman-temple', email: 'authority.kamakshi@demo.devasetu.local' },
  { slug: 'srikalahasteeswara-temple', email: 'authority.srikalahasti@demo.devasetu.local' },
];

async function checkAndTestAuthorityLogins() {
  await mongoose.connect(process.env.MONGODB_URI!);

  console.log('\n--- CHECKING 5 AUTHORITY ACCOUNTS & VERIFYING LOGIN API ---');

  for (const item of NEW_TEMPLES) {
    const temple = await Temple.findOne({ slug: item.slug });
    if (!temple) {
      console.error(`Temple not found for slug: ${item.slug}`);
      continue;
    }

    const user = await User.findOne({ email: item.email }).select('+password');
    if (!user) {
      console.error(`User not found for email: ${item.email}`);
      continue;
    }

    const testPassword = 'DevaSetu@2026';
    const bcryptOk = await bcrypt.compare(testPassword, user.password);

    console.log(`\nTemple:               ${temple.name}`);
    console.log(`Email:                ${user.email}`);
    console.log(`Temple ID:            ${temple._id}`);
    console.log(`Authority/User ID:    ${user._id}`);
    console.log(`Must Change Password: ${user.mustChangePassword}`);
    console.log(`Bcrypt check:         ${bcryptOk ? 'MATCH (DevaSetu@2026)' : 'FAIL'}`);

    // Test real API login endpoint
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: testPassword,
        }),
      });

      const resData: any = await response.json();
      if (response.ok && resData.success) {
        console.log(`HTTP /api/auth/login: SUCCESS (Status: ${response.status}, Token: ${resData.data?.token?.slice(0, 20)}...)`);
        console.log(`Returned Role:        ${resData.data?.user?.role}`);
        console.log(`Returned TempleId:    ${resData.data?.user?.templeId}`);
      } else {
        console.error(`HTTP /api/auth/login: FAILED (Status: ${response.status}, Error: ${resData.message})`);
      }
    } catch (e: any) {
      console.warn(`HTTP request error: ${e.message}`);
    }
  }

  await mongoose.disconnect();
}

checkAndTestAuthorityLogins().catch(console.error);
