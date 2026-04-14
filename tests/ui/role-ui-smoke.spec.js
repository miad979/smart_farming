import { test, expect, request as playwrightRequest } from '@playwright/test';

const APP_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:5176';
const APP_ORIGIN = new URL(APP_BASE_URL).origin;
const API_BASE_URL = `${APP_BASE_URL}/api/`;
const QA_PASSWORD = 'Strong!Pass123';

function authHeaders(token, csrfToken) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return headers;
}

async function unwrapJson(response, label) {
  const bodyText = await response.text();
  let body = {};

  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }

  if (!response.ok()) {
    const message = body.error || body.message || bodyText || 'Unknown error';
    throw new Error(`${label} failed (${response.status()}): ${message}`);
  }

  return body;
}

async function signIn(api, email, password) {
  const response = await api.post('auth/signin', {
    headers: authHeaders(),
    data: { email, password },
  });

  return unwrapJson(response, `Sign in (${email})`);
}

async function signUp(api, payload) {
  const response = await api.post('auth/signup', {
    headers: authHeaders(),
    data: payload,
  });

  return unwrapJson(response, `Sign up (${payload.email})`);
}

async function ensureCsrf(api) {
  const response = await api.get('auth/csrf', {
    headers: authHeaders(),
  });

  const payload = await unwrapJson(response, 'CSRF bootstrap');
  if (!payload.csrfToken) {
    throw new Error('CSRF bootstrap succeeded but csrfToken is missing');
  }
  return payload.csrfToken;
}

async function verifyDoctor(api, adminToken, csrfToken, doctorId) {
  const response = await api.post(`doctors/${encodeURIComponent(doctorId)}/verify`, {
    headers: authHeaders(adminToken, csrfToken),
    data: { status: 'verified' },
  });

  return unwrapJson(response, `Verify doctor (${doctorId})`);
}

async function deleteUser(api, adminToken, csrfToken, userId) {
  const response = await api.delete(`users/${encodeURIComponent(userId)}`, {
    headers: authHeaders(adminToken, csrfToken),
  });

  if (response.ok()) return;
  const body = await response.text();
  throw new Error(`Delete user (${userId}) failed (${response.status()}): ${body}`);
}

function normalizeUserForStorage(user) {
  return {
    name: user?.name || 'User',
    language: 'en',
    favorites: [],
    consent_flags: true,
    role: user?.role || 'farmer',
    ...user,
  };
}

function buildStorageState(session) {
  const user = normalizeUserForStorage(session.user);

  return {
    cookies: [],
    origins: [
      {
        origin: APP_ORIGIN,
        localStorage: [
          { name: 'smart-farming-language', value: JSON.stringify('en') },
          { name: 'smart-farming-user-mode', value: JSON.stringify('logged-in') },
          { name: 'smart-farming-user-data', value: JSON.stringify(user) },
          { name: 'smart-farming-access-token', value: JSON.stringify(session.accessToken) },
          { name: 'smart-farming-theme', value: JSON.stringify('light') },
          { name: 'smart-farming-settings', value: JSON.stringify({
            notifications: {
              disease: true,
              irrigation: true,
              price: true,
              weather: true,
            },
            voiceSpeed: 1,
            theme: 'light',
          }) },
        ],
      },
    ],
  };
}

async function newRoleContext(browser, session, extraOptions = {}) {
  return browser.newContext({
    storageState: buildStorageState(session),
    viewport: { width: 1366, height: 900 },
    ...extraOptions,
  });
}

