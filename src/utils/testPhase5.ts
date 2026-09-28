import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TimeSlot from '../models/TimeSlot.js';
import Temple from '../models/Temple.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import TempleRegistration from '../models/TempleRegistration.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import mongoose from 'mongoose';

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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  if (isFormData && headers['Content-Type']) {
    delete headers['Content-Type'];
  }

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

async function runPhase5Tests() {
  console.log('\n=============================================================');
  console.log('       DEVASETU — PHASE 5 AUTOMATED VERIFICATION SUITE');
  console.log('       Temple Authority Interface & Isolation Tests');
  console.log('=============================================================\n');

  try {
    const timestamp = Date.now();
    const adminEmail = `admin_phase5_${timestamp}@devasetu.test`;
    const adminPass = 'AdminSecret@123456';
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET || 'DevaSetu_Super_Secret_Admin_Bootstrap_Key_2025';

    // 1. Setup Admin: Create and Login
    console.log('[Setup 1] Creating bootstrap admin and logging in...');
    const adminCreateRes = await request('/auth/create-admin', {
      method: 'POST',
      headers: { 'x-admin-bootstrap-secret': secret },
      body: JSON.stringify({
        name: 'Phase 5 Test Admin',
        email: adminEmail,
        password: adminPass,
        phone: '9888877777',
      }),
    });
    assert(adminCreateRes.status === 201, 'Bootstrap admin created successfully', adminCreateRes.data);

    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: adminEmail,
        password: adminPass,
      }),
    });
    assert(adminLoginRes.status === 200, 'Admin logged in successfully and obtained bearer token', adminLoginRes.data);
    const adminToken = adminLoginRes.data?.data?.token;

    // 2. Register Temple A and Temple B via public registration
    console.log('\n[Setup 2] Registering Temple A and Temple B via public registration...');
    const emailA = `rama_priest_${timestamp}@devasetu.test`;
    const regARes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Rama Priest',
        applicantEmail: emailA,
        applicantPhone: '9876543210',
        authorityDesignation: 'Chief Priest',
        templeName: `Shri Rama Mandir ${timestamp}`,
        city: 'Ayodhya',
        state: 'Uttar Pradesh',
        address: 'Ram Janmabhoomi Marg',
        pincode: '224123',
        description: 'Sacred birthplace of Lord Rama',
      }),
    });
    assert(regARes.status === 201, 'Temple A registered', regARes.data);
    const regAId = regARes.data?.data?.registrationId || regARes.data?.data?._id;

    const emailB = `krishna_priest_${timestamp}@devasetu.test`;
    const regBRes = await request('/temple-registrations', {
      method: 'POST',
      body: JSON.stringify({
        applicantName: 'Krishna Priest',
        applicantEmail: emailB,
        applicantPhone: '9876543211',
        authorityDesignation: 'Head Trustee',
        templeName: `Shri Krishna Dham ${timestamp}`,
        city: 'Mathura',
        state: 'Uttar Pradesh',
        address: 'Janmabhoomi Marg',
        pincode: '281001',
        description: 'Sacred birthplace of Lord Krishna',
      }),
    });
    assert(regBRes.status === 201, 'Temple B registered', regBRes.data);
    const regBId = regBRes.data?.data?.registrationId || regBRes.data?.data?._id;

    // 3. Admin Approves Temple A & Temple B and Provisions Authorities
    console.log('\n[Setup 3] Admin approving both temples and provisioning authorities...');
    const approveARes = await request(`/admin/temple-registrations/${regAId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(approveARes.status === 200, 'Temple A approved', approveARes.data);

    const tempPassA = `TempPassA@${timestamp}123!`;
    const createAuthARes = await request(`/admin/temple-registrations/${regAId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ temporaryPassword: tempPassA }),
    });
    assert(createAuthARes.status === 200, 'Authority A account created and credentials dispatched', createAuthARes.data);

    const approveBRes = await request(`/admin/temple-registrations/${regBId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    assert(approveBRes.status === 200, 'Temple B approved', approveBRes.data);

    const tempPassB = `TempPassB@${timestamp}123!`;
    const createAuthBRes = await request(`/admin/temple-registrations/${regBId}/create-authority`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ temporaryPassword: tempPassB }),
    });
    assert(createAuthBRes.status === 200, 'Authority B account created and credentials dispatched', createAuthBRes.data);

    // 4. Authority A and Authority B Login
    console.log('\n[Authority Login & State] Logging in Authority A & Authority B via HTTP...');
    const loginARes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: emailA,
        password: tempPassA,
      }),
    });
    assert(loginARes.status === 200, 'Authority A logged in successfully with temporary password', loginARes.data);
    assert(loginARes.data.data.user.role === 'TEMPLE_AUTHORITY', 'Authority A role is TEMPLE_AUTHORITY');
    assert(loginARes.data.data.user.mustChangePassword === true, 'Authority A mustChangePassword is true');
    assert(Boolean(loginARes.data.data.user.templeId), 'Authority A has assigned templeId');
    const tokenA = loginARes.data.data.token;
    const templeAId = loginARes.data.data.user.templeId;

    const loginBRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: emailB,
        password: tempPassB,
      }),
    });
    assert(loginBRes.status === 200, 'Authority B logged in successfully', loginBRes.data);
    const tokenB = loginBRes.data.data.token;

    // 5. Devotee & RBAC Access Control Test
    console.log('\n[RBAC Verification] Verifying access control on /api/authority endpoints...');
    const devEmail = `devotee_phase5_${timestamp}@devasetu.test`;
    const devRegRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Devotee User',
        email: devEmail,
        password: 'DevoteePassword@123',
        phone: '9777766666',
      }),
    });
    assert(devRegRes.status === 201, 'Devotee created', devRegRes.data);
    const devToken = devRegRes.data.data.token;

    // Devotee attempting /api/authority/dashboard -> 403
    const devAuthCheck = await request('/authority/dashboard', {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    assert(devAuthCheck.status === 403, 'Devotee access to /api/authority/dashboard is blocked with 403 Forbidden');

    // Admin attempting /api/authority/dashboard -> 403
    const adminAuthCheck = await request('/authority/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAuthCheck.status === 403, 'Admin access to /api/authority/dashboard is blocked with 403 Forbidden');

    // Unauthenticated -> 401
    const anonAuthCheck = await request('/authority/dashboard');
    assert(anonAuthCheck.status === 401, 'Unauthenticated request blocked with 401 Unauthorized');

    // 6. Authority Dashboard
    console.log('\n[Feature 1: Authority Dashboard]');
    const dashRes = await request('/authority/dashboard', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(dashRes.status === 200, 'Authority A fetches dashboard metrics successfully', dashRes.data);
    assert(dashRes.data?.data?.kpis !== undefined, 'Dashboard contains KPIs');
    assert(dashRes.data?.data?.temple !== undefined, 'Dashboard contains temple summary');

    // 7. Temple Profile View & Protected Field Mutation Prevention
    console.log('\n[Feature 2: Temple Profile View & Update]');
    const getTempleRes = await request('/authority/temple', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getTempleRes.status === 200, 'Authority A retrieves assigned temple profile');
    assert(getTempleRes.data.data._id === templeAId, 'Retrieved temple ID matches assigned temple');

    // Attempt to update editable fields and attack protected fields
    const patchTempleRes = await request('/authority/temple', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        description: 'Updated sacred description by authority',
        timings: { specialNotes: 'Morning Darshan from 5:00 AM to 9:30 PM' },
        // Attempting to overwrite protected fields:
        status: 'SUSPENDED',
        slug: 'hacked-slug',
        authorityId: '666666666666666666666666',
      }),
    });
    assert(patchTempleRes.status === 200, 'Temple update returns 200 OK', patchTempleRes.data);
    assert(patchTempleRes.data.data.description === 'Updated sacred description by authority', 'Editable description updated');
    assert(patchTempleRes.data.data.timings.specialNotes === 'Morning Darshan from 5:00 AM to 9:30 PM', 'Editable timings updated');
    assert(patchTempleRes.data.data.status === 'ACTIVE', 'Protected field "status" remained ACTIVE (not overwritten)');
    assert(patchTempleRes.data.data.slug !== 'hacked-slug', 'Protected field "slug" was NOT overwritten');

    // 8. Gallery Operations (Dual-Mode: URL & Local File Upload)
    console.log('\n[Feature 3: Gallery Operations (URL & Local File Upload)]');
    // Invalid URL rejection check
    const invalidUrlRes = await request('/authority/gallery', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        url: 'invalid-not-a-url',
        caption: 'Invalid test',
      }),
    });
    assert(invalidUrlRes.status === 400, 'Invalid image URL rejected with 400 Bad Request');

    const addImgRes = await request('/authority/gallery', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
        caption: 'Sacred Garbhagriha',
        isPrimary: true,
      }),
    });
    assert(addImgRes.status === 201, 'Authority added gallery image URL', addImgRes.data);
    const addedImages = addImgRes.data?.data || [];
    const imageA = addedImages[addedImages.length - 1];
    const imageAId = imageA?._id;

    const addImg2Res = await request('/authority/gallery', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
        caption: 'Temple Gopuram',
      }),
    });
    assert(addImg2Res.status === 201, 'Authority added second gallery image');
    const addedImages2 = addImg2Res.data?.data || [];
    const imageB = addedImages2[addedImages2.length - 1];
    const imageBId = imageB?._id;

    // Dual-Mode Option 1: Local Multipart Upload via Cloudinary
    const formData = new FormData();
    const fakeImageBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const fileBlob = new Blob([fakeImageBytes], { type: 'image/jpeg' });
    formData.append('image', fileBlob, 'temple_mandir.jpg');
    formData.append('caption', 'Sacred Sanctum via Local Upload');
    formData.append('isPrimary', 'false');

    const uploadImgRes = await request('/authority/gallery/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    assert(uploadImgRes.status === 201, 'Local image file uploaded successfully via Cloudinary/multer', uploadImgRes.data);
    const galleryAfterUpload = uploadImgRes.data?.data || [];
    const uploadedImg = galleryAfterUpload[galleryAfterUpload.length - 1];
    assert(Boolean(uploadedImg?.url), 'Uploaded gallery image contains URL');
    assert(Boolean(uploadedImg?.publicId), 'Uploaded gallery image contains Cloudinary publicId');
    const uploadedImgId = uploadedImg?._id;

    // Fetch gallery
    const getGalRes = await request('/authority/gallery', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(getGalRes.status === 200, 'Gallery retrieved');
    assert(getGalRes.data.data.length >= 3, 'Gallery has at least 3 images (URL + Local Uploads)');

    // Cross-temple Isolation check: Authority B cannot delete Authority A's uploaded image
    if (uploadedImgId) {
      const crossDelImgRes = await request(`/authority/gallery/${uploadedImgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(crossDelImgRes.status === 404, 'Authority B cannot delete Authority A gallery image (404 isolation)');
    }

    // Delete one gallery image by owner (Authority A)
    if (imageBId) {
      const delImgRes = await request(`/authority/gallery/${imageBId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(delImgRes.status === 200, 'Gallery image deleted by Authority A');
    }

    // 9. Services CRUD & Temple Binding
    console.log('\n[Feature 4: Services Management & Isolation]');
    const createSvcRes = await request('/authority/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Special Suprabhata Seva',
        type: 'POOJA',
        description: 'Morning prayer and darshan seva',
        price: 250,
        duration: 45,
        // Attempt to hijack templeId to another temple:
        templeId: '666666666666666666666666',
      }),
    });
    assert(createSvcRes.status === 201, 'Service created successfully', createSvcRes.data);
    assert(createSvcRes.data.data.templeId === templeAId, 'Service templeId was automatically set to Authority A templeId (client tamper ignored)');
    const serviceAId = createSvcRes.data.data._id;

    // Update service
    const updateSvcRes = await request(`/authority/services/${serviceAId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        price: 300,
        isActive: true,
      }),
    });
    assert(updateSvcRes.status === 200, 'Service updated successfully');
    assert(updateSvcRes.data.data.price === 300, 'Service price correctly updated');

    // 10. Cross-Temple Isolation Check: Authority B tries to read/modify/delete Authority A's Service
    console.log('\n[Feature 5: Cross-Temple Isolation on Services]');
    const crossReadSvc = await request(`/authority/services/${serviceAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossReadSvc.status === 404, 'Authority B cannot read Authority A service (returns 404 Not Found)');

    const crossUpdateSvc = await request(`/authority/services/${serviceAId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ price: 9999 }),
    });
    assert(crossUpdateSvc.status === 404, 'Authority B cannot update Authority A service (returns 404 Not Found)');

    const crossDeleteSvc = await request(`/authority/services/${serviceAId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossDeleteSvc.status === 404, 'Authority B cannot delete Authority A service (returns 404 Not Found)');

    // 11. Time Slots Management & Validation
    console.log('\n[Feature 6: Time Slot Management & Validation]');
    // Validation failure 1: startTime >= endTime
    const invalidTimeSlotRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        date: '2026-10-01',
        startTime: '10:00',
        endTime: '09:00', // Invalid!
        capacity: 20,
      }),
    });
    assert(invalidTimeSlotRes.status === 400, 'Invalid time slot (startTime >= endTime) rejected with 400 Bad Request');

    // Validation failure 2: capacity <= 0
    const invalidCapacityRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        date: '2026-10-01',
        startTime: '08:00',
        endTime: '09:00',
        capacity: 0, // Invalid!
      }),
    });
    assert(invalidCapacityRes.status === 400, 'Invalid capacity (<= 0) rejected with 400 Bad Request');

    // Validation failure 3: Authority B tries to create slot for Authority A's service
    const crossSlotRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        date: '2026-10-01',
        startTime: '08:00',
        endTime: '09:00',
        capacity: 20,
      }),
    });
    assert(crossSlotRes.status === 404, 'Authority B creating time slot for Authority A service rejected with 404 Not Found');

    // Valid Time Slot creation by Authority A
    const validSlotRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        date: '2026-10-01',
        startTime: '06:00',
        endTime: '07:00',
        capacity: 25,
      }),
    });
    assert(validSlotRes.status === 201, 'Valid single-date time slot created successfully', validSlotRes.data);
    assert(validSlotRes.data.data.templeId === templeAId, 'Time slot automatically bound to Authority A templeId');
    const slotAId = validSlotRes.data.data._id;

    // Validation failure 4: startDate > endDate
    const invalidDateRangeRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        startDate: '2026-10-10',
        endDate: '2026-10-05',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 30,
      }),
    });
    assert(invalidDateRangeRes.status === 400, 'Invalid date range (startDate > endDate) rejected with 400 Bad Request');

    // Date Range Time Slot Creation with Specific Weekday Schedule
    const rangeSlotRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        startDate: '2026-09-25',
        endDate: '2026-09-30',
        availableDays: ['SATURDAY', 'SUNDAY'],
        startTime: '10:00',
        endTime: '11:00',
        capacity: 50,
      }),
    });
    assert(rangeSlotRes.status === 201, 'Date-range time slot created successfully', rangeSlotRes.data);
    assert(Boolean(rangeSlotRes.data.data.startDate), 'Slot contains startDate');
    assert(Boolean(rangeSlotRes.data.data.endDate), 'Slot contains endDate');
    assert(rangeSlotRes.data.data.availableDays.includes('SATURDAY'), 'Slot availableDays contains SATURDAY');
    const rangeSlotId = rangeSlotRes.data.data._id;

    // Multiple Slots within the Same Date Range
    const secondRangeSlotRes = await request('/authority/time-slots', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        serviceId: serviceAId,
        startDate: '2026-09-25',
        endDate: '2026-09-30',
        availableDays: ['ALL_DAYS'],
        startTime: '17:00',
        endTime: '18:00',
        capacity: 75,
      }),
    });
    assert(secondRangeSlotRes.status === 201, 'Multiple slots configured in same date range successfully');

    // Query Time Slots using Date Range Filter
    const queryRangeRes = await request('/authority/time-slots?startDate=2026-09-26&endDate=2026-09-27', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(queryRangeRes.status === 200, 'Query time slots by date range returns 200');
    const matchedSlots = Array.isArray(queryRangeRes.data?.data) ? queryRangeRes.data.data : (queryRangeRes.data?.data?.timeSlots || []);
    assert(matchedSlots.some((s) => s._id === rangeSlotId), 'Date-range slot returned in date range query filter');

    // Model Method Unit Verification: isAvailableForDate()
    const slotDoc = new TimeSlot({
      templeId: templeAId,
      serviceId: serviceAId,
      startDate: new Date('2026-09-25T00:00:00Z'),
      endDate: new Date('2026-09-30T23:59:59Z'),
      availableDays: ['SATURDAY', 'SUNDAY'],
      startTime: '10:00',
      endTime: '11:00',
      capacity: 50,
      bookedCount: 0,
      isActive: true,
    });
    // 2026-09-26 is a Saturday
    assert(slotDoc.isAvailableForDate('2026-09-26') === true, 'isAvailableForDate: true on Saturday within date range');
    // 2026-09-28 is a Monday
    assert(slotDoc.isAvailableForDate('2026-09-28') === false, 'isAvailableForDate: false on Monday when availableDays is weekend-only');
    // 2026-10-02 is outside the date range
    assert(slotDoc.isAvailableForDate('2026-10-02') === false, 'isAvailableForDate: false outside date range');

    // Cross-temple Isolation check on Time Slot
    const crossSlotRead = await request(`/authority/time-slots/${slotAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossSlotRead.status === 404, 'Authority B reading Authority A time slot returns 404 Not Found');

    // 12. Read-Only Bookings & Devotees
    console.log('\n[Feature 7: Read-Only Bookings & Devotees Queries]');
    const bookingsRes = await request('/authority/bookings', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(bookingsRes.status === 200, 'Authority A retrieves temple bookings query');
    assert(Array.isArray(bookingsRes.data.data.bookings), 'Bookings returned as array');

    const devoteesRes = await request('/authority/devotees', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(devoteesRes.status === 200, 'Authority A retrieves temple devotees query');
    assert(Array.isArray(devoteesRes.data.data.devotees), 'Devotees returned as array');

    // 13. Analytics & Notifications
    console.log('\n[Feature 8: Analytics & Notifications]');
    const analyticsRes = await request('/authority/analytics', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(analyticsRes.status === 200, 'Authority A fetches analytics successfully');

    const notifsRes = await request('/authority/notifications', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(notifsRes.status === 200, 'Authority A fetches notifications successfully');

    const readAllNotifs = await request('/authority/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(readAllNotifs.status === 200, 'Mark all notifications read returns 200');

    // 14. Password Change Workflow (mustChangePassword -> false)
    console.log('\n[Feature 9: Mandatory Password Change Workflow]');
    const changePassRes = await request('/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        currentPassword: tempPassA,
        newPassword: 'RamaAuthorityNewSecurePass@2026',
      }),
    });
    assert(changePassRes.status === 200, 'Authority A successfully changes temporary password to permanent password');
    assert(changePassRes.data.data.mustChangePassword === false, 'mustChangePassword flag is now false');

    // Verify login with new password
    const reLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: emailA,
        password: 'RamaAuthorityNewSecurePass@2026',
      }),
    });
    assert(reLoginRes.status === 200, 'Authority A successfully logs in with new permanent password');
    assert(reLoginRes.data.data.user.mustChangePassword === false, 'Persistent mustChangePassword remains false');

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');

    console.log('\n[Cleanup] Cleaning up Phase 5 test artifacts...');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const testTemples = await Temple.find({ name: { $regex: new RegExp(String(timestamp)) } }).lean();
    const testTempleIds = testTemples.map((t) => t._id);
    const testUsers = await User.find({ email: { $regex: new RegExp(String(timestamp)) } }).lean();
    const testUserIds = testUsers.map((u) => u._id);

    await Booking.deleteMany({ $or: [{ templeId: { $in: testTempleIds } }, { userId: { $in: testUserIds } }] });
    await TimeSlot.deleteMany({ templeId: { $in: testTempleIds } });
    await Service.deleteMany({ templeId: { $in: testTempleIds } });
    await Notification.deleteMany({ $or: [{ templeId: { $in: testTempleIds } }, { userId: { $in: testUserIds } }] });
    await Temple.deleteMany({ _id: { $in: testTempleIds } });
    await TempleRegistration.deleteMany({ applicantEmail: { $regex: new RegExp(String(timestamp)) } });
    await User.deleteMany({ _id: { $in: testUserIds } });
    console.log('  ✓ Phase 5 test artifacts cleaned up successfully.');
    try { await mongoose.connection.close(); } catch (_) {}

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  }
}

runPhase5Tests();
