import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { User } from '../models/User.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { TempleCategory } from '../models/TempleCategory.js';
import { TempleRegistration } from '../models/TempleRegistration.js';
import { uploadImageBufferToCloudinary, hasCloudinaryConfig } from '../services/cloudinaryService.js';

interface ServiceDefinition {
  name: string;
  type: 'DARSHAN' | 'SPECIAL_ENTRY' | 'POOJA' | 'SEVA' | 'PRASADAM' | 'DONATION';
  price: number;
  duration: number;
  description: string;
  rules: string[];
  slots: Array<{
    startTime: string;
    endTime: string;
    capacity: number;
    bookedCount: number;
  }>;
}

interface NewTempleSeedData {
  name: string;
  slug: string;
  templeType: string;
  deity: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  mapUrl: string;
  phone: string;
  website: string;
  authorityEmail: string;
  authorityName: string;
  authorityPhone: string;
  categorySlugs: string[];
  shortDescription: string;
  description: string;
  dressCode: string;
  guidelines: string[];
  facilities: string[];
  parking: string;
  howToReach: {
    byAir: string;
    byTrain: string;
    byRoad: string;
  };
  timings: {
    specialNotes: string;
    weekly: Array<{
      day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
      morningOpening: string;
      morningClosing: string;
      eveningOpening: string;
      eveningClosing: string;
      isOpen: boolean;
      specialNotes?: string;
    }>;
  };
  assetSources: {
    thumbnail: {
      sourceUrl: string;
      alt: string;
      sourceCredit: string;
    };
    banner: {
      sourceUrl: string;
      alt: string;
      sourceCredit: string;
    };
  };
  services: ServiceDefinition[];
}

