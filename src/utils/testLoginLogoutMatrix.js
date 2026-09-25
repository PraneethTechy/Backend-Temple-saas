import assert from 'assert';

const API_BASE = 'http://localhost:5000/api';

const ACCOUNTS = {
  DEVOTEE: {
    email: 'praneeth@gmail.com',
    password: 'CCCpraneeth@123',
    role: 'DEVOTEE',
    dashboard: '/dashboard',
  },
  ADMIN: {
    email: 'superadmin@devasetu.org',
    password: 'SecureAdminPassword2026!',
    role: 'ADMIN',
    dashboard: '/admin/dashboard',
  },
  AUTHORITY: {
    email: 'murugandham@gmail.com',
    password: 'Murugandham@1234',
    role: 'TEMPLE_AUTHORITY',
    dashboard: '/authority/dashboard',
  },
};

class SimulatedBrowserSession {
  constructor(name) {
    this.name = name;
    this.cookie = null;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (this.cookie) {
      headers.cookie = this.cookie;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle Set-Cookie header
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      if (setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970')) {
        this.cookie = null;
      } else {
        const match = setCookie.match(/devasetu_token=([^;]+)/);
        if (match) {
          this.cookie = `devasetu_token=${match[1]}`;
        }
      }
    }

    const json = await res.json().catch(() => null);
    return { status: res.status, data: json, rawRes: res };
  }