test.describe.serial('Role-based UI smoke checks', () => {
  test.setTimeout(180000);

  const createdUserIds = [];
  let adminSession;
  let farmerSession;
  let doctorSession;

  test.beforeAll(async () => {
    const api = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });

    const seed = Date.now();
    const farmerEmail = `ui.farmer.${seed}@smartfarming.local`;
    const doctorEmail = `ui.doctor.${seed}@smartfarming.local`;

    adminSession = await signIn(api, 'admin@smartfarming.local', 'admin123');

    const farmerSignup = await signUp(api, {
      email: farmerEmail,
      password: QA_PASSWORD,
      name: 'UI Farmer',
      role: 'farmer',
      location: 'Dhaka',
      termsAccepted: true,
      privacyAccepted: true,
    });
    createdUserIds.push(farmerSignup.user.id);

    const doctorSignup = await signUp(api, {
      email: doctorEmail,
      password: QA_PASSWORD,
      name: 'UI Doctor',
      role: 'doctor',
      phone: '+8801700000999',
      location: 'Dhaka',
      specialty: 'Plant Pathology',
      registrationNumber: `REG-UI-${seed}`,
      certificateDocument: 'https://example.com/ui-cert.pdf',
      resumeDocument: 'https://example.com/ui-resume.pdf',
      experienceYears: 5,
      profileSummary: 'UI smoke test doctor account',
      termsAccepted: true,
      privacyAccepted: true,
    });
    createdUserIds.push(doctorSignup.user.id);

    const csrfToken = await ensureCsrf(api);
    await verifyDoctor(api, adminSession.accessToken, csrfToken, doctorSignup.user.id);

    farmerSession = await signIn(api, farmerEmail, QA_PASSWORD);
    doctorSession = await signIn(api, doctorEmail, QA_PASSWORD);

    await api.dispose();
  });

  test.afterAll(async () => {
    if (!adminSession?.accessToken || createdUserIds.length === 0) return;

    const api = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });

    try {
      const csrfToken = await ensureCsrf(api);
      for (const userId of createdUserIds) {
        await deleteUser(api, adminSession.accessToken, csrfToken, userId);
      }
    } finally {
      await api.dispose();
    }
  });

  test('farmer can use dashboard, disease, and irrigation routes', async ({ browser }) => {
    const context = await newRoleContext(browser, farmerSession);
    const page = await context.newPage();

    await page.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

    await page.goto(`${APP_BASE_URL}/detect`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Detect Disease', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue With Demo Report' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue With Demo Report' }).click();
    await expect(page.getByRole('button', { name: 'New Scan' })).toBeVisible();

    await page.goto(`${APP_BASE_URL}/irrigation`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Irrigation', exact: true })).toBeVisible();
    await expect(page.getByText('Last updated')).toBeVisible();
    const autoModeToggle = page.getByTestId('auto-mode-toggle-btn');
    await expect(autoModeToggle).toBeVisible();
    await expect(page.getByTestId('auto-mode-status-pill')).toBeVisible();
    await autoModeToggle.click();
    await expect(page.getByTestId('auto-mode-status-pill')).toHaveCount(0, { timeout: 15000 });
    await expect(autoModeToggle).toBeEnabled({ timeout: 15000 });
    await autoModeToggle.click();
    await expect(page.getByTestId('auto-mode-status-pill')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('pump-visual-stage')).toBeVisible();
    await expect(page.getByTestId('pump-pipe-fill-overlay')).toBeVisible();
    await expect(page.getByTestId('pump-water-given-live')).toBeVisible();
    await expect(page.getByTestId('pump-water-given-total')).toBeVisible();
    await expect(page.getByTestId('alarm-trigger-label')).toBeVisible();
    await expect(page.getByTestId('device-helpline-call-btn')).toBeVisible();
    await expect(page.getByTestId('manual-water-amount-input')).toBeVisible();
    await page.getByTestId('manual-water-amount-input').fill('30');
    await page.getByTestId('manual-water-now-btn').click();
    await expect(page.getByTestId('manual-water-last-amount')).toContainText('30L', { timeout: 15000 });
    await expect(page.getByTestId('manual-water-stop-btn')).toBeVisible();
    await page.getByTestId('manual-water-stop-btn').click();
    await expect(page.getByTestId('manual-water-latest-result')).toContainText(/stopped|OFF/i, { timeout: 15000 });
    await page.getByRole('button', { name: 'Irrigation Policy' }).click();
    await expect(page.getByTestId('policy-land-area-input')).toBeVisible();
    await expect(page.getByTestId('alarm-tick-threshold-select')).toBeVisible();

    await context.close();
  });

  test('farmer refresh and route switches keep weather and irrigation responsive', async ({ browser }) => {
    const context = await newRoleContext(browser, farmerSession);
    const page = await context.newPage();

    await page.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Real location', { exact: true })).toBeVisible({ timeout: 30000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Real location', { exact: true })).toBeVisible({ timeout: 30000 });

    await page.goto(`${APP_BASE_URL}/irrigation`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/irrigation(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Irrigation', exact: true })).toBeVisible();
    await expect(page.getByText('Loading live irrigation data...')).toHaveCount(0, { timeout: 30000 });

    await page.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.goto(`${APP_BASE_URL}/irrigation`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/irrigation(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Irrigation', exact: true })).toBeVisible();
    await expect(page.getByText('Loading live irrigation data...')).toHaveCount(0, { timeout: 30000 });

    await context.close();
  });

  test('farmer mobile smoke routes @mobile', async ({ browser }) => {
    const context = await newRoleContext(browser, farmerSession, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

    await page.goto(`${APP_BASE_URL}/detect`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Detect Disease', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue With Demo Report' })).toBeVisible();

    await page.goto(`${APP_BASE_URL}/irrigation`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Irrigation', exact: true })).toBeVisible();

    await context.close();
  });

  test('doctor can access doctor portal after verification', async ({ browser }) => {
    const context = await newRoleContext(browser, doctorSession);
    const page = await context.newPage();

    await page.goto(`${APP_BASE_URL}/doctor`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/doctor(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Doctor Panel', exact: true })).toBeVisible();
    await expect(page.getByText('Weekly Consultations')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();

    await context.close();
  });

  test('admin can access admin dashboard and doctor verification page', async ({ browser }) => {
    const context = await newRoleContext(browser, adminSession);
    const page = await context.newPage();

    await page.goto(`${APP_BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Admin Panel', exact: true })).toBeVisible();
    await expect(page.getByTestId('admin-sensor-status-header')).toBeVisible();
    await expect(page.getByTestId('admin-sensor-failures-filter-btn')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open doctor verification' })).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'System' }).click();
    await expect(page.getByTestId('admin-device-helpline-input')).toBeVisible();
    await expect(page.getByTestId('admin-device-helpline-save-btn')).toBeVisible();

    await page.goto(`${APP_BASE_URL}/admin/doctor-verification`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/doctor-verification(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Doctor Verification', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();

    await context.close();
  });
});
