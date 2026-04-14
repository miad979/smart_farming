const http = require('http');
const path = require('path');

async function run() {
  process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'local_admin_smoke_secret_2026';

  const { createLocalApiMiddleware } = require(path.resolve(__dirname, 'local-api.cjs'));
  const middleware = createLocalApiMiddleware();

  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const jar = {};

  function ingestSetCookie(headerValue) {
    if (!headerValue) return;
    const chunks = Array.isArray(headerValue)
      ? headerValue
      : String(headerValue).split(/,(?=\s*[A-Za-z0-9_\-]+=)/g);

    for (const item of chunks) {
      const first = item.split(';')[0] || '';
      const idx = first.indexOf('=');
      if (idx === -1) continue;
      const name = first.slice(0, idx).trim();
      const value = first.slice(idx + 1).trim();
      jar[name] = decodeURIComponent(value);
    }
  }

  function cookieHeader() {
    return Object.entries(jar)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');
  }

  async function request(method, pathname, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const cookie = cookieHeader();
    if (cookie) headers.Cookie = cookie;

    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${base}${pathname}`, {
      method,
      headers,
      body: payload,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) ingestSetCookie(setCookie);

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    return { status: response.status, json };
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  const login = await request('POST', '/auth/signin', {
    email: 'admin@smartfarming.local',
    password: 'admin123',
  });
  assert(login.status === 200, `Admin signin failed (${login.status})`);

  const me = await request('GET', '/auth/me');
  assert(me.status === 200, `/auth/me failed (${me.status})`);
  assert(me.json?.user?.role === 'admin' || me.json?.user?.role === 'super_admin', 'Signed in user is not admin/super_admin');

  const usersRes = await request('GET', '/users');
  assert(usersRes.status === 200, `/users failed (${usersRes.status})`);
  const users = Array.isArray(usersRes.json?.users) ? usersRes.json.users : [];
  assert(users.length > 0, 'Users list is empty');

  const roleCounts = users.reduce((acc, user) => {
    const role = user?.role || 'unknown';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const pendingRes = await request('GET', '/doctors/pending');
  assert(pendingRes.status === 200, `/doctors/pending failed (${pendingRes.status})`);

  console.log('Admin panel smoke test passed');
  console.log('Users count:', users.length);
  console.log('Role counts:', JSON.stringify(roleCounts));
  console.log('Pending doctors:', Array.isArray(pendingRes.json?.doctors) ? pendingRes.json.doctors.length : 0);

  await new Promise((resolve) => server.close(resolve));
}

run().catch((error) => {
  console.error('Admin panel smoke test failed:', error?.message || error);
  process.exit(1);
});
