const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-actions-'));
  process.chdir(tempDir);

  process.env.AUTH_TOKEN_SECRET = 'ci_action_test_secret_2026';

  const localApiPath = path.resolve(__dirname, 'local-api.cjs');
  const { createLocalApiMiddleware } = require(localApiPath);
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

      const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
        && pathname !== '/auth/signin'
        && pathname !== '/auth/signup'
        && pathname !== '/auth/csrf';

      if (needsCsrf && jar.sf_csrf) {
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

    return { request, jar };
  }

  function assert(cond, message) {
    if (!cond) throw new Error(message);
  }

  const admin = createClient();
  const superUser = createClient();

  const signupDoctor = await admin.request('POST', '/auth/signup', {
    email: 'doctor.action@smartfarming.local',
    password: 'Strong!Pass123',
    name: 'Doctor Action',
    role: 'doctor',
    phone: '+8801700000000',
    specialty: 'Crop Health',
    registrationNumber: 'REG-TEST-001',
    certificateDocument: 'https://example.com/cert.pdf',
    resumeDocument: 'https://example.com/resume.pdf',
    termsAccepted: true,
    privacyAccepted: true,
  });
  assert(signupDoctor.status === 200, `Doctor signup failed (${signupDoctor.status})`);

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

  const usersRes = await admin.request('GET', '/users');
  assert(usersRes.status === 200, `Admin /users failed (${usersRes.status})`);
  const doctor = (usersRes.json.users || []).find((u) => u.email === 'doctor.action@smartfarming.local');
  assert(Boolean(doctor?.id), 'Failed to find created doctor account');

  const superVerifyTry = await superUser.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'verified',
    reason: 'super user attempt',
  });
  assert(superVerifyTry.status === 403, `Super user verify should be forbidden (${superVerifyTry.status})`);

  const rejectNoReason = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'rejected',
  });
  assert(rejectNoReason.status === 400, `Reject without reason should fail (${rejectNoReason.status})`);

  const rejectWithReason = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'rejected',
    reason: 'Missing qualification details',
  });
  assert(rejectWithReason.status === 200, `Reject with reason failed (${rejectWithReason.status})`);

  const verifyAfterRejected = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'verified',
    reason: 'Resubmitted and valid',
  });
  assert(verifyAfterRejected.status === 200, `Verify after rejected failed (${verifyAfterRejected.status})`);

  const suspendNoReason = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'suspended',
  });
  assert(suspendNoReason.status === 400, `Suspend without reason should fail (${suspendNoReason.status})`);

  const suspendWithReason = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'suspended',
    reason: 'Temporary compliance review',
  });
  assert(suspendWithReason.status === 200, `Suspend with reason failed (${suspendWithReason.status})`);

  const verifyAfterSuspended = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'verified',
    reason: 'Compliance cleared',
  });
  assert(verifyAfterSuspended.status === 200, `Verify after suspended failed (${verifyAfterSuspended.status})`);

  const rejectAfterVerified = await admin.request('POST', `/doctors/${encodeURIComponent(doctor.id)}/verify`, {
    status: 'rejected',
    reason: 'Policy violation detected',
  });
  assert(rejectAfterVerified.status === 200, `Reject after verified failed (${rejectAfterVerified.status})`);

  const auditLogs = await admin.request('GET', '/admin/audit-logs');
  assert(auditLogs.status === 200, `Audit logs fetch failed (${auditLogs.status})`);
  const doctorVerifyLogs = (auditLogs.json.logs || []).filter((log) => log?.action === 'doctors.verify' && log?.targetEmail === 'doctor.action@smartfarming.local');
  assert(doctorVerifyLogs.length >= 4, `Expected multiple doctor verify logs, found ${doctorVerifyLogs.length}`);

  const reasons = doctorVerifyLogs.map((log) => log?.metadata?.reason).filter(Boolean);
  assert(reasons.some((value) => String(value).includes('Policy violation detected')), 'Expected reject reason not found in logs');
  assert(reasons.some((value) => String(value).includes('Temporary compliance review')), 'Expected suspend reason not found in logs');

  await new Promise((resolve) => server.close(resolve));
  console.log('Action workflow test passed');
}

run().catch((error) => {
  console.error('Action workflow test failed:', error?.message || error);
  process.exitCode = 1;
});
