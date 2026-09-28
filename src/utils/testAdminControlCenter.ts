import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config({ path: './.env' });

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- ADMIN CONTROL CENTER AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await mongoose.connection.collection('users').findOne({ role: 'ADMIN' });
  if (!admin) throw new Error('No Admin account found in DB');

  const authority = await mongoose.connection.collection('users').findOne({ role: 'TEMPLE_AUTHORITY' });
  const devotee = await mongoose.connection.collection('users').findOne({ role: 'DEVOTEE' });

  const adminToken = jwt.sign(
    { userId: admin._id.toString(), email: admin.email, role: admin.role },
    process.env.JWT_SECRET || 'devasetu_secret_key_2026_jwt_token',
    { expiresIn: '1h' }
  );

  const authorityToken = authority
    ? jwt.sign(
        {
          userId: authority._id.toString(),
          email: authority.email,
          role: authority.role,
          templeId: authority.templeId ? authority.templeId.toString() : null,
        },
        process.env.JWT_SECRET || 'devasetu_secret_key_2026_jwt_token',
        { expiresIn: '1h' }
      )
    : null;

  console.log('Admin account detected:', admin.email);

  // 1. GET /api/admin/temples
  const templesRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/temples',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('1. GET /api/admin/temples status:', templesRes.status);
  console.log('   Total temples in response:', templesRes.body?.data?.pagination?.total);
  console.log('   Temples array length:', templesRes.body?.data?.temples?.length);
  if (templesRes.status !== 200 || !Array.isArray(templesRes.body?.data?.temples) || templesRes.body.data.temples.length === 0) {
    throw new Error('Test 1 failed: temples list not populated');
  }

  // 2. GET /api/admin/devotees
  const devoteesRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/devotees',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('2. GET /api/admin/devotees status:', devoteesRes.status);
  console.log('   Devotees count:', devoteesRes.body?.data?.devotees?.length);
  if (devoteesRes.status !== 200) throw new Error('Test 2 failed');

  // 3. Devotee status update guard check
  if (devotee) {
    const updateDevoteeRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/devotees/${devotee._id}/status`,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      },
      { isActive: true }
    );
    console.log('3a. PATCH /api/admin/devotees/:id/status (DEVOTEE) status:', updateDevoteeRes.status);
    if (updateDevoteeRes.status !== 200) throw new Error('Test 3a failed');

    // Attempt to modify an ADMIN account through /devotees status endpoint -> MUST FAIL with 403
    const modifyAdminFail = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/devotees/${admin._id}/status`,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      },
      { isActive: true }
    );
    console.log('3b. PATCH /api/admin/devotees/:id/status (ADMIN target, expect 403):', modifyAdminFail.status);
    if (modifyAdminFail.status !== 403) throw new Error('Test 3b failed: did not enforce role guard');
  }

  // 4. GET /api/admin/bookings
  const bookingsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/bookings',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('4. GET /api/admin/bookings status:', bookingsRes.status);
  console.log('   Total bookings count:', bookingsRes.body?.data?.pagination?.total);
  if (bookingsRes.status !== 200) throw new Error('Test 4 failed');

  // 5. GET /api/admin/payments
  const paymentsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/payments',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('5. GET /api/admin/payments status:', paymentsRes.status);
  console.log('   Total payments count:', paymentsRes.body?.data?.pagination?.total);
  if (paymentsRes.status !== 200) throw new Error('Test 5 failed');

  // 6. GET /api/admin/reviews/metrics
  const reviewMetricsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/reviews/metrics',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('6. GET /api/admin/reviews/metrics status:', reviewMetricsRes.status);
  console.log('   Review metrics:', reviewMetricsRes.body?.data);
  if (reviewMetricsRes.status !== 200) throw new Error('Test 6 failed');

  // 7. GET /api/admin/analytics
  const analyticsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/analytics',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('7. GET /api/admin/analytics status:', analyticsRes.status);
  console.log('   KPIs:', analyticsRes.body?.data?.kpis);
  if (analyticsRes.status !== 200) throw new Error('Test 7 failed');

  // 8. Temple Recommendations & Feedback Loop
  const firstTemple = templesRes.body?.data?.temples?.[0];
  if (firstTemple) {
    const createRecRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/recommendations',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      },
      {
        templeId: firstTemple._id,
        title: 'Queue Optimization during Peak Darshan',
        category: 'Queue Management',
        observedFeedback: '18 approved reviews mention long waiting times during weekend evening slots.',
        suggestedAction: 'Consider evaluating queue markers and additional sevadar assistance.',
      }
    );
    console.log('8a. POST /api/admin/recommendations status:', createRecRes.status);
    const createdRec = createRecRes.body?.data;
    if (createRecRes.status !== 201) throw new Error('Test 8a failed');

    // Test authority recommendations endpoint
    if (authorityToken && authority?.templeId?.toString() === firstTemple._id.toString()) {
      const authRecsRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/authority/recommendations',
        method: 'GET',
        headers: { Authorization: `Bearer ${authorityToken}` },
      });
      console.log('8b. GET /api/authority/recommendations status:', authRecsRes.status);
      console.log('    Recommendations visible to authority:', authRecsRes.body?.data?.length);

      // Authority transitions OPEN -> ACKNOWLEDGED
      const patchRecRes = await request(
        {
          hostname: 'localhost',
          port: 5000,
          path: `/api/authority/recommendations/${createdRec._id}/status`,
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${authorityToken}`,
            'Content-Type': 'application/json',
          },
        },
        { status: 'ACKNOWLEDGED' }
      );
      console.log('8c. PATCH /api/authority/recommendations/:id/status (ACKNOWLEDGED):', patchRecRes.status);
      if (patchRecRes.status !== 200) throw new Error('Test 8c failed');
    }
  }

  // 9. GET /api/admin/audit-logs
  const auditRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/audit-logs',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('9. GET /api/admin/audit-logs status:', auditRes.status);
  console.log('   Audit logs recorded:', auditRes.body?.data?.pagination?.total);
  if (auditRes.status !== 200) throw new Error('Test 9 failed');

  await mongoose.disconnect();
  console.log('--- ALL ADMIN CONTROL CENTER TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
