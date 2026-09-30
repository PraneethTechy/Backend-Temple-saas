process.env.NODE_ENV = 'test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import http from 'http';
import { User, Temple, Conversation, Message, USER_ROLES } from '../models/index.js';
import { generateToken } from '../services/tokenService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let passed = 0;
let failed = 0;

function assert(condition: any, message: string, details: any = null) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`, details ? JSON.stringify(details) : '');
    failed++;
  }
}

async function runTests() {
  console.log('=============================================================');
  console.log('       DEVASETU: ADMIN <-> AUTHORITY MESSAGING TESTS        ');
  console.log('=============================================================');

  // 1. Connect to Mongo
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  }

  // 2. Determine target server (existing dev server or ephemeral server)
  let server: any = null;
  let io: any = null;
  let API_BASE = 'http://localhost:5000/api';
  let SOCKET_URL = 'http://localhost:5000';

  const isAlreadyRunning = await new Promise<boolean>((resolve) => {
    const req = http.get('http://localhost:5000/api/messages/unread-count', (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (!isAlreadyRunning) {
    const { default: app } = await import('../server.js');
    const { initSocket } = await import('../services/socketService.js');
    server = http.createServer(app);
    io = initSocket(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    API_BASE = `http://localhost:${address.port}/api`;
    SOCKET_URL = `http://localhost:${address.port}`;
  }

  async function request(endpoint: string, options: any = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const res = await fetch(url, {
      ...options,
      headers,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  const timestamp = Date.now();
  let adminUser: any = null;
  let authorityUserA: any = null;
  let authorityUserB: any = null;
  let devoteeUser: any = null;
  let templeA: any = null;
  let templeB: any = null;

  try {
    // Setup test users & temples
    adminUser = await User.create({
      name: `Admin Test ${timestamp}`,
      email: `admin_msg_${timestamp}@devasetu.test`,
      password: 'AdminPassword@123',
      role: USER_ROLES.ADMIN,
      isActive: true,
    });

    templeA = await Temple.create({
      name: `Messaging Test Temple A ${timestamp}`,
      slug: `msg-temple-a-${timestamp}`,
      description: 'Historical Shiva Temple in Tiruvannamalai',
      address: 'Girivalam Road',
      pincode: '606601',
      city: 'Tiruvannamalai',
      state: 'Tamil Nadu',
      status: 'ACTIVE',
    });

    templeB = await Temple.create({
      name: `Messaging Test Temple B ${timestamp}`,
      slug: `msg-temple-b-${timestamp}`,
      description: 'Ancient Meenakshi Temple in Madurai',
      address: 'Temple Street',
      pincode: '625001',
      city: 'Madurai',
      state: 'Tamil Nadu',
      status: 'ACTIVE',
    });

    authorityUserA = await User.create({
      name: `Authority A ${timestamp}`,
      email: `auth_a_${timestamp}@devasetu.test`,
      password: 'AuthPassword@123',
      role: USER_ROLES.TEMPLE_AUTHORITY,
      templeId: templeA._id,
      isActive: true,
    });

    authorityUserB = await User.create({
      name: `Authority B ${timestamp}`,
      email: `auth_b_${timestamp}@devasetu.test`,
      password: 'AuthPassword@123',
      role: USER_ROLES.TEMPLE_AUTHORITY,
      templeId: templeB._id,
      isActive: true,
    });

    devoteeUser = await User.create({
      name: `Devotee ${timestamp}`,
      email: `devotee_msg_${timestamp}@devasetu.test`,
      password: 'DevPassword@123',
      role: USER_ROLES.DEVOTEE,
      isActive: true,
    });

    const adminToken = generateToken(adminUser._id, adminUser.role);
    const authAToken = generateToken(authorityUserA._id, authorityUserA.role);
    const authBToken = generateToken(authorityUserB._id, authorityUserB.role);
    const devoteeToken = generateToken(devoteeUser._id, devoteeUser.role);

    console.log('\n--- 1. Testing Authentication & Devotee Access Restriction ---');

    // Test 1: Unauthenticated request fails with 401
    const unauthRes = await request('/messages/unread-count');
    assert(unauthRes.status === 401, 'Unauthenticated request returns 401 Unauthorized');

    // Test 2: Devotee requesting unread-count is blocked with 403
    const devUnreadRes = await request('/messages/unread-count', {
      headers: { Authorization: `Bearer ${devoteeToken}` },
    });
    assert(devUnreadRes.status === 403, 'Devotee blocked from /messages/unread-count with 403 Forbidden');

    // Test 3: Devotee requesting conversations is blocked with 403
    const devConvRes = await request('/messages/conversations', {
      headers: { Authorization: `Bearer ${devoteeToken}` },
    });
    assert(devConvRes.status === 403, 'Devotee blocked from /messages/conversations with 403 Forbidden');

    console.log('\n--- 2. Testing Temple Authority Conversation Access ---');

    // Test 4: Authority A initial unread count is 0
    const authAUnreadRes = await request('/messages/unread-count', {
      headers: { Authorization: `Bearer ${authAToken}` },
    });
    assert(authAUnreadRes.status === 200, 'Authority A retrieves unread count (200 OK)');
    assert(authAUnreadRes.data?.data?.unreadCount === 0, 'Authority A initial unread count is 0');

    // Test 5: Authority A fetches my-conversation (auto-creates if first time)
    const myConvRes = await request('/messages/my-conversation', {
      headers: { Authorization: `Bearer ${authAToken}` },
    });
    assert(myConvRes.status === 200, 'Authority A accesses my-conversation (200 OK)');
    const convA = myConvRes.data?.data?.conversation;
    assert(convA && convA._id, 'Conversation record created with valid ID');
    assert(convA?.templeId?._id?.toString() === templeA._id.toString(), 'Conversation belongs to assigned Temple A');

    console.log('\n--- 3. Testing Message Sending & Cross-Temple Isolation ---');

    // Test 6: Empty message rejected
    const emptyMsgRes = await request(`/messages/conversations/${convA._id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authAToken}` },
      body: JSON.stringify({ message: '   ' }),
    });
    assert(emptyMsgRes.status === 400, 'Empty message rejected with 400 Bad Request');

    // Test 7: Authority A sends valid message
    const sendResA = await request(`/messages/conversations/${convA._id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authAToken}` },
      body: JSON.stringify({ message: 'Namaste Admin, please review our special pooja timing.' }),
    });
    assert(sendResA.status === 201, 'Authority A sends message successfully (201 Created)');
    assert(sendResA.data?.data?.message?.message === 'Namaste Admin, please review our special pooja timing.', 'Message body matches');
    assert(sendResA.data?.data?.conversation?.unreadForAdmin === 1, 'unreadForAdmin incremented to 1');

    // Test 8: Authority B attempts to access Authority A conversation (cross-temple tamper)
    const crossAccessRes = await request(`/messages/conversations/${convA._id}`, {
      headers: { Authorization: `Bearer ${authBToken}` },
    });
    assert(crossAccessRes.status === 403, 'Authority B accessing Authority A conversation blocked with 403 Forbidden');

    // Test 9: Authority B attempts to send message in Authority A conversation
    const crossSendRes = await request(`/messages/conversations/${convA._id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authBToken}` },
      body: JSON.stringify({ message: 'Imposter message' }),
    });
    assert(crossSendRes.status === 403, 'Authority B sending in Authority A conversation blocked with 403 Forbidden');

    console.log('\n--- 4. Testing Admin Supervisory Access & Replies ---');

    // Test 10: Admin unread count is >= 1
    const adminUnreadRes = await request('/messages/unread-count', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminUnreadRes.status === 200, 'Admin fetches unread count (200 OK)');
    assert(adminUnreadRes.data?.data?.unreadCount >= 1, 'Admin unread count reflects new authority message');

    // Test 11: Admin conversation list contains Temple A
    const adminConvListRes = await request('/messages/conversations', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminConvListRes.status === 200, 'Admin fetches conversation list (200 OK)');
    const foundConvA = adminConvListRes.data?.data?.conversations?.find(
      (c: any) => c._id === convA._id
    );
    assert(foundConvA !== undefined, 'Admin list includes Temple A conversation');
    assert(foundConvA?.unreadForAdmin === 1, 'Temple A has unreadForAdmin = 1');

    // Test 12: Admin opens Temple A conversation -> resets unreadForAdmin
    const adminOpenConvRes = await request(`/messages/conversations/${convA._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminOpenConvRes.status === 200, 'Admin opens conversation messages (200 OK)');
    assert(adminOpenConvRes.data?.data?.messages?.length >= 1, 'Message history retrieved');

    // Verify unreadForAdmin reset in DB
    const checkConvInDb = await Conversation.findById(convA._id);
    assert(checkConvInDb?.unreadForAdmin === 0, 'unreadForAdmin reset to 0 after Admin view');

    // Test 13: Admin sends reply to Authority A
    const adminReplyRes = await request(`/messages/conversations/${convA._id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ message: 'Pooja timing has been approved and updated.' }),
    });
    assert(adminReplyRes.status === 201, 'Admin sends reply (201 Created)');
    assert(adminReplyRes.data?.data?.conversation?.unreadForAuthority === 1, 'unreadForAuthority incremented to 1');

    // Test 14: Authority A checks unread count -> 1
    const authAUnreadAfterAdminReply = await request('/messages/unread-count', {
      headers: { Authorization: `Bearer ${authAToken}` },
    });
    assert(authAUnreadAfterAdminReply.data?.data?.unreadCount === 1, 'Authority A sees 1 unread message');

    // Test 15: Authority A opens my-conversation -> marks read
    const authAOpenAgain = await request('/messages/my-conversation', {
      headers: { Authorization: `Bearer ${authAToken}` },
    });
    assert(authAOpenAgain.status === 200, 'Authority A opens conversation (200 OK)');
    const checkConvAgain = await Conversation.findById(convA._id);
    assert(checkConvAgain?.unreadForAuthority === 0, 'unreadForAuthority reset to 0 after Authority view');

    // --- 5. Testing Real-time Typing Indicators & Multi-Tenant Scoping (Socket.IO) ---
    console.log('\n--- 5. Testing Real-time Typing Indicators (Socket.IO) ---');
    const { io: ioClient } = await import('socket.io-client');

    // Test 16: Devotee cannot connect to messaging socket
    const devoteeSocket = ioClient(SOCKET_URL, {
      auth: { token: devoteeToken },
      transports: ['websocket'],
      autoConnect: false,
    });
    const devoteeAuthFailed = await new Promise<boolean>((resolve) => {
      devoteeSocket.on('connect_error', (err) => {
        resolve(err.message.includes('Unauthorized') || err.message.includes('Devotees not permitted'));
      });
      devoteeSocket.on('connect', () => resolve(false));
      devoteeSocket.connect();
    });
    assert(devoteeAuthFailed, 'Devotee blocked from messaging Socket.IO connection');
    devoteeSocket.disconnect();

    // Test 17: Admin & Authority A connect to Socket.IO
    const adminSocket = ioClient(SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });
    const authASocket = ioClient(SOCKET_URL, {
      auth: { token: authAToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => adminSocket.on('connect', resolve)),
      new Promise<void>((resolve) => authASocket.on('connect', resolve)),
    ]);
    assert(adminSocket.connected && authASocket.connected, 'Admin and Authority A connect successfully to Socket.IO');

    // Test 18: Join conversation room
    adminSocket.emit('conversation:join', convA._id.toString());
    authASocket.emit('conversation:join', convA._id.toString());
    await new Promise((r) => setTimeout(r, 100));

    // Test 19: Authority A emits typing:start -> Admin receives typing:start
    const typingStartPromise = new Promise<any>((resolve) => {
      adminSocket.once('typing:start', resolve);
    });
    authASocket.emit('typing:start', { conversationId: convA._id.toString() });
    const startPayload = await typingStartPromise;
    assert(startPayload?.conversationId === convA._id.toString(), 'Admin receives typing:start for Temple A');

    // Test 20: Authority A emits typing:stop -> Admin receives typing:stop
    const typingStopPromise = new Promise<any>((resolve) => {
      adminSocket.once('typing:stop', resolve);
    });
    authASocket.emit('typing:stop', { conversationId: convA._id.toString() });
    const stopPayload = await typingStopPromise;
    assert(stopPayload?.conversationId === convA._id.toString(), 'Admin receives typing:stop for Temple A');

    adminSocket.disconnect();
    authASocket.disconnect();

    console.log('\n=============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================');
  } finally {
    // Cleanup test artifacts
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (authorityUserA) await User.deleteOne({ _id: authorityUserA._id });
    if (authorityUserB) await User.deleteOne({ _id: authorityUserB._id });
    if (devoteeUser) await User.deleteOne({ _id: devoteeUser._id });
    if (templeA) {
      await Temple.deleteOne({ _id: templeA._id });
      await Conversation.deleteMany({ templeId: templeA._id });
    }
    if (templeB) {
      await Temple.deleteOne({ _id: templeB._id });
      await Conversation.deleteMany({ templeId: templeB._id });
    }
    try {
      if (io) io.close();
      await mongoose.disconnect();
    } catch (_) {}
    if (server) {
      server.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } else {
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
