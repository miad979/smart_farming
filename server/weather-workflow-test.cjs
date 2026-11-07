// Live weather checks with simulated providers (no network): fallback, caching, time zones, failure handling.
// Run: npm run test:weather
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')

const realFetch = globalThis.fetch
const providerCalls = []
let mode = {} // per-provider behaviour: 'ok' | 'http429' | 'http500' | 'timeout'

const HOUR = 3600 * 1000
function openMeteoPayload() {
  const now = Date.now()
  const startHour = Math.floor(now / HOUR) * HOUR - 3 * HOUR
  const times = Array.from({ length: 72 }, (_, i) => (startHour + i * HOUR) / 1000)
  return {
    timezone: 'Asia/Dhaka',
    utc_offset_seconds: 21600,
    current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
    current: { time: Math.floor(now / 1000), temperature_2m: 30, apparent_temperature: 34, relative_humidity_2m: 70, precipitation: 0, wind_speed_10m: 10, wind_gusts_10m: 20, wind_direction_10m: 180, cloud_cover: 40, pressure_msl: 1008, is_day: 1, uv_index: 5, weather_code: 2 },
    hourly: {
      time: times,
      temperature_2m: times.map(() => 30), apparent_temperature: times.map(() => 33),
      precipitation_probability: times.map((_, i) => (i === 10 ? 80 : 10)), precipitation: times.map(() => 0),
      wind_speed_10m: times.map(() => 10), wind_gusts_10m: times.map(() => 20), dew_point_2m: times.map(() => 24), visibility: times.map(() => 10000),
    },
    daily: { time: [0, 1, 2].map((d) => (startHour + d * 24 * HOUR) / 1000), temperature_2m_max: [33, 32, 31], precipitation_probability_max: [80, 20, 10], precipitation_sum: [5, 0, 0], uv_index_max: [7, 6, 5] },
  }
}
function metPayload() {
  const startHour = Math.floor(Date.now() / HOUR) * HOUR - 2 * HOUR
  return { properties: { timeseries: Array.from({ length: 60 }, (_, i) => ({
    time: new Date(startHour + i * HOUR).toISOString(),
    data: {
      instant: { details: { air_temperature: 28, apparent_air_temperature: 31, relative_humidity: 75, wind_speed: 3, wind_from_direction: 90, cloud_area_fraction: 60, air_pressure_at_sea_level: 1010, dew_point_temperature: 23, ultraviolet_index_clear_sky: 4 } },
      next_1_hours: { summary: { symbol_code: i === 5 ? 'rain_day' : 'partlycloudy_day' }, details: { precipitation_amount: i === 5 ? 2 : 0 } },
    },
  })) } }
}

globalThis.fetch = async (url, options) => {
  const u = String(url)
  if (u.startsWith('http://127.0.0.1')) return realFetch(url, options)
  const provider = u.includes('open-meteo.com') ? 'open-meteo' : u.includes('api.met.no') ? 'met-norway' : u.includes('nominatim') ? 'nominatim' : 'other'
  providerCalls.push({ provider, url: u })
  const behaviour = mode[provider] || 'ok'
  if (behaviour === 'timeout') { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e }
  if (behaviour === 'http429') return new Response('{"reason":"rate limited"}', { status: 429 })
  if (behaviour === 'http500') return new Response('oops', { status: 500 })
  if (provider === 'open-meteo') return new Response(JSON.stringify(openMeteoPayload()), { status: 200 })
  if (provider === 'met-norway') return new Response(JSON.stringify(metPayload()), { status: 200 })
  if (provider === 'nominatim') return new Response(JSON.stringify({ name: 'Bogura', address: { state: 'Rajshahi Division', country: 'Bangladesh' } }), { status: 200 })
  return new Response('{}', { status: 404 })
}

