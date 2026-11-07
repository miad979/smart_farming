// Irrigation feature checks against an isolated temp database (no real data used).
// Run: npm run test:irrigation
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')

async function run() {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-irrigation-')))
  process.env.AUTH_TOKEN_SECRET = 'irrigation_workflow_test_secret_2026'
  process.env.DATABASE_URL = ''

  const { createLocalApiMiddleware } = require(path.resolve(__dirname, 'local-api.cjs'))
  const middleware = createLocalApiMiddleware()
  const server = http.createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise((resolve) => server.listen(0, resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  const results = []
  const assert = (cond, message) => { if (!cond) throw new Error(message) }
  const step = async (name, fn) => { await fn(); results.push(name); console.log(`  ✓ ${name}`) }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  let token = null
  const jar = {}
  async function request(method, pathname, body) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    if (cookie) headers.Cookie = cookie
    if (method !== 'GET' && jar.sf_csrf) headers['X-CSRF-Token'] = jar.sf_csrf
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const r = await fetch(`${base}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of String(r.headers.get('set-cookie') || '').split(/,(?=\s*[A-Za-z0-9_-]+=)/)) {
      const [pair] = c.split(';'); const i = pair.indexOf('=')
      if (i > 0) jar[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim())
    }
    const text = await r.text()
    let json = {}
    try { json = text ? JSON.parse(text) : {} } catch { /* ignore */ }
    if (json.accessToken) token = json.accessToken
    return { status: r.status, json }
  }

  const signup = await request('POST', '/auth/signup', { email: 'irrigation@example.com', password: 'Strong!Pass123', name: 'Irrigation Farmer', role: 'farmer', termsAccepted: true, privacyAccepted: true, phone: '+8801711111111' })
  assert(signup.status === 200, 'signup failed')
  await request('GET', '/auth/csrf')
  const userId = signup.json.user.id
  const getSchedule = async () => (await request('GET', `/irrigation/${userId}`)).json.schedule

  let deviceId
  await step('new farmer: no invented usage, no fake "45L", real next-watering text', async () => {
    const s = await getSchedule()
    assert((s.usage || []).length === 7, 'Weekly usage should list the last 7 days')
    assert(s.usage.every((u) => u.amount === 0), 'New farmer must have zero usage')
    assert(s.amount === '0L', `Expected 0L, got ${s.amount}`)
    assert(/Automatic, when moisture drops below \d+%/.test(s.nextWatering), `Unexpected next watering: ${s.nextWatering}`)
    const setup = await request('POST', '/devices/virtual-irrigation/setup', { crop: 'Rice' })
    assert(setup.status === 200 && setup.json.device?.id, 'Virtual device setup failed')
    deviceId = setup.json.device.id
    const again = await request('POST', '/devices/virtual-irrigation/setup', { crop: 'Rice' })
    assert(again.json.device.id === deviceId, 'Setup must reuse the existing virtual device')
  })

  await step('settings: crop change brings its own threshold; measured data cannot be set from the browser', async () => {
    const r = await request('PUT', `/irrigation/${userId}`, { policy: { crop: 'Wheat' }, moisture: 5, usageByDate: { '2020-01-01': 99999 }, amount: '9999L' })
    assert(r.status === 200, `PUT failed (${r.status})`)
    const s = r.json.schedule
    assert(s.policy.crop === 'Wheat', 'Crop not changed')
    assert(s.policy.threshold === 55, `Wheat threshold should be 55, got ${s.policy.threshold}`)
    assert(s.moisture !== 5 && s.amount !== '9999L' && !s.usageByDate['2020-01-01'], 'Measured data must not be writable via PUT')
    const off = await request('PUT', `/irrigation/${userId}`, { autoMode: false })
    assert(off.json.schedule.autoMode === false && /Manual mode/.test(off.json.schedule.nextWatering), 'Auto mode off should read "Manual mode"')
    await request('PUT', `/irrigation/${userId}`, { autoMode: true })
  })

  await step('a sensor tick with a stale crop does not undo the saved crop', async () => {
    await request('POST', `/devices/${deviceId}/simulate`, { crop: 'Rice', tickMode: 'sensor-only' })
    assert((await getSchedule()).policy.crop === 'Wheat', 'Stale crop in a tick reverted the saved crop')
  })

  await step('auto mode waters below the threshold and records usage for today', async () => {
    const r = await request('POST', `/devices/${deviceId}/simulate`, { measuredMoisture: 30 })
    assert(r.json.action === 'watering' && r.json.appliedLiters > 0, `Expected auto watering, got ${r.json.action}`)
    assert(r.json.device.actuatorState === 'watering' && r.json.device.pumpRunEndsAt, 'Server should record when the run ends')
    const s = await getSchedule()
    assert(s.usage[6].amount === r.json.appliedLiters, `Today's usage should be ${r.json.appliedLiters}, got ${s.usage[6].amount}`)
    assert(/Watering now/.test(s.nextWatering), `Next watering should say watering now, got ${s.nextWatering}`)
  })

  await step('while a run is in progress, automatic ticks do not start another decision', async () => {
    const r = await request('POST', `/devices/${deviceId}/simulate`, { measuredMoisture: 20 })
    assert(r.json.message === 'Pump run in progress' && r.json.appliedLiters === 0, 'A tick during a run must not water again')
  })

  await step('the server ends the pump run by itself (page closed mid-run)', async () => {
    await request('POST', `/devices/${deviceId}/simulate`, { forcePump: 'on', manualLiters: 1, manualRuntimeMinutes: 0 })
    const dbFile = path.resolve(process.cwd(), '.local-db.json')
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'))
    db.devices[deviceId].pumpRunEndsAt = new Date(Date.now() - 1000).toISOString() // run already over
    fs.writeFileSync(dbFile, JSON.stringify(db))
    const later = new Date(Date.now() + 2000)
    fs.utimesSync(dbFile, later, later) // make sure the server sees the outside edit (same-millisecond mtime otherwise)
    await wait(20)
    const devices = (await request('GET', '/devices')).json.devices
    assert(devices[0].actuatorState === 'idle' && !devices[0].pumpRunEndsAt, `Pump should be idle, got ${devices[0].actuatorState}`)
  })

  await step('Stop Watering turns the pump off immediately', async () => {
    await request('POST', `/devices/${deviceId}/simulate`, { forcePump: 'on', manualLiters: 50 })
    const r = await request('POST', `/devices/${deviceId}/simulate`, { forcePump: 'off' })
    assert(r.json.device.actuatorState === 'idle' && !r.json.device.pumpRunEndsAt, 'Stop should end the run')
  })

  await step('battery drains by time, not per request', async () => {
    for (let i = 0; i < 20; i += 1) await request('POST', `/devices/${deviceId}/simulate`, { tickMode: 'sensor-only' })
    const battery = (await request('GET', '/devices')).json.devices[0].telemetry.battery
    assert(battery >= 99, `20 quick ticks should not drain the battery (got ${battery}%)`)
  })

  await step('concurrent requests do not overwrite each other (setting change during sensor ticks)', async () => {
    const ticks = Array.from({ length: 10 }, () => request('POST', `/devices/${deviceId}/simulate`, { crop: 'Wheat', tickMode: 'sensor-only' }))
    const change = request('PUT', `/irrigation/${userId}`, { autoMode: false, policy: { landAreaAcres: 3 } })
    await Promise.all([...ticks, change])
    const s = await getSchedule()
    assert(s.autoMode === false && Number(s.policy.landAreaAcres) === 3, `Settings lost under concurrency: autoMode=${s.autoMode} land=${s.policy.landAreaAcres}`)
  })

  server.close()
  console.log(`\nIrrigation workflow: ${results.length} checks passed`)
  process.exit(0)
}

run().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