  async login(account) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('  DevaSetu Multi-Role Login / Logout Test Matrix');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
    }
  }

  // TEST A: Login DEVOTEE -> Logout -> Login ADMIN
  await test('TEST A: DEVOTEE -> Logout -> ADMIN succeeds', async () => {
    const browser = new SimulatedBrowserSession('Session A');
    // 1. Login Devotee
    const r1 = await browser.login(ACCOUNTS.DEVOTEE);
    assert.strictEqual(r1.status, 200, 'Devotee login status 200');
    assert.strictEqual(r1.data.data.user.role, 'DEVOTEE');
    assert.ok(browser.cookie, 'Session cookie exists after Devotee login');

    // 2. Logout
    const r2 = await browser.logout();
    assert.strictEqual(r2.status, 200, 'Logout status 200');
    assert.strictEqual(browser.cookie, null, 'Cookie cleared after logout');

    // Verify /auth/me returns 401
    const r3 = await browser.getMe();
    assert.strictEqual(r3.status, 401, '/auth/me returns 401 after logout');

    // 3. Login Admin
    const r4 = await browser.login(ACCOUNTS.ADMIN);
    assert.strictEqual(r4.status, 200, 'Admin login status 200');
    assert.strictEqual(r4.data.data.user.role, 'ADMIN');
    assert.ok(browser.cookie, 'Session cookie exists after Admin login');

    // Verify /auth/me returns Admin
    const r5 = await browser.getMe();
    assert.strictEqual(r5.status, 200, '/auth/me returns 200');
    assert.strictEqual(r5.data.data.user.role, 'ADMIN', 'Role is strictly ADMIN');
  });

  // TEST B: Login ADMIN -> Logout -> Login DEVOTEE
  await test('TEST B: ADMIN -> Logout -> DEVOTEE succeeds', async () => {
    const browser = new SimulatedBrowserSession('Session B');
    const r1 = await browser.login(ACCOUNTS.ADMIN);
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.data.data.user.role, 'ADMIN');

    const r2 = await browser.logout();
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(browser.cookie, null);

    const r3 = await browser.login(ACCOUNTS.DEVOTEE);
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.data.data.user.role, 'DEVOTEE');

    const r4 = await browser.getMe();
    assert.strictEqual(r4.status, 200);
    assert.strictEqual(r4.data.data.user.role, 'DEVOTEE');
  });

  // TEST C: Login ADMIN -> Logout -> Login TEMPLE_AUTHORITY
  await test('TEST C: ADMIN -> Logout -> TEMPLE_AUTHORITY succeeds', async () => {
    const browser = new SimulatedBrowserSession('Session C');
    const r1 = await browser.login(ACCOUNTS.ADMIN);
    assert.strictEqual(r1.status, 200);

    const r2 = await browser.logout();
    assert.strictEqual(r2.status, 200);

    const r3 = await browser.login(ACCOUNTS.AUTHORITY);
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.data.data.user.role, 'TEMPLE_AUTHORITY');

    const r4 = await browser.getMe();
    assert.strictEqual(r4.status, 200);
    assert.strictEqual(r4.data.data.user.role, 'TEMPLE_AUTHORITY');
  });

  // TEST D: Login TEMPLE_AUTHORITY -> Logout -> Login ADMIN
  await test('TEST D: TEMPLE_AUTHORITY -> Logout -> ADMIN succeeds', async () => {
    const browser = new SimulatedBrowserSession('Session D');
    const r1 = await browser.login(ACCOUNTS.AUTHORITY);
    assert.strictEqual(r1.status, 200);

    const r2 = await browser.logout();
    assert.strictEqual(r2.status, 200);

    const r3 = await browser.login(ACCOUNTS.ADMIN);
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.data.data.user.role, 'ADMIN');

    const r4 = await browser.getMe();
    assert.strictEqual(r4.status, 200);
    assert.strictEqual(r4.data.data.user.role, 'ADMIN');
  });

  // TEST E: Login A -> Logout -> immediately Login B
  await test('TEST E: Rapid Login A -> Logout -> Login B succeeds without race condition', async () => {
    const browser = new SimulatedBrowserSession('Session E');
    const r1 = await browser.login(ACCOUNTS.DEVOTEE);
    assert.strictEqual(r1.status, 200);

    // Logout and immediate login
    await browser.logout();
    const r2 = await browser.login(ACCOUNTS.ADMIN);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.data.data.user.role, 'ADMIN');

    const me = await browser.getMe();
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.data.data.user.role, 'ADMIN');
  });

  // TEST F: Login A -> Refresh -> Logout -> Refresh -> Login B
  await test('TEST F: Login A -> Refresh (/auth/me) -> Logout -> Refresh (/auth/me) -> Login B', async () => {
    const browser = new SimulatedBrowserSession('Session F');
    const r1 = await browser.login(ACCOUNTS.ADMIN);
    assert.strictEqual(r1.status, 200);

    // Refresh simulation: /auth/me returns Admin
    const ref1 = await browser.getMe();
    assert.strictEqual(ref1.status, 200);
    assert.strictEqual(ref1.data.data.user.role, 'ADMIN');

    // Logout
    await browser.logout();

    // Refresh simulation after logout: /auth/me returns 401
    const ref2 = await browser.getMe();
    assert.strictEqual(ref2.status, 401, '/auth/me returns 401');

    // Login Devotee
    const r2 = await browser.login(ACCOUNTS.DEVOTEE);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.data.data.user.role, 'DEVOTEE');

    const ref3 = await browser.getMe();
    assert.strictEqual(ref3.status, 200);
    assert.strictEqual(ref3.data.data.user.role, 'DEVOTEE');
  });

  // TEST G: Login A -> Logout -> Protected route access rejected
  await test('TEST G: Login A -> Logout -> Accessing protected route is rejected with 401', async () => {
    const browser = new SimulatedBrowserSession('Session G');
    await browser.login(ACCOUNTS.ADMIN);

    // Access admin dashboard while logged in
    const authReq = await browser.request('/admin/dashboard');
    assert.strictEqual(authReq.status, 200, 'Admin can access /admin/dashboard');

    // Logout
    await browser.logout();

    // Access admin dashboard after logout
    const unauthReq = await browser.request('/admin/dashboard');
    assert.strictEqual(unauthReq.status, 401, 'Unauthenticated request rejected with 401');
  });

  console.log('\n====================================================');
  console.log(`Results: ${passed}/${total} test matrices passed.`);
  console.log('====================================================\n');

  if (passed === total) {
    console.log('🎉 ALL LOGIN / LOGOUT / RBAC LIFECYCLE MATRICES PASSED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