async function run() {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-weather-')))
  process.env.AUTH_TOKEN_SECRET = 'weather_workflow_test_secret_2026'
  process.env.DATABASE_URL = ''
  const { createLocalApiMiddleware } = require(path.resolve(__dirname, 'local-api.cjs'))
  const middleware = createLocalApiMiddleware()
  const server = http.createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise((resolve) => server.listen(0, resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const get = async (p) => { const r = await realFetch(`${base}${p}`); return { status: r.status, json: await r.json() } }
  const calls = (provider) => providerCalls.filter((c) => c.provider === provider).length

  const results = []
  const assert = (cond, message) => { if (!cond) throw new Error(message) }
  const step = async (name, fn) => { providerCalls.length = 0; mode = {}; await fn(); results.push(name); console.log(`  ✓ ${name}`) }
  const dhakaHour = () => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', hour12: false }).format(new Date())) % 24

  await step('Open-Meteo: real place name, 24-hour window starts at the current local hour', async () => {
    const r = await get('/weather/current?lat=24.8501&lng=89.3701')
    assert(r.status === 200 && r.json.source === 'open-meteo', `Expected open-meteo (${r.status} ${r.json.source})`)
    assert(r.json.location.name === 'Bogura' && r.json.location.timezone === 'Asia/Dhaka', 'Place name / time zone missing')
    assert(r.json.rainForecast.nextDay.length === 24, 'Expected 24 forecast hours')
    assert(r.json.rainForecast.nextDay[0].hour === dhakaHour(), `Window should start at Dhaka hour ${dhakaHour()}, got ${r.json.rainForecast.nextDay[0].hour}`)
    assert(r.json.current.visibilityKm === 10 && r.json.current.dewPoint === 24, 'Visibility/dew point not mapped')
    const om = providerCalls.find((c) => c.provider === 'open-meteo').url
    assert(/latitude=24\.85&/.test(om) && /longitude=89\.37&/.test(om), `Coordinates should be rounded to ~1 km: ${om}`)
  })

  await step('repeat requests are served from cache (no provider call)', async () => {
    await get('/weather/current?lat=24.8501&lng=89.3701')
    await get('/weather/current?lat=24.8512&lng=89.3699') // GPS jitter, same ~1 km cell
    assert(calls('open-meteo') === 0, `Cached result expected, provider called ${calls('open-meteo')} times`)
  })

  await step('simultaneous requests share one provider call', async () => {
    await Promise.all(Array.from({ length: 6 }, () => get('/weather/current?lat=23.81&lng=90.41')))
    assert(calls('open-meteo') === 1, `Expected 1 provider call, got ${calls('open-meteo')}`)
  })

  await step('Open-Meteo refuses (HTTP 429): MET Norway is used, no pointless retry', async () => {
    mode = { 'open-meteo': 'http429' }
    const r = await get('/weather/current?lat=22.33&lng=91.83')
    assert(r.status === 200 && r.json.source === 'met-norway', `Expected met-norway fallback (${r.status} ${r.json.source})`)
    assert(calls('open-meteo') === 1, `429 must not be retried, got ${calls('open-meteo')} calls`)
    assert(r.json.current.windSpeed === 11, `MET wind should be converted m/s→km/h (got ${r.json.current.windSpeed})`)
    assert(r.json.rainForecast.nextDay[0].hour === dhakaHour(), 'MET window should start at the current local hour')
    assert(r.json.current.visibilityKm === undefined, 'MET has no visibility: must be absent, not 0')
    assert(r.json.rainForecast.maxRainProb > 0, 'MET rain amount should give a rain chance')
  })

  await step('Open-Meteo timeout / 500: retried once, then MET Norway', async () => {
    mode = { 'open-meteo': 'http500' }
    const r = await get('/weather/current?lat=24.37&lng=88.60')
    assert(r.json.source === 'met-norway' && calls('open-meteo') === 2, `Expected 2 Open-Meteo attempts then MET (${calls('open-meteo')})`)
    providerCalls.length = 0
    mode = { 'open-meteo': 'timeout' }
    const t = await get('/weather/current?lat=24.90&lng=91.87')
    assert(t.json.source === 'met-norway', 'Timeout should fall back to MET')
  })

  await step('all providers down, no cache: clear 503 (not a crash); yield advice still works', async () => {
    mode = { 'open-meteo': 'http429', 'met-norway': 'http500' }
    const r = await get('/weather/current?lat=21.43&lng=92.01')
    assert(r.status === 503 && /temporarily unavailable/.test(r.json.error), `Expected 503, got ${r.status}`)
    assert(Array.isArray(r.json.providerErrors) && r.json.providerErrors.length >= 2, 'Provider reasons should be reported')
    const y = await get('/yield/advice?lat=21.43&lng=92.01&moisture=40&crop=Rice')
    assert(y.status === 200 && y.json.weatherUnavailable === true && y.json.advice, 'Yield advice should work without weather')
  })

  await step('all providers down but a recent result exists: served as degraded', async () => {
    await get('/weather/current?lat=25.74&lng=89.25') // fills the cache (providers OK)
    // Age the cached entry beyond the fresh window but within the stale window.
    mode = { 'open-meteo': 'http429', 'met-norway': 'http429' }
    const realNow = Date.now
    Date.now = () => realNow() + 30 * 60 * 1000
    try {
      const r = await get('/weather/current?lat=25.74&lng=89.25')
      assert(r.status === 200 && r.json.degradedMode?.active === true, `Expected degraded cached weather (${r.status})`)
    } finally {
      Date.now = realNow
    }
  })

  server.close()
  console.log(`\nWeather workflow: ${results.length} checks passed`)
  process.exit(0)
}

run().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exit(1)
})
