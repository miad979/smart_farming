// End-to-end check of the farmer <-> doctor consultation flow against an isolated temp database.
// Run: npm run test:consultations
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-consult-'));
  process.chdir(tempDir);
  process.env.AUTH_TOKEN_SECRET = 'ci_consultation_test_secret_2026';

  const { createLocalApiMiddleware } = require(path.resolve(__dirname, 'local-api.cjs'));
  const middleware = createLocalApiMiddleware();
  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const openStreams = [];

  function createClient() {
    const jar = {};
    let token = null;

    const ingest = (headerValue) => {
      if (!headerValue) return;
      for (const item of String(headerValue).split(/,(?=\s*[A-Za-z0-9_\-]+=)/g)) {
        const first = item.split(';')[0] || '';
        const idx = first.indexOf('=');
        if (idx === -1) continue;
        jar[first.slice(0, idx).trim()] = decodeURIComponent(first.slice(idx + 1).trim());
      }
    };

    async function request(method, pathname, body) {
      const headers = {};
      const cookie = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
      if (cookie) headers.Cookie = cookie;
      if (token) headers.Authorization = `Bearer ${token}`;
      if (method !== 'GET' && jar.sf_csrf) headers['X-CSRF-Token'] = jar.sf_csrf;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${base}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      ingest(response.headers.get('set-cookie'));
      const text = await response.text();
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
      if (json.accessToken) token = json.accessToken;
      return { status: response.status, json };
    }

    // Collect SSE events for this user.
    async function listen() {
      const events = [];
      const controller = new AbortController();
      const response = await fetch(`${base}/realtime/stream?token=${encodeURIComponent(token)}`, { signal: controller.signal });
      openStreams.push(controller);
      (async () => {
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          for await (const chunk of response.body) {
            buffer += decoder.decode(chunk, { stream: true });
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
              const line = buffer.slice(0, idx).replace(/^data: /, '');
              buffer = buffer.slice(idx + 2);
              try { events.push(JSON.parse(line)); } catch { /* ignore */ }
            }
          }
        } catch { /* aborted */ }
      })();
      return events;
    }

    return { request, listen };
  }

  const assert = (cond, message) => { if (!cond) throw new Error(message); };
  const results = [];
  const step = async (name, fn) => {
    await fn();
    results.push(name);
    console.log(`  ✓ ${name}`);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const signupFarmer = async (client, email, name) => {
    const r = await client.request('POST', '/auth/signup', {
      email, password: 'Strong!Pass123', name, role: 'farmer', phone: '+8801711111111', location: 'Bogura',
      termsAccepted: true, privacyAccepted: true,
    });
    assert(r.status === 200, `Farmer signup failed (${r.status} ${r.json.error})`);
    await client.request('GET', '/auth/csrf');
    return r.json.user;
  };

  const admin = createClient();
  const farmer = createClient();
  const otherFarmer = createClient();
  const doctorA = createClient();
  const doctorB = createClient();

  const doctorIds = {};
  await step('admin signs in and verifies two doctors', async () => {
    for (const [email, name] of [['doc.a@smartfarming.local', 'Dr. Alpha'], ['doc.b@smartfarming.local', 'Dr. Beta']]) {
      const r = await admin.request('POST', '/auth/signup', {
        email, password: 'Strong!Pass123', name, role: 'doctor', phone: '+8801700000001', specialty: 'Plant Pathology',
        registrationNumber: `REG-${name}`, certificateDocument: 'https://example.com/c.pdf', resumeDocument: 'https://example.com/r.pdf',
        termsAccepted: true, privacyAccepted: true,
      });
      assert(r.status === 200, `Doctor signup failed (${r.status})`);
      doctorIds[email] = r.json.user.id;
    }
    const login = await admin.request('POST', '/auth/signin', { email: 'admin@smartfarming.local', password: 'admin123' });
    assert(login.status === 200, `Admin login failed (${login.status})`);
    await admin.request('GET', '/auth/csrf');
    for (const doctorId of Object.values(doctorIds)) {
      const v = await admin.request('POST', `/doctors/${doctorId}/verify`, { status: 'verified' });
      assert(v.status === 200, `Verify failed (${v.status} ${v.json.error})`);
    }
    for (const [client, email] of [[doctorA, 'doc.a@smartfarming.local'], [doctorB, 'doc.b@smartfarming.local']]) {
      const l = await client.request('POST', '/auth/signin', { email, password: 'Strong!Pass123' });
      assert(l.status === 200, `Doctor login failed (${l.status} ${l.json.error})`);
      await client.request('GET', '/auth/csrf');
    }
  });

  const farmerUser = await signupFarmer(farmer, 'farmer.one@smartfarming.local', 'Rahim');
  await signupFarmer(otherFarmer, 'farmer.two@smartfarming.local', 'Karim');

  const farmerEvents = await farmer.listen();
  const otherFarmerEvents = await otherFarmer.listen();
  const doctorAEvents = await doctorA.listen();
  const doctorBEvents = await doctorB.listen();
  await wait(100);

  let consultation;
  await step('farmer sees verified experts and requests one by id', async () => {
    const experts = await farmer.request('GET', '/experts');
    assert(experts.json.experts.some((e) => e.id === doctorIds['doc.a@smartfarming.local']), 'Doctor A missing from experts');
    const r = await farmer.request('POST', '/consultations', {
      crop: 'Rice', disease: 'Leaf Blast', description: 'Brown spots on leaves', expertId: doctorIds['doc.a@smartfarming.local'], mode: 'chat',
      images: ['data:image/png;base64,iVBORw0KGgo=', 'javascript:alert(1)'],
    });
    assert(r.status === 200, `Create failed (${r.status} ${r.json.error})`);
    consultation = r.json.consultation;
    assert(consultation.requestedDoctorId === doctorIds['doc.a@smartfarming.local'], 'Requested doctor not stored');
    assert(consultation.images.length === 1, 'Unsafe image URL was not filtered');
  });

  await step('requested doctor sees it; other doctor and other farmer do not', async () => {
    const a = await doctorA.request('GET', '/consultations');
    const b = await doctorB.request('GET', '/consultations');
    const f2 = await otherFarmer.request('GET', '/consultations');
    assert(a.json.consultations.some((c) => c.id === consultation.id), 'Doctor A cannot see requested case');
    assert(!b.json.consultations.some((c) => c.id === consultation.id), 'Doctor B can see a case requested from Doctor A');
    assert(f2.json.consultations.length === 0, 'Other farmer can see consultations');
    await wait(150);
    assert(doctorAEvents.some((e) => e.channel === 'consultations:all' && e.data?.action === 'new'), 'Doctor A got no realtime "new" event');
    assert(!doctorBEvents.some((e) => String(e.channel).startsWith('consultations')), 'Doctor B received a consultation event');
    assert(!otherFarmerEvents.some((e) => String(e.channel).startsWith('consultations')), 'Other farmer received a consultation event (data leak)');
  });

  await step('access control: other doctor, farmers and protected fields', async () => {
    const steal = await doctorB.request('PUT', `/consultations/${consultation.id}`, { status: 'in-progress' });
    assert(steal.status === 404, `Doctor B should not manage Doctor A's case (${steal.status})`);
    const farmerPut = await farmer.request('PUT', `/consultations/${consultation.id}`, { status: 'completed' });
    assert(farmerPut.status === 403, `Farmer should not update via PUT (${farmerPut.status})`);
    const strangerMsg = await otherFarmer.request('POST', `/consultations/${consultation.id}/messages`, { text: 'hi' });
    assert(strangerMsg.status === 404, `Other farmer should not post messages (${strangerMsg.status})`);
    const earlyRate = await farmer.request('POST', `/consultations/${consultation.id}/rating`, { rating: 5 });
    assert(earlyRate.status === 409, `Rating before completion should fail (${earlyRate.status})`);
  });

  await step('farmer adds detail, doctor accepts and chats', async () => {
    const m1 = await farmer.request('POST', `/consultations/${consultation.id}/messages`, { text: 'It started 3 days ago.' });
    assert(m1.status === 200, `Farmer message failed (${m1.status} ${m1.json.error})`);
    const accept = await doctorA.request('PUT', `/consultations/${consultation.id}`, { status: 'in-progress', farmerId: 'hijack', farmerName: 'X' });
    assert(accept.status === 200, `Accept failed (${accept.status} ${accept.json.error})`);
    assert(accept.json.consultation.status === 'in-progress', 'Status not in-progress');
    assert(accept.json.consultation.farmerId === farmerUser.id && accept.json.consultation.farmerName === 'Rahim', 'Doctor overwrote farmer fields');
    const m2 = await doctorA.request('POST', `/consultations/${consultation.id}/messages`, { text: 'Please share a closer photo.' });
    assert(m2.status === 200 && m2.json.consultation.messages.length === 2, 'Doctor message failed');
    await wait(150);
    assert(farmerEvents.some((e) => e.data?.consultation?.messages?.some((m) => m.senderRole === 'doctor')), 'Farmer got no realtime doctor message');
  });

  await step('doctor cannot complete without advice, then completes with advice', async () => {
    const noAdvice = await doctorA.request('PUT', `/consultations/${consultation.id}`, { status: 'completed' });
    assert(noAdvice.status === 400, `Completing without advice should fail (${noAdvice.status})`);
    const done = await doctorA.request('PUT', `/consultations/${consultation.id}`, { response: 'Spray tricyclazole 0.6 g/L.', status: 'completed' });
    assert(done.status === 200, `Complete failed (${done.status} ${done.json.error})`);
    const c = done.json.consultation;
    assert(c.status === 'completed' && c.doctorResponse === 'Spray tricyclazole 0.6 g/L.' && c.responseTime, 'Advice/response time not stored');
    const late = await farmer.request('POST', `/consultations/${consultation.id}/messages`, { text: 'thanks' });
    assert(late.status === 409, `Messaging a closed case should fail (${late.status})`);
  });

  await step('farmer sees advice and rates the doctor', async () => {
    const list = await farmer.request('GET', '/consultations');
    const c = list.json.consultations.find((x) => x.id === consultation.id);
    assert(c?.doctorResponse && c.doctorName === 'Dr. Alpha', 'Farmer cannot see the advice');
    const bad = await farmer.request('POST', `/consultations/${consultation.id}/rating`, { rating: 9 });
    assert(bad.status === 400, `Invalid rating should fail (${bad.status})`);
    const ok = await farmer.request('POST', `/consultations/${consultation.id}/rating`, { rating: 5, feedback: 'Worked!' });
    assert(ok.status === 200 && ok.json.consultation.rating === 5, 'Rating failed');
  });

  await step('open request: first doctor to reply claims it and it leaves the other queue', async () => {
    const r = await farmer.request('POST', '/consultations', { crop: 'Potato', disease: 'Late Blight', description: 'Help', mode: 'call' });
    const openCase = r.json.consultation;
    const b = await doctorB.request('GET', '/consultations');
    assert(b.json.consultations.some((c) => c.id === openCase.id), 'Open case not visible to Doctor B');
    const claim = await doctorB.request('POST', `/consultations/${openCase.id}/messages`, { text: 'Calling you now.' });
    assert(claim.status === 200 && claim.json.consultation.doctorId === doctorIds['doc.b@smartfarming.local'], 'Doctor B could not claim');
    const a = await doctorA.request('GET', '/consultations');
    assert(!a.json.consultations.some((c) => c.id === openCase.id), 'Claimed case still visible to Doctor A');
    await wait(150);
    assert(doctorAEvents.some((e) => e.data?.action === 'delete' && e.data.consultationId === openCase.id), 'Doctor A not told to drop claimed case');
  });

  await step('admin returns an accepted case to the queue and it is released', async () => {
    const r = await farmer.request('POST', '/consultations', { crop: 'Jute', disease: 'Stem Rot', description: 'Help' });
    const c = r.json.consultation;
    const accept = await doctorA.request('PUT', `/consultations/${c.id}`, { status: 'in-progress' });
    assert(accept.status === 200, `Accept failed (${accept.status})`);
    const requeue = await admin.request('PUT', `/consultations/${c.id}`, { status: 'pending', adminNote: 'Reassign' });
    assert(requeue.status === 200 && requeue.json.consultation.doctorId === null, 'Admin requeue did not release the doctor');
    const b = await doctorB.request('GET', '/consultations');
    assert(b.json.consultations.some((x) => x.id === c.id), 'Requeued case not visible to other doctors');
    const badStatus = await admin.request('PUT', `/consultations/${c.id}`, { status: 'closed' });
    assert(badStatus.status === 400, `Invalid status should be rejected (${badStatus.status})`);
  });

  await step('admin activity endpoint counts real consultations per day; farmers are refused', async () => {
    const r = await admin.request('GET', '/admin/activity?tzOffset=0');
    assert(r.status === 200 && Array.isArray(r.json.days) && r.json.days.length === 7, `Activity failed (${r.status})`);
    const today = r.json.days[6];
    assert(today.consultations >= 3, `Expected today's consultations to be counted (got ${today.consultations})`);
    const denied = await farmer.request('GET', '/admin/activity');
    assert(denied.status === 403, `Farmer should be refused (${denied.status})`);
  });

  await step('unknown API routes return a JSON 404 instead of the app page', async () => {
    const r = await farmer.request('GET', '/does-not-exist');
    assert(r.status === 404 && typeof r.json.error === 'string', `Expected JSON 404 (${r.status})`);
  });

  await step('change password: validation, success, and sign-in with the new password', async () => {
    const wrong = await farmer.request('POST', '/auth/change-password', { currentPassword: 'nope', newPassword: 'Another!Pass456' });
    assert(wrong.status === 400, `Wrong current password should fail (${wrong.status})`);
    const weak = await farmer.request('POST', '/auth/change-password', { currentPassword: 'Strong!Pass123', newPassword: 'short' });
    assert(weak.status === 400, `Weak password should fail (${weak.status})`);
    const ok = await farmer.request('POST', '/auth/change-password', { currentPassword: 'Strong!Pass123', newPassword: 'Another!Pass456' });
    assert(ok.status === 200, `Change password failed (${ok.status} ${ok.json.error})`);
    const fresh = createClient();
    const oldLogin = await fresh.request('POST', '/auth/signin', { email: 'farmer.one@smartfarming.local', password: 'Strong!Pass123' });
    assert(oldLogin.status === 401, `Old password still works (${oldLogin.status})`);
    const newLogin = await fresh.request('POST', '/auth/signin', { email: 'farmer.one@smartfarming.local', password: 'Another!Pass456' });
    assert(newLogin.status === 200, `New password does not work (${newLogin.status})`);
  });

  await step('doctor receives a live alert when an admin decides their verification', async () => {
    const doctorC = createClient();
    const s = await doctorC.request('POST', '/auth/signup', {
      email: 'doc.c@smartfarming.local', password: 'Strong!Pass123', name: 'Dr. Gamma', role: 'doctor', phone: '+8801700000003',
      specialty: 'Soil', registrationNumber: 'REG-C', certificateDocument: 'https://example.com/c.pdf', resumeDocument: 'https://example.com/r.pdf',
      termsAccepted: true, privacyAccepted: true,
    });
    const doctorCId = s.json.user.id;
    const login = await doctorC.request('POST', '/auth/signin', { email: 'doc.c@smartfarming.local', password: 'Strong!Pass123' });
    assert(login.status === 200, `Pending doctor sign-in failed (${login.status})`);
    const events = await doctorC.listen();
    await wait(100);
    const v = await admin.request('POST', `/doctors/${doctorCId}/verify`, { status: 'verified' });
    assert(v.status === 200, `Verify failed (${v.status})`);
    await wait(150);
    assert(events.some((e) => e.channel === `alerts:${doctorCId}` && e.data?.alert?.type === 'verification'), 'No live verification alert');
  });

  await step('admins get a live alert when a doctor applies (no page reload needed)', async () => {
    const adminEvents = await admin.listen();
    await wait(100);
    const applicant = createClient();
    const s = await applicant.request('POST', '/auth/signup', {
      email: 'doc.e@smartfarming.local', password: 'Strong!Pass123', name: 'Dr. Epsilon', role: 'doctor', phone: '+8801700000005',
      specialty: 'Entomology', registrationNumber: 'REG-E', certificateDocument: 'https://example.com/c.pdf', resumeDocument: 'https://example.com/r.pdf',
      termsAccepted: true, privacyAccepted: true,
    });
    assert(s.status === 200, `Doctor application failed (${s.status})`);
    await wait(150);
    assert(adminEvents.some((e) => String(e.channel).startsWith('alerts:') && e.data?.alert?.type === 'doctor_application' && /Dr\. Epsilon/.test(e.data.alert.message)), 'Admin got no live doctor-application alert');
    const pending = await admin.request('GET', '/doctors/pending');
    assert(pending.json.doctors.some((d) => d.email === 'doc.e@smartfarming.local' && d.specialty === 'Entomology'), 'Application missing from pending list');
  });

  await step('uploaded documents: attached ones are protected, unattached drafts can be removed', async () => {
    const anon = createClient();
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const up1 = await anon.request('POST', '/uploads/documents', { fileName: 'cert.png', base64Data: png, contentType: 'image/png' });
    assert(up1.status === 200, `Upload failed (${up1.status} ${up1.json.error})`);
    const up2 = await anon.request('POST', '/uploads/documents', { fileName: 'draft.png', base64Data: `${png.slice(0, -4)}AAAA`, contentType: 'image/png' });
    assert(up2.status === 200, `Second upload failed (${up2.status} ${up2.json.error})`);
    const s = await anon.request('POST', '/auth/signup', {
      email: 'doc.d@smartfarming.local', password: 'Strong!Pass123', name: 'Dr. Delta', role: 'doctor', phone: '+8801700000004',
      specialty: 'Soil', registrationNumber: 'REG-D', certificateDocument: up1.json.file.url, resumeDocument: 'https://example.com/r.pdf',
      termsAccepted: true, privacyAccepted: true,
    });
    assert(s.status === 200, `Doctor signup failed (${s.status})`);
    const stranger = createClient();
    const blocked = await stranger.request('DELETE', `/uploads/documents/${up1.json.file.id}`);
    assert(blocked.status === 403, `Anonymous delete of an attached certificate should be blocked (${blocked.status})`);
    const draft = await stranger.request('DELETE', `/uploads/documents/${up2.json.file.id}`);
    assert(draft.status === 200, `Unattached draft should be removable (${draft.status})`);
    const byAdmin = await admin.request('DELETE', `/uploads/documents/${up1.json.file.id}`);
    assert(byAdmin.status === 200, `Admin should be able to remove a document (${byAdmin.status})`);
  });

  openStreams.forEach((c) => c.abort());
  server.close();
  console.log(`\nConsultation workflow: ${results.length} checks passed`);
  process.exit(0);
}

run().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
