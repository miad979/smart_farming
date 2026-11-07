// Verifies production behaviour end to end in child processes with NODE_ENV=production and an isolated
// temp working directory (requires a built dist/: run `npm run build` first).
// Run: npm run test:production
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SERVER = path.join(ROOT, 'server', 'preview-server.cjs')
const CHECK = path.join(ROOT, 'server', 'check-production-env.cjs')
const results = []
const assert = (cond, message) => { if (!cond) throw new Error(message) }
const step = async (name, fn) => { await fn(); results.push(name); console.log(`  ✓ ${name}`) }

const STRONG = 'Prod!Admin-Pass-2026'
const baseEnv = {
  ...process.env,
  AUTH_TOKEN_SECRET: 'production_readiness_test_secret_value_0123456789',
  CORS_ALLOWED_ORIGINS: 'https://farm.example.com',
}
delete baseEnv.DATABASE_URL
delete baseEnv.POSTGRES_URL

function startServer(cwd, env) {
  return new Promise((resolve, reject) => {
    const port = 4300 + Math.floor(Math.random() * 500)
    const child = spawn(process.execPath, [SERVER], { cwd, env: { ...baseEnv, ...env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const timer = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 20000)
    child.stdout.on('data', (d) => {
      output += d
      if (String(d).includes('Preview server running')) { clearTimeout(timer); resolve({ child, base: `http://127.0.0.1:${port}` }) }
    })
    child.stderr.on('data', (d) => { output += d })
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited (${code}): ${output}`)) })
  })
}

function stop(server) {
  return new Promise((resolve) => {
    if (!server || server.child.exitCode !== null) return resolve()
    server.child.removeAllListeners('exit')
    server.child.on('exit', () => resolve())
    server.child.kill()
  })
}

const signin = (base, email, password, headers = {}) => fetch(`${base}/api/auth/signin`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ email, password }),
})

async function run() {
  assert(fs.existsSync(path.join(ROOT, 'dist', 'index.html')), 'dist/ missing: run `npm run build` first')
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-prod-'))
  fs.cpSync(path.join(ROOT, 'dist'), path.join(work, 'dist'), { recursive: true })

  await step('env check refuses production without DATABASE_URL or admin bootstrap, accepts a complete config', async () => {
    const runCheck = (env) => spawnSync(process.execPath, [CHECK], { env: { ...baseEnv, NODE_ENV: 'production', ...env }, encoding: 'utf8' }).status
    assert(runCheck({ BOOTSTRAP_ADMIN_EMAIL: 'a@b.co', BOOTSTRAP_ADMIN_PASSWORD: STRONG }) === 1, 'Missing DATABASE_URL should fail')
    assert(runCheck({ ALLOW_EPHEMERAL_STORAGE: 'true' }) === 1, 'Missing bootstrap admin should fail')
    assert(runCheck({ ALLOW_EPHEMERAL_STORAGE: 'true', BOOTSTRAP_ADMIN_EMAIL: 'a@b.co', BOOTSTRAP_ADMIN_PASSWORD: 'admin123' }) === 1, 'Weak bootstrap password should fail')
    assert(runCheck({ DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x', BOOTSTRAP_ADMIN_EMAIL: 'a@b.co', BOOTSTRAP_ADMIN_PASSWORD: STRONG }) === 0, 'Complete config should pass')
  })

  // Phase 1: a development run creates the public demo accounts (as an old deployment would have).
  const dev = await startServer(work, { NODE_ENV: 'development' })
  await fetch(`${dev.base}/api/health`)
  await stop(dev)

  const prod = await startServer(work, { NODE_ENV: 'production', BOOTSTRAP_ADMIN_EMAIL: 'owner@farm.example.com', BOOTSTRAP_ADMIN_PASSWORD: STRONG })
  try {
    await step('demo passwords are refused in production even if the accounts exist', async () => {
      const a = await signin(prod.base, 'admin@smartfarming.local', 'admin123')
      const s = await signin(prod.base, 'super@smartfarming.local', 'super123')
      assert(a.status === 403 && s.status === 403, `Expected 403 for demo passwords, got ${a.status}/${s.status}`)
    })

    await step('bootstrap admin from environment can sign in with admin rights', async () => {
      const r = await signin(prod.base, 'owner@farm.example.com', STRONG)
      const body = await r.json()
      assert(r.status === 200 && body.user?.role === 'admin', `Bootstrap admin sign-in failed (${r.status})`)
    })

    await step('spoofed X-Forwarded-For does not bypass the sign-in rate limit', async () => {
      let limited = false
      for (let i = 0; i < 60 && !limited; i += 1) {
        const r = await signin(prod.base, 'nobody@farm.example.com', 'wrong', { 'X-Forwarded-For': `10.0.${i}.${i}, 203.0.113.7` })
        limited = r.status === 429
      }
      assert(limited, 'Rate limit never triggered: client-supplied X-Forwarded-For entries are being trusted')
    })

    await step('static server: malformed URL is a 400 (no crash), missing asset 404, caching and gzip', async () => {
      const bad = await fetch(`${prod.base}/%E0%A4%A`)
      assert(bad.status === 400, `Malformed URL should be 400 (${bad.status})`)
      const alive = await fetch(`${prod.base}/api/health`)
      assert(alive.status === 200, 'Server died after malformed URL')
      const missing = await fetch(`${prod.base}/assets/does-not-exist-123.js`)
      assert(missing.status === 404, `Missing asset should 404 (${missing.status})`)
      const html = await fetch(`${prod.base}/consultations`)
      assert(html.status === 200 && /no-cache/.test(html.headers.get('cache-control') || ''), 'SPA route should be index.html with no-cache')
      const asset = (await (await fetch(`${prod.base}/`)).text()).match(/\/assets\/[^"']+\.js/)
      assert(asset, 'No JS asset referenced in index.html')
      const js = await fetch(`${prod.base}${asset[0]}`, { headers: { 'Accept-Encoding': 'gzip' } })
      assert(/immutable/.test(js.headers.get('cache-control') || ''), 'Hashed asset should be immutable')
      assert(js.headers.get('content-encoding') === 'gzip', 'JS should be gzip-compressed')
    })

    await step('security headers: page allows mic/geo for itself; no HSTS on plain http', async () => {
      const r = await fetch(`${prod.base}/`)
      assert(r.headers.get('permissions-policy') === 'camera=(self), microphone=(self), geolocation=(self)', 'Unexpected Permissions-Policy')
      assert(!r.headers.get('strict-transport-security'), 'HSTS must not be sent over plain http')
    })
  } finally {
    await stop(prod)
  }

  const testDbUrl = String(process.env.TEST_DATABASE_URL || '').trim()
  if (!testDbUrl) {
    console.log('  - skipped: redeploy persistence (set TEST_DATABASE_URL to a disposable Postgres database)')
  } else {
    await step('redeploy with a wiped disk keeps user accounts and uploaded files (Postgres)', async () => {
      const prodEnv = { NODE_ENV: 'production', DATABASE_URL: testDbUrl, SQL_SSL: 'false', BOOTSTRAP_ADMIN_EMAIL: 'owner@farm.example.com', BOOTSTRAP_ADMIN_PASSWORD: STRONG }
      const diskA = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-diskA-'))
      fs.cpSync(path.join(ROOT, 'dist'), path.join(diskA, 'dist'), { recursive: true })
      const email = `farmer.${Date.now()}@farm.example.com`
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
      let fileId
      const first = await startServer(diskA, prodEnv)
      try {
        const up = await fetch(`${first.base}/api/uploads/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: 'cert.png', base64Data: png.toString('base64'), contentType: 'image/png' }) })
        const upBody = await up.json()
        assert(up.status === 200 || up.status === 409, `Upload failed (${up.status} ${upBody.error})`)
        fileId = (upBody.file || {}).id
        const s = await fetch(`${first.base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Strong!Pass123', name: 'Persist Farmer', role: 'farmer', termsAccepted: true, privacyAccepted: true }) })
        assert(s.status === 200, `Signup failed (${s.status})`)
        await new Promise((r) => setTimeout(r, 1500)) // let the debounced snapshot write land
      } finally {
        await stop(first)
      }

      const diskB = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-diskB-')) // fresh disk: no .local-db.json, no uploads
      fs.cpSync(path.join(ROOT, 'dist'), path.join(diskB, 'dist'), { recursive: true })
      const second = await startServer(diskB, prodEnv)
      try {
        const login = await signin(second.base, email, 'Strong!Pass123')
        assert(login.status === 200, `User lost after redeploy (${login.status})`)
        if (fileId) {
          const file = await fetch(`${second.base}/api/uploads/documents/${fileId}`)
          const bytes = Buffer.from(await file.arrayBuffer())
          assert(file.status === 200 && bytes.equals(png), `Uploaded file lost after redeploy (${file.status})`)
        }
        const health = await (await fetch(`${second.base}/api/health`)).json()
        assert(health.storage?.sqlConnected === true, 'Health check does not report the SQL connection')
      } finally {
        await stop(second)
      }
    })
  }

  console.log(`\nProduction readiness: ${results.length} checks passed`)
}

run().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
