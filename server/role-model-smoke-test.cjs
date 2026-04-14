const http = require('http');
const path = require('path');

async function run() {
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
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  function createClient() {
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

      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      if (isMutation && pathname !== '/auth/signin' && pathname !== '/auth/signup' && pathname !== '/auth/csrf' && jar.sf_csrf) {
        headers['X-CSRF-Token'] = jar.sf_csrf;
      }

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

    return { request };
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  const admin = createClient();
  const superUser = createClient();

  const adminLogin = await admin.request('POST', '/auth/signin', {
    email: 'admin@smartfarming.local',
    password: 'admin123',
  });
  assert(adminLogin.status === 200, `Admin login failed (${adminLogin.status})`);

  const superLogin = await superUser.request('POST', '/auth/signin', {
    email: 'super@smartfarming.local',
    password: 'super123',
  });
  assert(superLogin.status === 200, `Super user login failed (${superLogin.status})`);

  const superPending = await superUser.request('GET', '/doctors/pending');
  assert(superPending.status === 403, `Super user should not access /doctors/pending (${superPending.status})`);

  const adminPending = await admin.request('GET', '/doctors/pending');
  assert(adminPending.status === 200, `Admin should access /doctors/pending (${adminPending.status})`);

  const superPrice = await superUser.request('POST', '/prices', {
    crop: 'Test Crop',
    crop_bn: 'টেস্ট ফসল',
    price: 100,
    location: 'Dhaka',
    location_bn: 'ঢাকা',
  });
  assert(superPrice.status === 403, `Super user should not update prices (${superPrice.status})`);

  const usersRes = await admin.request('GET', '/users');
  assert(usersRes.status === 200, `Admin /users failed (${usersRes.status})`);

  const superTarget = (usersRes.json.users || []).find((u) => u.role === 'super_admin');
  if (superTarget) {
    const updateRes = await admin.request('PUT', `/users/${encodeURIComponent(superTarget.id)}`, {
      name: superTarget.name,
      role: 'super_admin',
    });
    assert(updateRes.status === 200, `Admin should manage super user account (${updateRes.status})`);
  }

  console.log('Role model smoke test passed');
  await new Promise((resolve) => server.close(resolve));
}

run().catch((error) => {
  console.error('Role model smoke test failed:', error?.message || error);
  process.exit(1);
});
