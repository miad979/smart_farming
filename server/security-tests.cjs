const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-security-'))
  process.chdir(tempDir)

  process.env.AUTH_TOKEN_SECRET = 'ci_test_secret_change_in_prod_6b5ea3f4f4da7d5c'
  process.env.LEGACY_DEMO_TOKEN_FALLBACK = 'false'
  process.env.LOGIN_LOCKOUT_THRESHOLD = '5'
  process.env.LOGIN_LOCKOUT_WINDOW_MS = '600000'
  process.env.LOGIN_LOCKOUT_DURATION_MS = '1800000'

  const localApiPath = path.resolve(__dirname, 'local-api.cjs')
  const { createLocalApiMiddleware } = require(localApiPath)
  const middleware = createLocalApiMiddleware()

  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Not found' }))
    })
  })

  await new Promise((resolve) => server.listen(0, resolve))
  const address = server.address()
  const base = `http://127.0.0.1:${address.port}`

  const jar = {}

  function ingestSetCookie(headerValue) {
    if (!headerValue) return
    const chunks = Array.isArray(headerValue)
      ? headerValue
      : String(headerValue).split(/,(?=\s*[A-Za-z0-9_\-]+=)/g)

    for (const item of chunks) {
      const first = item.split(';')[0] || ''
      const idx = first.indexOf('=')
      if (idx === -1) continue
      const name = first.slice(0, idx).trim()
      const value = first.slice(idx + 1).trim()
      jar[name] = decodeURIComponent(value)
    }
  }

  function cookieHeader() {
    return Object.entries(jar)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ')
  }

  async function request(method, pathname, body, extraHeaders = {}) {
    const headers = { ...extraHeaders }
    const cookie = cookieHeader()
    if (cookie) headers.Cookie = cookie

    let payload
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }

    const response = await fetch(`${base}${pathname}`, {
      method,
      headers,
      body: payload,
    })

    const setCookie = response.headers.get('set-cookie')
    if (setCookie) ingestSetCookie(setCookie)

    const text = await response.text()
    let json
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = {}
    }

    return { status: response.status, json, headers: response.headers }
  }

  function assert(cond, message) {
    if (!cond) throw new Error(message)
  }

  const signup = await request('POST', '/auth/signup', {
    email: 'security_test_farmer@smartfarming.local',
    password: 'Str0ng!Pass123',
    name: 'Security Test Farmer',
    role: 'farmer',
    location: 'Dhaka',
    termsAccepted: true,
    privacyAccepted: true,
  })

  assert(signup.status === 200, `Signup failed (${signup.status})`)
  assert(Boolean(jar.sf_access_token), 'Auth cookie was not set')
  assert(Boolean(jar.sf_csrf), 'CSRF cookie was not set')

  const me = await request('GET', '/auth/me')
  assert(me.status === 200, `Cookie auth /auth/me failed (${me.status})`)
  const userId = me.json?.user?.id
  assert(Boolean(userId), 'Missing user id from /auth/me')

  const updateWithoutCsrf = await request('PUT', `/users/${encodeURIComponent(userId)}`, {
    name: 'No CSRF Update',
  })
  assert(updateWithoutCsrf.status === 403, 'CSRF protection did not block mutating request')

  const updateWithCsrf = await request(
    'PUT',
    `/users/${encodeURIComponent(userId)}`,
    { name: 'With CSRF Update' },
    { 'X-CSRF-Token': jar.sf_csrf },
  )
  assert(updateWithCsrf.status === 200, `CSRF-protected update failed (${updateWithCsrf.status})`)

  await request('POST', '/auth/logout', {}, { 'X-CSRF-Token': jar.sf_csrf || '' })

  for (let i = 0; i < 5; i += 1) {
    await request('POST', '/auth/signin', {
      email: 'security_test_farmer@smartfarming.local',
      password: 'Wrong!Pass123',
    })
  }

  const locked = await request('POST', '/auth/signin', {
    email: 'security_test_farmer@smartfarming.local',
    password: 'Wrong!Pass123',
  })
  assert(locked.status === 423, `Expected lockout status 423, got ${locked.status}`)

  const adminLogin = await request('POST', '/auth/signin', {
    email: 'admin@smartfarming.local',
    password: 'admin123',
  })
  assert(adminLogin.status === 200, `Admin login failed (${adminLogin.status})`)

  const logs = await request('GET', '/admin/audit-logs')
  assert(logs.status === 200, `Audit log fetch failed (${logs.status})`)
  const hasLockoutLog = (logs.json?.logs || []).some((log) => log?.action === 'auth.signin.lockout')
  assert(hasLockoutLog, 'Expected auth.signin.lockout audit log not found')

  await new Promise((resolve) => server.close(resolve))
  console.log('Security integration tests passed')
}

run().catch((error) => {
  console.error('Security integration tests failed:', error?.message || error)
  process.exitCode = 1
})
