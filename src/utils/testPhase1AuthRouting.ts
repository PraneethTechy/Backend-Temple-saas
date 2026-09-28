import assert from 'assert';

const API_BASE = 'http://localhost:5000/api';

async function runVerification() {
  console.log('====================================================');
  console.log('  DevaSetu Phase 1: Authentication & RBAC Verification');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Role-based routing helper logic
  console.log('1. Testing Role-Based Default Route Logic...');
  const { getDefaultRouteForRole } = await import('../../../client/src/utils/authNavigation.js');

  test('DEVOTEE resolves to /dashboard', () => {
    const route = getDefaultRouteForRole({ role: 'DEVOTEE', mustChangePassword: false });
    assert.strictEqual(route, '/dashboard');
  });

  test('ADMIN resolves to /admin/dashboard', () => {
    const route = getDefaultRouteForRole({ role: 'ADMIN', mustChangePassword: false });
    assert.strictEqual(route, '/admin/dashboard');
  });

  test('TEMPLE_AUTHORITY with mustChangePassword=true resolves to /authority/settings', () => {
    const route = getDefaultRouteForRole({ role: 'TEMPLE_AUTHORITY', mustChangePassword: true });
    assert.strictEqual(route, '/authority/settings');
  });

  test('TEMPLE_AUTHORITY with mustChangePassword=false resolves to /authority/dashboard', () => {
    const route = getDefaultRouteForRole({ role: 'TEMPLE_AUTHORITY', mustChangePassword: false });
    assert.strictEqual(route, '/authority/dashboard');
  });

  test('Unauthenticated / null user resolves to /login', () => {
    assert.strictEqual(getDefaultRouteForRole(null), '/login');
    assert.strictEqual(getDefaultRouteForRole({}), '/login');
  });

  // 2. Real Backend Account Authentication
  console.log('\n2. Testing Real Backend Authentication for all 3 Roles...');

  // Devotee Login
  let devoteeCookie = '';
  await testAsync('Devotee (test1@gmail.com) logs in successfully', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test1@gmail.com', password: 'CCCpraneeth@123' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.role, 'DEVOTEE');
    assert.strictEqual(data.data.user.mustChangePassword, false);
    devoteeCookie = res.headers.get('set-cookie') || '';
  });

  // Devotee session persistence via /auth/me
  await testAsync('Devotee session restores via /auth/me', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { cookie: devoteeCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.user.role, 'DEVOTEE');
  });

  // Admin Login
  let adminCookie = '';
  await testAsync('Admin (superadmin@devasetu.org) logs in successfully', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@devasetu.org', password: 'CCCpraneeth@123' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.role, 'ADMIN');
    adminCookie = res.headers.get('set-cookie') || '';
  });

  // Admin session persistence via /auth/me
  await testAsync('Admin session restores via /auth/me', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { cookie: adminCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.user.role, 'ADMIN');
  });

  // Temple Authority (mustChangePassword = false) Login
  let authCookie = '';
  await testAsync('Authority (praneethg511@gmail.com) logs in with mustChangePassword=false', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'praneethg511@gmail.com', password: 'CCCpraneeth@123' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.role, 'TEMPLE_AUTHORITY');
    assert.strictEqual(data.data.user.mustChangePassword, false);
    authCookie = res.headers.get('set-cookie') || '';
  });

  // Temple Authority (mustChangePassword = true) Login
  let tempAuthCookie = '';
  await testAsync('Authority with temporary credentials (praneethg807@gmail.com) has mustChangePassword=true', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'praneethg807@gmail.com', password: 'CCCpraneeth@123' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.user.role, 'TEMPLE_AUTHORITY');
    assert.strictEqual(data.data.user.mustChangePassword, true);
    tempAuthCookie = res.headers.get('set-cookie') || '';
  });

  // 3. Testing Backend RBAC Enforcement (Security boundary)
  console.log('\n3. Testing Backend Role-Based Access Enforcement...');

  await testAsync('Devotee is blocked from /api/admin/dashboard (403 Forbidden)', async () => {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { cookie: devoteeCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await testAsync('Devotee is blocked from /api/authority/dashboard (403 Forbidden)', async () => {
    const res = await fetch(`${API_BASE}/authority/dashboard`, {
      headers: { cookie: devoteeCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await testAsync('Authority is blocked from /api/admin/dashboard (403 Forbidden)', async () => {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { cookie: authCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await testAsync('Unauthenticated request is rejected from /api/auth/me (401 Unauthorized)', async () => {
    const res = await fetch(`${API_BASE}/auth/me`);
    assert.strictEqual(res.status, 401);
  });

  // 4. Logout cookie clearance
  console.log('\n4. Testing Logout Cookie Clearance...');
  await testAsync('/api/auth/logout successfully clears authentication cookie', async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { cookie: devoteeCookie },
    });
    assert.strictEqual(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    assert(setCookie.includes('devasetu_token=;') || setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970'));
  });

  console.log('\n====================================================');
  console.log(`Results: ${passed}/${total} checks passed.`);
  console.log('====================================================\n');

  if (passed === total) {
    console.log('🎉 ALL PHASE 1 AUTHENTICATION & ROUTING SPECIFICATIONS VERIFIED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