const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const NEW_TEMPLES_DATA: NewTempleSeedData[] = [
  // -------------------------------------------------------------
  // TEMPLE 1: Tirumala Venkateswara Temple
  // -------------------------------------------------------------
  {
    name: 'Tirumala Venkateswara Temple',
    slug: 'tirumala-venkateswara-temple',
    templeType: 'Major Pilgrimage Divya Desam',
    deity: 'Lord Venkateswara (Balaji / Srinivasa)',
    address: 'S Mada Street, Tirumala Hills',
    city: 'Tirumala',
    district: 'Tirupati',
    state: 'Andhra Pradesh',
    pincode: '517504',
    latitude: 13.6833,
    longitude: 79.3472,
    mapUrl: 'https://maps.google.com/?q=13.6833,79.3472',
    phone: '+91 877 2277777',
    website: 'https://ttdevasthanams.ap.gov.in',
    authorityEmail: 'authority.tirumala@demo.devasetu.local',
    authorityName: 'Srikanth Rao (Chief Operating Officer)',
    authorityPhone: '+919876500001',
    categorySlugs: ['perumal'],
    shortDescription:
      'The sacred Kaliyuga Vaikuntam atop the seven peaks of Tirumala Hills, dedicated to Lord Sri Venkateswara Swami.',
    description:
      'Tirumala Venkateswara Temple is an ancient and globally renowned Hindu pilgrimage shrine situated on the sacred Venkatadri hill of the Seshachalam range in Tirupati district, Andhra Pradesh. Revered as one of the 108 Divya Desams and the sacred abode of Lord Vishnu manifested as Sri Venkateswara, the temple attracts millions of devotees seeking divine grace and liberation in the Kali Yuga. The magnificent golden Ananda Nilayam vimanam crowns the sanctum sanctorum where the self-manifested (Swayambhu) deity stands adorned in divine regal ornaments. Devotees participate in continuous Vedic rituals, celestial Kalyanotsavams, and receive the consecrated GI-tagged Tirupati Laddu prasadam.',
    dressCode:
      'Strict Traditional Attire Required: Dhoti with Uttariyam or Kurta-Pyjama for men; Saree, Half-Saree, or Churidar with Dupatta for women. T-shirts, jeans, shorts, and skirts are strictly prohibited in darshan lines.',
    guidelines: [
      'Original Government Photo ID (Aadhaar/Passport/Voter ID) mandatory for all Special Entry Darshan and Seva ticket holders.',
      'Deposit electronic gadgets, mobile phones, smartwatches, and footwear at designated Vaikuntam luggage counters.',
      'Devotees should report 45 minutes prior to their assigned reporting slot at Vaikuntam Queue Complex Entry.',
      'Maintain sanctity, silence, and queue discipline inside the Ananda Nilayam prakaram.',
    ],
    facilities: [
      'Vaikuntam Queue Complex with free refreshments & baby care',
      'Matrusri Tarigonda Vengamamba Free Annaprasadam Complex',
      'Kalyanakatta 24/7 tonsure centers',
      'RO purified drinking water & medical emergency kiosks',
      'Devasthanam free RTC electric bus connectivity across Tirumala',
      'Dedicated Divyangjan & Senior Citizen battery-car assistance',
      'Authentic Srivari Laddu Prasadam counters',
    ],
    parking: 'Extensive multi-level car and tour bus parking facilities at Ring Road and Balaji Nagar grounds.',
    howToReach: {
      byAir: 'Tirupati International Airport (Renigunta, TIR) is approximately 40 km away with nonstop flights from major metros.',
      byTrain: 'Tirupati Main Railway Station (TPTY) and Renigunta Junction (RU) connect to all Indian railway networks (22 km).',
      byRoad: 'APSRTC operates continuous ghat-road express buses every 2 minutes from Tirupati Central Bus Station to Tirumala.',
    },
    timings: {
      specialNotes:
        'Sanctum opens with Suprabhatha Seva at 03:00 AM and concludes with Ekanta Seva at 01:00 AM. Free Sarva Darshan and Special Entry Darshan slots operate throughout the day.',
      weekly: WEEKDAYS.map((day) => ({
        day,
        morningOpening: '03:00',
        morningClosing: '13:30',
        eveningOpening: '14:30',
        eveningClosing: '23:30',
        isOpen: true,
      })),
    },
    assetSources: {
      thumbnail: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Front_side_view_of_swami_Venkateshwara_temple%2C_Tirupati.jpg',
        alt: 'Tirumala Venkateswara Temple Front Gopuram',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
      banner: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Tirumala_090615.jpg',
        alt: 'Tirumala Temple Ananda Nilayam Vimana and Courtyard',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
    },
    services: [
      {
        name: 'Special Entry Darshan (Seeghra Darshan)',
        type: 'SPECIAL_ENTRY',
        price: 300,
        duration: 45,
        description:
          'Expedited queue access through dedicated Vaikuntam Queue Complex entry with direct sanctum line and one complimentary Srivari Laddu prasadam.',
        rules: ['Aadhaar/Passport verification mandatory at entrance', 'Traditional dress code strictly enforced'],
        slots: [
          { startTime: '07:00', endTime: '08:00', capacity: 60, bookedCount: 42 },
          { startTime: '09:00', endTime: '10:00', capacity: 60, bookedCount: 58 },
          { startTime: '11:00', endTime: '12:00', capacity: 60, bookedCount: 60 },
          { startTime: '14:00', endTime: '15:00', capacity: 60, bookedCount: 30 },
          { startTime: '16:00', endTime: '17:00', capacity: 60, bookedCount: 51 },
          { startTime: '18:00', endTime: '19:00', capacity: 60, bookedCount: 22 },
        ],
      },
      {
        name: 'Srivari Sarva Darshan',
        type: 'DARSHAN',
        price: 0,
        duration: 60,
        description:
          'Traditional free darshan open to all visiting devotees with free buttermilk, warm milk, and consecrated food served in the queue compartments.',
        rules: ['Report directly to Vaikuntam Queue Complex', 'Footwear not permitted inside queue corridors'],
        slots: [
          { startTime: '06:00', endTime: '07:30', capacity: 100, bookedCount: 85 },
          { startTime: '08:00', endTime: '09:30', capacity: 100, bookedCount: 95 },
          { startTime: '10:00', endTime: '11:30', capacity: 100, bookedCount: 78 },
          { startTime: '13:00', endTime: '14:30', capacity: 100, bookedCount: 40 },
          { startTime: '15:00', endTime: '16:30', capacity: 100, bookedCount: 90 },
          { startTime: '17:00', endTime: '18:30', capacity: 100, bookedCount: 65 },
          { startTime: '19:00', endTime: '20:30', capacity: 100, bookedCount: 100 },
        ],
      },
      {
        name: 'Srivari Kalyanotsavam Seva',
        type: 'SEVA',
        price: 1001,
        duration: 90,
        description:
          'Sacred celestial wedding ceremony of Lord Sri Venkateswara with Goddesses Sridevi and Bhudevi performed according to ancient Vaikhanasa Agama tradition. Includes consecrated Vastram, Uttariyam, and laddus.',
        rules: ['Couples or single devotees in traditional silk dhoti/saree', 'Report at Kalyana Mandapam 30 mins prior'],
        slots: [
          { startTime: '11:30', endTime: '13:00', capacity: 30, bookedCount: 26 },
        ],
      },
      {
        name: 'Suprabhatha Seva Sanctum Entry',
        type: 'SEVA',
        price: 240,
        duration: 45,
        description:
          'Early morning sacred awakening hymns rendered in the sanctum sanctorum by descendants of Tallapaka Annamacharya, welcoming the dawn of Lord Srinivasa.',
        rules: ['Reporting time 02:15 AM at Vaikuntam Queue Complex', 'Strict silence observed'],
        slots: [
          { startTime: '03:00', endTime: '03:45', capacity: 40, bookedCount: 40 },
        ],
      },
      {
        name: 'Srivari Maha Laddu Prasadam Offering',
        type: 'PRASADAM',
        price: 50,
        duration: 15,
        description:
          'Token for collection of extra world-famous GI-tagged Tirupati Laddu prepared with pure cow ghee, gram flour, sugar, cashews, cardamom, and raisins in the sacred Potu kitchen.',
        rules: ['Collect token at Laddu Complex counter with booking confirmation QR code'],
        slots: [
          { startTime: '08:00', endTime: '12:00', capacity: 150, bookedCount: 110 },
          { startTime: '13:00', endTime: '17:00', capacity: 150, bookedCount: 82 },
          { startTime: '18:00', endTime: '22:00', capacity: 150, bookedCount: 145 },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // TEMPLE 2: Arulmigu Dhandayuthapani Swamy Temple (Palani)
  // -------------------------------------------------------------
  {
    name: 'Arulmigu Dhandayuthapani Swamy Temple',
    slug: 'dhandayuthapani-temple-palani',
    templeType: 'Arupadai Veedu Murugan Kshetram',
    deity: 'Lord Murugan (Dhandayuthapani Swamy)',
    address: 'Giri Veedhi, Palani Malai Adivaram',
    city: 'Palani',
    district: 'Dindigul',
    state: 'Tamil Nadu',
    pincode: '624601',
    latitude: 10.4442,
    longitude: 77.5186,
    mapUrl: 'https://maps.google.com/?q=10.4442,77.5186',
    phone: '+91 4545 242236',
    website: 'https://palanimurugan.hrce.tn.gov.in',
    authorityEmail: 'authority.palani@demo.devasetu.local',
    authorityName: 'Muthuswamy Gurukkal (Joint Commissioner / EO)',
    authorityPhone: '+919876500002',
    categorySlugs: ['murugan'],
    shortDescription:
      'The third sacred abode of Lord Murugan (Arupadai Veedu), where the ascetic deity stands atop Sivagiri hill made of sacred Navapashanam.',
    description:
      'Arulmigu Dhandayuthapani Swamy Temple is the third among the six sacred military camps (Arupadai Veedu) of Lord Murugan, crowned atop the Sivagiri hill in Palani, Tamil Nadu. The unique idol of Lord Murugan as an ascetic boy renouncing worldly possessions, clad in a loincloth and holding the sacred staff (dhandam), was consecrated by the legendary Siddha Bogar using Navapashanam—a mystical amalgamation of nine medicinal minerals and herbs. Devotees reach the hilltop via stone steps, historic haulage winches, or scenic rope cars, offering holy Kavadi and tasting the GI-tagged Palani Panchamirtham prasadam.',
    dressCode:
      'Traditional South Indian Attire: Dhoti or Kurta for men; Saree, Pavadai-Dhavani, or Salwar Kameez with Dupatta for women. Jeans, shorts, and sleeveless tops not permitted.',
    guidelines: [
      'Devotees carrying sacred Kavadi and offering tonsure should utilize designated Adivaram corridors.',
      'Photography and personal videography inside the Navapashanam Moolasthanam sanctum are strictly banned.',
      'Deposit mobile phones at the Adivaram HR&CE locker counter before boarding the ropeway or steps.',
      'Senior citizens and disabled devotees may access the priority winch counter.',
    ],
    facilities: [
      'Hilltop passenger Haulage Winches & high-capacity Rope Car systems',
      'Official HR&CE Panchamirtham production and distribution stalls',
      'Spacious Annadhanam mandapams providing hygienic daily meals',
      'Tonsure (Mottai) halls and sanitary bathing ghats at Shanmuganathi',
      'Golden Chariot (Thanga Ratham) circumambulation track',
      'Devotee rest shelters along the Girivalam path',
    ],
    parking: 'Spacious car and van parking available at Adivaram bus depot and Girivalam bypass grounds.',
    howToReach: {
      byAir: 'Coimbatore International Airport (CJB) is ~105 km away; Madurai Airport (IXM) is ~115 km away.',
      byTrain: 'Palani Railway Station (PLNI) is connected directly with Chennai, Madurai, Coimbatore, and Palakkad.',
      byRoad: 'NH-209 connects Palani directly with Coimbatore, Dindigul, and Pollachi with round-the-clock TNSTC buses.',
    },
    timings: {
      specialNotes:
        'Sanctum opens at 06:00 AM with Viswaroopa Darshan and concludes with Rakkala Pooja at 08:30 PM. Winch and rope cars operate 06:00 AM to 08:00 PM.',
      weekly: WEEKDAYS.map((day) => ({
        day,
        morningOpening: '06:00',
        morningClosing: '12:30',
        eveningOpening: '16:00',
        eveningClosing: '20:30',
        isOpen: true,
      })),
    },
    assetSources: {
      thumbnail: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Palani_Murugan_Hill_Temple.jpg',
        alt: 'Palani Murugan Hill Temple Rajagopuram',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
      banner: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Palani_Hill.JPG',
        alt: 'Palani Sivagiri Hill Temple Panoramic Landscape',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
    },
    services: [
      {
        name: 'Viswaroopa & Nitya Darshan',
        type: 'DARSHAN',
        price: 0,
        duration: 30,
        description:
          'Early morning darshan of Lord Murugan as the sun illuminates the sacred Navapashanam sanctum atop Palani hill.',
        rules: ['Queue entry starts at Adivaram steps and hilltop mandapam', 'Traditional attire mandatory'],
        slots: [
          { startTime: '06:00', endTime: '07:30', capacity: 80, bookedCount: 65 },
          { startTime: '08:00', endTime: '09:30', capacity: 80, bookedCount: 78 },
          { startTime: '10:00', endTime: '11:30', capacity: 80, bookedCount: 45 },
          { startTime: '16:00', endTime: '17:30', capacity: 80, bookedCount: 72 },
          { startTime: '18:00', endTime: '19:30', capacity: 80, bookedCount: 80 },
        ],
      },
      {
        name: 'Palani Special Entry Darshan',
        type: 'SPECIAL_ENTRY',
        price: 100,
        duration: 25,
        description:
          'Express queue access directly into the inner sanctum corridor for close darshan of Lord Dhandayuthapani Swamy with Panchamirtham vibhuti packet.',
        rules: ['Show digital booking confirmation at Special Darshan gate'],
        slots: [
          { startTime: '07:00', endTime: '08:00', capacity: 50, bookedCount: 38 },
          { startTime: '09:00', endTime: '10:00', capacity: 50, bookedCount: 48 },
          { startTime: '11:00', endTime: '12:00', capacity: 50, bookedCount: 50 },
          { startTime: '16:30', endTime: '17:30', capacity: 50, bookedCount: 29 },
          { startTime: '18:30', endTime: '19:30', capacity: 50, bookedCount: 41 },
        ],
      },
      {
        name: 'Thanga Ratham (Golden Chariot) Seva',
        type: 'SEVA',
        price: 2000,
        duration: 60,
        description:
          'Devout evening procession of Lord Dhandayuthapani in the breathtaking handcrafted Golden Chariot around the inner hill prakaram with Nadhaswaram accompaniment.',
        rules: ['Permits family of up to 4 devotees', 'Traditional panchakacham or saree mandatory'],
        slots: [
          { startTime: '19:00', endTime: '20:00', capacity: 20, bookedCount: 18 },
        ],
      },
      {
        name: 'Panchamirtham Abhisheka Archana',
        type: 'POOJA',
        price: 250,
        duration: 40,
        description:
          'Sacred abhishekam offered with pure honey, jaggery, cardamom, ghee, and hill bananas, followed by Sahasranama Archana and consecrated prasadam.',
        rules: ['Report 20 minutes prior to abhishekam time at Navagraha Mandapam'],
        slots: [
          { startTime: '08:30', endTime: '09:15', capacity: 35, bookedCount: 22 },
          { startTime: '17:30', endTime: '18:15', capacity: 35, bookedCount: 31 },
        ],
      },
      {
        name: 'Sacred Palani Panchamirtham Prasadam',
        type: 'PRASADAM',
        price: 50,
        duration: 15,
        description:
          'GI-certified sacred Palani Panchamirtham sealed jar prepared under strict traditional Agamic kitchen standards without added water or chemical preservatives.',
        rules: ['Collect sealed prasadam tin at Hilltop or Adivaram official counters'],
        slots: [
          { startTime: '07:30', endTime: '12:00', capacity: 120, bookedCount: 94 },
          { startTime: '16:00', endTime: '20:00', capacity: 120, bookedCount: 115 },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // TEMPLE 3: Samayapuram Mariamman Temple
  // -------------------------------------------------------------
  {
    name: 'Samayapuram Mariamman Temple',
    slug: 'samayapuram-mariamman-temple',
    templeType: 'Ancient Shakti Kshetram',
    deity: 'Goddess Mariamman (Kannanur Mariamman)',
    address: 'Samayapuram Main Road, Tollgate - Samayapuram',
    city: 'Samayapuram',
    district: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    pincode: '621112',
    latitude: 10.9272,
    longitude: 78.7428,
    mapUrl: 'https://maps.google.com/?q=10.9272,78.7428',
    phone: '+91 431 2670460',
    website: 'https://samayapurammariamman.hrce.tn.gov.in',
    authorityEmail: 'authority.samayapuram@demo.devasetu.local',
    authorityName: 'Subramanian Sivachariar (Executive Officer)',
    authorityPhone: '+919876500003',
    categorySlugs: ['mariamman', 'godess-amman'],
    shortDescription:
      'The supreme Shakti temple of Tamil Nadu, renowned for miraculous healing powers and the historic Pachai Pattini Viratham of Goddess Mariamman.',
    description:
      'Arulmigu Mariamman Temple at Samayapuram, nestled on the banks of the river Cauvery near Tiruchirappalli, is one of the most revered and visited Goddess shrines in South India. Dedicated to Kannanur Mariamman, an incarnation of Supreme Goddess Adi Parashakti, the deity is renowned as the divine healer who cures ailments and bestows good health, fertility, and prosperity. Unlike stone idols, the central deity is sculpted from sacred medicinal herb-infused clay (Sudhai), which makes her eyes radiate serene, boundless compassion. Hundreds of thousands of devotees observe the sacred Pachai Pattini Viratham and offer Mavilakku prayers.',
    dressCode:
      'Conservative Traditional Attire: Dhoti or Kurta-Pyjama for men; Saree or Salwar Kameez with Dupatta for women. Modern casuals not permitted inside sanctum.',
    guidelines: [
      'Devotees offering sacred Mavilakku (rice flour lamp) must light lamps only in the designated ventilated enclosures.',
      'Maintain strict queue discipline especially on auspicious Tuesdays, Fridays, and full moon nights.',
      'Deposit mobile phones and cameras at the HR&CE administrative cloak counter.',
      'Respect the sanctity of devotees offering Angapradakshinam and tonsure vows.',
    ],
    facilities: [
      'Free Nitya Annadhanam hall serving consecrated meals daily',
      'Modern covered tonsure mandapam with hot water facilities',
      'Spacious Mavilakku prayer halls with fire safety protections',
      'RO drinking water stations and clean restroom complexes',
      'Ear-piercing and sacred infant tonsure ritual centers',
      'Ample bus and car parking yards near Trichy-Chennai highway',
    ],
    parking: 'Organized parking for over 500 tourist buses and four-wheelers 150 meters from North Gopuram.',
    howToReach: {
      byAir: 'Tiruchirappalli International Airport (TRZ) is ~22 km away with domestic and Gulf-sector flights.',
      byTrain: 'Tiruchirappalli Junction (TPJ) is 15 km and Srirangam Railway Station (SRGM) is 10 km from temple.',
      byRoad: 'Situated directly off NH-45 (Chennai-Trichy Highway) with frequent buses from Trichy Central Bus Stand.',
    },
    timings: {
      specialNotes:
        'Temple operates from 05:30 AM to 01:00 PM and from 04:00 PM to 09:00 PM daily. Extended darshan hours on Tuesdays, Fridays, and festival occasions.',
      weekly: WEEKDAYS.map((day) => ({
        day,
        morningOpening: '05:30',
        morningClosing: '13:00',
        eveningOpening: '16:00',
        eveningClosing: '21:00',
        isOpen: true,
      })),
    },
    assetSources: {
      thumbnail: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Samayapuram_Mariamman_Temple.jpg',
        alt: 'Samayapuram Mariamman Temple Rajagopuram Entrance',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
      banner: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Samayapuram_Mariamman_Temple.jpg',
        alt: 'Samayapuram Mariamman Temple Gopuram and Sacred Courtyard',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
    },
    services: [
      {
        name: 'Mariamman Nitya Darshan',
        type: 'DARSHAN',
        price: 0,
        duration: 45,
        description:
          'Holy darshan of Goddess Samayapuram Mariamman adorned in glittering silk saree, floral garlands, and the holy silver crown.',
        rules: ['Queue starts from outer Rajagopuram mandapam', 'No electronic items inside'],
        slots: [
          { startTime: '06:00', endTime: '07:30', capacity: 90, bookedCount: 70 },
          { startTime: '08:00', endTime: '09:30', capacity: 90, bookedCount: 88 },
          { startTime: '10:00', endTime: '11:30', capacity: 90, bookedCount: 52 },
          { startTime: '16:00', endTime: '17:30', capacity: 90, bookedCount: 75 },
          { startTime: '18:00', endTime: '19:30', capacity: 90, bookedCount: 90 },
        ],
      },
      {
        name: 'Quick Special Darshan (Vipani Entry)',
        type: 'SPECIAL_ENTRY',
        price: 100,
        duration: 20,
        description:
          'Priority direct entrance corridor for devotees seeking quick darshan with holy lemon, vermillion kumkum, and neem leaves prasad.',
        rules: ['Valid for one devotee per ticket', 'Photo ID required at counter'],
        slots: [
          { startTime: '07:00', endTime: '08:00', capacity: 45, bookedCount: 35 },
          { startTime: '09:00', endTime: '10:00', capacity: 45, bookedCount: 45 },
          { startTime: '11:00', endTime: '12:00', capacity: 45, bookedCount: 40 },
          { startTime: '16:30', endTime: '17:30', capacity: 45, bookedCount: 28 },
          { startTime: '18:30', endTime: '19:30', capacity: 45, bookedCount: 44 },
        ],
      },
      {
        name: 'Thanga Thottil (Golden Cradle) Seva',
        type: 'SEVA',
        price: 500,
        duration: 45,
        description:
          'Sacred prayer where infants are gently placed in the consecrated Golden Cradle before Goddess Mariamman for divine health, vitality, and longevity.',
        rules: ['Parents and infant permitted', 'Archaka performs special sankalpam with consecrated thread'],
        slots: [
          { startTime: '09:30', endTime: '10:30', capacity: 25, bookedCount: 19 },
          { startTime: '17:00', endTime: '18:00', capacity: 25, bookedCount: 23 },
        ],
      },
      {
        name: 'Mavilakku Prarthana Pooja',
        type: 'POOJA',
        price: 150,
        duration: 30,
        description:
          'Traditional lighting of sacred lamps made of hand-pounded rice flour, natural jaggery, cardamom, and pure ghee in honor of Goddess Mariamman.',
        rules: ['Conducted in dedicated Mavilakku mandapam under archaka guidance'],
        slots: [
          { startTime: '08:00', endTime: '09:00', capacity: 50, bookedCount: 32 },
          { startTime: '10:30', endTime: '11:30', capacity: 50, bookedCount: 48 },
          { startTime: '17:30', endTime: '18:30', capacity: 50, bookedCount: 41 },
        ],
      },
      {
        name: 'Theertham & Sakkarai Pongal Prasadam',
        type: 'PRASADAM',
        price: 40,
        duration: 15,
        description:
          'Sacred temple prasadam including delicious Sakkarai Pongal (sweet jaggery rice), consecrated holy theertham, and fresh fragrant jasmine flowers.',
        rules: ['Redeemable at inner Annadhanam prasadam counter'],
        slots: [
          { startTime: '08:00', endTime: '12:30', capacity: 100, bookedCount: 75 },
          { startTime: '16:30', endTime: '20:30', capacity: 100, bookedCount: 88 },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // TEMPLE 4: Kamakshi Amman Temple (Kanchipuram)
  // -------------------------------------------------------------
  {
    name: 'Kamakshi Amman Temple',
    slug: 'kamakshi-amman-temple',
    templeType: 'Sacred Shakta Maha Peetham',
    deity: 'Goddess Kamakshi (Lalitha Maha Tripurasundari)',
    address: 'Kamakshi Amman Sannadhi Street, Big Kanchipuram',
    city: 'Kanchipuram',
    district: 'Kanchipuram',
    state: 'Tamil Nadu',
    pincode: '631502',
    latitude: 12.8407,
    longitude: 79.7032,
    mapUrl: 'https://maps.google.com/?q=12.8407,79.7032',
    phone: '+91 44 27222609',
    website: 'https://srikanchikamakshi.org',
    authorityEmail: 'authority.kamakshi@demo.devasetu.local',
    authorityName: 'Venkataramana Sastri (Chief Trustee / Srikaryam)',
    authorityPhone: '+919876500004',
    categorySlugs: ['godess-amman'],
    shortDescription:
      'The sacred Nabhi Kshetra of the 51 Shakti Peethas and seat of Sri Chakra Yantra established by Adi Shankaracharya in historic Kanchipuram.',
    description:
      'Sri Kanchi Kamakshi Amman Temple is one of the most paramount Shakta shrines in the world, situated at the spiritual epicenter of Kanchipuram, the City of Thousand Temples. Goddess Kamakshi sits in the majestic Padmasana posture holding sugarcane bow, floral arrows, noose, and goad, radiating supreme motherly grace. Uniquely in Kanchipuram, no other temple has a separate Ambal (goddess) shrine, as all goddess energy converges into Sri Kamakshi. Jagadguru Sri Adi Shankaracharya installed the famous Sri Chakra Yantra before the sanctum sanctorum to temper the fierce aspects of the deity and radiate perpetual peace and blessings.',
    dressCode:
      'Vedic Traditional Dress Strictly Enforced: Dhoti or Veshti for men (upper garment removed at Gayatri Mandapam); Saree or long traditional Salwar with Dupatta for women.',
    guidelines: [
      'Maintain deep silence and reverent prayer while viewing the sacred Sri Chakra inside the Gayatri Mandapam.',
      'Photography, cell phones, and videography are strictly prohibited throughout the sanctum complex.',
      'Footwear custody counters are located opposite the East Rajagopuram.',
      'Devotees should circumambulate the temple tank (Panchaganga) in a clockwise direction.',
    ],
    facilities: [
      'Sacred Sri Chakra Yantra Darshan Mandapam',
      'Golden Vimana observation terrace and pradakshina walkway',
      'Kamakshi Kunkumarchana hall with qualified Vedic archakas',
      'Devasthanam sacred Laddu and Panchamirtham prasadam counter',
      'Panchaganga Teertham holy tank ghats',
      'Filtered drinking water and cloak facilities',
    ],
    parking: 'Devasthanam car parking lot situated 100 meters from South Mada Street.',
    howToReach: {
      byAir: 'Chennai International Airport (MAA) is approximately 70 km away via Bangalore Highway (NH-48).',
      byTrain: 'Kanchipuram Railway Station (CJ) is just 2 km away with regular train connections to Chennai Central.',
      byRoad: 'Connected by frequent direct government express buses from Chennai CMBT/Koyambedu (every 10 minutes).',
    },
    timings: {
      specialNotes:
        'Sanctum opens at 05:30 AM and closes at 12:15 PM; reopens at 04:00 PM and closes at 08:45 PM. Golden Chariot procession is held on Pournami and Fridays at 07:00 PM.',
      weekly: WEEKDAYS.map((day) => ({
        day,
        morningOpening: '05:30',
        morningClosing: '12:15',
        eveningOpening: '16:00',
        eveningClosing: '20:45',
        isOpen: true,
      })),
    },
    assetSources: {
      thumbnail: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Kanchipuram_Kamakshi_Amman_Temple.jpg',
        alt: 'Kanchipuram Kamakshi Amman Temple Rajagopuram',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
      banner: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Kamakshi_Amman_Temple_with_golden_roof%2C_Kanchipuram.jpg',
        alt: 'Kamakshi Amman Temple Golden Vimana and Courtyard',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
    },
    services: [
      {
        name: 'Nitya Kamakshi Darshan',
        type: 'DARSHAN',
        price: 0,
        duration: 30,
        description:
          'Peaceful darshan of Sri Kamakshi Amman in her glorious Padmasana posture with direct view of the sanctum sanctorum.',
        rules: ['Traditional Vedic dress mandatory', 'Join queue at East Rajagopuram'],
        slots: [
          { startTime: '06:00', endTime: '07:30', capacity: 70, bookedCount: 50 },
          { startTime: '08:00', endTime: '09:30', capacity: 70, bookedCount: 65 },
          { startTime: '10:00', endTime: '11:30', capacity: 70, bookedCount: 42 },
          { startTime: '16:30', endTime: '18:00', capacity: 70, bookedCount: 60 },
          { startTime: '18:30', endTime: '20:00', capacity: 70, bookedCount: 70 },
        ],
      },
      {
        name: 'Special Quick Entry Darshan',
        type: 'SPECIAL_ENTRY',
        price: 100,
        duration: 20,
        description:
          'Expedited sanctum passage directly through the Gayatri Mandapam corridor for a closer glimpse of the Goddess and consecrated kumkum.',
        rules: ['Report at Special Entry booth 10 minutes prior to slot time'],
        slots: [
          { startTime: '07:00', endTime: '08:00', capacity: 50, bookedCount: 35 },
          { startTime: '09:00', endTime: '10:00', capacity: 50, bookedCount: 47 },
          { startTime: '11:00', endTime: '12:00', capacity: 50, bookedCount: 50 },
          { startTime: '16:30', endTime: '17:30', capacity: 50, bookedCount: 30 },
          { startTime: '18:30', endTime: '19:30', capacity: 50, bookedCount: 42 },
        ],
      },
      {
        name: 'Suvasini & Kumkumarchana Pooja',
        type: 'POOJA',
        price: 200,
        duration: 40,
        description:
          'Vedic archana reciting the holy Lalitha Sahasranamam with fragrant vermillion kumkum consecrated directly before Sri Kamakshi. Devotees receive blessed kumkum box and silver coin.',
        rules: ['Devotees participate sitting in the sanctum mandapam', 'Traditional attire strictly required'],
        slots: [
          { startTime: '08:30', endTime: '09:15', capacity: 40, bookedCount: 33 },
          { startTime: '10:30', endTime: '11:15', capacity: 40, bookedCount: 38 },
          { startTime: '17:30', endTime: '18:15', capacity: 40, bookedCount: 39 },
        ],
      },
      {
        name: 'Sri Chakra Navavarana Pooja',
        type: 'POOJA',
        price: 500,
        duration: 60,
        description:
          'Profound tantric-vedic worship of the Nine Enclosures of the consecrated Sri Chakra established by Sri Adi Shankaracharya for prosperity, spiritual elevation, and cosmic harmony.',
        rules: ['Family of up to 3 members permitted', 'Sankalpam performed in devotee name and gotram'],
        slots: [
          { startTime: '09:30', endTime: '10:30', capacity: 20, bookedCount: 17 },
          { startTime: '18:00', endTime: '19:00', capacity: 20, bookedCount: 19 },
        ],
      },
      {
        name: 'Panchamirtham & Ksheera Prasadam',
        type: 'PRASADAM',
        price: 50,
        duration: 15,
        description:
          'Consecrated dry-fruit Panchamirtham and sweet milk payasam prasad prepared daily in the temple madapalli.',
        rules: ['Collect prasadam at designated counter inside the inner prakaram'],
        slots: [
          { startTime: '08:00', endTime: '12:00', capacity: 100, bookedCount: 78 },
          { startTime: '16:30', endTime: '20:30', capacity: 100, bookedCount: 85 },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // TEMPLE 5: Srikalahasteeswara Temple
  // -------------------------------------------------------------
  {
    name: 'Srikalahasteeswara Temple',
    slug: 'srikalahasteeswara-temple',
    templeType: 'Pancha Bhoota Sthalam (Vayu Lingam)',
    deity: 'Lord Shiva (Srikalahasteeswara) & Goddess Gnana Prasunambika',
    address: 'Bahadur Pet, Srikalahasti, Swarnamukhi River Bank',
    city: 'Srikalahasti',
    district: 'Tirupati',
    state: 'Andhra Pradesh',
    pincode: '517644',
    latitude: 13.7498,
    longitude: 79.6984,
    mapUrl: 'https://maps.google.com/?q=13.7498,79.6984',
    phone: '+91 8578 222240',
    website: 'https://srikalahasthitemple.com',
    authorityEmail: 'authority.srikalahasti@demo.devasetu.local',
    authorityName: 'Anjaneya Prasad (Executive Officer / Commissioner)',
    authorityPhone: '+919876500005',
    categorySlugs: ['lord-shiva'],
    shortDescription:
      'The ancient Pancha Bhoota Sthalam embodying the Wind element (Vayu Lingam), world-renowned for Rahu-Ketu Sarpa Dosha Nivarana rituals.',
    description:
      'Srikalahasteeswara Temple, situated on the picturesque banks of the holy Swarnamukhi river in Andhra Pradesh, is one of India’s most revered Shiva temples and the Pancha Bhoota Sthalam representing the Wind (Vayu) element. In the inner sanctum, an eternal flickering lamp flutters continuously, demonstrating the presence of the invisible Vayu element even in a sealed room. The temple takes its name from three legendary devotees: Sri (spider), Kala (serpent), and Hasti (elephant), who attained liberation through their pure devotion to Lord Shiva. Millions visit to perform the powerful Rahu-Ketu Sarpa Dosha Nivarana Pooja to dispel planetary afflictions.',
    dressCode:
      'Traditional Attire Mandatory: Men must wear Dhoti, Pancha, or Kurta-Pyjama (white dress recommended for Rahu-Ketu pooja); Women should wear Saree or Salwar Kameez with Dupatta.',
    guidelines: [
      'Devotees performing Rahu-Ketu Pooja should partake in a holy dip in the Swarnamukhi river or pushkarini prior to rituals.',
      'Strictly avoid photography inside the sanctum sanctorum and around the Patala Ganapathi underground shrine.',
      'Deposit phones, electronics, and leather items at the Devasthanam cloak counters before sanctum entry.',
      'Report at the air-conditioned Rahu-Ketu Mandapam 30 minutes before your allotted pooja time slot.',
    ],
    facilities: [
      'Spacious Air-Conditioned Rahu-Ketu Pooja Mandapams',
      'Sacred Swarnamukhi river bathing ghats and Pushkarini steps',
      'Free Nitya Annadanam complex for pilgrims',
      'Devasthanam Laddu and Pulihora prasadam counters',
      'Cloak rooms, mobile lockers, and shoe storage sheds',
      'Comprehensive information desk and online slot verification kiosks',
    ],
    parking: 'Organized Devasthanam vehicle parking available along Swarnamukhi River Bund road.',
    howToReach: {
      byAir: 'Tirupati International Airport (TIR) is only 28 km away with quick taxi and bus connectivity.',
      byTrain: 'Srikalahasti Railway Station (KHT) is 3 km from the temple; Renigunta Junction is ~35 km away.',
      byRoad: 'Located on the Tirupati-Nellore highway, with frequent APSRTC buses from Tirupati Central Bus Stand (every 15 mins).',
    },
    timings: {
      specialNotes:
        'Sanctum is open continuously from 06:00 AM to 09:00 PM. Rahu-Ketu poojas are conducted throughout the day in dedicated hourly batches during Rahukalam.',
      weekly: WEEKDAYS.map((day) => ({
        day,
        morningOpening: '06:00',
        morningClosing: '13:00',
        eveningOpening: '14:00',
        eveningClosing: '21:00',
        isOpen: true,
      })),
    },
    assetSources: {
      thumbnail: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/View_of_Srikalahasti_temple.jpg',
        alt: 'Srikalahasteeswara Temple Towers and River Bank',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
      banner: {
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Srikalahasti_temple_and_Hill.jpg',
        alt: 'Srikalahasti Temple Complex and Kailasagiri Hill Landscape',
        sourceCredit: 'Wikimedia Commons / CC-BY-SA',
      },
    },
    services: [
      {
        name: 'Vayu Linga Darshan',
        type: 'DARSHAN',
        price: 0,
        duration: 35,
        description:
          'Sacred darshan of Lord Srikalahasteeswara manifesting as the invisible cosmic Vayu (Wind) Lingam with darshan of Mother Gnana Prasunambika.',
        rules: ['General queue entry through South Gopuram', 'Traditional dress required'],
        slots: [
          { startTime: '06:30', endTime: '08:00', capacity: 75, bookedCount: 52 },
          { startTime: '08:30', endTime: '10:00', capacity: 75, bookedCount: 71 },
          { startTime: '10:30', endTime: '12:00', capacity: 75, bookedCount: 65 },
          { startTime: '15:00', endTime: '16:30', capacity: 75, bookedCount: 40 },
          { startTime: '17:00', endTime: '18:30', capacity: 75, bookedCount: 75 },
          { startTime: '19:00', endTime: '20:30', capacity: 75, bookedCount: 60 },
        ],
      },
      {
        name: 'Rahu-Ketu Sarpa Dosha Nivarana Pooja',
        type: 'POOJA',
        price: 500,
        duration: 45,
        description:
          'World-famous astrological remedy pooja performed with consecrated silver idols of Rahu and Ketu, black sesame, and Vedic homa mantras to neutralize Kalasarpa and marriage obstacles.',
        rules: ['Devotees receive sacred silver idols and consecrated prasadam', 'Traditional attire mandatory'],
        slots: [
          { startTime: '07:30', endTime: '08:30', capacity: 60, bookedCount: 48 },
          { startTime: '09:00', endTime: '10:00', capacity: 60, bookedCount: 60 },
          { startTime: '10:30', endTime: '11:30', capacity: 60, bookedCount: 55 },
          { startTime: '12:00', endTime: '13:00', capacity: 60, bookedCount: 42 },
          { startTime: '14:30', endTime: '15:30', capacity: 60, bookedCount: 50 },
          { startTime: '16:00', endTime: '17:00', capacity: 60, bookedCount: 58 },
          { startTime: '17:30', endTime: '18:30', capacity: 60, bookedCount: 30 },
        ],
      },
      {
        name: 'Rudrabhishekam Seva',
        type: 'SEVA',
        price: 600,
        duration: 60,
        description:
          'Sacred Panchamrita and Gangajal abhishekam performed to the sacred Sphatika and Vayu Linga accompanied by continuous chanting of Sri Rudram and Chamakam.',
        rules: ['Report at inner sanctum mantapam 15 mins prior', 'Vibhuti and holy theertham provided'],
        slots: [
          { startTime: '07:00', endTime: '08:00', capacity: 30, bookedCount: 24 },
          { startTime: '17:30', endTime: '18:30', capacity: 30, bookedCount: 29 },
        ],
      },
      {
        name: 'Special Quick Entry Darshan',
        type: 'SPECIAL_ENTRY',
        price: 100,
        duration: 20,
        description:
          'Direct express entry corridor minimizing queue time for devotees to offer direct prayers to Srikalahasteeswara and Gnana Prasunambika.',
        rules: ['Digital ticket validation at gate', 'Children below 5 free with parents'],
        slots: [
          { startTime: '07:00', endTime: '08:00', capacity: 50, bookedCount: 31 },
          { startTime: '09:30', endTime: '10:30', capacity: 50, bookedCount: 49 },
          { startTime: '11:30', endTime: '12:30', capacity: 50, bookedCount: 45 },
          { startTime: '16:00', endTime: '17:00', capacity: 50, bookedCount: 27 },
          { startTime: '18:00', endTime: '19:00', capacity: 50, bookedCount: 48 },
        ],
      },
      {
        name: 'Srikalahasti Laddu & Pulihora Prasadam',
        type: 'PRASADAM',
        price: 40,
        duration: 15,
        description:
          'Consecrated temple prasadam package containing rich Tamarind Pulihora and delicious Besan Laddu prepared with pure ghee in the temple potu.',
        rules: ['Redeem token at Devasthanam prasadam counter'],
        slots: [
          { startTime: '07:00', endTime: '12:30', capacity: 120, bookedCount: 92 },
          { startTime: '15:00', endTime: '20:30', capacity: 120, bookedCount: 110 },
        ],
      },
    ],
  },
];

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DevaSetu/1.0 (devotee-portal@devasetu.org; contact@devasetu.local)',
      Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadToCloudinaryIfNeeded(
  currentUrl: string | undefined,
  sourceUrl: string,
  folder: string
): Promise<string> {
  // If the currentUrl is already a valid Cloudinary URL, keep it (idempotent!)
  if (currentUrl && currentUrl.startsWith('https://res.cloudinary.com/')) {
    console.log(`    [Asset] Already hosted on Cloudinary: ${currentUrl.slice(0, 60)}...`);
    return currentUrl;
  }

  console.log(`    [Asset] Fetching authentic image from source: ${sourceUrl.slice(0, 60)}...`);
  const buffer = await fetchImageBuffer(sourceUrl);
  console.log(`    [Asset] Uploading ${buffer.byteLength} bytes to Cloudinary folder "${folder}"...`);
  const result = await uploadImageBufferToCloudinary(buffer, folder);
  console.log(`    [Asset] Upload success: ${result.url}`);
  return result.url;
}

export async function seedFiveAdditionalTemples(): Promise<void> {
  console.log('\n======================================================');
  console.log('🚀 DEVASetu: 5 REALISTIC TEMPLES SEEDING SCRIPT');
  console.log('======================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  // Verify Cloudinary configuration
  const cloudinaryReady = hasCloudinaryConfig();
  console.log(`Cloudinary Active: ${cloudinaryReady}\n`);

  // Count existing temples before seed
  const existingActiveTemples = await Temple.find({ status: TEMPLE_STATUS.ACTIVE });
  console.log(`Existing Active Temples in DB: ${existingActiveTemples.length}`);
  existingActiveTemples.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name} (${t.slug})`);
  });

  // Verify all categories
  const categoriesInDb = await TempleCategory.find();
  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  categoriesInDb.forEach((c) => {
    categoryMap.set(c.slug, c._id as mongoose.Types.ObjectId);
  });

  const rawPassword = 'DevaSetu@2026';
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90); // 90 days active booking window
  endDate.setHours(23, 59, 59, 999);

  let newTemplesCreated = 0;
  let existingTemplesUpdated = 0;
  let totalServicesProcessed = 0;
  let totalSlotsProcessed = 0;

  for (const tData of NEW_TEMPLES_DATA) {
    console.log(`\n------------------------------------------------------`);
    console.log(`Processing Temple: ${tData.name} (${tData.slug})`);
    console.log(`------------------------------------------------------`);

    // Duplicate check: Look up by slug or exact name
    let temple = await Temple.findOne({
      $or: [{ slug: tData.slug }, { name: tData.name }],
    });

    const isNew = !temple;
    if (isNew) {
      console.log(`  -> Creating new Temple document...`);
    } else {
      console.log(`  -> Existing Temple found (ID: ${temple._id}). Updating safely...`);
    }

    // Resolve Category IDs
    const categoryIds: mongoose.Types.ObjectId[] = [];
    for (const catSlug of tData.categorySlugs) {
      const catId = categoryMap.get(catSlug);
      if (catId) {
        categoryIds.push(catId);
      } else {
        console.warn(`  [Warning] Category slug "${catSlug}" not found in DB`);
      }
    }

    // Prepare authentic image URLs via Cloudinary
    const existingThumbnailUrl = temple?.gallery?.find((g) => g.isThumbnail)?.url;
    const existingBannerUrl =
      temple?.gallery?.find((g) => g.isBanner)?.url || temple?.coverImage?.url;

    const folder = `devasetu/temples/${tData.slug}`;

    const finalThumbnailUrl = await uploadToCloudinaryIfNeeded(
      existingThumbnailUrl,
      tData.assetSources.thumbnail.sourceUrl,
      folder
    );

    const finalBannerUrl = await uploadToCloudinaryIfNeeded(
      existingBannerUrl,
      tData.assetSources.banner.sourceUrl,
      folder
    );

    const galleryData = [
      {
        url: finalThumbnailUrl,
        alt: tData.assetSources.thumbnail.alt,
        isThumbnail: true,
        isBanner: false,
        order: 1,
      },
      {
        url: finalBannerUrl,
        alt: tData.assetSources.banner.alt,
        isThumbnail: false,
        isBanner: true,
        order: 2,
      },
    ];

    const templePayload = {
      name: tData.name,
      slug: tData.slug,
      templeType: tData.templeType,
      description: tData.description,
      address: tData.address,
      city: tData.city,
      state: tData.state,
      pincode: tData.pincode,
      latitude: tData.latitude,
      longitude: tData.longitude,
      mapUrl: tData.mapUrl,
      phone: tData.phone,
      email: tData.authorityEmail,
      website: tData.website,
      status: TEMPLE_STATUS.ACTIVE,
      dressCode: tData.dressCode,
      guidelines: tData.guidelines,
      facilities: tData.facilities,
      parking: tData.parking,
      howToReach: tData.howToReach,
      timings: tData.timings,
      categories: categoryIds,
      coverImage: {
        url: finalBannerUrl,
        alt: tData.assetSources.banner.alt,
      },
      gallery: galleryData,
    };

    if (isNew) {
      temple = await Temple.create(templePayload);
      newTemplesCreated++;
    } else {
      Object.assign(temple, templePayload);
      await temple.save();
      existingTemplesUpdated++;
    }

    console.log(`  ✅ Temple Record Saved: ${temple.name} (ID: ${temple._id})`);

    // Create / Update Temple Authority User
    let authorityUser = await User.findOne({ email: tData.authorityEmail });
    if (authorityUser) {
      authorityUser.name = tData.authorityName;
      authorityUser.phone = tData.authorityPhone;
      authorityUser.role = 'TEMPLE_AUTHORITY';
      authorityUser.templeId = temple._id as mongoose.Types.ObjectId;
      authorityUser.isActive = true;
      authorityUser.isEmailVerified = true;
      authorityUser.mustChangePassword = false;
      authorityUser.password = rawPassword; // Will be hashed by pre('save')
      await authorityUser.save();
      console.log(`  ✅ Authority User Updated: ${tData.authorityEmail}`);
    } else {
      authorityUser = await User.create({
        name: tData.authorityName,
        email: tData.authorityEmail,
        phone: tData.authorityPhone,
        password: rawPassword,
        role: 'TEMPLE_AUTHORITY',
        templeId: temple._id,
        isActive: true,
        isEmailVerified: true,
        mustChangePassword: false,
      });
      console.log(`  ✅ Authority User Created: ${tData.authorityEmail}`);
    }

    // Link authorityId to temple
    temple.authorityId = authorityUser._id as mongoose.Types.ObjectId;
    await temple.save();

    // Create or update TempleRegistration for audit/admin consistency
    let registration = await TempleRegistration.findOne({ applicantEmail: tData.authorityEmail });
    const regPayload = {
      applicantName: tData.authorityName,
      applicantEmail: tData.authorityEmail,
      applicantPhone: tData.authorityPhone,
      authorityDesignation: 'Executive Officer / Dharmakartha',
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
          name: 'Endowments Department / HR&CE Official Sanction Certificate',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
          type: 'CERTIFICATE',
        },
      ],
      basicTempleImages: [
        {
          url: finalThumbnailUrl,
          alt: temple.name,
        },
      ],
      categoryIds,
      status: 'APPROVED',
      createdTempleId: temple._id,
      reviewedAt: new Date(),
    };

    if (registration) {
      Object.assign(registration, regPayload);
      await registration.save();
    } else {
      await TempleRegistration.create(regPayload);
    }
    console.log(`  ✅ Approved TempleRegistration synchronized.`);

    // Create / Update Services and TimeSlots
    for (const sDef of tData.services) {
      let service = await Service.findOne({
        templeId: temple._id,
        name: sDef.name,
      });

      const servicePayload = {
        templeId: temple._id,
        name: sDef.name,
        type: sDef.type,
        price: sDef.price,
        duration: sDef.duration,
        description: sDef.description,
        rules: sDef.rules,
        isActive: true,
        availableDays: [...WEEKDAYS],
        image: {
          url: finalThumbnailUrl,
          alt: sDef.name,
        },
      };

      if (service) {
        Object.assign(service, servicePayload);
        await service.save();
      } else {
        service = await Service.create(servicePayload);
      }
      totalServicesProcessed++;

      // Create / Update TimeSlots for this service
      for (const slotDef of sDef.slots) {
        let slot = await TimeSlot.findOne({
          templeId: temple._id,
          serviceId: service._id,
          startTime: slotDef.startTime,
          endTime: slotDef.endTime,
        });

        if (slot) {
          slot.startDate = startDate;
          slot.endDate = endDate;
          slot.capacity = slotDef.capacity;
          slot.bookedCount = slotDef.bookedCount;
          slot.isActive = true;
          slot.availableDays = [...WEEKDAYS];
          await slot.save();
        } else {
          slot = await TimeSlot.create({
            templeId: temple._id,
            serviceId: service._id,
            startDate,
            endDate,
            startTime: slotDef.startTime,
            endTime: slotDef.endTime,
            capacity: slotDef.capacity,
            bookedCount: slotDef.bookedCount,
            isActive: true,
            availableDays: [...WEEKDAYS],
          });
        }
        totalSlotsProcessed++;
      }
    }
    console.log(`  ✅ ${tData.services.length} Services and Slots verified.`);
  }

  // Final count check
  const totalTemples = await Temple.countDocuments();
  const totalActiveTemples = await Temple.countDocuments({ status: TEMPLE_STATUS.ACTIVE });
  const allTemples = await Temple.find().select('name slug status').lean();

  console.log('\n======================================================');
  console.log('🎯 SEEDING COMPLETE & VERIFICATION');
  console.log('======================================================');
  console.log(`New Temples Created:        ${newTemplesCreated}`);
  console.log(`Existing Temples Updated:   ${existingTemplesUpdated}`);
  console.log(`Total Services Processed:   ${totalServicesProcessed}`);
  console.log(`Total TimeSlots Processed:  ${totalSlotsProcessed}`);
  console.log(`Total Temples in DB:        ${totalTemples}`);
  console.log(`Total Active Temples in DB: ${totalActiveTemples}`);
  console.log('------------------------------------------------------');
  console.log('Full Temple List in Database:');
  allTemples.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.status}] ${t.name} (${t.slug})`);
  });
  console.log('======================================================\n');

  await mongoose.disconnect();
}

// Run directly if called as a script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedFiveAdditionalTemples().catch((err) => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
  });
}
