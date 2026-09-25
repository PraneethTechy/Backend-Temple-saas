import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { User } from '../models/User.js';
import { USER_ROLES } from '../models/userRole.js';
import { connectDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, message, details = null) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`, details ? JSON.stringify(details) : '');
    failed++;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function runGalleryTests() {
  console.log('\n=============================================================');
  console.log('🏛️  DevaSetu — Task 1: Temple Gallery Thumbnail & Banner Suite');
  console.log('=============================================================\n');

  await connectDatabase();

  const timestamp = Date.now();
  const testIds = [];

  let authority1User, authority2User, devoteeUser, adminUser;
  let temple1, temple2;
  let auth1Token, auth2Token, devoteeToken, adminToken;

  try {
    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    // Create Temple 1
    temple1 = await Temple.create({
      name: `Test Shrine A ${timestamp}`,
      slug: `test-shrine-a-${timestamp}`,
      description: 'Sacred shrine for testing gallery thumbnail and banner features.',
      address: '108 Temple Street',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      pincode: '221001',
      status: TEMPLE_STATUS.ACTIVE,
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1544816155-12df9643f363',
          alt: 'Image One',
          order: 0,
          isThumbnail: false,
          isBanner: false,
        },
        {
          url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220',
          alt: 'Image Two',
          order: 1,
          isThumbnail: false,
          isBanner: false,
        },
        {
          url: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a',
          alt: 'Image Three',
          order: 2,
          isThumbnail: false,
          isBanner: false,
        },
      ],
    });
    testIds.push({ model: Temple, id: temple1._id });

    // Create Temple 2
    temple2 = await Temple.create({
      name: `Test Shrine B ${timestamp}`,
      slug: `test-shrine-b-${timestamp}`,
      description: 'Second shrine for testing cross-authority isolation.',
      address: '204 Heritage Marg',
      city: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401',
      status: TEMPLE_STATUS.ACTIVE,
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-temple2-1',
          alt: 'Temple 2 Image',
          order: 0,
          isThumbnail: false,
          isBanner: false,
        },
      ],
    });
    testIds.push({ model: Temple, id: temple2._id });

    // Create Authority 1
    authority1User = await User.create({
      name: `Authority One ${timestamp}`,
      email: `auth1_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.TEMPLE_AUTHORITY,
      templeId: temple1._id,
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: authority1User._id });

    // Update Temple 1 authorityId
    temple1.authorityId = authority1User._id;
    await temple1.save();

    // Create Authority 2
    authority2User = await User.create({
      name: `Authority Two ${timestamp}`,
      email: `auth2_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.TEMPLE_AUTHORITY,
      templeId: temple2._id,
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: authority2User._id });

    temple2.authorityId = authority2User._id;
    await temple2.save();

    // Create Devotee
    devoteeUser = await User.create({
      name: `Devotee Test ${timestamp}`,
      email: `devotee_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.DEVOTEE,
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: devoteeUser._id });

    // Create Admin
    adminUser = await User.create({
      name: `Admin Test ${timestamp}`,
      email: `admin_${timestamp}@devasetu.test`,
      password: 'TestPass@123',
      role: USER_ROLES.ADMIN,
      isEmailVerified: true,
    });
    testIds.push({ model: User, id: adminUser._id });

    // Login users to get JWT tokens
    const auth1Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authority1User.email, password: 'TestPass@123' }),
    });
    auth1Token = auth1Login.data?.data?.token;

    const auth2Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authority2User.email, password: 'TestPass@123' }),
    });
    auth2Token = auth2Login.data?.data?.token;

    const devoteeLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: devoteeUser.email, password: 'TestPass@123' }),
    });
    devoteeToken = devoteeLogin.data?.data?.token;

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminUser.email, password: 'TestPass@123' }),
    });
    adminToken = adminLogin.data?.data?.token;

    const img1Id = temple1.gallery[0]._id.toString();
    const img2Id = temple1.gallery[1]._id.toString();
    const img3Id = temple1.gallery[2]._id.toString();

    // 1. Authority can set thumbnail for own temple
    console.log('\n[Test 1: Set Thumbnail for own temple]');
    const setThumb1 = await request(`/authority/gallery/${img1Id}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(setThumb1.status === 200, 'Authority 1 set image 1 as thumbnail successfully', setThumb1.data);
    const updatedTemple1A = await Temple.findById(temple1._id);
    const img1DocA = updatedTemple1A.gallery.id(img1Id);
    assert(img1DocA.isThumbnail === true, 'Image 1 is marked isThumbnail: true in database');

    // 2. Setting second thumbnail clears previous thumbnail
    console.log('\n[Test 2: Setting second thumbnail atomically clears previous thumbnail]');
    const setThumb2 = await request(`/authority/gallery/${img2Id}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(setThumb2.status === 200, 'Authority 1 set image 2 as thumbnail successfully');
    const updatedTemple1B = await Temple.findById(temple1._id);
    const img1DocB = updatedTemple1B.gallery.id(img1Id);
    const img2DocB = updatedTemple1B.gallery.id(img2Id);
    assert(img1DocB.isThumbnail === false, 'Previous thumbnail (Image 1) is cleared to false');
    assert(img2DocB.isThumbnail === true, 'New thumbnail (Image 2) is set to true');
    const totalThumbnails = updatedTemple1B.gallery.filter((img) => img.isThumbnail).length;
    assert(totalThumbnails === 1, 'Exactly one active thumbnail exists in temple gallery');

    // 3. Authority cannot modify another temple's gallery (Cross-temple protection)
    console.log('\n[Test 3: Authority cannot modify another temple gallery]');
    const crossThumb = await request(`/authority/gallery/${img1Id}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth2Token}` }, // Authority 2 tries to modify Temple 1 image
    });
    assert(crossThumb.status === 404 || crossThumb.status === 403, 'Authority 2 cannot modify Temple 1 image (cross-temple rejected)');

    // 4. Authority can set banner
    console.log('\n[Test 4: Set Banner for own temple]');
    const setBanner1 = await request(`/authority/gallery/${img1Id}/banner`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(setBanner1.status === 200, 'Authority 1 set image 1 as banner successfully');
    const updatedTemple1C = await Temple.findById(temple1._id);
    const img1DocC = updatedTemple1C.gallery.id(img1Id);
    assert(img1DocC.isBanner === true, 'Image 1 is marked isBanner: true in database');

    // 5. Setting second banner clears previous banner
    console.log('\n[Test 5: Setting second banner atomically clears previous banner]');
    const setBanner3 = await request(`/authority/gallery/${img3Id}/banner`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(setBanner3.status === 200, 'Authority 1 set image 3 as banner successfully');
    const updatedTemple1D = await Temple.findById(temple1._id);
    const img1DocD = updatedTemple1D.gallery.id(img1Id);
    const img3DocD = updatedTemple1D.gallery.id(img3Id);
    assert(img1DocD.isBanner === false, 'Previous banner (Image 1) is cleared to false');
    assert(img3DocD.isBanner === true, 'New banner (Image 3) is set to true');
    const totalBanners = updatedTemple1D.gallery.filter((img) => img.isBanner).length;
    assert(totalBanners === 1, 'Exactly one active banner exists in temple gallery');

    // 6. Same image can be both thumbnail and banner
    console.log('\n[Test 6: Same image can be both thumbnail and banner independently]');
    const setBanner2 = await request(`/authority/gallery/${img2Id}/banner`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(setBanner2.status === 200, 'Image 2 set as banner while already being thumbnail');
    const updatedTemple1E = await Temple.findById(temple1._id);
    const img2DocE = updatedTemple1E.gallery.id(img2Id);
    assert(img2DocE.isThumbnail === true, 'Image 2 is still thumbnail');
    assert(img2DocE.isBanner === true, 'Image 2 is also banner');

    // 7. Delete image works
    console.log('\n[Test 7: Delete image from gallery]');
    const deleteRes = await request(`/authority/gallery/${img3Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(deleteRes.status === 200, 'Image 3 deleted from gallery successfully');
    const updatedTemple1F = await Temple.findById(temple1._id);
    const img3DocF = updatedTemple1F.gallery.id(img3Id);
    assert(!img3DocF, 'Image 3 no longer exists in database gallery');

    // 8. Deleting thumbnail clears thumbnail
    console.log('\n[Test 8: Deleting image that is thumbnail clears thumbnail]');
    // First set image 1 as thumbnail
    await request(`/authority/gallery/${img1Id}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    // Delete image 1
    const delThumbRes = await request(`/authority/gallery/${img1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(delThumbRes.status === 200, 'Deleted image 1 which was thumbnail');
    const updatedTemple1G = await Temple.findById(temple1._id);
    const remainingThumb = updatedTemple1G.gallery.find((img) => img.isThumbnail);
    assert(!remainingThumb, 'No thumbnail remains active after deleting thumbnail image');

    // 9. Deleting banner clears banner
    console.log('\n[Test 9: Deleting image that is banner clears banner]');
    // Image 2 was banner from earlier test. Delete image 2.
    const delBannerRes = await request(`/authority/gallery/${img2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    assert(delBannerRes.status === 200, 'Deleted image 2 which was banner');
    const updatedTemple1H = await Temple.findById(temple1._id);
    const remainingBanner = updatedTemple1H.gallery.find((img) => img.isBanner);
    assert(!remainingBanner, 'No banner remains active after deleting banner image');

    // 10. Devotee temple card uses isThumbnail image
    console.log('\n[Test 10: Devotee temple listing exposes gallery with isThumbnail]');
    // Add a fresh image and mark it as thumbnail
    const addImgRes = await request('/authority/gallery', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth1Token}` },
      body: JSON.stringify({
        url: 'https://images.unsplash.com/photo-final-card',
        alt: 'Final Card Photo',
      }),
    });
    const newImgId = addImgRes.data?.data?.[addImgRes.data.data.length - 1]?._id;
    await request(`/authority/gallery/${newImgId}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });

    const publicTemplesRes = await request(`/temples?search=${encodeURIComponent(temple1.name)}`);
    assert(publicTemplesRes.status === 200, 'Public temples listing retrieved');
    const matchedTemple = publicTemplesRes.data?.data?.items?.find((t) => t._id === temple1._id.toString());
    assert(matchedTemple != null, 'Found test temple in public listing');
    const publicThumb = matchedTemple?.gallery?.find((img) => img.isThumbnail);
    assert(publicThumb?.url === 'https://images.unsplash.com/photo-final-card', 'Public gallery exposes isThumbnail image correctly');

    // 11. Temple details uses isBanner image
    console.log('\n[Test 11: Temple details exposes gallery with isBanner]');
    await request(`/authority/gallery/${newImgId}/banner`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth1Token}` },
    });
    const templeDetailsRes = await request(`/temples/${temple1.slug}`);
    assert(templeDetailsRes.status === 200, 'Public temple details retrieved');
    const publicBanner = templeDetailsRes.data?.data?.gallery?.find((img) => img.isBanner);
    assert(publicBanner?.url === 'https://images.unsplash.com/photo-final-card', 'Public temple details exposes isBanner image correctly');

    // 12. No static image fallback is used as business data
    console.log('\n[Test 12: Zero static image fallback as business data]');
    assert(templeDetailsRes.data?.data?.coverImage?.url === '', 'Temple coverImage does not contain fake placeholder data');

    // 13. Admin/Devotee cannot modify authority gallery
    console.log('\n[Test 13: RBAC - Devotee and Admin cannot modify authority gallery]');
    const devoteeMod = await request(`/authority/gallery/${newImgId}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devoteeToken}` },
    });
    assert(devoteeMod.status === 403, 'Devotee blocked with 403 Forbidden');

    const adminMod = await request(`/authority/gallery/${newImgId}/thumbnail`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminMod.status === 403, 'Admin blocked from authority gallery with 403 Forbidden');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    // Automated Cleanup
    console.log('\n[Cleanup]: Purging test records from database...');
    for (const item of testIds) {
      try {
        await item.model.findByIdAndDelete(item.id);
      } catch (e) {}
    }
    console.log('✓ Cleanup complete.');
    await mongoose.disconnect();

    console.log('\n-------------------------------------------------------------');
    console.log(`Gallery Tests Finished: ${passed} Passed, ${failed} Failed`);
    console.log('-------------------------------------------------------------\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runGalleryTests();
