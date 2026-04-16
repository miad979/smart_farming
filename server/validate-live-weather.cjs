const BASE_URL = String(process.env.WEATHER_VALIDATE_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '')

const COORDS = [
  { name: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { name: 'Chattogram', lat: 22.3569, lng: 91.7832 },
]

const FRESHNESS_WINDOW_SECONDS = 120
const FRESHNESS_DELTA_SECONDS = 3
const FETCH_RETRY_ATTEMPTS = Math.max(0, Number(process.env.WEATHER_VALIDATE_RETRY_ATTEMPTS || 2))
const FETCH_RETRY_DELAY_MS = Math.max(150, Number(process.env.WEATHER_VALIDATE_RETRY_DELAY_MS || 750))

function nowIso() {
  return new Date().toISOString()
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round1(value) {
  return Math.round(toNumber(value) * 10) / 10
}

function approxEqual(a, b, tolerance = 0) {
  return Math.abs(toNumber(a) - toNumber(b)) <= tolerance
}

function buildProviderUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,pressure_msl,surface_pressure,is_day,uv_index,weather_code',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,dew_point_2m,visibility',
    daily: 'temperature_2m_max,precipitation_probability_max,precipitation_sum,uv_index_max',
    timezone: 'auto',
    forecast_days: '3',
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

function isRetriableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)
}

function isLikelyTransientError(error) {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('fetch failed')
    || message.includes('network')
    || message.includes('timeout')
    || message.includes('econnreset')
    || message.includes('etimedout')
    || message.includes('econnrefused')
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, label) {
  let lastError = null

  for (let attempt = 0; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        const error = new Error(`${label} failed (${response.status}): ${text}`)
        if (attempt < FETCH_RETRY_ATTEMPTS && isRetriableStatus(response.status)) {
          await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1))
          continue
        }
        throw error
      }
      return response.json()
    } catch (error) {
      lastError = error
      if (attempt >= FETCH_RETRY_ATTEMPTS || !isLikelyTransientError(error)) {
        throw error
      }
      await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError || new Error(`${label} failed after retries`)
}

function evaluatePoint(app, provider, point) {
  const checks = []
  const add = (name, pass, appValue, expectedValue) => {
    checks.push({ name, pass, appValue, expectedValue, point: point.name })
  }

  const current = provider.current || {}
  const daily = provider.daily || {}
  const forecast = Array.isArray(app.forecast) ? app.forecast : []

  add('source=open-meteo', app.source === 'open-meteo', app.source, 'open-meteo')
  add('location.lat~', approxEqual(app.location?.lat, point.lat, 0.001), app.location?.lat, point.lat)
  add('location.lng~', approxEqual(app.location?.lng, point.lng, 0.001), app.location?.lng, point.lng)

  add('current.temp', approxEqual(app.current?.temp, Math.round(toNumber(current.temperature_2m)), 1), app.current?.temp, Math.round(toNumber(current.temperature_2m)))
  add('current.feelsLike', approxEqual(app.current?.feelsLike, Math.round(toNumber(current.apparent_temperature)), 1), app.current?.feelsLike, Math.round(toNumber(current.apparent_temperature)))
  add('current.humidity', approxEqual(app.current?.humidity, Math.round(toNumber(current.relative_humidity_2m)), 1), app.current?.humidity, Math.round(toNumber(current.relative_humidity_2m)))
  add('current.rainfall', approxEqual(app.current?.rainfall, Math.round(toNumber(current.precipitation)), 1), app.current?.rainfall, Math.round(toNumber(current.precipitation)))
  add('current.windSpeed', approxEqual(app.current?.windSpeed, Math.round(toNumber(current.wind_speed_10m)), 1), app.current?.windSpeed, Math.round(toNumber(current.wind_speed_10m)))
  add('current.windGust', approxEqual(app.current?.windGust, Math.round(toNumber(current.wind_gusts_10m)), 1), app.current?.windGust, Math.round(toNumber(current.wind_gusts_10m)))
  add('current.windDirection', approxEqual(app.current?.windDirection, Math.round(toNumber(current.wind_direction_10m)), 1), app.current?.windDirection, Math.round(toNumber(current.wind_direction_10m)))
  add('current.cloudCover', approxEqual(app.current?.cloudCover, Math.round(toNumber(current.cloud_cover)), 1), app.current?.cloudCover, Math.round(toNumber(current.cloud_cover)))
  add('current.uvIndex', approxEqual(app.current?.uvIndex, Math.round(toNumber(current.uv_index)), 1), app.current?.uvIndex, Math.round(toNumber(current.uv_index)))
  add('current.weatherCode', app.current?.weatherCode === Number(current.weather_code || 0), app.current?.weatherCode, Number(current.weather_code || 0))
  add('forecast.length=3', forecast.length === 3, forecast.length, 3)

  for (let i = 0; i < Math.min(3, forecast.length); i += 1) {
    add(
      `forecast[${i}].temp`,
      approxEqual(forecast[i].temp, Math.round(toNumber((daily.temperature_2m_max || [])[i])), 1),
      forecast[i].temp,
      Math.round(toNumber((daily.temperature_2m_max || [])[i])),
    )
    add(
      `forecast[${i}].rainfall`,
      approxEqual(forecast[i].rainfall, Math.round(toNumber((daily.precipitation_probability_max || [])[i])), 1),
      forecast[i].rainfall,
      Math.round(toNumber((daily.precipitation_probability_max || [])[i])),
    )
    add(
      `forecast[${i}].precipitationSum`,
      approxEqual(forecast[i].precipitationSum, round1((daily.precipitation_sum || [])[i]), 0.1),
      forecast[i].precipitationSum,
      round1((daily.precipitation_sum || [])[i]),
    )
    add(
      `forecast[${i}].uvIndex`,
      approxEqual(forecast[i].uvIndex, Math.round(toNumber((daily.uv_index_max || [])[i])), 1),
      forecast[i].uvIndex,
      Math.round(toNumber((daily.uv_index_max || [])[i])),
    )
  }

  const updatedAtMs = app.updatedAt ? new Date(app.updatedAt).getTime() : NaN
  const ageSeconds = Number.isFinite(updatedAtMs)
    ? Math.round((Date.now() - updatedAtMs) / 1000)
    : Number.POSITIVE_INFINITY
  add(
    `updatedAt age <= ${FRESHNESS_WINDOW_SECONDS}s`,
    ageSeconds >= 0 && ageSeconds <= FRESHNESS_WINDOW_SECONDS,
    ageSeconds,
    `0..${FRESHNESS_WINDOW_SECONDS}`,
  )

  return checks
}

