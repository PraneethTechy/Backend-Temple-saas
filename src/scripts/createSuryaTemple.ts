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
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { TempleCategory } from '../models/TempleCategory.js';
import { TempleRegistration } from '../models/TempleRegistration.js';

async function createSuryaTempleRecord() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected successfully.');

  const authorityEmail = 'kuppamnithin786@gmail.com'.toLowerCase().trim();
  const rawPassword = 'SuryaDevalayam@2026';
  const templeSlug = 'sri-suryanarayana-swamy-temple';

  // 1. Find categories to associate with temple
  const categories = await TempleCategory.find({ isActive: true });
  const categoryIds = categories.slice(0, 3).map((c) => c._id);

  // 2. Create or update Temple Record
  let temple = await Temple.findOne({ slug: templeSlug });
  if (!temple) {
    temple = await Temple.findOne({ name: /Suryanarayana/i });
  }

  const templeData = {
    name: 'Sri Suryanarayana Swamy Temple',
    slug: templeSlug,
    description:
      'The sacred sanctuary of Lord Surya Narayana Swamy (The Sun God), the radiant dispeller of darkness and divine harbinger of vitality, health, and spiritual illumination. Built according to ancient Vedic Vastu and solar architecture, the temple is world-renowned for the sacred morning Surya Kirana Sparsha, where the golden rays of the rising sun illuminate the sanctum sanctorum. Devotees from across India visit this holy kshetra to offer Aditya Hridayam, perform Surya Namaskara, and seek divine blessings for health, prosperity, and wisdom.',
    templeType: 'Traditional Heritage',
    address: 'Arasavalli Devalayam Road, Near Sun Temple Tank',
    city: 'Srikakulam',
    state: 'Andhra Pradesh',
    pincode: '532001',
    latitude: 18.2949,
    longitude: 83.9014,
    mapUrl: 'https://maps.google.com/?q=18.2949,83.9014',
    phone: '+91 8942 222421',
    email: authorityEmail,
    website: 'https://arasavallitemple.gov.in',
    status: 'ACTIVE',
    dressCode:
      'Strict Traditional Vedic Attire: Dhoti or Kurta-Pyjama for men; Saree or Half-Saree or Churidar with Dupatta for women. Western wear is not permitted inside the sanctum.',
    guidelines: [
      'Photography and videography are strictly prohibited inside the Moola Virat sanctum.',
      'Mobile phones must be switched off or deposited at the designated cloak counter.',
      'Maintain sanctity and silence inside the inner parikrama.',
      'Special darshan ticket holders must report 15 minutes prior to their assigned slot time.',
    ],
    facilities: [
      'Sacred Prasadam Counter',
      'RO Filtered Drinking Water',
      'Free Footwear Custody',
      'Cloak Room & Luggage Locker',
      'Wheelchair Assistance for Elders & Divyangjan',
      'Kalyana Mandapam',
      'Devotee Information Kiosk',
    ],
    parking: 'Spacious car and tour bus parking available 100 meters from the Rajagopuram.',
    howToReach: {
      byAir: 'Visakhapatnam International Airport (VTZ) is approximately 105 km away with direct taxi connectivity.',
      byTrain: 'Srikakulam Road Railway Station (CHE) is 12 km from the temple with frequent buses and autos.',
      byRoad: 'Situated on the NH-16 corridor, easily accessible via APSRTC and private luxury coaches.',
    },
    timings: {
      specialNotes:
        'Sanctum opens at 06:00 AM. Maha Mangala Harathi is conducted at 06:30 AM and 07:30 PM daily. Special Aditya Hridayam archana takes place on Sundays.',
      weekly: [
        { day: 'MONDAY', morningOpening: '06:00', morningClosing: '12:30', eveningOpening: '16:00', eveningClosing: '20:30', isOpen: true },
        { day: 'TUESDAY', morningOpening: '06:00', morningClosing: '12:30', eveningOpening: '16:00', eveningClosing: '20:30', isOpen: true },
        { day: 'WEDNESDAY', morningOpening: '06:00', morningClosing: '12:30', eveningOpening: '16:00', eveningClosing: '20:30', isOpen: true },
        { day: 'THURSDAY', morningOpening: '06:00', morningClosing: '12:30', eveningOpening: '16:00', eveningClosing: '20:30', isOpen: true },
        { day: 'FRIDAY', morningOpening: '06:00', morningClosing: '12:30', eveningOpening: '16:00', eveningClosing: '20:30', isOpen: true },
        { day: 'SATURDAY', morningOpening: '06:00', morningClosing: '12:30', eveningOpening: '16:00', eveningClosing: '20:30', isOpen: true },
        { day: 'SUNDAY', morningOpening: '05:30', morningClosing: '13:00', eveningOpening: '15:30', eveningClosing: '21:00', isOpen: true, specialNotes: 'Special Solar Day (Aditya Varam) with extended darshan hours' },
      ],
    },
    categories: categoryIds,
    coverImage: {
      url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
      alt: 'Sri Suryanarayana Swamy Temple Gopuram in early morning sunrise',
    },
    gallery: [
      {
        url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80',
        alt: 'Golden Rajagopuram bathed in solar dawn light',
        isThumbnail: true,
        order: 1,
      },
      {
        url: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?auto=format&fit=crop&w=800&q=80',
        alt: 'Sacred Temple Courtyard & Deepasthambham',
        isBanner: true,
        order: 2,
      },
      {
        url: 'https://images.unsplash.com/photo-1621847468516-1ed5d0df56fe?auto=format&fit=crop&w=800&q=80',
        alt: 'Holy Morning Deepam Aarti',
        order: 3,
      },
      {
        url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
        alt: 'Ancient Stone Carvings of Solar Chariot and Seven Horses',
        order: 4,
      },
    ],
  };

  if (temple) {
    Object.assign(temple, templeData);
    await temple.save();
    console.log(`Updated existing temple record: ${temple.name} (ID: ${temple._id})`);
  } else {
    temple = await Temple.create(templeData);
    console.log(`Created new temple record: ${temple.name} (ID: ${temple._id})`);
  }

  // 3. Create or update User Authority Account
  let user = await User.findOne({ email: authorityEmail });

  if (user) {
    user.name = 'Nithin Kuppam (Temple Authority)';
    user.password = rawPassword;
    user.role = 'TEMPLE_AUTHORITY';
    user.templeId = temple._id;
    user.isActive = true;
    user.isEmailVerified = true;
    user.mustChangePassword = false;
    await user.save();
    console.log(`Updated existing user account: ${authorityEmail} (ID: ${user._id})`);
  } else {
    user = await User.create({
      name: 'Nithin Kuppam (Temple Authority)',
      email: authorityEmail,
      phone: '+919876543210',
      password: rawPassword,
      role: 'TEMPLE_AUTHORITY',
      templeId: temple._id,
      isActive: true,
      isEmailVerified: true,
      mustChangePassword: false,
    });
    console.log(`Created new user account: ${authorityEmail} (ID: ${user._id})`);
  }

  // Link authorityId to temple
  temple.authorityId = user._id;
  await temple.save();

  // Create or update TempleRegistration record
  let registration = await TempleRegistration.findOne({ applicantEmail: authorityEmail });
  const registrationData = {
    applicantName: 'Nithin Kuppam',
    applicantEmail: authorityEmail,
    applicantPhone: '+919876543210',
    authorityDesignation: 'Chief Temple Executive Officer / Dharmakartha',
    templeName: temple.name,
    templeType: temple.templeType,
    description: temple.description,
    address: temple.address,
    city: temple.city,
    state: temple.state,
    pincode: temple.pincode,
    latitude: temple.latitude,
    longitude: temple.longitude,
    mapUrl: temple.mapUrl,
    timings: temple.timings?.specialNotes || '',
    facilities: temple.facilities,
    guidelines: temple.guidelines?.join('\n') || '',
    documents: [
      {
        name: 'Endowments Department Registration Certificate',
        url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        type: 'CERTIFICATE',
      },
    ],
    basicTempleImages: [
      {
        url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80',
        alt: 'Sri Suryanarayana Swamy Temple',
      },
    ],
    categoryIds,
    status: 'APPROVED',
    createdTempleId: temple._id,
    reviewedAt: new Date(),
  };

  if (registration) {
    Object.assign(registration, registrationData);
    await registration.save();
    console.log(`Updated TempleRegistration for: ${authorityEmail}`);
  } else {
    registration = await TempleRegistration.create(registrationData);
    console.log(`Created approved TempleRegistration for: ${authorityEmail}`);
  }

  // 4. Create Services
  const servicesToCreate = [
    {
      name: 'Pratahkalina Surya Namaskara Darshan',
      type: 'DARSHAN',
      price: 0,
      duration: 30,
      description:
        'Holy early morning darshan during sunrise hours to witness the morning solar rays illuminating the idol of Lord Surya Narayana Swamy.',
      image: {
        url: 'https://images.unsplash.com/photo-1621847468516-1ed5d0df56fe?auto=format&fit=crop&w=600&q=80',
        alt: 'Surya Namaskara Darshan',
      },
      rules: ['Traditional dress mandatory', 'Report 15 minutes prior to slot time'],
      isActive: true,
      availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      slots: [
        { startTime: '06:00', endTime: '07:00', capacity: 100 },
        { startTime: '07:00', endTime: '08:30', capacity: 100 },
        { startTime: '09:00', endTime: '10:30', capacity: 100 },
      ],
    },
    {
      name: 'Surya Tejas Special VIP Darshan',
      type: 'SPECIAL_ENTRY',
      price: 100,
      duration: 20,
      description:
        'Expedited sanctum entry with dedicated queue, direct sanctum view of the golden Kavacham, and special Teertha prasadam packet.',
      image: {
        url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80',
        alt: 'VIP Darshan',
      },
      rules: ['Valid photo ID required with booking ticket', 'Children under 5 free'],
      isActive: true,
      availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      slots: [
        { startTime: '07:30', endTime: '08:30', capacity: 50 },
        { startTime: '11:00', endTime: '12:00', capacity: 50 },
        { startTime: '16:30', endTime: '17:30', capacity: 50 },
        { startTime: '18:00', endTime: '19:00', capacity: 50 },
      ],
    },
    {
      name: 'Aditya Hridayam Maha Sankalpa Pooja',
      type: 'POOJA',
      price: 251,
      duration: 45,
      description:
        'Sacred Vedic recitation of the powerful Aditya Hridaya Stotram with Kumkumarchana and Surya Ashtottara Shatanamavali performed by temple archakas in the devotee’s name and gotram for health, vigor, and prosperity.',
      image: {
        url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
        alt: 'Aditya Hridayam Pooja',
      },
      rules: ['Devotees receive consecrated sacred Surya Raksha thread and dry fruit prasadam', 'Family of up to 4 permitted per pooja'],
      isActive: true,
      availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      slots: [
        { startTime: '08:00', endTime: '09:00', capacity: 25 },
        { startTime: '10:00', endTime: '11:00', capacity: 25 },
        { startTime: '17:00', endTime: '18:00', capacity: 25 },
      ],
    },
    {
      name: 'Ratha Saptami Arogya Seva & Prasadam',
      type: 'SEVA',
      price: 501,
      duration: 60,
      description:
        'Solemn solar seva invoking the seven rays of Surya Bhagavan for complete health and spiritual vitality. Includes special Ksheerabhishekam, offering of sweet wheat Payasam prasadam, and energized silver Surya coin.',
      image: {
        url: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?auto=format&fit=crop&w=600&q=80',
        alt: 'Arogya Seva',
      },
      rules: ['Traditional panchakacham/saree mandatory', 'Prasadam box provided after completion'],
      isActive: true,
      availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      slots: [
        { startTime: '09:30', endTime: '10:30', capacity: 20 },
      ],
    },
  ];

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90); // 90 days active booking window
  endDate.setHours(23, 59, 59, 999);

  for (const sData of servicesToCreate) {
    const { slots, ...serviceFields } = sData;

    let service = await Service.findOne({
      templeId: temple._id,
      name: serviceFields.name,
    });

    if (service) {
      Object.assign(service, serviceFields);
      await service.save();
      console.log(`Updated service: ${service.name} (ID: ${service._id})`);
    } else {
      service = await Service.create({
        ...serviceFields,
        templeId: temple._id,
      });
      console.log(`Created service: ${service.name} (ID: ${service._id})`);
    }

    // Create time slots for this service
    for (const slotDef of slots) {
      let slot = await TimeSlot.findOne({
        templeId: temple._id,
        serviceId: service._id,
        startTime: slotDef.startTime,
        endTime: slotDef.endTime,
      });

      if (!slot) {
        slot = await TimeSlot.create({
          templeId: temple._id,
          serviceId: service._id,
          startDate,
          endDate,
          availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
          startTime: slotDef.startTime,
          endTime: slotDef.endTime,
          capacity: slotDef.capacity,
          bookedCount: 0,
          isActive: true,
        });
        console.log(`  -> Created TimeSlot: ${slot.startTime} - ${slot.endTime} (Capacity: ${slot.capacity})`);
      } else {
        slot.startDate = startDate;
        slot.endDate = endDate;
        slot.capacity = slotDef.capacity;
        slot.isActive = true;
        await slot.save();
        console.log(`  -> Refreshed TimeSlot: ${slot.startTime} - ${slot.endTime}`);
      }
    }
  }

  console.log('\n======================================================');
  console.log('✅ LORD SURYA TEMPLE & AUTHORITY ACCOUNT CREATED');
  console.log('======================================================');
  console.log(`Temple Name: ${temple.name}`);
  console.log(`Temple Slug: ${temple.slug}`);
  console.log(`Temple ID:   ${temple._id}`);
  console.log(`Location:    ${temple.city}, ${temple.state}`);
  console.log(`Public URL:  /temples/${temple.slug}`);
  console.log('------------------------------------------------------');
  console.log('🔑 TEMPLE AUTHORITY LOGIN CREDENTIALS:');
  console.log(`Email / Username: ${authorityEmail}`);
  console.log(`Password:         ${rawPassword}`);
  console.log(`Role:             TEMPLE_AUTHORITY`);
  console.log(`Login URL:        http://localhost:5173/login`);
  console.log(`Portal URL:       http://localhost:5173/authority/dashboard`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

createSuryaTempleRecord().catch((err) => {
  console.error('Error creating Surya Temple record:', err);
  process.exit(1);
});
