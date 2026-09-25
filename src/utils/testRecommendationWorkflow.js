import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config({ path: './.env' });

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function testRecWorkflow() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rec = await mongoose.connection.collection('templerecommendations').findOne({});
  const authority = await mongoose.connection
    .collection('users')
    .findOne({ templeId: rec.templeId, role: 'TEMPLE_AUTHORITY' });
  const otherAuthority = await mongoose.connection
    .collection('users')
    .findOne({ role: 'TEMPLE_AUTHORITY', templeId: { $ne: rec.templeId } });

  console.log('Rec ID:', rec._id, 'Status:', rec.status);
  console.log('Assigned Authority:', authority?.email);
  console.log('Other Authority:', otherAuthority?.email);

  if (!authority) throw new Error('No assigned authority found for this temple');

  const authTok = jwt.sign(
    {
      userId: authority._id.toString(),
      email: authority.email,
      role: 'TEMPLE_AUTHORITY',
      templeId: authority.templeId.toString(),
    },
    process.env.JWT_SECRET || 'devasetu_secret_key_2026_jwt_token'
  );

  // 1. GET authority recommendations
  const getRes = await req({
    hostname: 'localhost',
    port: 5000,
    path: '/api/authority/recommendations',
    method: 'GET',
    headers: { Authorization: 'Bearer ' + authTok },
  });
  console.log('Authority GET recs status:', getRes.status, 'Count:', getRes.body?.data?.length);

  // 2. Transition OPEN -> ACKNOWLEDGED
  const ackRes = await req(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/authority/recommendations/' + rec._id + '/status',
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + authTok, 'Content-Type': 'application/json' },
    },
    { status: 'ACKNOWLEDGED' }
  );
  console.log('Authority ACK status:', ackRes.status, 'New status:', ackRes.body?.data?.status);
  if (ackRes.status !== 200) throw new Error('ACK failed');

  // 3. Transition ACKNOWLEDGED -> RESOLVED
  const resRes = await req(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/authority/recommendations/' + rec._id + '/status',
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + authTok, 'Content-Type': 'application/json' },
    },
    { status: 'RESOLVED' }
  );
  console.log('Authority RESOLVE status:', resRes.status, 'New status:', resRes.body?.data?.status);
  if (resRes.status !== 200) throw new Error('RESOLVE failed');

  // 4. Test tenant isolation with otherAuthority -> MUST RETURN 403
  if (otherAuthority) {
    const otherTok = jwt.sign(
      {
        userId: otherAuthority._id.toString(),
        email: otherAuthority.email,
        role: 'TEMPLE_AUTHORITY',
        templeId: otherAuthority.templeId ? otherAuthority.templeId.toString() : null,
      },
      process.env.JWT_SECRET || 'devasetu_secret_key_2026_jwt_token'
    );
    const failRes = await req(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/authority/recommendations/' + rec._id + '/status',
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + otherTok, 'Content-Type': 'application/json' },
      },
      { status: 'RESOLVED' }
    );
    console.log('Other Authority modify attempt (expect 403):', failRes.status);
    if (failRes.status !== 403) throw new Error('Tenant isolation check failed!');
  }

  await mongoose.disconnect();
  console.log('--- ALL RECOMMENDATION WORKFLOW & TENANT ISOLATION CHECKS PASSED ---');
}

testRecWorkflow().catch((e) => {
  console.error(e);
  process.exit(1);
});