async function verifyFreshness(baseUrl, point) {
  const url = `${baseUrl}/api/weather/current?lat=${point.lat}&lng=${point.lng}`
  const first = await fetchJson(url, 'App weather (first)')
  await new Promise((resolve) => setTimeout(resolve, FRESHNESS_DELTA_SECONDS * 1000))
  const second = await fetchJson(url, 'App weather (second)')

  const a = new Date(first.updatedAt || 0).getTime()
  const b = new Date(second.updatedAt || 0).getTime()
  const deltaSeconds = Number.isFinite(a) && Number.isFinite(b)
    ? Math.round((b - a) / 1000)
    : Number.NaN

  return {
    name: `updatedAt changes after ${FRESHNESS_DELTA_SECONDS}s`,
    pass: Boolean(first.updatedAt && second.updatedAt && first.updatedAt !== second.updatedAt && deltaSeconds >= 1),
    appValue: { updatedAt1: first.updatedAt, updatedAt2: second.updatedAt, deltaSeconds },
    expectedValue: 'second timestamp newer than first',
    point: point.name,
  }
}

async function main() {
  const allChecks = []

  for (const point of COORDS) {
    const appUrl = `${BASE_URL}/api/weather/current?lat=${point.lat}&lng=${point.lng}`
    const providerUrl = buildProviderUrl(point.lat, point.lng)
    const [app, provider] = await Promise.all([
      fetchJson(appUrl, `App weather (${point.name})`),
      fetchJson(providerUrl, `Open-Meteo (${point.name})`),
    ])

    allChecks.push(...evaluatePoint(app, provider, point))
  }

  allChecks.push(await verifyFreshness(BASE_URL, COORDS[0]))

  const failed = allChecks.filter((check) => !check.pass)
  const summary = {
    checkedAt: nowIso(),
    baseUrl: BASE_URL,
    points: COORDS,
    passCount: allChecks.length - failed.length,
    failCount: failed.length,
    total: allChecks.length,
    passRate: `${(((allChecks.length - failed.length) / allChecks.length) * 100).toFixed(1)}%`,
    is100Percent: failed.length === 0,
  }

  console.log('WEATHER_LIVE_VALIDATION_SUMMARY')
  console.log(JSON.stringify(summary, null, 2))

  if (failed.length > 0) {
    console.log('WEATHER_LIVE_VALIDATION_FAILED_CHECKS')
    console.log(JSON.stringify(failed, null, 2))
    process.exit(1)
  }

  console.log('WEATHER_LIVE_VALIDATION: PASS')
}

main().catch((error) => {
  console.error('WEATHER_LIVE_VALIDATION: ERROR')
  console.error(error?.message || error)
  process.exit(1)
})
