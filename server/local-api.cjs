const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function parseEnvFileLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const eqIndex = trimmed.indexOf('=')
  if (eqIndex <= 0) return null

  const key = trimmed.slice(0, eqIndex).trim()
  let value = trimmed.slice(eqIndex + 1).trim()

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const parsed = parseEnvFileLine(line)
    if (!parsed) continue
    if (!(parsed.key in process.env)) {
      process.env[parsed.key] = parsed.value
    }
  }
}

function loadLocalEnvFiles() {
  const envPath = path.resolve(process.cwd(), '.env')
  const localEnvPath = path.resolve(process.cwd(), '.env.local')
  loadEnvFromFile(envPath)
  loadEnvFromFile(localEnvPath)
}

loadLocalEnvFiles()

function parseEnvInt(name, fallback, minValue = 1) {
  const raw = process.env[name]
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(minValue, Math.floor(parsed))
}

function normalizeSameSite(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'strict') return 'Strict'
  if (normalized === 'none') return 'None'
  return 'Lax'
}

function normalizeMarketVolatilityProfile(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'stable' || normalized === 'aggressive') return normalized
  return 'balanced'
}

let PgPool = null
try {
  PgPool = require('pg').Pool
} catch {
  PgPool = null
}

let MsEdgeTtsModule = null
try {
  MsEdgeTtsModule = require('msedge-tts')
} catch {
  MsEdgeTtsModule = null
}

const DB_PATH = path.resolve(process.cwd(), '.local-db.json')
const UPLOADS_DIR = path.resolve(process.cwd(), '.local-uploads')
const MAX_DOCTOR_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_JSON_BODY_BYTES = Number(process.env.MAX_JSON_BODY_BYTES || 1024 * 1024)
const AUTH_TOKEN_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.AUTH_TOKEN_TTL_MS || 12 * 60 * 60 * 1000))
const LEGACY_DEMO_TOKEN_FALLBACK = String(process.env.LEGACY_DEMO_TOKEN_FALLBACK || 'false').toLowerCase() === 'true'
const PROVIDED_AUTH_TOKEN_SECRET = (process.env.AUTH_TOKEN_SECRET || '').trim()
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
const AUTH_TOKEN_SECRET = PROVIDED_AUTH_TOKEN_SECRET
  || crypto.createHash('sha256').update(`smart-farming-local:${DB_PATH}`).digest('hex')
if (IS_PRODUCTION && !PROVIDED_AUTH_TOKEN_SECRET) {
  throw new Error('AUTH_TOKEN_SECRET is required when NODE_ENV=production')
}
const AUTH_COOKIE_NAME = 'sf_access_token'
const CSRF_COOKIE_NAME = 'sf_csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'
const FORCE_SECURE_COOKIES = String(process.env.FORCE_SECURE_COOKIES || 'false').toLowerCase() === 'true'
const AUTH_COOKIE_SAME_SITE = normalizeSameSite(process.env.AUTH_COOKIE_SAME_SITE || 'Lax')
const CSRF_COOKIE_SAME_SITE = normalizeSameSite(process.env.CSRF_COOKIE_SAME_SITE || AUTH_COOKIE_SAME_SITE)
const LOGIN_LOCKOUT_WINDOW_MS = Math.max(60 * 1000, Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || 15 * 60 * 1000))
const LOGIN_LOCKOUT_DURATION_MS = Math.max(60 * 1000, Number(process.env.LOGIN_LOCKOUT_DURATION_MS || 30 * 60 * 1000))
const LOGIN_LOCKOUT_THRESHOLD = Math.max(3, Number(process.env.LOGIN_LOCKOUT_THRESHOLD || 8))
const RATE_LIMIT_GLOBAL_PER_MINUTE = parseEnvInt('RATE_LIMIT_GLOBAL_PER_MINUTE', IS_PRODUCTION ? 120 : 240, 20)
const RATE_LIMIT_SIGNIN_PER_10_MINUTES = parseEnvInt('RATE_LIMIT_SIGNIN_PER_10_MINUTES', IS_PRODUCTION ? 20 : 50, 5)
const RATE_LIMIT_SIGNUP_PER_10_MINUTES = parseEnvInt('RATE_LIMIT_SIGNUP_PER_10_MINUTES', IS_PRODUCTION ? 10 : 20, 3)
const RATE_LIMIT_UPLOADS_PER_5_MINUTES = parseEnvInt('RATE_LIMIT_UPLOADS_PER_5_MINUTES', IS_PRODUCTION ? 20 : 30, 5)
const RATE_LIMIT_USERS_MUTATION_PER_MINUTE = parseEnvInt('RATE_LIMIT_USERS_MUTATION_PER_MINUTE', IS_PRODUCTION ? 40 : 80, 10)
const RATE_LIMIT_DOCTOR_VERIFY_PER_MINUTE = parseEnvInt('RATE_LIMIT_DOCTOR_VERIFY_PER_MINUTE', IS_PRODUCTION ? 30 : 60, 5)
const RATE_LIMIT_SIGNIN_EMAIL_PER_10_MINUTES = parseEnvInt('RATE_LIMIT_SIGNIN_EMAIL_PER_10_MINUTES', IS_PRODUCTION ? 8 : 12, 3)
const RATE_LIMIT_REALTIME_CONNECT_PER_MINUTE = parseEnvInt('RATE_LIMIT_REALTIME_CONNECT_PER_MINUTE', IS_PRODUCTION ? 20 : 40, 5)
const RATE_LIMIT_REALTIME_CONNECTIONS_PER_IP = parseEnvInt('RATE_LIMIT_REALTIME_CONNECTIONS_PER_IP', IS_PRODUCTION ? 5 : 20, 1)
const CORS_ALLOWED_ORIGINS = new Set(
  String(process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)
const PLANT_ID_API_BASE = process.env.PLANT_ID_API_BASE || 'https://api.plant.id/v2'
const PLANT_ID_HEALTH_ENDPOINT = process.env.PLANT_ID_HEALTH_ENDPOINT || `${PLANT_ID_API_BASE}/health_assessment`
// Read API key at runtime, not at module load time, so env vars set after startup are used
const getPlantIdApiKey = () => process.env.PLANT_ID_API_KEY || process.env.CROP_DISEASE_API_KEY || ''
const getGoogleTtsApiKey = () => process.env.GOOGLE_CLOUD_TTS_API_KEY || ''
const getElevenLabsApiKey = () => process.env.ELEVENLABS_API_KEY || ''
const getOpenAiApiKey = () => process.env.OPENAI_API_KEY || ''
const getGroqApiKey = () => process.env.GROQ_API_KEY || ''
const getOpenRouterApiKey = () => process.env.OPENROUTER_API_KEY || ''
const EDGE_TTS_ENABLED = String(process.env.EDGE_TTS_ENABLED || 'true').toLowerCase() !== 'false'
const EDGE_TTS_BN_VOICE = (process.env.EDGE_TTS_BN_VOICE || 'bn-BD-PradeepNeural').trim()
const EDGE_TTS_EN_VOICE = (process.env.EDGE_TTS_EN_VOICE || 'en-US-AriaNeural').trim()
const EDGE_TTS_BN_RATE = (process.env.EDGE_TTS_BN_RATE || '-10%').trim()
const EDGE_TTS_EN_RATE = (process.env.EDGE_TTS_EN_RATE || 'default').trim()
const DEFAULT_DEVICE_HELP_LINE = '+8801700000000'
const ENV_DEVICE_HELP_LINE = String(process.env.DEVICE_HELP_LINE || DEFAULT_DEVICE_HELP_LINE).trim()
const TTS_CACHE = new Map() // In-memory cache for generated speech
const realtimeClients = new Map()
const RATE_LIMIT_BUCKETS = new Map()
const DHAKA_LIVE_UPDATE_INTERVAL_MS = Number(process.env.DHAKA_LIVE_UPDATE_INTERVAL_MS || 60000)
const MARKET_VOLATILITY_PROFILE = normalizeMarketVolatilityProfile(process.env.MARKET_VOLATILITY_PROFILE || 'balanced')
const MARKET_PROFILE_PRESETS = Object.freeze({
  stable: Object.freeze({
    updateMs: 45000,
    driftHardCapPct: 2.2,
    shockChance: 0.004,
    meanReversionWeight: 0.34,
    momentumWeight: 0.12,
    noiseMultiplier: 2.1,
    peakHourVolatility: 1.2,
    daytimeVolatility: 1.05,
    offHourVolatility: 0.62,
  }),
  balanced: Object.freeze({
    updateMs: 30000,
    driftHardCapPct: 4.2,
    shockChance: 0.015,
    meanReversionWeight: 0.2,
    momentumWeight: 0.18,
    noiseMultiplier: 3.2,
    peakHourVolatility: 1.35,
    daytimeVolatility: 1.15,
    offHourVolatility: 0.75,
  }),
  aggressive: Object.freeze({
    updateMs: 16000,
    driftHardCapPct: 6.5,
    shockChance: 0.04,
    meanReversionWeight: 0.12,
    momentumWeight: 0.26,
    noiseMultiplier: 4.1,
    peakHourVolatility: 1.5,
    daytimeVolatility: 1.28,
    offHourVolatility: 0.88,
  }),
})
const MARKET_ACTIVE_PROFILE = MARKET_PROFILE_PRESETS[MARKET_VOLATILITY_PROFILE]
const MARKET_REALTIME_AUTO_UPDATE_MS = Math.max(
  10000,
  Number(process.env.MARKET_REALTIME_AUTO_UPDATE_MS || MARKET_ACTIVE_PROFILE.updateMs),
)
const MARKET_DRIFT_HARD_CAP_PCT = Math.max(1, Number(process.env.MARKET_DRIFT_HARD_CAP_PCT || MARKET_ACTIVE_PROFILE.driftHardCapPct))
const MARKET_SHOCK_CHANCE = Math.min(0.2, Math.max(0, Number(process.env.MARKET_SHOCK_CHANCE || MARKET_ACTIVE_PROFILE.shockChance)))
const MARKET_MEAN_REVERSION_WEIGHT = Math.min(1, Math.max(0, Number(process.env.MARKET_MEAN_REVERSION_WEIGHT || MARKET_ACTIVE_PROFILE.meanReversionWeight)))
const MARKET_MOMENTUM_WEIGHT = Math.min(1, Math.max(0, Number(process.env.MARKET_MOMENTUM_WEIGHT || MARKET_ACTIVE_PROFILE.momentumWeight)))
const MARKET_NOISE_MULTIPLIER = Math.max(0.5, Number(process.env.MARKET_NOISE_MULTIPLIER || MARKET_ACTIVE_PROFILE.noiseMultiplier))
const MARKET_PEAK_HOUR_VOLATILITY = Math.max(0.2, Number(process.env.MARKET_PEAK_HOUR_VOLATILITY || MARKET_ACTIVE_PROFILE.peakHourVolatility))
const MARKET_DAYTIME_VOLATILITY = Math.max(0.2, Number(process.env.MARKET_DAYTIME_VOLATILITY || MARKET_ACTIVE_PROFILE.daytimeVolatility))
const MARKET_OFF_HOUR_VOLATILITY = Math.max(0.1, Number(process.env.MARKET_OFF_HOUR_VOLATILITY || MARKET_ACTIVE_PROFILE.offHourVolatility))
const MARKET_CROP_VOLATILITY = Object.freeze({
  rice: 0.45,
  onion: 0.95,
  wheat: 0.5,
  maize: 0.7,
  chili: 1.5,
  lentil: 0.8,
})
const MARKET_LOCATION_VOLATILITY = Object.freeze({
  dhaka: 1,
  chittagong: 0.9,
})
let lastDhakaLiveUpdateAt = 0
let marketRealtimeAutoUpdateTimer = null
let marketRealtimeAutoUpdateInFlight = false
let marketRealtimeAutoUpdateStarted = false
const marketAnchorByPriceId = new Map()

const SQL_SNAPSHOT_KEY = 'local-db'
let sqlPool = null
let sqlInitPromise = null
let sqlMirrorEnabled = false
let sqlMirrorLastError = null
let sqlMirrorWriteTimer = null
let dbBootstrapSource = 'local-json'

function createEmptyDb() {
  return {
    users: {},
    usersByEmail: {},
    pendingDoctors: [],
    diseases: {},
    diseasesByUser: {},
    irrigation: {},
    consultations: {},
    consultationsByFarmer: {},
    prices: {},
    alerts: {},
    alertsByUser: {},
    devices: {},
    devicesByUser: {},
    uploads: {},
    uploadsByHash: {},
    uploaded_documents: {},
    uploadedDocumentsByHash: {},
    assistantChats: {},
    assistant_chat_sessions: {},
    assistant_chat_messages: {},
    audit_logs: {},
    login_security: {},
    app_settings: {},
  }
}

function tryGetSupabaseProjectRef() {
  const explicit = String(process.env.SUPABASE_PROJECT_REF || '').trim()
  if (explicit) return explicit

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  if (!supabaseUrl) return ''

  try {
    const hostname = new URL(supabaseUrl).hostname
    const projectRef = String(hostname.split('.')[0] || '').trim()
    return projectRef
  } catch {
    return ''
  }
}

function getSupabaseDatabaseUrl() {
  const explicit = String(process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || '').trim()
  if (explicit) return explicit

  const projectRef = tryGetSupabaseProjectRef()
  const rawPassword = String(process.env.SUPABASE_DB_PASSWORD || '').trim()
  if (!projectRef || !rawPassword) return ''

  const password = encodeURIComponent(rawPassword)
  return `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
}

function getSqlDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || getSupabaseDatabaseUrl() || '').trim()
}

function shouldUseSqlSsl(databaseUrl) {
  const sslMode = String(process.env.SQL_SSL || '').trim().toLowerCase()
  if (sslMode === 'true' || sslMode === '1' || sslMode === 'require') return true
  if (sslMode === 'false' || sslMode === '0' || sslMode === 'disable') return false
  return /supabase\.co|pooler\.supabase\.com/i.test(String(databaseUrl || ''))
}

async function initSqlMirror() {
  if (sqlInitPromise) return sqlInitPromise

  sqlInitPromise = (async () => {
    const databaseUrl = getSqlDatabaseUrl()
    if (!databaseUrl) {
      sqlMirrorEnabled = false
      return false
    }

    if (!PgPool) {
      sqlMirrorEnabled = false
      sqlMirrorLastError = 'pg package is not installed'
      return false
    }

    try {
      const useSsl = shouldUseSqlSsl(databaseUrl)

      sqlPool = new PgPool({
        connectionString: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      })

      await sqlPool.query('SELECT 1')
      await sqlPool.query(`
        CREATE TABLE IF NOT EXISTS app_state_snapshots (
          snapshot_key TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      sqlMirrorEnabled = true
      sqlMirrorLastError = null
      return true
    } catch (error) {
      sqlMirrorEnabled = false
      sqlMirrorLastError = error?.message || 'SQL mirror init failed'
      if (sqlPool) {
        try {
          await sqlPool.end()
        } catch {}
      }
      sqlPool = null
      return false
    }
  })()

  return sqlInitPromise
}

async function writeSqlSnapshot(snapshotPayload) {
  const ready = await initSqlMirror()
  if (!ready || !sqlPool) return false

  try {
    await sqlPool.query(
      `
      INSERT INTO app_state_snapshots (snapshot_key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (snapshot_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [SQL_SNAPSHOT_KEY, snapshotPayload],
    )
    sqlMirrorLastError = null
    return true
  } catch (error) {
    sqlMirrorLastError = error?.message || 'SQL snapshot write failed'
    return false
  }
}

async function readSqlSnapshotDb() {
  const ready = await initSqlMirror()
  if (!ready || !sqlPool) return null

  try {
    const result = await sqlPool.query(
      'SELECT payload FROM app_state_snapshots WHERE snapshot_key = $1 LIMIT 1',
      [SQL_SNAPSHOT_KEY],
    )
    const row = result?.rows?.[0]
    if (!row || !row.payload) return null

    const payload = row.payload
    if (typeof payload === 'string') {
      return JSON.parse(payload)
    }
    if (typeof payload === 'object') {
      return payload
    }
    return null
  } catch (error) {
    sqlMirrorLastError = error?.message || 'SQL snapshot read failed'
    return null
  }
}

function scheduleSqlSnapshotWrite(db) {
  const databaseUrl = getSqlDatabaseUrl()
  if (!databaseUrl) return

  const snapshotPayload = JSON.stringify(db)
  if (sqlMirrorWriteTimer) {
    clearTimeout(sqlMirrorWriteTimer)
  }

  sqlMirrorWriteTimer = setTimeout(() => {
    void writeSqlSnapshot(snapshotPayload)
  }, 150)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (Buffer.byteLength(data, 'utf8') > MAX_JSON_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch (e) {
        reject(new Error('Invalid JSON body'))
      }
    })
  })
}

function toPercent(probability) {
  const value = Number(probability)
  if (Number.isNaN(value)) return 0
  if (value <= 1) {
    return Math.max(0, Math.min(100, Math.round(value * 100)))
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

function listToSentence(values) {
  if (!Array.isArray(values) || values.length === 0) return ''
  return values.filter(Boolean).join(' ')
}

function normalizePlantIdDetection(payload) {
  const suggestions = payload?.result?.disease?.suggestions || payload?.health_assessment?.diseases || []
  const top = Array.isArray(suggestions) ? suggestions[0] : null

  const isHealthy = Boolean(
    payload?.result?.is_healthy?.binary === true
      || payload?.health_assessment?.is_healthy === true,
  )

  if (isHealthy) {
    const healthyProb = payload?.result?.is_healthy?.probability
      || payload?.result?.is_healthy?.probability_value
      || 0.85
    return {
      disease: 'No significant disease detected (healthy crop)',
      confidence: toPercent(healthyProb),
      advisory_en: 'The crop appears healthy from the uploaded image. Continue routine monitoring.',
      advisory_bn: 'আপলোড করা ছবিতে ফসল সুস্থ মনে হচ্ছে। নিয়মিত পর্যবেক্ষণ চালিয়ে যান।',
      treatment_en: 'No immediate treatment needed. Maintain irrigation, nutrition, and field hygiene.',
      treatment_bn: 'তাৎক্ষণিক চিকিৎসা প্রয়োজন নেই। সেচ, পুষ্টি ও জমির পরিচ্ছন্নতা বজায় রাখুন।',
      prevention_en: 'Inspect leaves every 2-3 days and remove stressed or damaged foliage early.',
      prevention_bn: 'প্রতি ২-৩ দিনে পাতা পর্যবেক্ষণ করুন এবং ক্ষতিগ্রস্ত পাতা দ্রুত অপসারণ করুন।',
      image_ref: payload?.input?.images?.[0],
    }
  }

  const details = top?.details || {}
  const commonNames = Array.isArray(details?.common_names) ? details.common_names.filter(Boolean) : []
  const scientificName = details?.scientific_name || details?.scientific_name_without_author
  const primaryName = top?.name || commonNames[0] || details?.local_name || scientificName || 'Unknown issue detected'
  const diseaseName = scientificName && scientificName !== primaryName
    ? `${primaryName} (${scientificName})`
    : primaryName

  const alternatives = (Array.isArray(suggestions) ? suggestions.slice(1, 3) : [])
    .map((item) => item?.name || item?.details?.local_name)
    .filter(Boolean)

  const probability = typeof top?.probability === 'number'
    ? top.probability
    : typeof top?.probability_value === 'number'
      ? top.probability_value
      : 0

  const treatment = details?.treatment || {}
  const chemical = listToSentence(treatment.chemical)
  const biological = listToSentence(treatment.biological)
  const prevention = listToSentence(treatment.prevention)

  const treatmentEn = [chemical, biological].filter(Boolean).join(' ')
  const preventionEn = prevention || 'Monitor the crop daily and remove infected leaves to reduce spread.'
  const descriptionEn = details?.description || 'Potential crop disease detected from the uploaded image.'
  const alternativeTextEn = alternatives.length ? ` Other possible diseases: ${alternatives.join(', ')}.` : ''
  const advisoryEn = `${descriptionEn}${alternativeTextEn}`
  const advisoryBn = alternatives.length
    ? `প্রাথমিকভাবে ${primaryName} শনাক্ত হয়েছে। সম্ভাব্য অন্যান্য রোগ: ${alternatives.join(', ')}।`
    : `প্রাথমিকভাবে ${primaryName} শনাক্ত হয়েছে।`

  const fallbackTreatmentBn = 'পরামর্শ অনুযায়ী উপযুক্ত ছত্রাকনাশক বা জৈব নিয়ন্ত্রণ প্রয়োগ করুন এবং আক্রান্ত অংশ অপসারণ করুন।'
  const fallbackPreventionBn = 'নিয়মিত মাঠ পর্যবেক্ষণ করুন, আক্রান্ত পাতা সরিয়ে ফেলুন এবং পরিষ্কার-পরিচ্ছন্নতা বজায় রাখুন।'

  return {
    disease: diseaseName,
    confidence: toPercent(probability),
    advisory_en: advisoryEn,
    advisory_bn: advisoryBn,
    treatment_en: treatmentEn || 'Consult a local agronomist before applying chemicals and follow label dosage.',
    treatment_bn: fallbackTreatmentBn,
    prevention_en: preventionEn,
    prevention_bn: fallbackPreventionBn,
    image_ref: payload?.input?.images?.[0],
  }
}

function dayBn(shortDay) {
  if (shortDay === 'Sun') return 'রবি'
  if (shortDay === 'Mon') return 'সোম'
  if (shortDay === 'Tue') return 'মঙ্গল'
  if (shortDay === 'Wed') return 'বুধ'
  if (shortDay === 'Thu') return 'বৃহস্পতি'
  if (shortDay === 'Fri') return 'শুক্র'
  if (shortDay === 'Sat') return 'শনি'
  return shortDay
}

function weatherCodeInfo(code) {
  const map = {
    0: { en: 'Clear sky', bn: 'আকাশ পরিষ্কার' },
    1: { en: 'Mainly clear', bn: 'প্রধানত পরিষ্কার' },
    2: { en: 'Partly cloudy', bn: 'আংশিক মেঘলা' },
    3: { en: 'Overcast', bn: 'মেঘাচ্ছন্ন' },
    45: { en: 'Fog', bn: 'কুয়াশা' },
    48: { en: 'Fog', bn: 'কুয়াশা' },
    51: { en: 'Drizzle', bn: 'ঝিরিঝিরি বৃষ্টি' },
    53: { en: 'Drizzle', bn: 'ঝিরিঝিরি বৃষ্টি' },
    55: { en: 'Dense drizzle', bn: 'ঘন ঝিরিঝিরি বৃষ্টি' },
    61: { en: 'Rain', bn: 'বৃষ্টি' },
    63: { en: 'Rain', bn: 'বৃষ্টি' },
    65: { en: 'Heavy rain', bn: 'ভারী বৃষ্টি' },
    71: { en: 'Snow fall', bn: 'তুষারপাত' },
    80: { en: 'Rain showers', bn: 'বৃষ্টির ঝাপটা' },
    81: { en: 'Rain showers', bn: 'বৃষ্টির ঝাপটা' },
    82: { en: 'Heavy showers', bn: 'ভারী ঝাপটা' },
    95: { en: 'Thunderstorm', bn: 'বজ্রঝড়' },
  }
  return map[code] || { en: 'Unknown', bn: 'অজানা' }
}

async function resolveLocationName(lat, lng) {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      language: 'en',
      format: 'json',
    })
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?${params.toString()}`)
    if (!response.ok) return null
    const payload = await response.json()
    const place = payload?.results?.[0]
    if (!place) return null

    return {
      name: place.name || null,
      admin1: place.admin1 || null,
      admin2: place.admin2 || null,
      country: place.country || null,
      timezone: place.timezone || null,
    }
  } catch {
    return null
  }
}

async function fetchLiveWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,pressure_msl,surface_pressure,is_day,uv_index,weather_code',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,dew_point_2m,visibility',
    daily: 'temperature_2m_max,precipitation_probability_max,precipitation_sum,uv_index_max',
    timezone: 'auto',
    forecast_days: '3',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch weather from provider')
  }

  const payload = await response.json()
  const locationName = await resolveLocationName(lat, lng)
  const current = payload.current || {}
  const currentUnits = payload.current_units || {}
  const code = Number(current.weather_code || 0)
  const codeInfo = weatherCodeInfo(code)

  // Extract hourly rain probability for next 24 hours
  const hourlyTimes = payload.hourly?.time || []
  const hourlyPrecipProb = payload.hourly?.precipitation_probability || []
  const hourlyPrecip = payload.hourly?.precipitation || []
  const hourlyTemp = payload.hourly?.temperature_2m || []
  const hourlyFeelsLike = payload.hourly?.apparent_temperature || []
  const hourlyWind = payload.hourly?.wind_speed_10m || []
  const hourlyGust = payload.hourly?.wind_gusts_10m || []
  const hourlyDewPoint = payload.hourly?.dew_point_2m || []
  const hourlyVisibility = payload.hourly?.visibility || []

  const nextDay24Hours = []
  const currentHourIso = typeof current.time === 'string' ? current.time : ''
  const matchedCurrentHourIndex = currentHourIso ? hourlyTimes.findIndex((entry) => entry === currentHourIso) : -1
  let hourlyStartIndex = matchedCurrentHourIndex >= 0 ? matchedCurrentHourIndex : 0

  if (hourlyStartIndex === 0 && hourlyTimes.length > 0 && matchedCurrentHourIndex < 0) {
    const nowMs = Date.now()
    const nearestFutureIndex = hourlyTimes.findIndex((entry) => {
      const timestamp = new Date(entry).getTime()
      if (!Number.isFinite(timestamp)) return false
      return timestamp >= nowMs - (30 * 60 * 1000)
    })
    if (nearestFutureIndex >= 0) {
      hourlyStartIndex = nearestFutureIndex
    }
  }

  const hourlyEndIndex = Math.min(hourlyStartIndex + 24, hourlyTimes.length)

  for (let i = hourlyStartIndex; i < hourlyEndIndex; i++) {
    const timeStr = hourlyTimes[i]
    const time = new Date(timeStr)
    const hour = time.getHours()

    nextDay24Hours.push({
      hour,
      timeStr: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      precipProb: Math.round(Number(hourlyPrecipProb[i] || 0)),
      precipAmount: Math.round(Number(hourlyPrecip[i] || 0) * 10) / 10, // mm of rain
      temp: Math.round(Number(hourlyTemp[i] || 0)),
      feelsLike: Math.round(Number(hourlyFeelsLike[i] || 0)),
      windSpeed: Math.round(Number(hourlyWind[i] || 0)),
      windGust: Math.round(Number(hourlyGust[i] || 0)),
      dewPoint: Math.round(Number(hourlyDewPoint[i] || 0)),
      visibilityKm: Math.round((Number(hourlyVisibility[i] || 0) / 1000) * 10) / 10,
    })
  }

  // Calculate peak rain hour and average probability from upcoming forecast window.
  const maxRainProb = nextDay24Hours.length > 0
    ? Math.max(...nextDay24Hours.map((hour) => hour.precipProb), 0)
    : 0
  const peakRainHour = nextDay24Hours.find((hour) => hour.precipProb === maxRainProb)
  const avgRainProb = nextDay24Hours.length > 0
    ? Math.round(nextDay24Hours.reduce((sum, hour) => sum + hour.precipProb, 0) / nextDay24Hours.length)
    : 0

  const currentHourForecast = nextDay24Hours[0] || null
  const nextHourForecast = nextDay24Hours[1] || currentHourForecast

  const forecast = (payload.daily?.time || []).map((dateStr, index) => {
    const date = new Date(dateStr)
    const day = date.toLocaleDateString('en-US', { weekday: 'short' })
    return {
      day,
      day_bn: dayBn(day),
      temp: Math.round(Number(payload.daily?.temperature_2m_max?.[index] || 0)),
      rainfall: Math.round(Number(payload.daily?.precipitation_probability_max?.[index] || 0)),
      precipitationSum: Math.round(Number(payload.daily?.precipitation_sum?.[index] || 0) * 10) / 10, // mm
      uvIndex: Math.round(Number(payload.daily?.uv_index_max?.[index] || 0)),
    }
  })

  const rainfallChance = forecast[0]?.rainfall || 0
  const nextHourRainProb = Number(nextHourForecast?.precipProb || 0)
  const windGust = Math.round(Number(current.wind_gusts_10m || 0))
  const windDirection = Math.round(Number(current.wind_direction_10m || 0))
  const feelsLike = Math.round(Number(current.apparent_temperature || current.temperature_2m || 0))
  const cloudCover = Math.round(Number(current.cloud_cover || 0))
  const uvIndex = Math.round(Number(current.uv_index || 0))
  const pressure = Math.round(Number(current.pressure_msl || current.surface_pressure || 0))
  const visibilityKm = Number.isFinite(currentHourForecast?.visibilityKm)
    ? Number(currentHourForecast.visibilityKm)
    : 0
  const dewPoint = Number.isFinite(currentHourForecast?.dewPoint)
    ? Number(currentHourForecast.dewPoint)
    : 0
  const alerts = []
  if (rainfallChance >= 70) {
    alerts.push({
      message: 'Heavy rainfall expected in the next 24 hours',
      message_bn: 'আগামী ২৪ ঘন্টায় ভারী বৃষ্টির সম্ভাবনা',
    })
  }
  if (rainfallChance >= 50 && rainfallChance < 70) {
    alerts.push({
      message: 'Moderate rainfall possible - plan irrigation accordingly',
      message_bn: 'মধ্যম বৃষ্টির সম্ভাবনা - সেচ পরিকল্পনা অনুযায়ী করুন',
    })
  }
  if (Number(current.temperature_2m) >= 35) {
    alerts.push({
      message: 'High temperature stress risk for crops',
      message_bn: 'উচ্চ তাপমাত্রার কারণে ফসলের চাপের ঝুঁকি',
    })
  }
  if (windGust >= 35) {
    alerts.push({
      message: 'Strong wind gusts may affect spraying and young plants',
      message_bn: 'শক্তিশালী বাতাস স্প্রে ও নতুন গাছের উপর প্রভাব ফেলতে পারে',
    })
  }

  return {
    source: 'open-meteo',
    location: {
      lat: Number(lat),
      lng: Number(lng),
      name: locationName?.name || null,
      admin1: locationName?.admin1 || null,
      admin2: locationName?.admin2 || null,
      country: locationName?.country || null,
      timezone: locationName?.timezone || null,
    },
    current: {
      temp: Math.round(Number(current.temperature_2m || 0)),
      feelsLike,
      condition: codeInfo.en,
      condition_bn: codeInfo.bn,
      humidity: Math.round(Number(current.relative_humidity_2m || 0)),
      rainfall: Math.round(Number(current.precipitation || 0)),
      rainProbability1h: nextHourRainProb,
      rainProbability: avgRainProb,
      windSpeed: Math.round(Number(current.wind_speed_10m || 0)),
      windGust,
      windDirection,
      cloudCover,
      uvIndex,
      pressure,
      visibilityKm,
      dewPoint,
      isDay: Number(current.is_day || 0) === 1,
      weatherCode: code,
      unitTemp: currentUnits.temperature_2m || '°C',
      unitWind: currentUnits.wind_speed_10m || 'km/h',
    },
    rainForecast: {
      nextDay: nextDay24Hours,
      peakRainHour: peakRainHour ? `${peakRainHour.hour}:00` : 'N/A',
      peakRainTime: peakRainHour?.timeStr || 'N/A',
      maxRainProb,
      averageRainProb: avgRainProb,
    },
    alerts,
    forecast,
    liveSummary: {
      feelsLike,
      windGust,
      cloudCover,
      uvIndex,
      rainRisk: avgRainProb >= 70 ? 'high' : avgRainProb >= 50 ? 'moderate' : avgRainProb >= 30 ? 'low' : 'minimal',
    },
    updatedAt: nowIso(),
  }
}

function estimateYieldAdvice({ crop, moisture, weather }) {
  const cropName = crop || 'Rice'
  const humidity = Number(weather?.current?.humidity || 0)
  const rainChance = Number(weather?.forecast?.[0]?.rainfall || 0)
  const temp = Number(weather?.current?.temp || 0)

  const moisturePenalty = moisture < 55 ? 0.25 : moisture > 80 ? 0.1 : 0
  const rainPenalty = rainChance > 75 ? 0.12 : 0
  const tempPenalty = temp > 35 ? 0.1 : 0
  const humidityPenalty = humidity > 85 ? 0.08 : 0
  const totalPenalty = Math.min(0.45, moisturePenalty + rainPenalty + tempPenalty + humidityPenalty)

  const baseYield = 4.2
  const expected = Number((baseYield * (1 - totalPenalty)).toFixed(2))
  const deltaPct = Number((((expected - baseYield) / baseYield) * 100).toFixed(1))

  const adviceEn = []
  const adviceBn = []

  if (moisture < 55) {
    adviceEn.push('Soil moisture is low. Irrigate within the next 6-8 hours.')
    adviceBn.push('মাটির আর্দ্রতা কম। আগামী ৬-৮ ঘন্টার মধ্যে সেচ দিন।')
  }
  if (rainChance > 70) {
    adviceEn.push('High rain probability. Avoid over-irrigation and ensure drainage.')
    adviceBn.push('বৃষ্টির সম্ভাবনা বেশি। অতিরিক্ত সেচ এড়িয়ে পানি নিষ্কাশন নিশ্চিত করুন।')
  }
  if (humidity > 85) {
    adviceEn.push('High humidity may increase disease risk. Monitor leaves daily.')
    adviceBn.push('উচ্চ আর্দ্রতায় রোগের ঝুঁকি বাড়ে। প্রতিদিন পাতা পর্যবেক্ষণ করুন।')
  }
  if (temp > 35) {
    adviceEn.push('High temperature stress detected. Prefer early morning irrigation.')
    adviceBn.push('উচ্চ তাপমাত্রার চাপ রয়েছে। ভোরে সেচ দেওয়া ভালো।')
  }

  if (adviceEn.length === 0) {
    adviceEn.push('Current conditions are favorable. Maintain current irrigation schedule.')
    adviceBn.push('বর্তমান অবস্থা অনুকূল। বর্তমান সেচ সূচি বজায় রাখুন।')
  }

  return {
    crop: cropName,
    crop_bn: cropName,
    expectedYieldTonsPerAcre: expected,
    deltaPercent: deltaPct,
    trend: deltaPct >= 0 ? 'up' : 'down',
    advice_en: adviceEn,
    advice_bn: adviceBn,
    basedOn: {
      moisture,
      humidity,
      rainChance,
      temperature: temp,
    },
    updatedAt: nowIso(),
  }
}

const IRRIGATION_CROP_PROFILES = {
  Rice: { crop: 'Rice', crop_bn: 'ধান', threshold: 65, window: '6:00 AM - 8:00 AM', maxVolume: 150 },
  Wheat: { crop: 'Wheat', crop_bn: 'গম', threshold: 55, window: '6:30 AM - 8:30 AM', maxVolume: 110 },
  Maize: { crop: 'Maize', crop_bn: 'ভুট্টা', threshold: 58, window: '6:00 AM - 8:00 AM', maxVolume: 120 },
  Vegetables: { crop: 'Vegetables', crop_bn: 'সবজি', threshold: 62, window: '5:30 AM - 7:30 AM', maxVolume: 95 },
  Potato: { crop: 'Potato', crop_bn: 'আলু', threshold: 60, window: '6:00 AM - 8:00 AM', maxVolume: 105 },
}

function getIrrigationCropPolicy(cropName) {
  const key = typeof cropName === 'string' ? cropName.trim() : ''
  return IRRIGATION_CROP_PROFILES[key] || IRRIGATION_CROP_PROFILES.Rice
}

function normalizeLandAreaAcres(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(0.1, Math.min(50, Math.round(parsed * 10) / 10))
}

function calculateIrrigationMaxVolume(cropName, landAreaAcres) {
  const profile = getIrrigationCropPolicy(cropName)
  const area = normalizeLandAreaAcres(landAreaAcres)
  const perAcreVolume = Number(profile?.maxVolume || 120)
  return Math.max(1, Math.round(perAcreVolume * area))
}

function calculateDefaultPumpCapacityLpm(landAreaAcres) {
  const area = normalizeLandAreaAcres(landAreaAcres)
  return Math.max(20, Math.round(35 * area))
}

function normalizePumpCapacityLpm(value, landAreaAcres = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return calculateDefaultPumpCapacityLpm(landAreaAcres)
  }
  return Math.max(5, Math.min(5000, Math.round(parsed)))
}

function normalizeMaxCycleMinutes(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 12
  return Math.max(1, Math.min(120, Math.round(parsed)))
}

function applyPumpCapacityForCycle({ targetLiters, pumpCapacityLpm, maxCycleMinutes, respectCycleLimit = true }) {
  const safeTarget = Math.max(0, Number(targetLiters || 0))
  const safeCapacity = Math.max(1, Number(pumpCapacityLpm || 1))
  const safeMaxCycleMinutes = Math.max(1, Number(maxCycleMinutes || 1))

  if (safeTarget <= 0) {
    return {
      targetLiters: 0,
      appliedLiters: 0,
      runtimeSeconds: 0,
      cappedByCycle: false,
    }
  }

  const flowPerSecond = safeCapacity / 60
  const requiredSeconds = safeTarget / flowPerSecond
  const allowedSeconds = respectCycleLimit ? (safeMaxCycleMinutes * 60) : requiredSeconds
  const runtimeSeconds = Math.max(1, Math.ceil(Math.min(requiredSeconds, allowedSeconds)))
  const deliveredLiters = Math.max(1, Math.round(flowPerSecond * runtimeSeconds))
  const appliedLiters = Math.min(safeTarget, deliveredLiters)

  return {
    targetLiters: safeTarget,
    appliedLiters,
    runtimeSeconds,
    cappedByCycle: respectCycleLimit && (requiredSeconds > allowedSeconds),
  }
}

function createDefaultIrrigationSchedule(userId, cropName = 'Rice') {
  const profile = getIrrigationCropPolicy(cropName)
  const landAreaAcres = 1
  const pumpCapacityLpm = calculateDefaultPumpCapacityLpm(landAreaAcres)
  return {
    id: userId,
    userId,
    autoMode: true,
    moisture: 68,
    nextWatering: 'Tomorrow 6 AM',
    nextWatering_bn: 'আগামীকাল সকাল ৬টা',
    amount: '45L',
    usage: [
      { id: 'usage-mon', day: 'Mon', day_bn: 'সোম', amount: 120 },
      { id: 'usage-tue', day: 'Tue', day_bn: 'মঙ্গল', amount: 140 },
      { id: 'usage-wed', day: 'Wed', day_bn: 'বুধ', amount: 100 },
      { id: 'usage-thu', day: 'Thu', day_bn: 'বৃহস্পতি', amount: 160 },
      { id: 'usage-fri', day: 'Fri', day_bn: 'শুক্র', amount: 130 },
      { id: 'usage-sat', day: 'Sat', day_bn: 'শনি', amount: 150 },
      { id: 'usage-sun', day: 'Sun', day_bn: 'রবি', amount: 110 },
    ],
    sensorHistory: [
      {
        id: id('sensor_tick'),
        timestamp: nowIso(),
        moisture: 68,
        measuredMoisture: 68,
        action: 'seed',
        appliedLiters: 0,
      },
    ],
    alerts: [],
    policy: {
      crop: profile.crop,
      crop_bn: profile.crop_bn,
      threshold: profile.threshold,
      window: profile.window,
      landAreaAcres,
      maxVolume: calculateIrrigationMaxVolume(profile.crop, landAreaAcres),
      pumpCapacityLpm,
      maxCycleMinutes: 12,
      alarmTickThreshold: 3,
    },
    updatedAt: nowIso(),
  }
}

function upsertIrrigationUsageForToday(schedule, liters) {
  const amount = Math.max(0, Number(liters || 0))
  const day = new Date().toLocaleDateString('en-US', { weekday: 'short' })
  const day_bn = dayBn(day)
  const usage = Array.isArray(schedule.usage) ? [...schedule.usage] : []
  const idx = usage.findIndex((item) => item?.day === day)
  if (idx >= 0) {
    usage[idx] = {
      ...usage[idx],
      amount: Math.max(0, Number(usage[idx].amount || 0) + amount),
    }
  } else {
    usage.push({ id: id('usage'), day, day_bn, amount })
  }
  return usage
}

function appendSensorHistory(schedule, { measuredMoisture, moisture, action, appliedLiters, runtimeSeconds, flowRateLpm, targetLiters }) {
  const history = Array.isArray(schedule.sensorHistory) ? [...schedule.sensorHistory] : []
  history.push({
    id: id('sensor_tick'),
    timestamp: nowIso(),
    measuredMoisture: Number(measuredMoisture),
    moisture: Number(moisture),
    action: action || 'idle',
    appliedLiters: Number(appliedLiters || 0),
    runtimeSeconds: Number(runtimeSeconds || 0),
    flowRateLpm: Number(flowRateLpm || 0),
    targetLiters: Number(targetLiters || 0),
  })
  return history.slice(-20)
}

function normalizeForcedPumpAction(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'on') return 'on'
  if (normalized === 'off') return 'off'
  return null
}

function normalizeSimulationTickMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'sensor-only') return 'sensor-only'
  return 'decision'
}

function normalizeAlarmTickThreshold(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 3
  return Math.max(2, Math.min(4, Math.round(parsed)))
}

function runAutoIrrigationDecision(schedule, measuredMoisture, options = {}) {
  const threshold = Number(schedule?.policy?.threshold || 60)
  const maxVolume = Number(schedule?.policy?.maxVolume || 120)
  const landAreaAcres = normalizeLandAreaAcres(schedule?.policy?.landAreaAcres ?? 1)
  const pumpCapacityLpm = normalizePumpCapacityLpm(schedule?.policy?.pumpCapacityLpm, landAreaAcres)
  const maxCycleMinutes = normalizeMaxCycleMinutes(schedule?.policy?.maxCycleMinutes)
  const tickMode = normalizeSimulationTickMode(options?.tickMode)
  const forcePump = normalizeForcedPumpAction(options?.forcePump)
  const requestedLiters = Number(options?.manualLiters || 0)
  const requestedRuntimeMinutes = Number(options?.manualRuntimeMinutes || 0)
  const safeRequestedRuntimeMinutes = Number.isFinite(requestedRuntimeMinutes)
    ? Math.max(0, Math.round(requestedRuntimeMinutes))
    : 0
  const safeRequestedLiters = Number.isFinite(requestedLiters) ? requestedLiters : 0
  const nextSchedule = { ...schedule, moisture: measuredMoisture, alerts: [] }
  let action = 'idle'
  let appliedLiters = 0
  let runtimeSeconds = 0
  let targetLiters = 0
  let reason = 'Sensor tick processed'

  if (forcePump === 'on') {
    const fallbackManualLiters = Math.max(1, Math.round(45 * landAreaAcres))
    const manualUpperBound = Math.max(50000, Math.round(maxVolume * 1000))
    targetLiters = Math.min(manualUpperBound, Math.max(1, Math.round(safeRequestedLiters || fallbackManualLiters)))
    const cycle = applyPumpCapacityForCycle({
      targetLiters,
      pumpCapacityLpm,
      maxCycleMinutes,
      respectCycleLimit: false,
    })
    const logicalRuntimeSeconds = Number(cycle.runtimeSeconds || 0)
    const minimumRuntimeSeconds = Math.max(0, safeRequestedRuntimeMinutes * 60)
    appliedLiters = cycle.appliedLiters
    runtimeSeconds = Math.max(logicalRuntimeSeconds, minimumRuntimeSeconds)
    const moistureLift = Math.max(6, Math.round(appliedLiters * 0.35))
    nextSchedule.moisture = Math.min(95, measuredMoisture + moistureLift)
    nextSchedule.amount = `${appliedLiters}L`
    nextSchedule.nextWatering = 'Manual simulation cycle complete'
    nextSchedule.nextWatering_bn = 'ম্যানুয়াল সিমুলেশন চক্র সম্পন্ন'
    nextSchedule.alerts = [
      {
        message: 'Virtual pump forced ON for simulation.',
        message_bn: 'সিমুলেশনের জন্য ভার্চুয়াল পাম্প চালু করা হয়েছে।',
      },
    ]
    action = 'watering'
    reason = cycle.cappedByCycle
      ? `Manual watering partially delivered due to cycle limit (${maxCycleMinutes} min)`
      : `Manual watering delivered using ${pumpCapacityLpm} L/min capacity`
    nextSchedule.usage = upsertIrrigationUsageForToday(nextSchedule, appliedLiters)
  } else if (forcePump === 'off') {
    nextSchedule.amount = '0L'
    nextSchedule.nextWatering = 'Pump forced OFF for simulation'
    nextSchedule.nextWatering_bn = 'সিমুলেশনের জন্য পাম্প বন্ধ রাখা হয়েছে'
    nextSchedule.alerts = [
      {
        message: 'Virtual pump forced OFF for simulation.',
        message_bn: 'সিমুলেশনের জন্য ভার্চুয়াল পাম্প বন্ধ রাখা হয়েছে।',
      },
    ]
    action = 'idle'
    reason = 'Virtual pump forced OFF for simulation'
  } else if (tickMode === 'sensor-only') {
    nextSchedule.amount = nextSchedule.amount || '0L'
    nextSchedule.nextWatering = nextSchedule.nextWatering || 'Sensor-only tick captured'
    nextSchedule.nextWatering_bn = nextSchedule.nextWatering_bn || 'শুধু সেন্সর টিক রেকর্ড হয়েছে'
    nextSchedule.alerts = []
    action = 'idle'
    reason = 'Sensor-only random tick processed (pump unchanged)'
  } else if (nextSchedule.autoMode && measuredMoisture < threshold) {
    const deficit = threshold - measuredMoisture
    const minAutoLiters = Math.max(1, Math.round(20 * landAreaAcres))
    const deficitDrivenLiters = Math.round(deficit * 3.2 * landAreaAcres)
    targetLiters = Math.min(maxVolume, Math.max(minAutoLiters, deficitDrivenLiters))
    const cycle = applyPumpCapacityForCycle({
      targetLiters,
      pumpCapacityLpm,
      maxCycleMinutes,
      respectCycleLimit: false,
    })
    appliedLiters = cycle.appliedLiters
    runtimeSeconds = cycle.runtimeSeconds
    const deliveryRatio = targetLiters > 0 ? Math.max(0.2, appliedLiters / targetLiters) : 0
    const moistureLift = Math.max(4, Math.round(Math.max(8, deficit * 0.9) * deliveryRatio))
    nextSchedule.moisture = Math.min(95, measuredMoisture + moistureLift)
    nextSchedule.amount = `${appliedLiters}L`
    nextSchedule.nextWatering = 'Auto adjusted after sensor reading'
    nextSchedule.nextWatering_bn = 'সেন্সর রিডিং অনুযায়ী স্বয়ংক্রিয় সমন্বয়'
    nextSchedule.alerts = [
      {
        message: `Auto irrigation applied for ${nextSchedule.policy?.crop || 'crop'} due to low soil moisture.`,
        message_bn: `মাটির আর্দ্রতা কম থাকায় ${nextSchedule.policy?.crop_bn || 'ফসল'}-এ স্বয়ংক্রিয় সেচ চালু হয়েছে।`,
      },
    ]
    action = 'watering'
    reason = cycle.cappedByCycle
      ? `Auto watering reached cycle limit (${maxCycleMinutes} min); remaining demand carries to next tick`
      : 'Automatic irrigation applied from virtual sensor'
    nextSchedule.usage = upsertIrrigationUsageForToday(nextSchedule, appliedLiters)
  } else {
    nextSchedule.amount = nextSchedule.amount || '0L'
    nextSchedule.nextWatering = nextSchedule.nextWatering || 'Monitor in 2 hours'
    nextSchedule.nextWatering_bn = nextSchedule.nextWatering_bn || '২ ঘণ্টা পরে পুনরায় দেখুন'
    reason = 'No watering needed based on moisture threshold'
  }

  nextSchedule.updatedAt = nowIso()
  return {
    schedule: nextSchedule,
    action,
    appliedLiters,
    runtimeSeconds,
    targetLiters,
    pumpCapacityLpm,
    reason,
  }
}

function send(res, status, payload) {
  if (res.headersSent || res.writableEnded) {
    console.error('Cannot send response: headers already sent', { status, payload })
    if (!res.writableEnded) {
      try {
        res.end()
      } catch (endErr) {
        console.error('Failed to close response after headers were already sent', endErr)
      }
    }
    return
  }

  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function nowIso() {
  return new Date().toISOString()
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

function roleBn(role) {
  if (role === 'farmer') return 'কৃষক'
  if (role === 'doctor') return 'ডাক্তার'
  if (role === 'super_admin') return 'সুপার ইউজার'
  return 'অ্যাডমিন'
}

function isAdminRole(role) {
  return role === 'admin' || role === 'super_admin'
}

function isPrimaryAdmin(user) {
  return user?.role === 'admin'
}

function isSuperUser(user) {
  return user?.role === 'super_admin'
}

function isMainAdmin(user) {
  return user?.email === 'admin@smartfarming.local'
}

function normalizeDeviceHelpLine(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const sanitized = raw.replace(/[^+\d]/g, '')
  if (!sanitized) return ''

  if (sanitized.startsWith('+')) {
    return `+${sanitized.slice(1).replace(/\+/g, '')}`
  }

  return sanitized.replace(/\+/g, '')
}

function isValidDeviceHelpLine(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 6
}

function getDeviceHelpLineNumber(db) {
  const stored = normalizeDeviceHelpLine(db?.app_settings?.device_help_line)
  if (stored && isValidDeviceHelpLine(stored)) {
    return stored
  }

  const envValue = normalizeDeviceHelpLine(ENV_DEVICE_HELP_LINE)
  if (envValue && isValidDeviceHelpLine(envValue)) {
    return envValue
  }

  return DEFAULT_DEVICE_HELP_LINE
}

function setDeviceHelpLineNumber(db, value) {
  const normalized = normalizeDeviceHelpLine(value)
  if (!isValidDeviceHelpLine(normalized)) {
    throw new Error('Help line number must contain at least 6 digits')
  }

  db.app_settings ||= {}
  db.app_settings.device_help_line = normalized
  db.app_settings.updated_at = nowIso()

  return normalized
}

function getSensorStatusLabels(status) {
  switch (status) {
    case 'healthy':
      return { en: 'Healthy', bn: 'স্বাভাবিক' }
    case 'warning':
      return { en: 'Attention', bn: 'সতর্কতা' }
    case 'not-working':
      return { en: 'Not Working', bn: 'কাজ করছে না' }
    case 'broken':
      return { en: 'Broken', bn: 'বিকল' }
    default:
      return { en: 'No Sensor', bn: 'সেন্সর নেই' }
  }
}

function evaluateDeviceSensorHealth(device) {
  const rawStatus = String(device?.status || 'active').trim().toLowerCase()
  const offlineStatuses = new Set(['offline', 'inactive', 'disconnected'])
  const brokenStatuses = new Set(['broken', 'fault', 'error'])
  const lastSyncMs = new Date(device?.lastSync || 0).getTime()
  const hasValidSync = Number.isFinite(lastSyncMs) && lastSyncMs > 0
  const syncAgeMinutes = hasValidSync
    ? Math.max(0, Math.round((Date.now() - lastSyncMs) / 60000))
    : null
  const staleSync = typeof syncAgeMinutes === 'number' && syncAgeMinutes > 45
  const battery = Number(device?.telemetry?.battery)
  const lowBattery = Number.isFinite(battery) && battery <= 10
  const moisture = Number(device?.telemetry?.soilMoisture)
  const missingMoisture = !Number.isFinite(moisture)

  let health = 'healthy'
  let reason = 'Sensor reporting normally'
  let reasonBn = 'সেন্সর স্বাভাবিকভাবে তথ্য দিচ্ছে'

  if (brokenStatuses.has(rawStatus)) {
    health = 'broken'
    reason = 'Device reported a broken/fault status'
    reasonBn = 'ডিভাইস বিকল বা ত্রুটি স্ট্যাটাস দেখাচ্ছে'
  } else if (offlineStatuses.has(rawStatus)) {
    health = 'not-working'
    reason = 'Device is offline or inactive'
    reasonBn = 'ডিভাইস অফলাইন বা নিষ্ক্রিয়'
  } else if (!hasValidSync || staleSync) {
    health = 'not-working'
    reason = 'No recent sensor sync from device'
    reasonBn = 'ডিভাইস থেকে সাম্প্রতিক সেন্সর সিঙ্ক পাওয়া যায়নি'
  } else if (missingMoisture) {
    health = 'warning'
    reason = 'Sensor data is incomplete (moisture missing)'
    reasonBn = 'সেন্সর ডাটা অসম্পূর্ণ (ময়েশ্চার পাওয়া যায়নি)'
  } else if (lowBattery) {
    health = 'warning'
    reason = 'Device battery is critically low'
    reasonBn = 'ডিভাইসের ব্যাটারি খুব কম'
  }

  return {
    health,
    reason,
    reasonBn,
    syncAgeMinutes,
  }
}

function buildUserSensorStatusSummary(user, devices = []) {
  const deviceList = Array.isArray(devices) ? devices.filter(Boolean) : []
  const labelsNoSensor = getSensorStatusLabels('no-device')

  if (!deviceList.length) {
    return {
      userId: user?.id || null,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || null,
      userRole: user?.role || 'farmer',
      userRoleBn: user?.role_bn || roleBn(user?.role || 'farmer'),
      sensorStatus: 'no-device',
      sensorStatusLabel: labelsNoSensor.en,
      sensorStatusLabelBn: labelsNoSensor.bn,
      issueReason: 'No registered irrigation sensor device',
      issueReasonBn: 'কোনো নিবন্ধিত সেচ সেন্সর ডিভাইস নেই',
      deviceCount: 0,
      activeDeviceCount: 0,
      warningDeviceCount: 0,
      notWorkingDeviceCount: 0,
      brokenDeviceCount: 0,
      lastSync: null,
      primaryDevice: null,
      primaryTelemetry: {},
    }
  }

  const evaluated = deviceList.map((device) => ({
    device,
    health: evaluateDeviceSensorHealth(device),
  }))

  const broken = evaluated.filter((item) => item.health.health === 'broken')
  const notWorking = evaluated.filter((item) => item.health.health === 'not-working')
  const warning = evaluated.filter((item) => item.health.health === 'warning')
  const healthy = evaluated.filter((item) => item.health.health === 'healthy')

  let sensorStatus = 'healthy'
  let statusSource = evaluated[0]

  if (broken.length > 0) {
    sensorStatus = 'broken'
    statusSource = broken[0]
  } else if (notWorking.length > 0) {
    sensorStatus = 'not-working'
    statusSource = notWorking[0]
  } else if (warning.length > 0) {
    sensorStatus = 'warning'
    statusSource = warning[0]
  }

  const labels = getSensorStatusLabels(sensorStatus)
  const primaryDevice = deviceList.find((item) => item?.type === 'virtual_soil_sensor') || deviceList[0]

  return {
    userId: user?.id || null,
    userName: user?.name || 'Unknown',
    userEmail: user?.email || null,
    userRole: user?.role || 'farmer',
    userRoleBn: user?.role_bn || roleBn(user?.role || 'farmer'),
    sensorStatus,
    sensorStatusLabel: labels.en,
    sensorStatusLabelBn: labels.bn,
    issueReason: statusSource?.health?.reason || 'Sensor reporting normally',
    issueReasonBn: statusSource?.health?.reasonBn || 'সেন্সর স্বাভাবিকভাবে তথ্য দিচ্ছে',
    deviceCount: deviceList.length,
    activeDeviceCount: healthy.length,
    warningDeviceCount: warning.length,
    notWorkingDeviceCount: notWorking.length,
    brokenDeviceCount: broken.length,
    lastSync: primaryDevice?.lastSync || null,
    primaryDevice: {
      id: primaryDevice?.id || null,
      name: primaryDevice?.name || null,
      type: primaryDevice?.type || null,
      mode: primaryDevice?.mode || null,
      status: primaryDevice?.status || null,
      actuatorState: primaryDevice?.actuatorState || null,
    },
    primaryTelemetry: {
      soilMoisture: Number(primaryDevice?.telemetry?.soilMoisture),
      battery: Number(primaryDevice?.telemetry?.battery),
      temperature: Number(primaryDevice?.telemetry?.temperature),
      humidity: Number(primaryDevice?.telemetry?.humidity),
    },
  }
}

function pushUserAlert(db, userId, payload = {}) {
  if (!userId) return
  const alert = {
    id: id('alert'),
    userId,
    crop: payload.crop || null,
    threshold: payload.threshold || null,
    direction: payload.direction || 'system',
    type: payload.type || 'system',
    message: payload.message || 'System notification',
    message_bn: payload.message_bn || 'সিস্টেম নোটিফিকেশন',
    createdAt: nowIso(),
    read: false,
  }
  db.alerts[alert.id] = alert
  db.alertsByUser[userId] ||= []
  db.alertsByUser[userId].push(alert.id)
  emitRealtime(`alerts:${userId}`, { action: 'new', alert }, userId)
}

function recordAuditLog(db, payload = {}) {
  const logId = id('audit')
  const log = {
    id: logId,
    actorId: payload.actorId || null,
    actorEmail: payload.actorEmail || null,
    action: payload.action || 'unknown',
    targetUserId: payload.targetUserId || null,
    targetEmail: payload.targetEmail || null,
    metadata: payload.metadata || {},
    createdAt: nowIso(),
  }
  db.audit_logs ||= {}
  db.audit_logs[logId] = log
}

function sanitizeSelfUserUpdates(updates = {}) {
  const allowed = new Set([
    'name',
    'phone',
    'language',
    'favorites',
    'consent_flags',
    'location',
    'location_bn',
    'specialty',
    'specialty_bn',
    'registrationNumber',
    'profileSummary',
    'experienceYears',
  ])

  const next = {}
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (allowed.has(key)) {
      next[key] = value
    }
  })

  return next
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 120000
  const keylen = 32
  const digest = 'sha256'
  const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex')
  // Format: pbkdf2$sha256$120000$salt$derivedHex
  return `pbkdf2$${digest}$${iterations}$${salt}$${derived}`
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts[0] !== 'pbkdf2') return false

  // Support both:
  // - pbkdf2$sha256$120000$salt$derived
  // - pbkdf2$$sha256$$120000$$salt$$derived (older accidental format)
  const normalized = parts.filter((p) => p !== '')
  if (normalized.length !== 5) return false

  const digest = normalized[1]
  const iterations = Number(normalized[2])
  const salt = normalized[3]
  const derived = normalized[4]
  const computed = crypto.pbkdf2Sync(password, salt, iterations, derived.length / 2, digest).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(derived, 'hex'))
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) return { valid: false, error: 'Invalid email address format' }
  return { valid: true }
}

function validatePasswordStrength(password) {
  if (!password || password.length < 10) return { valid: false, error: 'Password must be at least 10 characters' }
  if (password.length > 100) return { valid: false, error: 'Password is too long' }
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must include a lowercase letter' }
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must include an uppercase letter' }
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must include a number' }
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Password must include a special character' }
  return { valid: true }
}

function normalizeTextField(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/\"/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePriceRecord(record) {
  if (!record || typeof record !== 'object') return record

  const locationRaw = normalizeTextField(record.location)
  const locationBnRaw = normalizeTextField(record.location_bn || record.llocation_bn)
  const marketRaw = normalizeTextField(record.market)
  const cropRaw = normalizeTextField(record.crop)

  const normalized = {
    ...record,
    crop: cropRaw || 'Unknown Crop',
    crop_bn: normalizeTextField(record.crop_bn) || cropRaw,
    location: locationRaw || 'Unknown',
    location_bn: locationBnRaw,
    market: marketRaw || 'Unknown Market',
    unit: normalizeTextField(record.unit) || 'kg',
  }

  for (const key of Object.keys(normalized)) {
    if (/location_bn/i.test(key) && key !== 'location_bn') {
      delete normalized[key]
    }
  }

  if (!normalized.location_bn) {
    normalized.location_bn = normalized.location === 'Dhaka'
      ? 'ঢাকা'
      : normalized.location === 'Chittagong'
        ? 'চট্টগ্রাম'
        : normalized.location
  }

  const numericPrice = Number(normalized.price)
  normalized.price = Number.isFinite(numericPrice) ? numericPrice : 0

  // Fix legacy rice records that were accidentally stored as per-maund prices with unit=kg.
  if (
    normalized.unit.toLowerCase() === 'kg' &&
    String(normalized.crop).toLowerCase() === 'rice' &&
    normalized.price > 300
  ) {
    normalized.price = Number((normalized.price / 40).toFixed(2))
  }

  const numericChange = Number(normalized.changePercent)
  normalized.changePercent = Number.isFinite(numericChange) ? numericChange : 0

  if (!['up', 'down', 'stable'].includes(normalized.trend)) {
    normalized.trend = normalized.changePercent > 0 ? 'up' : normalized.changePercent < 0 ? 'down' : 'stable'
  }

  const allowedKeys = new Set([
    'id',
    'crop',
    'crop_bn',
    'price',
    'unit',
    'location',
    'location_bn',
    'market',
    'trend',
    'changePercent',
    'change',
    'date',
    'lastUpdated',
    'lastUpdated_bn',
    'min',
    'max',
    'avg',
    'grade',
    'observedTime',
    'observedTime_bn',
    'variety',
  ])

  for (const key of Object.keys(normalized)) {
    if (!allowedKeys.has(key)) {
      delete normalized[key]
    }
  }

  return normalized
}

function normalizeAllPrices(db) {
  if (!db?.prices || typeof db.prices !== 'object') return false
  let changed = false

  for (const [id, record] of Object.entries(db.prices)) {
    const next = normalizePriceRecord(record)
    const before = JSON.stringify(record)
    const after = JSON.stringify(next)
    if (before !== after) {
      db.prices[id] = next
      changed = true
    }
  }

  return changed
}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

function getExtensionFromMime(contentType = '') {
  const type = String(contentType).toLowerCase()
  if (type.includes('pdf')) return 'pdf'
  if (type.includes('png')) return 'png'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('webp')) return 'webp'
  if (type.includes('txt')) return 'txt'
  if (type.includes('docx')) return 'docx'
  if (type.includes('doc')) return 'doc'
  return ''
}

function safeFileName(name = '') {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

function mimeFromExtension(ext = '') {
  const normalized = String(ext).toLowerCase()
  if (normalized === 'pdf') return 'application/pdf'
  if (normalized === 'png') return 'image/png'
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'webp') return 'image/webp'
  if (normalized === 'txt') return 'text/plain; charset=utf-8'
  if (normalized === 'doc') return 'application/msword'
  if (normalized === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function ensureSystemStorageTables(db) {
  db.assistantChats ||= {}
  db.assistant_chat_sessions ||= {}
  db.assistant_chat_messages ||= {}
  db.uploads ||= {}
  db.uploadsByHash ||= {}
  db.uploaded_documents ||= {}
  db.uploadedDocumentsByHash ||= {}
  db.app_settings ||= {}
}

function inferUploadedDocumentType(record) {
  const haystack = `${record?.originalName || ''} ${record?.stored_name || ''}`.toLowerCase()
  if (haystack.includes('certificate') || haystack.includes('cert')) return 'doctor_certificate'
  if (haystack.includes('resume') || haystack.includes('cv')) return 'doctor_resume'
  return 'other'
}

function migrateLegacyStorageTables(db) {
  ensureSystemStorageTables(db)

  if (Object.keys(db.assistant_chat_sessions).length === 0 && Object.keys(db.assistantChats).length > 0) {
    for (const [chatId, chat] of Object.entries(db.assistantChats)) {
      const messages = Array.isArray(chat?.messages) ? chat.messages : []
      const updatedAt = chat?.updatedAt || nowIso()
      const lastMessage = messages[messages.length - 1] || null

      db.assistant_chat_sessions[chatId] = {
        chat_id: chatId,
        user_id: null,
        language: 'en',
        title: null,
        context: {},
        message_count: messages.length,
        last_provider: lastMessage?.role === 'assistant' ? lastMessage?.provider || null : null,
        last_reason: lastMessage?.role === 'assistant' ? lastMessage?.reason || null : null,
        created_at: chat?.createdAt || updatedAt,
        updated_at: updatedAt,
        last_message_at: lastMessage?.createdAt || updatedAt,
      }

      for (const message of messages) {
        const messageId = message?.id || id('chat_msg')
        db.assistant_chat_messages[messageId] = {
          message_id: messageId,
          chat_id: chatId,
          user_id: null,
          role: message?.role === 'assistant' ? 'assistant' : 'user',
          message_text: message?.text || '',
          image_ref: null,
          image_base64: null,
          provider: message?.role === 'assistant' ? message?.provider || null : null,
          reason: message?.role === 'assistant' ? message?.reason || null : null,
          metadata: { time: message?.time || null },
          created_at: message?.createdAt || updatedAt,
        }
      }
    }
  }

  if (Object.keys(db.uploaded_documents).length === 0 && Object.keys(db.uploads).length > 0) {
    for (const [storedName, upload] of Object.entries(db.uploads)) {
      const documentId = upload?.id || storedName
      db.uploaded_documents[documentId] = {
        document_id: documentId,
        user_id: upload?.user_id || null,
        document_type: upload?.document_type || inferUploadedDocumentType(upload),
        original_name: upload?.originalName || upload?.original_name || storedName,
        stored_name: storedName,
        content_type: upload?.contentType || upload?.content_type || 'application/octet-stream',
        file_size_bytes: Number(upload?.size || upload?.file_size_bytes || 0),
        sha256: upload?.sha256 || null,
        storage_path: upload?.storage_path || storedName,
        public_url: upload?.url || upload?.public_url || `/api/uploads/documents/${storedName}`,
        metadata: upload?.metadata || {},
        uploaded_at: upload?.uploadedAt || upload?.uploaded_at || nowIso(),
      }
      if (upload?.sha256) {
        db.uploadedDocumentsByHash[upload.sha256] = documentId
      }
    }
  }
}

function getAssistantChatSnapshot(db, chatId) {
  const legacyChat = db.assistantChats?.[chatId]
  if (legacyChat) return legacyChat

  const session = db.assistant_chat_sessions?.[chatId]
  if (!session) return null

  const messages = Object.values(db.assistant_chat_messages || {})
    .filter((message) => message?.chat_id === chatId)
    .sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime())
    .map((message) => ({
      id: message.message_id,
      role: message.role,
      text: message.message_text,
      time: message.metadata?.time || new Date(message.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: message.created_at,
      provider: message.provider,
      reason: message.reason,
    }))

  return {
    id: chatId,
    messages,
    updatedAt: session.updated_at || session.last_message_at || nowIso(),
  }
}

function persistAssistantChatSnapshot(db, chatId, chat, meta = {}) {
  db.assistantChats[chatId] = chat
  const now = meta.now || nowIso()
  const createdAt = db.assistant_chat_sessions[chatId]?.created_at || chat?.createdAt || now

  db.assistant_chat_sessions[chatId] = {
    chat_id: chatId,
    user_id: meta.userId || db.assistant_chat_sessions[chatId]?.user_id || null,
    language: meta.language || db.assistant_chat_sessions[chatId]?.language || 'en',
    title: meta.title || db.assistant_chat_sessions[chatId]?.title || null,
    context: meta.context || db.assistant_chat_sessions[chatId]?.context || {},
    message_count: Array.isArray(chat?.messages) ? chat.messages.length : 0,
    last_provider: meta.provider || null,
    last_reason: meta.reason || null,
    created_at: createdAt,
    updated_at: now,
    last_message_at: now,
  }

  Object.keys(db.assistant_chat_messages || {}).forEach((messageId) => {
    if (db.assistant_chat_messages[messageId]?.chat_id === chatId) {
      delete db.assistant_chat_messages[messageId]
    }
  })

  for (const message of Array.isArray(chat?.messages) ? chat.messages : []) {
    const messageId = message?.id || id('chat_msg')
    db.assistant_chat_messages[messageId] = {
      message_id: messageId,
      chat_id: chatId,
      user_id: message?.role === 'user' ? meta.userId || null : null,
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      message_text: message?.text || '',
      image_ref: meta.imageRef || null,
      image_base64: meta.imageBase64 || null,
      provider: message?.role === 'assistant' ? meta.provider || null : null,
      reason: message?.role === 'assistant' ? meta.reason || null : null,
      metadata: { time: message?.time || null },
      created_at: message?.createdAt || now,
    }
  }
}

function persistUploadedDocument(db, record, meta = {}) {
  db.uploads[record.id] = record
  if (record.sha256) {
    db.uploadsByHash[record.sha256] = record.id
    db.uploadedDocumentsByHash[record.sha256] = record.id
  }

  db.uploaded_documents[record.id] = {
    document_id: record.id,
    user_id: meta.userId || record.user_id || null,
    document_type: meta.documentType || record.document_type || inferUploadedDocumentType(record),
    original_name: record.originalName,
    stored_name: record.id,
    content_type: record.contentType,
    file_size_bytes: record.size,
    sha256: record.sha256 || null,
    storage_path: meta.storagePath || record.id,
    public_url: record.url,
    metadata: meta.metadata || record.metadata || {},
    uploaded_at: record.uploadedAt,
  }
}

function removeUploadedDocument(db, fileName) {
  const upload = db.uploads[fileName]
  if (upload?.sha256) {
    delete db.uploadsByHash[upload.sha256]
    delete db.uploadedDocumentsByHash[upload.sha256]
  }
  delete db.uploads[fileName]
  delete db.uploaded_documents[fileName]
}

async function loadDb() {
  const localDbExists = fs.existsSync(DB_PATH)

  // Runtime reads should prefer local JSON to prevent stale SQL snapshot reads
  // from dropping newly written chat/session updates between requests.
  if (localDbExists) {
    const db = (() => {
      const raw = fs.readFileSync(DB_PATH, 'utf8')
      return raw ? JSON.parse(raw) : {}
    })()

    seedIfEmpty(db)
    migrateLegacyStorageTables(db)
    const changed = normalizeAllPrices(db)

    if (changed) {
      saveDb(db)
    } else if (getSqlDatabaseUrl()) {
      scheduleSqlSnapshotWrite(db)
    }

    dbBootstrapSource = 'local-json'
    return db
  }

  const sqlDb = await readSqlSnapshotDb()
  if (sqlDb && typeof sqlDb === 'object') {
    const db = sqlDb
    seedIfEmpty(db)
    migrateLegacyStorageTables(db)
    const changed = normalizeAllPrices(db)

    if (changed || !localDbExists) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8')
      scheduleSqlSnapshotWrite(db)
    }

    dbBootstrapSource = 'sql-snapshot'
    return db
  }

  const db = createEmptyDb()
  seedIfEmpty(db)
  migrateLegacyStorageTables(db)
  normalizeAllPrices(db)
  saveDb(db)
  dbBootstrapSource = 'empty-local'
  return db
}

function saveDb(db) {
  ensureSystemStorageTables(db)
  normalizeAllPrices(db)
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8')
  scheduleSqlSnapshotWrite(db)
}

function seedIfEmpty(db) {
  db.users ||= {}
  db.usersByEmail ||= {}
  db.pendingDoctors ||= []
  db.diseases ||= {}
  db.diseasesByUser ||= {}
  db.irrigation ||= {}
  db.consultations ||= {}
  db.consultationsByFarmer ||= {}
  db.prices ||= {}
  db.alerts ||= {}
  db.alertsByUser ||= {}
  db.devices ||= {}
  db.devicesByUser ||= {}
  db.uploads ||= {}
  db.uploadsByHash ||= {}
  db.uploaded_documents ||= {}
  db.uploadedDocumentsByHash ||= {}
  db.assistantChats ||= {}
  db.assistant_chat_sessions ||= {}
  db.assistant_chat_messages ||= {}
  db.audit_logs ||= {}
  db.login_security ||= {}
  db.app_settings ||= {}

  // Default admin so the app is usable immediately.
  const adminEmail = 'admin@smartfarming.local'
  if (!db.usersByEmail[adminEmail]) {
    const adminId = id('user')
    const user = {
      id: adminId,
      email: adminEmail,
      name: 'Admin',
      role: 'admin',
      role_bn: roleBn('admin'),
      verificationStatus: 'verified',
      createdAt: nowIso(),
      metadata: { passwordHash: hashPassword('admin123') },
    }
    db.users[adminId] = user
    db.usersByEmail[adminEmail] = adminId
  }

  const superUserEmail = 'super@smartfarming.local'
  if (!db.usersByEmail[superUserEmail]) {
    const superUserId = id('user')
    const user = {
      id: superUserId,
      email: superUserEmail,
      name: 'Super User',
      role: 'super_admin',
      role_bn: roleBn('super_admin'),
      verificationStatus: 'verified',
      createdAt: nowIso(),
      metadata: { passwordHash: hashPassword('super123') },
    }
    db.users[superUserId] = user
    db.usersByEmail[superUserEmail] = superUserId
  }

  const seededPrices = [
      {
        id: 'price_dhaka_rice',
        crop: 'Rice',
        crop_bn: 'ধান',
        price: 58,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Karwan Bazar',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_potato',
        crop: 'Potato',
        crop_bn: 'আলু',
        price: 35,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Shyambazar',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_tomato',
        crop: 'Tomato',
        crop_bn: 'টমেটো',
        price: 80,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Jatrabari',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_ctg_rice',
        crop: 'Rice',
        crop_bn: 'ধান',
        price: 57,
        unit: 'kg',
        location: 'Chittagong',
        location_bn: 'চট্টগ্রাম',
        market: 'Chittagong Market',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_onion',
        crop: 'Onion',
        crop_bn: 'পেঁয়াজ',
        price: 70,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Karwan Bazar',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_wheat',
        crop: 'Wheat',
        crop_bn: 'গম',
        price: 49,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Shyambazar',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_maize',
        crop: 'Maize',
        crop_bn: 'ভুট্টা',
        price: 42,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Jatrabari',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_chili',
        crop: 'Chili',
        crop_bn: 'মরিচ',
        price: 120,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Karwan Bazar',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_dhaka_lentil',
        crop: 'Lentil',
        crop_bn: 'মসুর ডাল',
        price: 110,
        unit: 'kg',
        location: 'Dhaka',
        location_bn: 'ঢাকা',
        market: 'Shyambazar',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_ctg_onion',
        crop: 'Onion',
        crop_bn: 'পেঁয়াজ',
        price: 69,
        unit: 'kg',
        location: 'Chittagong',
        location_bn: 'চট্টগ্রাম',
        market: 'Khatunganj',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_ctg_wheat',
        crop: 'Wheat',
        crop_bn: 'গম',
        price: 48,
        unit: 'kg',
        location: 'Chittagong',
        location_bn: 'চট্টগ্রাম',
        market: 'Chaktai',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_ctg_maize',
        crop: 'Maize',
        crop_bn: 'ভুট্টা',
        price: 41,
        unit: 'kg',
        location: 'Chittagong',
        location_bn: 'চট্টগ্রাম',
        market: 'Chittagong Market',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_ctg_chili',
        crop: 'Chili',
        crop_bn: 'মরিচ',
        price: 116,
        unit: 'kg',
        location: 'Chittagong',
        location_bn: 'চট্টগ্রাম',
        market: 'Khatunganj',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
      {
        id: 'price_ctg_lentil',
        crop: 'Lentil',
        crop_bn: 'মসুর ডাল',
        price: 108,
        unit: 'kg',
        location: 'Chittagong',
        location_bn: 'চট্টগ্রাম',
        market: 'Chaktai',
        trend: 'stable',
        changePercent: 0,
        date: nowIso(),
        lastUpdated: new Date().toLocaleString('en-US'),
        lastUpdated_bn: new Date().toLocaleString('bn-BD'),
      },
    ]

  if (Object.keys(db.prices).length === 0) {
    for (const p of seededPrices) {
      db.prices[p.id] = p
    }
  } else {
    // Ensure core crop coverage exists even when DB already has partial seed data.
    for (const p of seededPrices) {
      const exists = Object.values(db.prices).some((row) => row.crop === p.crop && row.location === p.location)
      if (!exists) {
        db.prices[p.id] = p
      }
    }
  }
}

function notifyPriceAlerts(db, price) {
  for (const alert of Object.values(db.alerts)) {
    if (!alert || !alert.active) continue
    if (alert.crop && alert.crop !== price.crop) continue
    if (alert.location && alert.location !== price.location) continue

    const shouldNotify = alert.condition === 'above'
      ? price.price >= alert.targetPrice
      : price.price <= alert.targetPrice

    if (shouldNotify) {
      emitRealtime(`prices:${alert.userId}`, {
        action: 'alert',
        crop: price.crop,
        crop_bn: price.crop_bn,
        price: price.price,
        location: price.location,
        location_bn: price.location_bn,
        targetPrice: alert.targetPrice,
        condition: alert.condition,
      }, alert.userId)
    }
  }
}

function sortMarketPriceRecords(records = []) {
  return [...records].sort((a, b) => {
    const locationDelta = String(a.location || '').localeCompare(String(b.location || ''))
    if (locationDelta !== 0) return locationDelta

    const cropDelta = String(a.crop || '').localeCompare(String(b.crop || ''))
    if (cropDelta !== 0) return cropDelta

    return String(a.market || '').localeCompare(String(b.market || ''))
  })
}

function getMarketPriceKey(price) {
  return String(price?.id || `${price?.crop || ''}|${price?.location || ''}|${price?.market || ''}`)
}

function clampMarketNumber(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getMarketVolatilityMultiplier(price, now = Date.now()) {
  const cropKey = String(price?.crop || '').trim().toLowerCase()
  const locationKey = String(price?.location || '').trim().toLowerCase()
  const cropVolatility = MARKET_CROP_VOLATILITY[cropKey] ?? 0.75
  const locationVolatility = MARKET_LOCATION_VOLATILITY[locationKey] ?? 0.95

  const hour = new Date(now).getHours()
  const marketHoursVolatility = hour >= 6 && hour <= 11
    ? MARKET_PEAK_HOUR_VOLATILITY
    : hour >= 12 && hour <= 17
      ? MARKET_DAYTIME_VOLATILITY
      : MARKET_OFF_HOUR_VOLATILITY

  return cropVolatility * locationVolatility * marketHoursVolatility
}

function getMarketAnchorPrice(price) {
  const key = getMarketPriceKey(price)
  const currentPrice = Math.max(1, Number(price?.price || 0))
  const previousAnchor = Number(marketAnchorByPriceId.get(key))

  if (!Number.isFinite(previousAnchor) || previousAnchor <= 0) {
    marketAnchorByPriceId.set(key, currentPrice)
    return currentPrice
  }

  const nextAnchor = Number((previousAnchor * 0.96 + currentPrice * 0.04).toFixed(2))
  marketAnchorByPriceId.set(key, nextAnchor)
  return nextAnchor
}

function randomCenteredNoise() {
  return ((Math.random() + Math.random() + Math.random() + Math.random()) / 4) - 0.5
}

function derivePriceTrend(changePercent = 0) {
  if (changePercent > 0.05) return 'up'
  if (changePercent < -0.05) return 'down'
  return 'stable'
}

function calculateLiveMarketPriceUpdate(existing, now = Date.now()) {
  const currentPrice = Math.max(1, Number(existing?.price || 0))
  const anchorPrice = getMarketAnchorPrice(existing)
  const volatility = getMarketVolatilityMultiplier(existing, now)

  const trendDirection = existing?.trend === 'up' ? 1 : existing?.trend === 'down' ? -1 : 0
  const boundedRecentChange = clampMarketNumber(Number(existing?.changePercent || 0), -2, 2)
  const momentumDriftPct = trendDirection * Math.abs(boundedRecentChange) * MARKET_MOMENTUM_WEIGHT
  const meanReversionDriftPct = ((anchorPrice - currentPrice) / Math.max(anchorPrice, 1)) * 100 * MARKET_MEAN_REVERSION_WEIGHT
  const noiseDriftPct = randomCenteredNoise() * volatility * MARKET_NOISE_MULTIPLIER
  const shockDriftPct = Math.random() < MARKET_SHOCK_CHANCE
    ? (Math.random() < 0.5 ? -1 : 1) * (volatility * (1.5 + Math.random() * 1.8))
    : 0

  const driftPercent = clampMarketNumber(
    noiseDriftPct + momentumDriftPct + meanReversionDriftPct + shockDriftPct,
    -MARKET_DRIFT_HARD_CAP_PCT,
    MARKET_DRIFT_HARD_CAP_PCT,
  )

  const nextPrice = Math.max(1, Number((currentPrice * (1 + driftPercent / 100)).toFixed(2)))
  const changed = Math.abs(nextPrice - currentPrice) >= 0.01

  if (!changed) {
    return {
      changed: false,
      price: normalizePriceRecord(existing),
    }
  }

  const change = Number((nextPrice - currentPrice).toFixed(2))
  const changePercent = Number(((change / currentPrice) * 100).toFixed(2))
  const previousMin = Number(existing?.min ?? currentPrice)
  const previousMax = Number(existing?.max ?? currentPrice)
  const previousAvg = Number(existing?.avg ?? currentPrice)

  const updated = normalizePriceRecord({
    ...existing,
    price: nextPrice,
    trend: derivePriceTrend(changePercent),
    change,
    changePercent,
    min: Number.isFinite(previousMin) ? Math.min(previousMin, nextPrice) : nextPrice,
    max: Number.isFinite(previousMax) ? Math.max(previousMax, nextPrice) : nextPrice,
    avg: Number.isFinite(previousAvg) ? Number(((previousAvg * 4 + nextPrice) / 5).toFixed(2)) : nextPrice,
    date: new Date(now).toISOString(),
    lastUpdated: new Date(now).toLocaleString('en-US'),
    lastUpdated_bn: new Date(now).toLocaleString('bn-BD'),
  })

  const key = getMarketPriceKey(updated)
  const nextAnchor = Number((anchorPrice * 0.94 + updated.price * 0.06).toFixed(2))
  marketAnchorByPriceId.set(key, nextAnchor)

  return {
    changed: true,
    price: updated,
  }
}

function getFilteredMarketPrices(db, locationParam = '', cropParam = '') {
  const location = String(locationParam || '').trim()
  const crop = String(cropParam || '').trim()

  let prices = Object.values(db.prices || {}).map((row) => normalizePriceRecord(row))
  if (location) {
    prices = prices.filter((p) => String(p.location || '').toLowerCase() === location.toLowerCase())
  }
  if (crop) {
    prices = prices.filter((p) => String(p.crop || '').toLowerCase() === crop.toLowerCase())
  }
  return sortMarketPriceRecords(prices)
}

function runLiveMarketDrift(db, options = {}) {
  const {
    locationParam = '',
    cropParam = '',
    force = false,
    now = Date.now(),
  } = options

  const prices = getFilteredMarketPrices(db, locationParam, cropParam)
  const updatedAtIso = new Date(now).toISOString()

  // Avoid changing prices too frequently when clients poll aggressively.
  if (!force && now - lastDhakaLiveUpdateAt < DHAKA_LIVE_UPDATE_INTERVAL_MS) {
    return {
      prices,
      updatedAt: new Date(lastDhakaLiveUpdateAt || now).toISOString(),
      live: true,
      throttled: true,
      count: prices.length,
      profile: MARKET_VOLATILITY_PROFILE,
      updateIntervalMs: MARKET_REALTIME_AUTO_UPDATE_MS,
    }
  }

  const updatedPrices = []
  const changedPrices = []

  for (const existing of prices) {
    const result = calculateLiveMarketPriceUpdate(existing, now)
    updatedPrices.push(result.price)
    if (!result.changed) continue

    db.prices[existing.id] = result.price
    changedPrices.push(result.price)

    emitRealtime('prices:broadcast', {
      action: 'update',
      price: result.price,
      updatedAt: updatedAtIso,
      profile: MARKET_VOLATILITY_PROFILE,
    })
    notifyPriceAlerts(db, result.price)
  }

  if (changedPrices.length > 0) {
    emitRealtime('prices:batch', {
      action: 'batch-update',
      prices: changedPrices,
      updatedAt: updatedAtIso,
      count: changedPrices.length,
      profile: MARKET_VOLATILITY_PROFILE,
    })
    saveDb(db)
  }

  lastDhakaLiveUpdateAt = now
  return {
    prices: sortMarketPriceRecords(updatedPrices),
    updatedAt: updatedAtIso,
    live: true,
    throttled: false,
    count: updatedPrices.length,
    profile: MARKET_VOLATILITY_PROFILE,
    updateIntervalMs: MARKET_REALTIME_AUTO_UPDATE_MS,
  }
}

function startMarketRealtimeAutoUpdateLoop() {
  if (marketRealtimeAutoUpdateStarted) return
  marketRealtimeAutoUpdateStarted = true

  marketRealtimeAutoUpdateTimer = setInterval(async () => {
    if (marketRealtimeAutoUpdateInFlight) return
    marketRealtimeAutoUpdateInFlight = true
    try {
      const db = await loadDb()
      runLiveMarketDrift(db, { force: true, now: Date.now() })
    } catch (error) {
      console.error('Market realtime auto-update failed', error)
    } finally {
      marketRealtimeAutoUpdateInFlight = false
    }
  }, MARKET_REALTIME_AUTO_UPDATE_MS)

  if (typeof marketRealtimeAutoUpdateTimer?.unref === 'function') {
    marketRealtimeAutoUpdateTimer.unref()
  }
}

function getBearer(req) {
  const h = req.headers['authorization']
  if (h && typeof h === 'string' && h.startsWith('Bearer ')) {
    return h.slice(7)
  }
  const cookieToken = parseCookies(req)[AUTH_COOKIE_NAME]
  if (cookieToken && typeof cookieToken === 'string') return cookieToken
  return null
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/')
  const padLen = normalized.length % 4
  const padded = padLen ? normalized + '='.repeat(4 - padLen) : normalized
  return Buffer.from(padded, 'base64').toString('utf8')
}

function signTokenPart(input) {
  return base64UrlEncode(crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(input).digest())
}

function createAccessToken(userId) {
  const now = Date.now()
  const payload = {
    sub: String(userId || ''),
    iat: now,
    exp: now + AUTH_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  }
  const encoded = base64UrlEncode(JSON.stringify(payload))
  const sig = signTokenPart(encoded)
  return `sf_token_${encoded}.${sig}`
}

function parseAccessToken(token) {
  if (!token || typeof token !== 'string') return null
  if (!token.startsWith('sf_token_')) return null

  const raw = token.replace('sf_token_', '')
  const [encoded, signature] = raw.split('.')
  if (!encoded || !signature) return null

  const expectedSig = signTokenPart(encoded)
  if (expectedSig.length !== signature.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded))
    if (!payload?.sub || typeof payload.sub !== 'string') return null
    if (!payload?.exp || Date.now() > Number(payload.exp)) return null
    return payload.sub
  } catch {
    return null
  }
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function applyRateLimit(res, key, windowMs, maxRequests) {
  const now = Date.now()
  const existing = RATE_LIMIT_BUCKETS.get(key)

  let bucket = existing
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
  }

  bucket.count += 1
  RATE_LIMIT_BUCKETS.set(key, bucket)

  if (RATE_LIMIT_BUCKETS.size > 10000) {
    for (const [bucketKey, value] of RATE_LIMIT_BUCKETS.entries()) {
      if (now > value.resetAt) RATE_LIMIT_BUCKETS.delete(bucketKey)
    }
  }

  const remaining = Math.max(0, maxRequests - bucket.count)
  res.setHeader('X-RateLimit-Limit', String(maxRequests))
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

  if (bucket.count > maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    send(res, 429, { error: 'Too many requests. Please try again later.' })
    return false
  }

  return true
}

function enforceRouteRateLimits(req, res, { method, pathname, ip }) {
  if (pathname === '/health') return true

  if (pathname === '/realtime/stream') {
    if (!applyRateLimit(res, `realtime-connect:${ip}`, 60 * 1000, RATE_LIMIT_REALTIME_CONNECT_PER_MINUTE)) return false
    return true
  }

  if (!applyRateLimit(res, `global:${ip}`, 60 * 1000, RATE_LIMIT_GLOBAL_PER_MINUTE)) return false

  if (method === 'POST' && pathname === '/auth/signin') {
    if (!applyRateLimit(res, `signin:${ip}`, 10 * 60 * 1000, RATE_LIMIT_SIGNIN_PER_10_MINUTES)) return false
  }

  if (method === 'POST' && pathname === '/auth/signup') {
    if (!applyRateLimit(res, `signup:${ip}`, 10 * 60 * 1000, RATE_LIMIT_SIGNUP_PER_10_MINUTES)) return false
  }

  if (method === 'POST' && pathname === '/uploads/documents') {
    if (!applyRateLimit(res, `uploads:${ip}`, 5 * 60 * 1000, RATE_LIMIT_UPLOADS_PER_5_MINUTES)) return false
  }

  if ((method === 'PUT' || method === 'DELETE') && pathname.startsWith('/users/')) {
    if (!applyRateLimit(res, `users-mutation:${ip}`, 60 * 1000, RATE_LIMIT_USERS_MUTATION_PER_MINUTE)) return false
  }

  if (method === 'POST' && /^\/doctors\/[^/]+\/verify$/.test(pathname)) {
    if (!applyRateLimit(res, `doctor-verify:${ip}`, 60 * 1000, RATE_LIMIT_DOCTOR_VERIFY_PER_MINUTE)) return false
  }

  return true
}

function isAllowedCorsOrigin(origin) {
  return CORS_ALLOWED_ORIGINS.has(origin)
}

function setSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')

  const proto = req.headers['x-forwarded-proto']
  const isHttps = req.socket?.encrypted || (typeof proto === 'string' && proto.toLowerCase().includes('https'))
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

function authUserIdFromReq(req) {
  const token = getBearer(req)
  if (!token) return null
  const parsed = parseAccessToken(token)
  if (parsed) return parsed
  if (LEGACY_DEMO_TOKEN_FALLBACK && token.startsWith('demo_token_')) return token.replace('demo_token_', '')
  return null
}

function authUserIdFromToken(token) {
  const parsed = parseAccessToken(token)
  if (parsed) return parsed
  if (LEGACY_DEMO_TOKEN_FALLBACK && token && typeof token === 'string' && token.startsWith('demo_token_')) {
    return token.replace('demo_token_', '')
  }
  return null
}

function writeSse(res, channel, data) {
  res.write(`data: ${JSON.stringify({ channel, data, ts: Date.now() })}\n\n`)
}

function emitRealtime(channel, data, userId) {
  for (const [, client] of realtimeClients) {
    if (userId && client.userId !== userId) continue
    writeSse(client.res, channel, data)
  }
}

function countRealtimeConnectionsForIp(ip) {
  let count = 0
  for (const [, client] of realtimeClients) {
    if (client.ip === ip) count += 1
  }
  return count
}

function containsBanglaScript(text) {
  return /[\u0980-\u09ff]/.test(String(text || ''))
}

function inferMessageLanguageFlavor(message) {
  const text = String(message || '').trim()
  if (!text) return 'en'
  if (containsBanglaScript(text)) return 'bn'

  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const banglishHints = [
    'ami', 'amar', 'ajke', 'kalke', 'kisu', 'kichu', 'ki', 'kivabe', 'kibhabe', 'kemon', 'koto', 'kotodin', 'din',
    'dhan', 'chal', 'pata', 'dag', 'rog', 'osudh', 'oushodh', 'medicine', 'spray', 'sprey', 'dibo', 'dite', 'lagbe',
    'proyojon', 'protirudh', 'chikitsha', 'upay', 'hobe', 'korbo', 'korbo?', 'jomi', 'foshol',
  ]

  let hits = 0
  for (const token of normalized.split(' ')) {
    if (banglishHints.includes(token)) hits += 1
  }

  if (hits >= 2) return 'banglish'
  return 'en'
}

function chooseAssistantLanguage(message, contextLanguage) {
  const flavor = inferMessageLanguageFlavor(message)
  if (contextLanguage === 'bn') return 'bn'
  if (flavor === 'bn' || flavor === 'banglish') return 'bn'
  return 'en'
}

function buildAssistantReply(message, context = {}) {
  const text = String(message || '').toLowerCase()
  const outputLanguage = chooseAssistantLanguage(message, context?.language)
  const diseaseName = context?.disease || context?.disease_bn || 'এই রোগ'
  const advisory = outputLanguage === 'bn'
    ? (context?.advisory_bn || 'রোগ শনাক্ত করার পর আমি নির্দিষ্ট পরামর্শ দিতে পারি।')
    : (context?.advisory_en || 'I can give specific advice after disease detection.')
  const treatment = outputLanguage === 'bn'
    ? (context?.treatment_bn || 'আক্রান্ত অংশ আলাদা করুন এবং লেবেল অনুযায়ী চিকিৎসা প্রয়োগ করুন।')
    : (context?.treatment_en || 'Separate infected parts and apply treatment according to the label.')
  const prevention = outputLanguage === 'bn'
    ? (context?.prevention_bn || 'নিয়মিত পর্যবেক্ষণ করুন এবং ফসল পরিষ্কার রাখুন।')
    : (context?.prevention_en || 'Monitor regularly and keep the crop clean.')

  const asksDoseOrSchedule = (
    text.includes('dose') || text.includes('ডোজ') || text.includes('koto') || text.includes('kotodin')
    || text.includes('spray') || text.includes('sprey') || text.includes('interval')
  )
  const asksPrevention = text.includes('prevent') || text.includes('প্রতিরোধ') || text.includes('protirudh')
  const asksTreatment = (
    text.includes('treat') || text.includes('চিকিৎসা') || text.includes('medicine') || text.includes('ওষুধ')
    || text.includes('osudh') || text.includes('oushodh')
  )

  if (asksDoseOrSchedule) {
    return outputLanguage === 'bn'
      ? `আপনার প্রশ্ন অনুযায়ী সাধারণত ৭-১০ দিন পর পুনরায় স্প্রে দেওয়া হয়, তবে ফসল/রোগ/আবহাওয়া অনুযায়ী এটি বদলাতে পারে। ডোজ ও রি-স্প্রে ইন্টারভ্যাল অবশ্যই পণ্যের লেবেল অনুসরণ করুন। ${treatment}`
      : `For most cases, re-spray is done every 7-10 days, but it varies by crop, disease pressure, and weather. Always follow the product label for exact dose and interval. ${treatment}`
  }

  if (asksPrevention && asksTreatment) {
    return outputLanguage === 'bn'
      ? `চিকিৎসা: ${treatment} প্রতিরোধ: ${prevention}`
      : `Treatment: ${treatment} Prevention: ${prevention}`
  }

  if (asksPrevention) {
    return `${outputLanguage === 'bn' ? 'প্রতিরোধের পরামর্শ: ' : 'Prevention advice: '}${prevention}`
  }

  if (asksTreatment) {
    return `${outputLanguage === 'bn' ? 'চিকিৎসার পরামর্শ: ' : 'Treatment advice: '}${treatment}`
  }

  if (text.includes('disease') || text.includes('রোগ') || text.includes('rog')) {
    return `${outputLanguage === 'bn' ? 'সম্ভাব্য রোগ: ' : 'Likely disease: '}${diseaseName}. ${advisory}`
  }

  return outputLanguage === 'bn'
    ? `আমি Banglish/বাংলা বুঝতে পারি। আপনার প্রশ্নটি একটু নির্দিষ্ট করে বলুন (যেমন: ডোজ, স্প্রে ইন্টারভ্যাল, প্রতিরোধ, বা চিকিৎসা), তাহলে আমি সরাসরি কাজের পরামর্শ দেব।`
    : `I can understand Banglish as well. Please specify whether you want dose, spray interval, prevention, or treatment so I can give a direct actionable reply.`
}

async function buildAssistantReplyWithOpenAI(message, context = {}) {
  const language = chooseAssistantLanguage(message, context?.language)
  const messageFlavor = inferMessageLanguageFlavor(message)
  const diseaseName = context?.disease || context?.disease_bn || 'Unknown disease'
  const advisoryEn = context?.advisory_en || ''
  const advisoryBn = context?.advisory_bn || ''
  const treatmentEn = context?.treatment_en || ''
  const treatmentBn = context?.treatment_bn || ''
  const preventionEn = context?.prevention_en || ''
  const preventionBn = context?.prevention_bn || ''
  const chatHistory = Array.isArray(context?.chatHistory) ? context.chatHistory : []
  const imageBase64 = typeof context?.imageBase64 === 'string' ? context.imageBase64.trim() : ''
  const hasUsableImage = imageBase64.startsWith('data:image/') && imageBase64.length <= 4000000

  const systemPrompt = language === 'bn'
    ? 'আপনি একজন কৃষি সহকারী। ব্যবহারকারীর প্রশ্নের সরাসরি ও স্বাভাবিক ভাষায় উত্তর দিন। Banglish (Roman Bangla) বুঝুন; Banglish ইনপুট পেলে উত্তর বাংলা লিপিতে দিন (শুধু ব্যবহারকারী ইংরেজি চাইলে ইংরেজি দিন)। প্রতিবার একই ফরম্যাট/টেমপ্লেট ব্যবহার করবেন না। রোগ-সংক্রান্ত কনটেক্সট কেবল প্রাসঙ্গিক হলে ব্যবহার করুন। প্রশ্ন অস্পষ্ট হলে একটি ছোট follow-up প্রশ্ন করুন এবং ২টি দ্রুত অপশন দিন। রাসায়নিক বা ডোজ দিলে লেবেল অনুসরণ ও স্থানীয় বিশেষজ্ঞের পরামর্শের সতর্কতা যোগ করুন।'
    : 'You are an agriculture assistant. Understand Banglish (Romanized Bengali mixed with English) and respond clearly. If the input is Banglish, reply in Bengali script by default unless the user explicitly asks for English. Answer the exact user question naturally, without repeating boilerplate templates. Use disease context only when relevant. If the user is vague, ask one short follow-up question and offer 2 quick options. When giving chemical dosage, include a brief safety note to follow product labels and local expert advice.'

  const userPrompt = language === 'bn'
    ? `ব্যবহারকারীর বার্তা: ${message}\nইনপুট স্টাইল: ${messageFlavor}\n\nপ্রাসঙ্গিক হলে নিচের কনটেক্সট ব্যবহার করুন (অপ্রাসঙ্গিক হলে জোর করে ব্যবহার করবেন না):\nশনাক্ত রোগ: ${diseaseName}\nপরামর্শ: ${advisoryBn || advisoryEn}\nচিকিৎসা: ${treatmentBn || treatmentEn}\nপ্রতিরোধ: ${preventionBn || preventionEn}\n\nউত্তর নির্দেশনা:\n- সরাসরি প্রশ্নের উত্তর দিন।\n- Banglish ইনপুট হলে বাংলা লিপিতে পরিষ্কার উত্তর দিন।\n- প্রয়োজন হলে ২-৪টি সংক্ষিপ্ত bullet ব্যবহার করুন, নাহলে ১-৩টি বাক্য।\n- সার/ডোজ/স্প্রে শিডিউল কেবল প্রশ্নে চাওয়া হলে বা বাস্তবে প্রয়োজন হলে দিন।\n- অপ্রয়োজনীয় লম্বা ভূমিকা, পুনরাবৃত্তি, বা একি ফরম্যাট এড়িয়ে চলুন।`
    : `User message: ${message}\nInput style: ${messageFlavor}\n\nUse the following context only if relevant (do not force it if irrelevant):\nDetected disease: ${diseaseName}\nAdvisory: ${advisoryEn || advisoryBn}\nTreatment: ${treatmentEn || treatmentBn}\nPrevention: ${preventionEn || preventionBn}\n\nResponse guidance:\n- Answer the user's exact question directly.\n- If input style is Banglish, output should be Bengali script unless user asks English.\n- Use 2-4 short bullets only when useful; otherwise 1-3 concise sentences.\n- Include fertilizer/dose/spray schedule only when asked or clearly needed.\n- Avoid repetitive boilerplate intros.`

  const historyMessages = chatHistory
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant'))
    .map((entry) => ({
      role: entry.role,
      content: String(entry.text || '').trim(),
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(-8)

  const extractAssistantContent = (payload) => {
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content === 'string') return content.trim()
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part
          if (part && typeof part === 'object' && typeof part.text === 'string') return part.text
          return ''
        })
        .join('\n')
        .trim()
    }
    return ''
  }

  const callOpenAiCompatibleApi = async ({
    provider,
    apiKey,
    endpoint,
    model,
    imageEnabled,
    extraHeaders = {},
  }) => {
    const userContent = imageEnabled && hasUsableImage
      ? [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageBase64, detail: 'low' } },
        ]
      : userPrompt

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userContent },
    ]

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        messages,
      }),
    })

    const rawText = await response.text().catch(() => '')
    let payload = {}
    if (rawText) {
      try {
        payload = JSON.parse(rawText)
      } catch {
        payload = { rawText: rawText.slice(0, 500) }
      }
    }

    if (!response.ok) {
      const messageText = payload?.error?.message
        || payload?.message
        || payload?.detail
        || payload?.rawText
        || `${provider} API error: ${response.status}`
      throw new Error(messageText)
    }

    const content = extractAssistantContent(payload)
    if (!content) {
      throw new Error(`${provider} returned empty reply`)
    }

    return content
  }

  const availableProviders = []
  const openAiKey = getOpenAiApiKey()
  const groqKey = getGroqApiKey()
  const openRouterKey = getOpenRouterApiKey()

  if (groqKey) {
    availableProviders.push({
      provider: 'groq',
      apiKey: groqKey,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      imageEnabled: false,
    })
  }

  if (openAiKey) {
    availableProviders.push({
      provider: 'openai',
      apiKey: openAiKey,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      imageEnabled: true,
    })
  }

  if (openRouterKey) {
    availableProviders.push({
      provider: 'openrouter',
      apiKey: openRouterKey,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free',
      imageEnabled: false,
      extraHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Smart Farming',
      },
    })
  }

  const providerById = new Map(availableProviders.map((providerConfig) => [providerConfig.provider, providerConfig]))
  const forcedProvider = String(process.env.CHAT_PROVIDER || '').trim().toLowerCase()
  const priority = String(process.env.CHAT_PROVIDER_PRIORITY || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((value, index, array) => {
      if (!value) return false
      if (!['groq', 'openai', 'openrouter'].includes(value)) return false
      return array.indexOf(value) === index
    })

  let providers = []

  if (forcedProvider) {
    const forcedConfig = providerById.get(forcedProvider)
    if (!forcedConfig) {
      return {
        text: buildAssistantReply(message, context),
        provider: 'fallback',
        reason: `CHAT_PROVIDER=${forcedProvider} is configured but corresponding API key is not available`,
      }
    }
    providers = [forcedConfig]
  } else {
    const defaultOrder = priority.length > 0 ? priority : ['groq', 'openai', 'openrouter']
    for (const providerId of defaultOrder) {
      const providerConfig = providerById.get(providerId)
      if (providerConfig) {
        providers.push(providerConfig)
      }
    }

    for (const providerConfig of availableProviders) {
      if (!providers.some((item) => item.provider === providerConfig.provider)) {
        providers.push(providerConfig)
      }
    }
  }

  if (providers.length === 0) {
    return {
      text: buildAssistantReply(message, context),
      provider: 'fallback',
      reason: 'No chat API key configured (OPENAI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY)',
    }
  }

  const failures = []
  for (const providerConfig of providers) {
    try {
      const text = await callOpenAiCompatibleApi(providerConfig)
      return {
        text,
        provider: providerConfig.provider,
        reason: null,
      }
    } catch (error) {
      const reason = error?.message || `${providerConfig.provider} request failed`
      failures.push(`${providerConfig.provider}: ${reason}`)
      console.error(`Assistant ${providerConfig.provider} fallback:`, reason)
    }
  }

  return {
    text: buildAssistantReply(message, context),
    provider: 'fallback',
    reason: failures.join(' | ').slice(0, 1200) || 'All chat providers failed',
  }
}

function stripUserMetadata(user) {
  const copy = { ...user }
  delete copy.metadata
  return copy
}

function parseUrl(req) {
  const url = new URL(req.url, 'http://localhost')
  return url
}

function parseCookies(req) {
  const raw = req.headers.cookie
  if (!raw || typeof raw !== 'string') return {}
  return raw.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.trim().split('=')
    if (!name) return acc
    acc[name] = decodeURIComponent(rest.join('=') || '')
    return acc
  }, {})
}

function shouldUseSecureCookies(req) {
  if (FORCE_SECURE_COOKIES || IS_PRODUCTION) return true
  const proto = req.headers['x-forwarded-proto']
  return Boolean(req.socket?.encrypted || (typeof proto === 'string' && proto.toLowerCase().includes('https')))
}

function serializeCookie(name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(String(value || ''))}`]
  attrs.push(`Path=${options.path || '/'}`)
  if (typeof options.maxAge === 'number') attrs.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
  if (options.httpOnly) attrs.push('HttpOnly')
  if (options.secure) attrs.push('Secure')
  attrs.push(`SameSite=${options.sameSite || 'Lax'}`)
  return attrs.join('; ')
}

function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie')
  if (!current) {
    res.setHeader('Set-Cookie', [value])
    return
  }
  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, value])
    return
  }
  res.setHeader('Set-Cookie', [String(current), value])
}

function issueCsrfToken(res, req, token) {
  const secure = shouldUseSecureCookies(req)
  appendSetCookie(
    res,
    serializeCookie(CSRF_COOKIE_NAME, token, {
      path: '/',
      sameSite: CSRF_COOKIE_SAME_SITE,
      secure,
      maxAge: Math.floor(AUTH_TOKEN_TTL_MS / 1000),
    }),
  )
}

function ensureCsrfToken(res, req) {
  const existing = parseCookies(req)[CSRF_COOKIE_NAME]
  if (existing) return existing
  const token = crypto.randomBytes(24).toString('hex')
  issueCsrfToken(res, req, token)
  return token
}

function setAuthCookies(res, req, token) {
  const secure = shouldUseSecureCookies(req)
  appendSetCookie(
    res,
    serializeCookie(AUTH_COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      sameSite: AUTH_COOKIE_SAME_SITE,
      secure,
      maxAge: Math.floor(AUTH_TOKEN_TTL_MS / 1000),
    }),
  )
  ensureCsrfToken(res, req)
}

function clearAuthCookies(res, req) {
  const secure = shouldUseSecureCookies(req)
  appendSetCookie(
    res,
    serializeCookie(AUTH_COOKIE_NAME, '', {
      path: '/',
      httpOnly: true,
      sameSite: AUTH_COOKIE_SAME_SITE,
      secure,
      maxAge: 0,
    }),
  )
  appendSetCookie(
    res,
    serializeCookie(CSRF_COOKIE_NAME, '', {
      path: '/',
      sameSite: CSRF_COOKIE_SAME_SITE,
      secure,
      maxAge: 0,
    }),
  )
}

function isCsrfValid(req) {
  const cookies = parseCookies(req)
  const cookieToken = cookies[CSRF_COOKIE_NAME]
  const headerToken = req.headers[CSRF_HEADER_NAME]
  if (!cookieToken || !headerToken || typeof headerToken !== 'string') return false
  if (cookieToken.length !== headerToken.length) return false
  return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
}

function shouldRequireCsrf(method, pathname) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false
  if (pathname === '/auth/signin' || pathname === '/auth/signup' || pathname === '/auth/csrf') return false
  return true
}

function getLockRecord(db, normalizedEmail) {
  db.login_security ||= {}
  db.login_security[normalizedEmail] ||= {
    failedCount: 0,
    firstFailureAt: null,
    lastFailureAt: null,
    lockedUntil: null,
  }
  return db.login_security[normalizedEmail]
}

function notifyAdminSecurityAlert(db, message, messageBn, metadata = {}) {
  const admins = Object.values(db.users || {}).filter((u) => isAdminRole(u?.role))
  for (const admin of admins) {
    pushUserAlert(db, admin.id, {
      type: 'security',
      message,
      message_bn: messageBn,
      ...metadata,
    })
  }
}

function registerFailedSignin(db, { email, userId, ip }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const now = Date.now()
  const rec = getLockRecord(db, normalizedEmail)
  const firstFailureAt = rec.firstFailureAt ? Date.parse(rec.firstFailureAt) : 0

  if (!firstFailureAt || now - firstFailureAt > LOGIN_LOCKOUT_WINDOW_MS) {
    rec.failedCount = 0
    rec.firstFailureAt = new Date(now).toISOString()
  }

  rec.failedCount += 1
  rec.lastFailureAt = new Date(now).toISOString()

  const shouldLock = rec.failedCount >= LOGIN_LOCKOUT_THRESHOLD
  if (shouldLock) {
    rec.lockedUntil = new Date(now + LOGIN_LOCKOUT_DURATION_MS).toISOString()

    recordAuditLog(db, {
      actorId: null,
      actorEmail: normalizedEmail,
      action: 'auth.signin.lockout',
      targetUserId: userId || null,
      targetEmail: normalizedEmail,
      metadata: {
        ip,
        failedCount: rec.failedCount,
        lockedUntil: rec.lockedUntil,
      },
    })

    notifyAdminSecurityAlert(
      db,
      `Account lockout triggered for ${normalizedEmail} after repeated failed sign-in attempts.`,
      `${normalizedEmail} অ্যাকাউন্টে বারবার ভুল সাইন-ইন চেষ্টার কারণে সাময়িক লক চালু হয়েছে।`,
      { type: 'security_lockout' },
    )
  } else if (rec.failedCount >= 3 && rec.failedCount % 3 === 0) {
    recordAuditLog(db, {
      actorId: null,
      actorEmail: normalizedEmail,
      action: 'auth.signin.failed',
      targetUserId: userId || null,
      targetEmail: normalizedEmail,
      metadata: {
        ip,
        failedCount: rec.failedCount,
      },
    })
  }

  return {
    locked: shouldLock,
    failedCount: rec.failedCount,
    lockedUntil: rec.lockedUntil,
  }
}

function clearFailedSignin(db, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail || !db.login_security) return
  delete db.login_security[normalizedEmail]
}

const BANGLA_TTS_DIGITS = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
}

function normalizeBanglaTtsText(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  text = text.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 শতাংশ')

  const replacements = [
    [/\bpossible disease\b/gi, 'সম্ভাব্য রোগ'],
    [/\bconfidence\b/gi, 'নিশ্চয়তা'],
    [/\badvisory\b/gi, 'পরামর্শ'],
    [/\btreatment\b/gi, 'চিকিৎসা'],
    [/\bprevention\b/gi, 'প্রতিরোধ'],
    [/\band\b/gi, 'এবং'],
    [/\bwith\b/gi, 'সহ'],
    [/\bnutrient deficiency\b/gi, 'পুষ্টির ঘাটতি'],
    [/\balternaria\b/gi, 'অল্টারনারিয়া'],
    [/\brace leaf disease\s*\(preliminary\)/gi, 'ধানের পাতার রোগ (প্রাথমিক)'],
    [/\brace leaf disease\b/gi, 'ধানের পাতার রোগ'],
    [/\bleaf disease\b/gi, 'পাতার রোগ'],
    [/\bpreliminary\b/gi, 'প্রাথমিক'],
    [/\brice\b/gi, 'ধান'],
    [/\bpotato\b/gi, 'আলু'],
    [/\btomato\b/gi, 'টমেটো'],
    [/\bonion\b/gi, 'পেঁয়াজ'],
    [/\bwheat\b/gi, 'গম'],
    [/\bmaize\b/gi, 'ভুট্টা'],
    [/\bchili\b/gi, 'মরিচ'],
    [/\blentil\b/gi, 'মসুর ডাল'],
    [/\bnpk\b/gi, 'এন পি কে'],
    [/\bkg\b/gi, 'কেজি'],
    [/\bmm\b/gi, 'মিলিমিটার'],
  ]

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement)
  }

  text = text.replace(/[0-9]/g, (digit) => BANGLA_TTS_DIGITS[digit] || digit)
  return text
}

function splitTtsText(value, maxLen = 700) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return []
  if (text.length <= maxLen) return [text]

  const sentenceParts = text
    .replace(/([.!?।])\s+/g, '$1|')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)

  if (!sentenceParts.length) return [text.slice(0, maxLen)]

  const chunks = []
  let current = ''
  for (const part of sentenceParts) {
    const next = current ? `${current} ${part}` : part
    if (next.length > maxLen) {
      if (current) chunks.push(current)
      if (part.length > maxLen) {
        let remaining = part
        while (remaining.length > maxLen) {
          chunks.push(remaining.slice(0, maxLen))
          remaining = remaining.slice(maxLen)
        }
        current = remaining
      } else {
        current = part
      }
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function escapeXmlForTts(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function audioStreamToBuffer(audioStream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    }

    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    audioStream.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk))
    })
    audioStream.on('error', (error) => {
      fail(error)
    })
    audioStream.on('end', () => {
      if (!chunks.length) {
        fail(new Error('Edge neural TTS stream ended without audio'))
        return
      }
      finish()
    })
    audioStream.on('close', () => {
      if (settled) return
      if (chunks.length > 0) {
        finish()
        return
      }
      setTimeout(() => {
        if (settled) return
        if (chunks.length > 0) {
          finish()
          return
        }
        fail(new Error('Edge neural TTS stream closed before audio data'))
      }, 120)
    })
  })
}

async function generateTtsWithMsEdge(text, language = 'en') {
  if (!EDGE_TTS_ENABLED) {
    throw new Error('Edge neural TTS is disabled')
  }

  if (!MsEdgeTtsModule?.MsEdgeTTS || !MsEdgeTtsModule?.OUTPUT_FORMAT) {
    throw new Error('msedge-tts package is not available')
  }

  const { MsEdgeTTS, OUTPUT_FORMAT } = MsEdgeTtsModule
  const tts = new MsEdgeTTS()
  const isBangla = language === 'bn'

  const voiceCandidates = isBangla
    ? [
        EDGE_TTS_BN_VOICE,
        'bn-BD-NabanitaNeural',
        'bn-BD-PradeepNeural',
        'bn-IN-TanishaaNeural',
        'bn-IN-BashkarNeural',
      ]
    : [
        EDGE_TTS_EN_VOICE,
        'en-US-AriaNeural',
        'en-US-GuyNeural',
      ]

  let selectedVoice = ''
  let lastVoiceError = null

  for (const candidate of voiceCandidates.filter(Boolean)) {
    try {
      await tts.setMetadata(
        candidate,
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3 || OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
      )
      selectedVoice = candidate
      break
    } catch (error) {
      lastVoiceError = error
    }
  }

  if (!selectedVoice) {
    throw new Error(lastVoiceError?.message || 'No compatible Edge voice available')
  }

  const chunks = splitTtsText(text, 700)
  const audioChunks = []
  const prosody = {
    rate: isBangla ? EDGE_TTS_BN_RATE : EDGE_TTS_EN_RATE,
  }
  for (const chunk of chunks) {
    const safeChunk = escapeXmlForTts(chunk)
    const { audioStream } = await tts.toStream(safeChunk, prosody)
    const audioBuffer = await audioStreamToBuffer(audioStream)
    if (audioBuffer.length) {
      audioChunks.push(audioBuffer)
    }
  }

  if (!audioChunks.length) {
    throw new Error('Edge neural TTS returned empty audio')
  }

  return {
    provider: 'msedge-neural',
    audioContent: Buffer.concat(audioChunks).toString('base64'),
    language: isBangla ? 'bn-BD' : 'en-US',
    text,
    voice: selectedVoice,
  }
}

// TTS (Text-to-Speech) Service
async function generateTtsAudio(text, language = 'en') {
  const inputText = String(text || '').trim()
  if (!inputText) {
    throw new Error('Text is required for TTS')
  }

  const normalizedText = language === 'bn'
    ? normalizeBanglaTtsText(inputText)
    : inputText

  // Create cache key
  const cacheKey = `${language}:${normalizedText.substring(0, 200)}`
  if (TTS_CACHE.has(cacheKey)) {
    const cached = TTS_CACHE.get(cacheKey)
    if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.data
    }
  }

  // Try Microsoft Edge neural voices first for natural Bangla/English delivery.
  try {
    const result = await generateTtsWithMsEdge(normalizedText, language)
    TTS_CACHE.set(cacheKey, { data: result, timestamp: Date.now() })
    return result
  } catch (err) {
    console.error('❌ Edge neural TTS error:', err.message)
    // Fall through to other providers
  }

  // Try Google Cloud TTS first (if API key configured)
  const googleKey = getGoogleTtsApiKey()
  if (googleKey) {
    try {
      const result = await generateTtsWithGoogle(normalizedText, language, googleKey)
      TTS_CACHE.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (err) {
      console.error('❌ Google Cloud TTS error:', err.message)
      // Fall through to next provider
    }
  }

  // Try ElevenLabs (if API key configured)
  const elevenLabsKey = getElevenLabsApiKey()
  if (elevenLabsKey) {
    try {
      const result = await generateTtsWithElevenLabs(normalizedText, language, elevenLabsKey)
      TTS_CACHE.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (err) {
      console.error('❌ ElevenLabs TTS error:', err.message)
      // Fall through to fallback
    }
  }

  // Return info for client-side Web Speech API fallback
  return {
    provider: 'web-speech',
    text: normalizedText,
    language: language === 'bn' ? 'bn-BD' : 'en-US',
    message: 'Using browser Web Speech API for voice synthesis',
  }
}

async function generateTtsWithGoogle(text, language, apiKey) {
  const voiceMap = {
    'en': 'en-US-Neural2-C',
    'bn': 'bn-IN-Standard-A'
  }
  
  const voiceName = voiceMap[language] || voiceMap['en']
  const languageCode = language === 'bn' ? 'bn-IN' : 'en-US'
  
  const payload = {
    input: { text },
    voice: {
      languageCode,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0,
    },
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Google TTS: ${error.error?.message || 'API error'}`)
  }

  const result = await response.json()
  return {
    provider: 'google-cloud-tts',
    audioContent: result.audioContent, // Base64 encoded MP3
    language: languageCode,
    text,
  }
}

async function generateTtsWithElevenLabs(text, language, apiKey) {
  const voiceId = language === 'bn' ? 'pFZP5JQG7iQjIQuC4Bxe' : '21m00Tcm4TlvDq8ikWAM' // Placeholder IDs
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`ElevenLabs TTS: ${error.detail?.message || 'API error'}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const audioBase64 = Buffer.from(audioBuffer).toString('base64')
  
  return {
    provider: 'elevenlabs',
    audioContent: audioBase64, // Base64 encoded MP3
    language: language === 'bn' ? 'bn' : 'en',
    text,
  }
}

function createLocalApiMiddleware() {
  startMarketRealtimeAutoUpdateLoop()
  return async function localApi(req, res, next) {
    try {
      const url = parseUrl(req)
      const method = (req.method || 'GET').toUpperCase()
      const pathname = url.pathname || '/'
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
      const clientIp = getClientIp(req)

      setSecurityHeaders(req, res)

      // CORS: allow only configured origins
      if (origin && isAllowedCorsOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      if (!enforceRouteRateLimits(req, res, { method, pathname, ip: clientIp })) return
      if (method === 'OPTIONS') return send(res, 200, { ok: true })

      const db = await loadDb()

      if (shouldRequireCsrf(method, pathname)) {
        const authId = authUserIdFromReq(req)
        if (authId && !isCsrfValid(req)) {
          return send(res, 403, { error: 'CSRF token is missing or invalid' })
        }
      }

      // Health
      if (method === 'GET' && pathname === '/health') {
        return send(res, 200, {
          status: 'ok',
          mode: 'local',
          storage: {
            localJson: true,
            bootstrapSource: dbBootstrapSource,
            sqlConfigured: Boolean(getSqlDatabaseUrl()),
            sqlConnected: sqlMirrorEnabled,
            sqlLastError: sqlMirrorLastError,
          },
        })
      }

      // UPLOADS: serve uploaded doctor documents
      if (method === 'GET' && pathname.startsWith('/uploads/documents/')) {
        const fileName = path.basename(pathname.replace('/uploads/documents/', ''))
        const filePath = path.resolve(UPLOADS_DIR, fileName)
        if (!filePath.startsWith(UPLOADS_DIR)) {
          return send(res, 400, { error: 'Invalid file path' })
        }
        if (!fs.existsSync(filePath)) {
          return send(res, 404, { error: 'File not found' })
        }

        const ext = path.extname(fileName).replace('.', '')
        const contentType = mimeFromExtension(ext)
        res.statusCode = 200
        res.setHeader('Content-Type', contentType)
        fs.createReadStream(filePath).pipe(res)
        return
      }

      // UPLOADS: check duplicate by SHA-256 hash
      if (method === 'POST' && pathname === '/uploads/documents/check-hash') {
        const body = await readJsonBody(req)
        const sha256 = typeof body?.sha256 === 'string' ? body.sha256.trim().toLowerCase() : ''
        if (!sha256) return send(res, 400, { error: 'sha256 is required' })

        const existingId = db.uploadsByHash[sha256]
        const file = existingId ? db.uploads[existingId] || null : null
        return send(res, 200, { exists: Boolean(file), file })
      }

      // UPLOADS: upload doctor documents (pre-signup allowed)
      if (method === 'POST' && pathname === '/uploads/documents') {
        const body = await readJsonBody(req)
        const fileNameInput = body?.fileName
        const base64DataInput = body?.base64Data
        const contentTypeInput = body?.contentType
        const authId = authUserIdFromReq(req)

        if (!fileNameInput || !base64DataInput) {
          return send(res, 400, { error: 'fileName and base64Data are required' })
        }

        ensureUploadsDir()

        const safeName = safeFileName(fileNameInput)
        const incomingExt = path.extname(safeName).replace('.', '').toLowerCase()
        const guessedExt = getExtensionFromMime(contentTypeInput)
        const ext = incomingExt || guessedExt || 'bin'

        if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
          return send(res, 400, { error: 'Only PDF, JPG, and PNG files are allowed' })
        }

        if (contentTypeInput && !ALLOWED_UPLOAD_MIME_TYPES.has(String(contentTypeInput).toLowerCase())) {
          return send(res, 400, { error: 'Invalid content type. Allowed: PDF, JPG, PNG' })
        }

        const storedName = `${id('doc')}.${ext}`
        const destination = path.resolve(UPLOADS_DIR, storedName)

        const base64Body = String(base64DataInput).replace(/^data:[^;]+;base64,/, '')
        const fileBuffer = Buffer.from(base64Body, 'base64')

        if (!fileBuffer || fileBuffer.length === 0) {
          return send(res, 400, { error: 'Uploaded file is empty' })
        }

        if (fileBuffer.length > MAX_DOCTOR_UPLOAD_SIZE_BYTES) {
          return send(res, 400, { error: 'File size exceeds 10MB limit' })
        }

        const sha256 = sha256Buffer(fileBuffer)
        const existingId = db.uploadsByHash[sha256]
        const existing = existingId ? db.uploads[existingId] : null
        if (existing) {
          return send(res, 409, {
            error: 'Duplicate file already uploaded',
            duplicate: true,
            file: existing,
          })
        }

        fs.writeFileSync(destination, fileBuffer)

        const uploadRecord = {
          id: storedName,
          originalName: safeName,
          contentType: contentTypeInput || mimeFromExtension(ext),
          size: fileBuffer.length,
          sha256,
          url: `/api/uploads/documents/${storedName}`,
          uploadedAt: nowIso(),
        }
        persistUploadedDocument(db, uploadRecord, {
          userId: authId,
          documentType: inferUploadedDocumentType({ originalName: safeName, stored_name: storedName }),
          storagePath: destination,
          metadata: { source: 'local-upload' },
        })
        saveDb(db)

        return send(res, 200, {
          file: uploadRecord,
        })
      }

      // UPLOADS: delete uploaded doctor documents
      if (method === 'DELETE' && pathname.startsWith('/uploads/documents/')) {
        const fileName = path.basename(pathname.replace('/uploads/documents/', ''))
        const filePath = path.resolve(UPLOADS_DIR, fileName)
        if (!filePath.startsWith(UPLOADS_DIR)) {
          return send(res, 400, { error: 'Invalid file path' })
        }

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }

        removeUploadedDocument(db, fileName)
        saveDb(db)

        return send(res, 200, { ok: true, fileName })
      }

      // REALTIME: SSE stream
      if (method === 'GET' && pathname === '/realtime/stream') {
        const tokenFromQuery = url.searchParams.get('token')
        const userId = authUserIdFromToken(tokenFromQuery) || authUserIdFromReq(req)

        if (countRealtimeConnectionsForIp(clientIp) >= RATE_LIMIT_REALTIME_CONNECTIONS_PER_IP) {
          res.setHeader('Retry-After', '30')
          return send(res, 429, { error: 'Too many realtime connections from this IP. Please retry shortly.' })
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        })

        const clientId = id('rt')
        realtimeClients.set(clientId, { res, userId, ip: clientIp })
        writeSse(res, 'connection', { status: 'connected', userId: userId || null })

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) {
            writeSse(res, 'heartbeat', { ok: true })
          }
        }, 25000)

        req.on('close', () => {
          clearInterval(heartbeat)
          realtimeClients.delete(clientId)
        })

        return
      }

      // REALTIME: test event trigger (for demos)
      if (method === 'POST' && pathname === '/realtime/test-event') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current) return send(res, 404, { error: 'User not found' })

        const body = await readJsonBody(req)
        const type = body?.type
        const requestedTargetUserId = typeof body?.targetUserId === 'string' && body.targetUserId
          ? body.targetUserId.trim()
          : ''
        const targetUserId = requestedTargetUserId
          ? requestedTargetUserId
          : authId

        if (targetUserId !== authId && !isPrimaryAdmin(current)) {
          return send(res, 403, { error: 'Only admins can target other users' })
        }

        if (!['price', 'consultation', 'irrigation', 'disease', 'system'].includes(type)) {
          return send(res, 400, { error: 'Invalid test event type' })
        }

        if (type === 'price') {
          const price = {
            id: id('price_demo'),
            crop: 'Rice',
            crop_bn: 'ধান',
            price: Math.floor(52 + Math.random() * 14),
            location: 'Dhaka',
            location_bn: 'ঢাকা',
            market: 'Demo Market',
            date: nowIso(),
            trend: 'up',
            changePercent: Number((Math.random() * 5).toFixed(2)),
          }
          emitRealtime('prices:broadcast', { action: 'new', price })
          emitRealtime(`prices:${targetUserId}`, {
            action: 'alert',
            crop: price.crop,
            crop_bn: price.crop_bn,
            price: price.price,
            location: price.location,
            location_bn: price.location_bn,
          }, targetUserId)
        }

        if (type === 'consultation') {
          const consultation = {
            id: id('consultation_demo'),
            farmerId: targetUserId,
            disease: 'Leaf blight',
            disease_bn: 'পাতা ব্লাইট',
            status: 'pending',
            submittedAt: nowIso(),
          }
          emitRealtime('consultations:all', { action: 'new', consultation })
          emitRealtime(`consultations:${targetUserId}`, { action: 'new', consultation }, targetUserId)
        }

        if (type === 'irrigation') {
          emitRealtime(`irrigation:${targetUserId}`, {
            action: 'update',
            status: Math.random() > 0.5 ? 'on' : 'off',
            updatedAt: nowIso(),
          }, targetUserId)
        }

        if (type === 'disease') {
          emitRealtime(`diseases:${targetUserId}`, {
            action: 'review',
            status: Math.random() > 0.5 ? 'approved' : 'rejected',
            reviewedAt: nowIso(),
          }, targetUserId)
        }

        if (type === 'system') {
          emitRealtime('system:broadcast', {
            title: 'System Demo Notification',
            message: 'This is a realtime demo event.',
            message_bn: 'এটি একটি রিয়েল-টাইম ডেমো ইভেন্ট।',
          })
        }

        return send(res, 200, { ok: true, type, targetUserId })
      }

      // ASSISTANT CHAT: history (guest allowed)
      if (method === 'GET' && pathname === '/assistant-chat/history') {
        const chatId = typeof url.searchParams.get('chatId') === 'string' ? url.searchParams.get('chatId').trim() : ''
        if (!chatId) return send(res, 400, { error: 'chatId is required' })

        const chat = getAssistantChatSnapshot(db, chatId) || { id: chatId, messages: [], updatedAt: nowIso() }
        return send(res, 200, { chat })
      }

      // ASSISTANT CHAT: send message + realtime broadcast (guest allowed)
      if (method === 'POST' && pathname === '/assistant-chat') {
        const body = await readJsonBody(req)
        const chatId = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
        const message = typeof body?.message === 'string' ? body.message.trim() : ''
        const language = body?.language === 'bn' ? 'bn' : 'en'
        const authId = authUserIdFromReq(req)

        if (!chatId) return send(res, 400, { error: 'chatId is required' })
        if (!message) return send(res, 400, { error: 'message is required' })

        const now = nowIso()
        const currentChat = db.assistantChats[chatId] || { id: chatId, messages: [], updatedAt: now }
        const userMessage = {
          id: id('chat_msg'),
          role: 'user',
          text: message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: now,
        }

        const assistantResponse = await buildAssistantReplyWithOpenAI(message, {
          language,
          disease: body?.disease,
          disease_bn: body?.disease_bn,
          advisory_en: body?.advisory_en,
          advisory_bn: body?.advisory_bn,
          treatment_en: body?.treatment_en,
          treatment_bn: body?.treatment_bn,
          prevention_en: body?.prevention_en,
          prevention_bn: body?.prevention_bn,
          imageBase64: body?.imageBase64,
          chatHistory: Array.isArray(currentChat.messages) ? currentChat.messages.slice(-8) : [],
        })

        const assistantMessage = {
          id: id('chat_msg'),
          role: 'assistant',
          text: assistantResponse.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: now,
        }

        const nextMessages = [...(currentChat.messages || []), userMessage, assistantMessage].slice(-100)
        const nextChat = {
          id: chatId,
          messages: nextMessages,
          updatedAt: now,
        }

        persistAssistantChatSnapshot(db, chatId, nextChat, {
          userId: authId,
          language,
          provider: assistantResponse.provider,
          reason: assistantResponse.reason,
          context: {
            disease: body?.disease || null,
            disease_bn: body?.disease_bn || null,
            imageBase64: Boolean(body?.imageBase64),
          },
        })
        saveDb(db)

        emitRealtime(`assistant-chat:${chatId}`, {
          action: 'update',
          chat: nextChat,
          message: assistantMessage,
          userMessage,
          provider: assistantResponse.provider,
          reason: assistantResponse.reason,
        })

        return send(res, 200, {
          chat: nextChat,
          assistantMessage,
          userMessage,
          provider: assistantResponse.provider,
          reason: assistantResponse.reason,
        })
      }

      // WEATHER: live weather by coordinates
      if (method === 'GET' && pathname === '/weather/current') {
        const lat = Number(url.searchParams.get('lat') || '23.8103')
        const lng = Number(url.searchParams.get('lng') || '90.4125')
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return send(res, 400, { error: 'Invalid coordinates' })
        }

        const weather = await fetchLiveWeather(lat, lng)
        return send(res, 200, weather)
      }

      // YIELD: real-time advisory based on weather + moisture
      if (method === 'GET' && pathname === '/yield/advice') {
        const lat = Number(url.searchParams.get('lat') || '23.8103')
        const lng = Number(url.searchParams.get('lng') || '90.4125')
        const moisture = Number(url.searchParams.get('moisture') || '68')
        const crop = url.searchParams.get('crop') || 'Rice'

        if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(moisture)) {
          return send(res, 400, { error: 'Invalid advisory parameters' })
        }

        const weather = await fetchLiveWeather(lat, lng)
        const advice = estimateYieldAdvice({ crop, moisture, weather })
        return send(res, 200, { advice, weather })
      }

      // AUTH: signup
      if (method === 'POST' && pathname === '/auth/signup') {
        const body = await readJsonBody(req)
        const {
          email,
          password,
          name,
          role,
          phone,
          location,
          specialty,
          registrationNumber,
          certificateDocument,
          resumeDocument,
          experienceYears,
          profileSummary,
          termsAccepted,
          privacyAccepted,
        } = body || {}
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

        if (!normalizedEmail || !password || !name || !role) {
          return send(res, 400, { error: 'Missing required fields: email, password, name, role' })
        }

        if (!['farmer', 'doctor'].includes(role)) {
          return send(res, 403, { error: 'Only farmer and doctor signup is allowed' })
        }

        if (!termsAccepted || !privacyAccepted) {
          return send(res, 400, { error: 'Terms and Privacy Policy acceptance is required' })
        }

        const ev = validateEmail(normalizedEmail)
        if (!ev.valid) return send(res, 400, { error: ev.error })

        const pv = validatePasswordStrength(password)
        if (!pv.valid) return send(res, 400, { error: pv.error })

        if (db.usersByEmail[normalizedEmail]) {
          return send(res, 409, { error: 'User already exists with this email address' })
        }

        if (role === 'doctor') {
          if (!specialty || !phone || !registrationNumber || !certificateDocument || !resumeDocument) {
            return send(res, 400, {
              error: 'Doctor signup requires phone, specialty, license number, certificate document, and resume document',
            })
          }
        }

        const userId = id('user')
        const user = {
          id: userId,
          email: normalizedEmail,
          name,
          phone,
          role,
          role_bn: roleBn(role),
          location,
          location_bn: location,
          specialty,
          specialty_bn: specialty,
          verificationStatus: role === 'doctor' ? 'pending' : 'verified',
          registrationNumber,
          experienceYears: Number(experienceYears || 0),
          certificateDocument,
          resumeDocument,
          profileSummary: profileSummary || '',
          verificationDocuments: role === 'doctor'
            ? [certificateDocument, resumeDocument].filter(Boolean)
            : [],
          termsAccepted: true,
          privacyAccepted: true,
          termsAcceptedAt: nowIso(),
          createdAt: nowIso(),
          metadata: { passwordHash: hashPassword(password) },
        }

        db.users[userId] = user
        db.usersByEmail[normalizedEmail] = userId
        if (role === 'doctor') db.pendingDoctors.push(userId)
        saveDb(db)

        if (role === 'doctor') {
          return send(res, 200, {
            user: stripUserMetadata(user),
            requiresApproval: true,
            message: 'Doctor application submitted. Admin approval is required before sign in.',
          })
        }

        const accessToken = createAccessToken(userId)
        setAuthCookies(res, req, accessToken)

        return send(res, 200, {
          user: stripUserMetadata(user),
          accessToken,
          message: 'User created successfully',
        })
      }

      // AUTH: signin
      if (method === 'POST' && pathname === '/auth/signin') {
        const body = await readJsonBody(req)
        const { email, password } = body || {}
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

        if (!applyRateLimit(
          res,
          `signin-email:${clientIp}:${normalizedEmail || 'unknown'}`,
          10 * 60 * 1000,
          RATE_LIMIT_SIGNIN_EMAIL_PER_10_MINUTES,
        )) return

        if (!normalizedEmail || !password) return send(res, 400, { error: 'Email and password are required' })

        const ev = validateEmail(normalizedEmail)
        if (!ev.valid) return send(res, 400, { error: ev.error })

        const lockRecord = getLockRecord(db, normalizedEmail)
        const lockedUntilTs = lockRecord.lockedUntil ? Date.parse(lockRecord.lockedUntil) : 0
        if (lockedUntilTs && Date.now() < lockedUntilTs) {
          return send(res, 423, {
            error: 'Account temporarily locked due to repeated failed sign-ins. Try again later.',
            lockedUntil: lockRecord.lockedUntil,
          })
        }

        const userId = db.usersByEmail[normalizedEmail]
        if (!userId) {
          const failState = registerFailedSignin(db, {
            email: normalizedEmail,
            userId: null,
            ip: clientIp,
          })
          saveDb(db)
          if (failState.locked) {
            return send(res, 423, {
              error: 'Account temporarily locked due to repeated failed sign-ins. Try again later.',
              lockedUntil: failState.lockedUntil,
            })
          }
          return send(res, 401, { error: 'Invalid email or password' })
        }

        const user = db.users[userId]
        if (!user) return send(res, 404, { error: 'User profile not found' })

        const ok = verifyPassword(password, user.metadata?.passwordHash)
        if (!ok) {
          const failState = registerFailedSignin(db, {
            email: normalizedEmail,
            userId,
            ip: clientIp,
          })
          saveDb(db)
          if (failState.locked) {
            return send(res, 423, {
              error: 'Account temporarily locked due to repeated failed sign-ins. Try again later.',
              lockedUntil: failState.lockedUntil,
            })
          }
          return send(res, 401, { error: 'Invalid email or password' })
        }

        clearFailedSignin(db, normalizedEmail)

        user.lastSeen = nowIso()
        db.users[userId] = user
        const accessToken = createAccessToken(userId)
        setAuthCookies(res, req, accessToken)
        saveDb(db)

        return send(res, 200, {
          user: stripUserMetadata(user),
          accessToken,
          message: 'Signed in successfully',
        })
      }

      // AUTH: csrf bootstrap
      if (method === 'GET' && pathname === '/auth/csrf') {
        const csrfToken = ensureCsrfToken(res, req)
        return send(res, 200, { csrfToken })
      }

      // AUTH: logout
      if (method === 'POST' && pathname === '/auth/logout') {
        clearAuthCookies(res, req)
        return send(res, 200, { ok: true })
      }

      // AUTH: me
      if (method === 'GET' && pathname === '/auth/me') {
        const userId = authUserIdFromReq(req)
        if (!userId) return send(res, 401, { error: 'Unauthorized' })
        const user = db.users[userId]
        if (!user) return send(res, 404, { error: 'User not found' })
        ensureCsrfToken(res, req)
        return send(res, 200, { user: stripUserMetadata(user) })
      }

      // USERS: list (admin)
      if (method === 'GET' && pathname === '/users') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isAdminRole(current.role)) return send(res, 403, { error: 'Admin access required' })
        const users = Object.values(db.users).map(stripUserMetadata)
        return send(res, 200, { users })
      }

      // ADMIN: audit logs
      if (method === 'GET' && pathname === '/admin/audit-logs') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isAdminRole(current.role)) return send(res, 403, { error: 'Admin access required' })

        const logs = Object.values(db.audit_logs || {})
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 100)

        return send(res, 200, { logs })
      }

      // ADMIN: per-user sensor status overview
      if (method === 'GET' && pathname === '/admin/device-status') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isAdminRole(current.role)) return send(res, 403, { error: 'Admin access required' })

        const users = Object.values(db.users || {}).map(stripUserMetadata)
        const statuses = users.map((user) => {
          const deviceIds = db.devicesByUser?.[user.id] || []
          const devices = deviceIds.map((deviceId) => db.devices?.[deviceId]).filter(Boolean)
          return buildUserSensorStatusSummary(user, devices)
        })

        const summary = statuses.reduce((acc, item) => {
          acc.totalUsers += 1
          if (item.sensorStatus === 'healthy') acc.healthyUsers += 1
          if (item.sensorStatus === 'warning') acc.attentionUsers += 1
          if (item.sensorStatus === 'not-working') acc.notWorkingUsers += 1
          if (item.sensorStatus === 'broken') acc.brokenUsers += 1
          if (item.sensorStatus === 'no-device') acc.noDeviceUsers += 1
          return acc
        }, {
          totalUsers: 0,
          healthyUsers: 0,
          attentionUsers: 0,
          notWorkingUsers: 0,
          brokenUsers: 0,
          noDeviceUsers: 0,
        })

        return send(res, 200, {
          statuses,
          summary,
          helpLineNumber: getDeviceHelpLineNumber(db),
        })
      }

      // ADMIN: update device help line number
      if (method === 'PUT' && pathname === '/admin/help-line') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isAdminRole(current.role)) return send(res, 403, { error: 'Admin access required' })

        const body = await readJsonBody(req)
        const incomingHelpLine = typeof body?.helpLineNumber === 'string' ? body.helpLineNumber : ''

        let nextHelpLine = ''
        try {
          nextHelpLine = setDeviceHelpLineNumber(db, incomingHelpLine)
        } catch (error) {
          return send(res, 400, { error: error?.message || 'Invalid help line number' })
        }

        recordAuditLog(db, {
          actorId: authId,
          actorEmail: current.email || null,
          action: 'admin.helpLine.update',
          targetUserId: null,
          targetEmail: null,
          metadata: {
            helpLineNumber: nextHelpLine,
          },
        })

        saveDb(db)

        return send(res, 200, {
          helpLineNumber: nextHelpLine,
          message: 'Device help line updated',
        })
      }

      // EXPERTS: public verified doctors list
      if (method === 'GET' && pathname === '/experts') {
        const experts = Object.values(db.users)
          .filter((u) => u && u.role === 'doctor' && u.verificationStatus === 'verified')
          .map((u) => ({
            id: u.id,
            name: u.name,
            name_bn: u.name,
            specialty: u.specialty || 'Agricultural Specialist',
            specialty_bn: u.specialty_bn || u.specialty || 'কৃষি বিশেষজ্ঞ',
            rating: Number((4.1 + Math.random() * 0.8).toFixed(1)),
            responseTime: 'within 20 min',
            responseTime_bn: '২০ মিনিটের মধ্যে',
            available: true,
            registrationNumber: u.registrationNumber || '',
            experienceYears: Number(u.experienceYears || 0),
            profileSummary: u.profileSummary || '',
            certificateDocument: u.certificateDocument || '',
            resumeDocument: u.resumeDocument || '',
            verificationStatus: u.verificationStatus || 'verified',
          }))

        return send(res, 200, { experts })
      }

      // USERS: update
      if (method === 'PUT' && pathname.startsWith('/users/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })

        const userId = pathname.split('/').pop()
        const current = db.users[authId]
        const isSelfUpdate = Boolean(userId && userId === authId)
        const canAdminUpdate = Boolean(userId && current && isAdminRole(current.role) && userId !== authId)
        if (!userId || !current || (!isSelfUpdate && !canAdminUpdate)) {
          return send(res, 403, { error: 'Forbidden' })
        }

        const user = db.users[userId]
        if (!user) return send(res, 404, { error: 'User not found' })

        const incomingUpdates = await readJsonBody(req)

        let updates = incomingUpdates || {}
        if (isSelfUpdate && !isAdminRole(current.role)) {
          updates = sanitizeSelfUserUpdates(incomingUpdates)
        }

        if (isSelfUpdate && current.role === 'super_admin') {
          if (typeof updates.role === 'string' && updates.role !== current.role) {
            return send(res, 403, { error: 'Super users cannot change their own role' })
          }
        }

        if (canAdminUpdate && current.role === 'super_admin') {
          if (user.role === 'admin' || user.role === 'super_admin') {
            return send(res, 403, { error: 'Super users cannot manage admin or super user accounts' })
          }
          if (updates.role === 'admin' || updates.role === 'super_admin') {
            return send(res, 403, { error: 'Super users cannot grant admin or super user access' })
          }
        }

        const nextRole = typeof updates.role === 'string' ? updates.role : user.role
        if (nextRole && !['farmer', 'doctor', 'admin', 'super_admin'].includes(nextRole)) {
          return send(res, 400, { error: 'Invalid role' })
        }

        const updated = {
          ...user,
          ...updates,
          id: userId,
        }

        if (nextRole) {
          updated.role = nextRole
          updated.role_bn = roleBn(nextRole)
        }

        if (user.role === 'doctor' && updated.role !== 'doctor') {
          updated.verificationStatus = 'rejected'
          pushUserAlert(db, userId, {
            type: 'access',
            message: 'Your doctor access has been removed by admin.',
            message_bn: 'অ্যাডমিন আপনার ডাক্তার অ্যাক্সেস বাতিল করেছেন।',
          })
        }

        if (user.verificationStatus !== 'rejected' && updated.verificationStatus === 'rejected') {
          pushUserAlert(db, userId, {
            type: 'verification',
            message: 'Your doctor verification status is now rejected. Please contact support or resubmit documents.',
            message_bn: 'আপনার ডাক্তার ভেরিফিকেশন রিজেক্ট হয়েছে। সাপোর্টে যোগাযোগ করুন বা নতুন করে ডকুমেন্ট দিন।',
          })
        }

        db.users[userId] = updated
        recordAuditLog(db, {
          actorId: authId,
          actorEmail: current.email || null,
          action: 'users.update',
          targetUserId: userId,
          targetEmail: updated.email || user.email || null,
          metadata: {
            fromRole: user.role,
            toRole: updated.role,
            fromStatus: user.verificationStatus || null,
            toStatus: updated.verificationStatus || null,
          },
        })
        saveDb(db)
        return send(res, 200, { user: stripUserMetadata(updated) })
      }

      // USERS: delete (admin)
      if (method === 'DELETE' && pathname.startsWith('/users/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })

        const current = db.users[authId]
        if (!current || !isAdminRole(current.role)) return send(res, 403, { error: 'Admin access required' })

        const userId = pathname.split('/').pop()
        if (!userId) return send(res, 400, { error: 'User id is required' })
        if (userId === authId) return send(res, 400, { error: 'You cannot delete your own admin account' })

        const user = db.users[userId]
        if (!user) return send(res, 404, { error: 'User not found' })

        if (current.role === 'super_admin' && (user.role === 'admin' || user.role === 'super_admin')) {
          return send(res, 403, { error: 'Super users cannot delete admin or super user accounts' })
        }

        if (user.role === 'admin') {
          const adminCount = Object.values(db.users).filter((u) => u && u.role === 'admin').length
          if (adminCount <= 1) {
            return send(res, 400, { error: 'At least one admin account must remain' })
          }
        }

        recordAuditLog(db, {
          actorId: authId,
          actorEmail: current.email || null,
          action: 'users.delete',
          targetUserId: userId,
          targetEmail: user.email || null,
          metadata: {
            deletedRole: user.role,
          },
        })

        if (user.email) {
          delete db.usersByEmail[user.email]
        }
        delete db.pendingDoctors
        db.pendingDoctors = (db.pendingDoctors || []).filter((id) => id !== userId)

        Object.keys(db.consultations || {}).forEach((consultationId) => {
          const consultation = db.consultations[consultationId]
          if (consultation?.farmerId === userId || consultation?.doctorId === userId) {
            delete db.consultations[consultationId]
          }
        })
        Object.keys(db.consultationsByFarmer || {}).forEach((farmerId) => {
          db.consultationsByFarmer[farmerId] = (db.consultationsByFarmer[farmerId] || []).filter((id) => {
            const consultation = db.consultations[id]
            return consultation && consultation.farmerId !== userId && consultation.doctorId !== userId
          })
          if (db.consultationsByFarmer[farmerId].length === 0) delete db.consultationsByFarmer[farmerId]
        })

        delete db.irrigation[userId]
        delete db.diseasesByUser[userId]
        Object.keys(db.diseases || {}).forEach((diseaseId) => {
          if (db.diseases[diseaseId]?.userId === userId) delete db.diseases[diseaseId]
        })

        delete db.alertsByUser[userId]
        Object.keys(db.alerts || {}).forEach((alertId) => {
          if (db.alerts[alertId]?.userId === userId) delete db.alerts[alertId]
        })

        delete db.devicesByUser[userId]
        Object.keys(db.devices || {}).forEach((deviceId) => {
          if (db.devices[deviceId]?.userId === userId) delete db.devices[deviceId]
        })

        delete db.assistantChats[userId]
        Object.keys(db.assistantChats || {}).forEach((chatId) => {
          const chat = db.assistantChats[chatId]
          if (chatId === userId || chat?.userId === userId) delete db.assistantChats[chatId]
        })

        Object.keys(db.assistant_chat_sessions || {}).forEach((chatId) => {
          if (db.assistant_chat_sessions[chatId]?.user_id === userId) delete db.assistant_chat_sessions[chatId]
        })
        Object.keys(db.assistant_chat_messages || {}).forEach((messageId) => {
          if (db.assistant_chat_messages[messageId]?.user_id === userId) delete db.assistant_chat_messages[messageId]
        })

        Object.keys(db.uploaded_documents || {}).forEach((documentId) => {
          if (db.uploaded_documents[documentId]?.user_id === userId) {
            const document = db.uploaded_documents[documentId]
            if (document?.sha256) {
              delete db.uploadedDocumentsByHash[document.sha256]
            }
            delete db.uploaded_documents[documentId]
          }
        })

        delete db.users[userId]
        saveDb(db)

        return send(res, 200, { message: 'User deleted successfully', userId })
      }

      // DOCTORS: pending (admin)
      if (method === 'GET' && pathname === '/doctors/pending') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isPrimaryAdmin(current)) return send(res, 403, { error: 'Admin access required' })
        const doctors = db.pendingDoctors.map((id) => db.users[id]).filter(Boolean).map(stripUserMetadata)
        return send(res, 200, { doctors })
      }

      // DOCTORS: verify (admin)
      if (method === 'POST' && pathname.startsWith('/doctors/') && pathname.endsWith('/verify')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isPrimaryAdmin(current)) return send(res, 403, { error: 'Admin access required' })

        const parts = pathname.split('/')
        const doctorId = parts[2]
        const { status, reason } = await readJsonBody(req)
        if (!['verified', 'rejected', 'suspended', 'pending'].includes(status)) return send(res, 400, { error: 'Invalid status' })
        const reasonText = typeof reason === 'string' ? reason.trim() : ''
        if ((status === 'rejected' || status === 'suspended') && !reasonText) {
          return send(res, 400, { error: 'Audit note is required for reject or suspend actions' })
        }

        const doctor = db.users[doctorId]
        if (!doctor) return send(res, 404, { error: 'Doctor not found' })

        doctor.verificationStatus = status
        if (reasonText) doctor.metadata = { ...(doctor.metadata || {}), rejectionReason: reasonText }
        db.users[doctorId] = doctor
        db.pendingDoctors = (db.pendingDoctors || []).filter((x) => x !== doctorId)
        if (status === 'pending') {
          db.pendingDoctors.push(doctorId)
        }
        recordAuditLog(db, {
          actorId: authId,
          actorEmail: current.email || null,
          action: 'doctors.verify',
          targetUserId: doctorId,
          targetEmail: doctor.email || null,
          metadata: {
            status,
            reason: reasonText || null,
          },
        })
        saveDb(db)

        return send(res, 200, { doctor: stripUserMetadata(doctor), message: `Doctor ${status} successfully` })
      }

      // DISEASES: save (guest allowed)
      if (method === 'POST' && pathname === '/diseases') {
        const authId = authUserIdFromReq(req) || 'guest'
        const body = await readJsonBody(req)
        const record = {
          id: id('disease'),
          userId: authId,
          disease: body.disease,
          disease_bn: body.disease_bn,
          confidence: body.confidence,
          image_url: body.image_url,
          advisory_en: body.advisory_en,
          advisory_bn: body.advisory_bn,
          treatment_en: body.treatment_en,
          treatment_bn: body.treatment_bn,
          prevention_en: body.prevention_en,
          prevention_bn: body.prevention_bn,
          crop: body.crop,
          crop_bn: body.crop_bn,
          chat_id: body.chat_id || '',
          treatmentOutcome: 'unknown',
          treatmentNote: '',
          detectedAt: nowIso(),
          reviewed: false,
        }

        db.diseases[record.id] = record
        db.diseasesByUser[authId] ||= []
        db.diseasesByUser[authId].push(record.id)
        saveDb(db)

        if (authId !== 'guest') {
          emitRealtime(`diseases:${authId}`, { action: 'new', record }, authId)
        }

        return send(res, 200, { record, message: 'Disease record saved' })
      }

      // DISEASES: detect using Plant.id Health Assessment
      if (method === 'POST' && pathname === '/diseases/detect') {
        const body = await readJsonBody(req)
        const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : ''
        const crop = typeof body?.crop === 'string' ? body.crop.trim() : ''

        if (!imageBase64) {
          return send(res, 400, { error: 'imageBase64 is required' })
        }

        const buildLocalFallback = () => {
          const name = crop || 'Crop'
          return {
            disease: `${name} leaf disease (preliminary)`,
            confidence: 76,
            advisory_en: 'Preliminary analysis completed. Please verify with a field expert if symptoms persist.',
            advisory_bn: 'প্রাথমিক বিশ্লেষণ সম্পন্ন হয়েছে। লক্ষণ স্থায়ী হলে মাঠ পর্যায়ের বিশেষজ্ঞের সাথে যাচাই করুন।',
            treatment_en: 'Remove infected leaves, keep field dry, and apply a recommended fungicide as per label dose.',
            treatment_bn: 'আক্রান্ত পাতা সরান, জমি অতিরিক্ত ভেজা রাখবেন না, এবং লেবেল অনুযায়ী উপযুক্ত ছত্রাকনাশক প্রয়োগ করুন।',
            prevention_en: 'Use certified seeds, maintain spacing, and monitor plants every 2-3 days.',
            prevention_bn: 'মানসম্মত বীজ ব্যবহার করুন, গাছের দূরত্ব বজায় রাখুন, এবং ২-৩ দিন পরপর পর্যবেক্ষণ করুন।',
            image_ref: 'local-fallback',
          }
        }

        const plantIdApiKey = getPlantIdApiKey()
        if (!plantIdApiKey) {
          return send(res, 200, {
            result: buildLocalFallback(),
            provider: 'local-fallback',
            warning: 'Plant.id API key not configured. Returned local fallback detection.',
          })
        }

        const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/i, '')
        const apiPayload = {
          images: [cleanBase64],
          latitude: 23.8103,
          longitude: 90.4125,
          similar_images: true,
          health: 'only',
          disease_details: ['local_name', 'description', 'treatment', 'classification', 'common_names', 'url'],
        }

        const externalResponse = await fetch(PLANT_ID_HEALTH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': plantIdApiKey,
          },
          body: JSON.stringify(apiPayload),
        })

        const rawText = await externalResponse.text().catch(() => '')
        let raw = {}
        if (rawText) {
          try {
            raw = JSON.parse(rawText)
          } catch {
            raw = { rawText: rawText.slice(0, 500) }
          }
        }

        if (!externalResponse.ok) {
          const message = raw?.message
            || raw?.error
            || raw?.detail
            || raw?.rawText
            || `HTTP ${externalResponse.status}: Crop disease detection failed`
          console.error(`❌ Plant.id API error (${externalResponse.status}):`, JSON.stringify(raw).substring(0, 200))
          return send(res, 200, {
            result: buildLocalFallback(),
            provider: 'local-fallback',
            warning: `Plant.id unavailable: ${message}`,
            raw,
          })
        }

        const result = normalizePlantIdDetection(raw)
        const safeRaw = raw && typeof raw === 'object' ? { ...raw } : raw
        if (safeRaw && typeof safeRaw === 'object' && 'secret' in safeRaw) {
          delete safeRaw.secret
        }
        return send(res, 200, { result, raw: safeRaw, provider: 'plant.id' })
      }

      // TTS: text-to-speech endpoint (guest allowed)
      if (method === 'POST' && pathname === '/tts/generate') {
        const body = await readJsonBody(req)
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        const language = ['en', 'bn'].includes(body?.language) ? body.language : 'en'

        if (!text) {
          return send(res, 400, { error: 'Text is required' })
        }

        try {
          const audioData = await generateTtsAudio(text, language)
          return send(res, 200, audioData)
        } catch (err) {
          console.error('TTS error:', err.message)
          // Return fallback with client-side synthesis info
          return send(res, 200, {
            provider: 'web-speech',
            text,
            language: language === 'bn' ? 'bn-BD' : 'en-US',
            message: 'Using browser Web Speech API for voice synthesis',
          })
        }
      }

      // DISEASES: history (auth required)
      if (method === 'GET' && pathname === '/diseases') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const ids = db.diseasesByUser[authId] || []
        const records = ids.map((rid) => db.diseases[rid]).filter(Boolean)
        records.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
        return send(res, 200, { records })
      }

      // DISEASES: update treatment outcome/note
      if (method === 'PUT' && pathname.startsWith('/diseases/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })

        const diseaseId = pathname.split('/').pop()
        if (!diseaseId) return send(res, 400, { error: 'Disease record id is required' })

        const existing = db.diseases[diseaseId]
        if (!existing) return send(res, 404, { error: 'Disease record not found' })

        const current = db.users[authId]
        const canUpdate = existing.userId === authId || current?.role === 'admin'
        if (!canUpdate) return send(res, 403, { error: 'Forbidden' })

        const body = await readJsonBody(req)
        const allowedOutcomes = new Set(['improved', 'no-change', 'worse', 'unknown'])
        const nextOutcome = allowedOutcomes.has(body?.treatmentOutcome)
          ? body.treatmentOutcome
          : existing.treatmentOutcome || 'unknown'
        const nextNote = typeof body?.treatmentNote === 'string'
          ? body.treatmentNote.slice(0, 500)
          : existing.treatmentNote || ''

        const updated = {
          ...existing,
          treatmentOutcome: nextOutcome,
          treatmentNote: nextNote,
          updatedAt: nowIso(),
        }

        db.diseases[diseaseId] = updated
        saveDb(db)

        if (updated.userId && updated.userId !== 'guest') {
          emitRealtime(`diseases:${updated.userId}`, { action: 'update', record: updated }, updated.userId)
        }

        return send(res, 200, { record: updated, message: 'Disease record updated' })
      }

      // IRRIGATION: get
      if (method === 'GET' && pathname.startsWith('/irrigation/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const userId = pathname.split('/').pop()
        if (!userId || userId !== authId) return send(res, 403, { error: 'Forbidden' })
        let schedule = db.irrigation[userId]
        if (!schedule) {
          schedule = createDefaultIrrigationSchedule(userId)
          db.irrigation[userId] = schedule
          saveDb(db)
        }
        return send(res, 200, {
          schedule,
          helpLineNumber: getDeviceHelpLineNumber(db),
        })
      }

      // IRRIGATION: update
      if (method === 'PUT' && pathname.startsWith('/irrigation/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const userId = pathname.split('/').pop()
        if (!userId || userId !== authId) return send(res, 403, { error: 'Forbidden' })
        const updates = await readJsonBody(req)
        const existing = db.irrigation[userId] || createDefaultIrrigationSchedule(userId)
        let schedule = { ...existing, ...updates, id: userId, userId, updatedAt: nowIso() }

        const nextCrop = updates?.policy?.crop || updates?.crop || schedule?.policy?.crop || existing?.policy?.crop || 'Rice'
        const profile = getIrrigationCropPolicy(nextCrop)
        const nextLandAreaAcres = normalizeLandAreaAcres(
          updates?.policy?.landAreaAcres
            ?? schedule?.policy?.landAreaAcres
            ?? existing?.policy?.landAreaAcres
            ?? 1,
        )
        const nextPumpCapacityLpm = normalizePumpCapacityLpm(
          updates?.policy?.pumpCapacityLpm
            ?? schedule?.policy?.pumpCapacityLpm
            ?? existing?.policy?.pumpCapacityLpm,
          nextLandAreaAcres,
        )
        const nextMaxCycleMinutes = normalizeMaxCycleMinutes(
          updates?.policy?.maxCycleMinutes
            ?? schedule?.policy?.maxCycleMinutes
            ?? existing?.policy?.maxCycleMinutes,
        )

        schedule.policy = {
          ...(schedule.policy || {}),
          crop: profile.crop,
          crop_bn: profile.crop_bn,
          threshold: Number(schedule?.policy?.threshold || profile.threshold),
          window: schedule?.policy?.window || profile.window,
          landAreaAcres: nextLandAreaAcres,
          maxVolume: calculateIrrigationMaxVolume(profile.crop, nextLandAreaAcres),
          pumpCapacityLpm: nextPumpCapacityLpm,
          maxCycleMinutes: nextMaxCycleMinutes,
          alarmTickThreshold: normalizeAlarmTickThreshold(schedule?.policy?.alarmTickThreshold),
        }

        db.irrigation[userId] = schedule
        saveDb(db)
        emitRealtime(`irrigation:${userId}`, { action: 'update', schedule }, userId)
        return send(res, 200, {
          schedule,
          message: 'Irrigation schedule updated',
          helpLineNumber: getDeviceHelpLineNumber(db),
        })
      }

      // CONSULTATIONS: create
      if (method === 'POST' && pathname === '/consultations') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const farmer = db.users[authId]
        if (!farmer) return send(res, 404, { error: 'User not found' })
        const body = await readJsonBody(req)

        const consultation = {
          id: id('consultation'),
          farmerId: authId,
          farmerName: farmer.name,
          farmerEmail: farmer.email,
          farmerPhone: farmer.phone || farmer.email || '',
          crop: body.crop,
          crop_bn: body.crop_bn,
          disease: body.disease,
          disease_bn: body.disease_bn,
          description: body.description,
          description_en: body.description_en || body.description,
          location: body.location || farmer.location || 'Unknown',
          location_bn: body.location_bn || farmer.location_bn || 'অজানা',
          priority: body.priority || 'medium',
          status: 'pending',
          images: body.images || [],
          submittedAt: nowIso(),
        }

        db.consultations[consultation.id] = consultation
        db.consultationsByFarmer[authId] ||= []
        db.consultationsByFarmer[authId].push(consultation.id)
        saveDb(db)

        emitRealtime('consultations:all', { action: 'new', consultation })
        emitRealtime(`consultations:${authId}`, { action: 'new', consultation }, authId)

        return send(res, 200, { consultation, message: 'Consultation created' })
      }

      // CONSULTATIONS: list (role-based)
      if (method === 'GET' && pathname === '/consultations') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current) return send(res, 404, { error: 'User not found' })

        let consultations = []
        if (current.role === 'farmer') {
          const ids = db.consultationsByFarmer[authId] || []
          consultations = ids.map((cid) => db.consultations[cid]).filter(Boolean)
        } else if (current.role === 'doctor') {
          consultations = Object.values(db.consultations).filter(
            (c) => c && (c.status === 'pending' || c.doctorId === authId),
          )
        } else {
          consultations = Object.values(db.consultations)
        }

        consultations.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        return send(res, 200, { consultations })
      }

      // CONSULTATIONS: update (doctor/admin/super user manager)
      if (method === 'PUT' && pathname.startsWith('/consultations/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        const canManageConsultation = Boolean(current && (current.role === 'doctor' || current.role === 'admin' || current.role === 'super_admin'))
        if (!canManageConsultation) return send(res, 403, { error: 'Consultation manager access required' })

        const consultationId = pathname.split('/').pop()
        const existing = consultationId ? db.consultations[consultationId] : null
        if (!existing) return send(res, 404, { error: 'Consultation not found' })

        const updates = await readJsonBody(req)
        let updated = { ...existing }

        if (current.role === 'doctor') {
          updated = {
            ...existing,
            ...updates,
            doctorId: authId,
            doctorName: current.name,
            doctorSpecialty: current.specialty || 'Agricultural Specialist',
            doctorRegistrationNumber: current.registrationNumber || '',
            doctorExperienceYears: Number(current.experienceYears || 0),
            doctorProfileSummary: current.profileSummary || '',
            doctorCertificateDocument: current.certificateDocument || '',
            doctorResumeDocument: current.resumeDocument || '',
            doctorVerificationStatus: current.verificationStatus || 'verified',
            status: updates.status || 'in-progress',
          }
        } else {
          const nextStatus = typeof updates?.status === 'string' ? updates.status : existing.status
          const nextPriority = typeof updates?.priority === 'string' ? updates.priority : existing.priority
          const nextAdminNote = typeof updates?.adminNote === 'string'
            ? updates.adminNote.slice(0, 500)
            : (existing.adminNote || '')

          updated = {
            ...existing,
            status: nextStatus,
            priority: nextPriority,
            adminNote: nextAdminNote,
            reviewedAt: nowIso(),
            reviewedBy: current.email || current.name || authId,
            reviewedByRole: current.role,
          }
        }

        db.consultations[consultationId] = updated
        saveDb(db)
        emitRealtime('consultations:all', { action: 'update', consultation: updated })
        if (updated.farmerId) {
          emitRealtime(`consultations:${updated.farmerId}`, { action: 'update', consultation: updated }, updated.farmerId)
        }
        return send(res, 200, { consultation: updated, message: 'Consultation updated' })
      }

      // PRICES: list (filters)
      if (method === 'GET' && pathname === '/prices') {
        const location = (url.searchParams.get('location') || '').trim()
        const crop = (url.searchParams.get('crop') || '').trim()
        const prices = getFilteredMarketPrices(db, location, crop)
        return send(res, 200, {
          prices,
          updatedAt: new Date(lastDhakaLiveUpdateAt || Date.now()).toISOString(),
          live: false,
          count: prices.length,
          profile: MARKET_VOLATILITY_PROFILE,
          updateIntervalMs: MARKET_REALTIME_AUTO_UPDATE_MS,
        })
      }

      // PRICES: live feed (small simulated market drift)
      if (method === 'GET' && (pathname === '/prices/live' || pathname === '/prices/live/dhaka')) {
        const locationParam = pathname === '/prices/live/dhaka'
          ? 'Dhaka'
          : (url.searchParams.get('location') || '').trim()
        const cropParam = (url.searchParams.get('crop') || '').trim()
        const livePayload = runLiveMarketDrift(db, {
          locationParam,
          cropParam,
          force: false,
          now: Date.now(),
        })
        return send(res, 200, livePayload)
      }

      // PRICES: update (admin)
      if (method === 'POST' && pathname === '/prices') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const current = db.users[authId]
        if (!current || !isPrimaryAdmin(current)) return send(res, 403, { error: 'Admin access required' })
        const body = await readJsonBody(req)

        const normalizedIncoming = normalizePriceRecord(body)
        const targetPrice = Number(normalizedIncoming.price)
        if (!normalizedIncoming.crop || normalizedIncoming.crop === 'Unknown Crop') {
          return send(res, 400, { error: 'Valid crop is required' })
        }
        if (!normalizedIncoming.location || normalizedIncoming.location === 'Unknown') {
          return send(res, 400, { error: 'Valid location is required' })
        }
        if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
          return send(res, 400, { error: 'Valid numeric price is required' })
        }

        const normalizedMarket = String(normalizedIncoming.market || '').toLowerCase()
        const existing = Object.values(db.prices || {})
          .map((row) => normalizePriceRecord(row))
          .find((row) => {
            if (normalizedIncoming.id && row.id === normalizedIncoming.id) return true
            return (
              String(row.crop || '').toLowerCase() === String(normalizedIncoming.crop || '').toLowerCase() &&
              String(row.location || '').toLowerCase() === String(normalizedIncoming.location || '').toLowerCase() &&
              String(row.market || '').toLowerCase() === normalizedMarket
            )
          })

        const previousPrice = Number(existing?.price || targetPrice)
        const absoluteChange = Number((targetPrice - previousPrice).toFixed(2))
        const changePercent = previousPrice > 0
          ? Number(((absoluteChange / previousPrice) * 100).toFixed(2))
          : 0

        const now = Date.now()
        const nextPriceRecord = normalizePriceRecord({
          ...(existing || {}),
          ...normalizedIncoming,
          id: existing?.id || normalizedIncoming.id || id('price'),
          price: targetPrice,
          change: absoluteChange,
          changePercent,
          trend: derivePriceTrend(changePercent),
          min: existing ? Math.min(Number(existing.min ?? previousPrice), targetPrice) : targetPrice,
          max: existing ? Math.max(Number(existing.max ?? previousPrice), targetPrice) : targetPrice,
          avg: existing
            ? Number(((Number(existing.avg ?? previousPrice) * 4 + targetPrice) / 5).toFixed(2))
            : targetPrice,
          date: new Date(now).toISOString(),
          lastUpdated: new Date(now).toLocaleString('en-US'),
          lastUpdated_bn: new Date(now).toLocaleString('bn-BD'),
        })

        db.prices[nextPriceRecord.id] = nextPriceRecord
        marketAnchorByPriceId.set(getMarketPriceKey(nextPriceRecord), Number(nextPriceRecord.avg || nextPriceRecord.price))
        saveDb(db)

        const action = existing ? 'update' : 'new'
        const updatedAt = new Date(now).toISOString()

        emitRealtime('prices:broadcast', {
          action,
          price: nextPriceRecord,
          updatedAt,
          profile: MARKET_VOLATILITY_PROFILE,
        })
        emitRealtime('prices:batch', {
          action: 'manual-update',
          prices: [nextPriceRecord],
          updatedAt,
          count: 1,
          profile: MARKET_VOLATILITY_PROFILE,
        })
        notifyPriceAlerts(db, nextPriceRecord)

        return send(res, 200, {
          price: nextPriceRecord,
          action,
          updatedAt,
          profile: MARKET_VOLATILITY_PROFILE,
          message: existing ? 'Price updated' : 'Price created',
        })
      }

      // ALERTS: create
      if (method === 'POST' && pathname === '/alerts') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const body = await readJsonBody(req)
        const alert = {
          id: id('alert'),
          userId: authId,
          crop: body.crop,
          crop_bn: body.crop_bn,
          targetPrice: body.targetPrice,
          condition: body.condition,
          location: body.location,
          active: true,
          createdAt: nowIso(),
        }
        db.alerts[alert.id] = alert
        db.alertsByUser[authId] ||= []
        db.alertsByUser[authId].push(alert.id)
        saveDb(db)
        return send(res, 200, { alert, message: 'Alert created' })
      }

      // ALERTS: list
      if (method === 'GET' && pathname === '/alerts') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const ids = db.alertsByUser[authId] || []
        const alerts = ids.map((aid) => db.alerts[aid]).filter(Boolean)
        return send(res, 200, { alerts })
      }

      // ALERTS: delete
      if (method === 'DELETE' && pathname.startsWith('/alerts/')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const alertId = pathname.split('/').pop()
        const alert = alertId ? db.alerts[alertId] : null
        if (!alert) return send(res, 404, { error: 'Alert not found' })
        if (alert.userId !== authId) return send(res, 403, { error: 'Forbidden' })
        delete db.alerts[alertId]
        db.alertsByUser[authId] = (db.alertsByUser[authId] || []).filter((x) => x !== alertId)
        saveDb(db)
        return send(res, 200, { message: 'Alert deleted' })
      }

      // DEVICES: setup virtual irrigation sensor
      if (method === 'POST' && pathname === '/devices/virtual-irrigation/setup') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })

        const body = await readJsonBody(req)
        const requestedCrop = typeof body?.crop === 'string' ? body.crop : 'Rice'
        const cropProfile = getIrrigationCropPolicy(requestedCrop)

        db.devicesByUser[authId] ||= []
        const existingVirtual = (db.devicesByUser[authId] || [])
          .map((did) => db.devices[did])
          .find((device) => device && device.mode === 'virtual' && device.type === 'virtual_soil_sensor')

        let device = existingVirtual
        if (!device) {
          device = {
            id: id('device'),
            userId: authId,
            name: 'Virtual Soil Sensor',
            type: 'virtual_soil_sensor',
            type_bn: 'ভার্চুয়াল মাটি সেন্সর',
            status: 'active',
            status_bn: 'সক্রিয়',
            mode: 'virtual',
            actuatorState: 'idle',
            telemetry: {
              soilMoisture: 68,
              battery: 100,
              temperature: 29,
              humidity: 72,
            },
            lastSync: nowIso(),
            createdAt: nowIso(),
          }
          db.devices[device.id] = device
          db.devicesByUser[authId].push(device.id)
        }

        const existingSchedule = db.irrigation[authId] || createDefaultIrrigationSchedule(authId, cropProfile.crop)
        const setupLandAreaAcres = normalizeLandAreaAcres(
          body?.landAreaAcres
            ?? existingSchedule?.policy?.landAreaAcres
            ?? 1,
        )
        const setupPumpCapacityLpm = normalizePumpCapacityLpm(
          body?.pumpCapacityLpm
            ?? existingSchedule?.policy?.pumpCapacityLpm,
          setupLandAreaAcres,
        )
        const setupMaxCycleMinutes = normalizeMaxCycleMinutes(
          body?.maxCycleMinutes
            ?? existingSchedule?.policy?.maxCycleMinutes,
        )
        const schedule = {
          ...existingSchedule,
          userId: authId,
          deviceId: device.id,
          policy: {
            ...(existingSchedule.policy || {}),
            crop: cropProfile.crop,
            crop_bn: cropProfile.crop_bn,
            threshold: Number(existingSchedule?.policy?.threshold || cropProfile.threshold),
            window: existingSchedule?.policy?.window || cropProfile.window,
            landAreaAcres: setupLandAreaAcres,
            maxVolume: calculateIrrigationMaxVolume(cropProfile.crop, setupLandAreaAcres),
            pumpCapacityLpm: setupPumpCapacityLpm,
            maxCycleMinutes: setupMaxCycleMinutes,
            alarmTickThreshold: normalizeAlarmTickThreshold(existingSchedule?.policy?.alarmTickThreshold),
          },
          updatedAt: nowIso(),
        }

        db.irrigation[authId] = schedule
        saveDb(db)
        emitRealtime(`irrigation:${authId}`, { action: 'update', schedule }, authId)

        return send(res, 200, {
          device,
          schedule,
          helpLineNumber: getDeviceHelpLineNumber(db),
          message: 'Virtual irrigation device is ready',
        })
      }

      // DEVICES: simulate virtual irrigation sensor tick
      if (method === 'POST' && pathname.startsWith('/devices/') && pathname.endsWith('/simulate')) {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })

        const parts = pathname.split('/').filter(Boolean)
        const deviceId = parts[1]
        const device = deviceId ? db.devices[deviceId] : null
        if (!device) return send(res, 404, { error: 'Device not found' })
        if (device.userId !== authId) return send(res, 403, { error: 'Forbidden' })

        const body = await readJsonBody(req)
        const cropInput = typeof body?.crop === 'string' ? body.crop : (db.irrigation[authId]?.policy?.crop || 'Rice')
        const cropProfile = getIrrigationCropPolicy(cropInput)

        const existingSchedule = db.irrigation[authId] || createDefaultIrrigationSchedule(authId, cropProfile.crop)
        const simulationLandAreaAcres = normalizeLandAreaAcres(
          body?.landAreaAcres
            ?? existingSchedule?.policy?.landAreaAcres
            ?? 1,
        )
        const simulationPumpCapacityLpm = normalizePumpCapacityLpm(
          body?.pumpCapacityLpm
            ?? existingSchedule?.policy?.pumpCapacityLpm,
          simulationLandAreaAcres,
        )
        const simulationMaxCycleMinutes = normalizeMaxCycleMinutes(
          body?.maxCycleMinutes
            ?? existingSchedule?.policy?.maxCycleMinutes,
        )
        const currentMoisture = Number(existingSchedule.moisture ?? device?.telemetry?.soilMoisture ?? 68)
        const measuredInput = Number(body?.measuredMoisture)
        const hasMeasuredInput = Number.isFinite(measuredInput)
        const noise = Math.round((Math.random() * 12) - 8)
        const measuredMoisture = hasMeasuredInput
          ? Math.max(20, Math.min(95, Math.round(measuredInput)))
          : Math.max(20, Math.min(95, currentMoisture + noise))
        const forcePump = normalizeForcedPumpAction(body?.forcePump)
        const manualLitersInput = Number(body?.manualLiters)
        const manualLiters = Number.isFinite(manualLitersInput)
          ? Math.max(1, Math.round(manualLitersInput))
          : undefined
        const manualRuntimeMinutesInput = Number(body?.manualRuntimeMinutes)
        const manualRuntimeMinutes = Number.isFinite(manualRuntimeMinutesInput)
          ? Math.max(1, Math.round(manualRuntimeMinutesInput))
          : undefined
        const tickMode = normalizeSimulationTickMode(body?.tickMode)

        const scheduleWithPolicy = {
          ...existingSchedule,
          policy: {
            ...(existingSchedule.policy || {}),
            crop: cropProfile.crop,
            crop_bn: cropProfile.crop_bn,
            threshold: Number(existingSchedule?.policy?.threshold || cropProfile.threshold),
            window: existingSchedule?.policy?.window || cropProfile.window,
            landAreaAcres: simulationLandAreaAcres,
            maxVolume: calculateIrrigationMaxVolume(cropProfile.crop, simulationLandAreaAcres),
            pumpCapacityLpm: simulationPumpCapacityLpm,
            maxCycleMinutes: simulationMaxCycleMinutes,
            alarmTickThreshold: normalizeAlarmTickThreshold(existingSchedule?.policy?.alarmTickThreshold),
          },
          deviceId,
        }

        const { schedule, action, appliedLiters, runtimeSeconds, targetLiters, pumpCapacityLpm, reason } = runAutoIrrigationDecision(
          scheduleWithPolicy,
          measuredMoisture,
          { forcePump, manualLiters, manualRuntimeMinutes, tickMode },
        )

        // Keep critical control settings from the latest persisted schedule so sensor ticks
        // do not revert recent UI changes due to in-flight request timing.
        const latestPersistedSchedule = db.irrigation[authId]
        if (latestPersistedSchedule) {
          if (typeof latestPersistedSchedule.autoMode === 'boolean') {
            schedule.autoMode = latestPersistedSchedule.autoMode
          }
          schedule.policy = {
            ...(schedule.policy || {}),
            pumpCapacityLpm: normalizePumpCapacityLpm(
              latestPersistedSchedule?.policy?.pumpCapacityLpm
                ?? schedule?.policy?.pumpCapacityLpm,
              schedule?.policy?.landAreaAcres,
            ),
            maxCycleMinutes: normalizeMaxCycleMinutes(
              latestPersistedSchedule?.policy?.maxCycleMinutes
                ?? schedule?.policy?.maxCycleMinutes,
            ),
            alarmTickThreshold: normalizeAlarmTickThreshold(
              latestPersistedSchedule?.policy?.alarmTickThreshold
                ?? schedule?.policy?.alarmTickThreshold,
            ),
          }
        }

        schedule.sensorHistory = appendSensorHistory(schedule, {
          measuredMoisture,
          moisture: schedule.moisture,
          action,
          appliedLiters,
          runtimeSeconds,
          flowRateLpm: pumpCapacityLpm,
          targetLiters,
        })
        db.irrigation[authId] = schedule

        const updatedDevice = {
          ...device,
          actuatorState: action,
          telemetry: {
            ...(device.telemetry || {}),
            soilMoisture: schedule.moisture,
            battery: Math.max(5, Number(device?.telemetry?.battery || 100) - (action === 'watering' ? 1 : 0.2)),
            temperature: Math.max(18, Math.min(42, Number(device?.telemetry?.temperature || 29) + Math.round((Math.random() * 4) - 2))),
            humidity: Math.max(30, Math.min(95, Number(device?.telemetry?.humidity || 72) + Math.round((Math.random() * 6) - 3))),
          },
          lastSync: nowIso(),
        }
        db.devices[deviceId] = updatedDevice
        saveDb(db)

        emitRealtime(`irrigation:${authId}`, { action: 'update', schedule }, authId)
        emitRealtime(`devices:${authId}`, { action: 'update', device: updatedDevice }, authId)

        return send(res, 200, {
          device: updatedDevice,
          schedule,
          helpLineNumber: getDeviceHelpLineNumber(db),
          action,
          appliedLiters,
          runtimeSeconds,
          targetLiters,
          pumpCapacityLpm,
          simulatedInput: {
            measuredMoisture,
            forcePump: forcePump || 'auto',
            manualLiters: typeof manualLiters === 'number' ? manualLiters : null,
            manualRuntimeMinutes: typeof manualRuntimeMinutes === 'number' ? manualRuntimeMinutes : null,
            tickMode,
          },
          message: reason,
        })
      }

      // DEVICES: register
      if (method === 'POST' && pathname === '/devices') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const body = await readJsonBody(req)
        const device = {
          id: id('device'),
          userId: authId,
          name: body.name || body.type || 'Device',
          type: body.type,
          type_bn: body.type_bn,
          status: 'active',
          status_bn: 'সক্রিয়',
          mode: body.mode || 'physical',
          telemetry: body.telemetry || {},
          lastSync: nowIso(),
        }
        db.devices[device.id] = device
        db.devicesByUser[authId] ||= []
        db.devicesByUser[authId].push(device.id)
        saveDb(db)
        return send(res, 200, { device, message: 'Device registered' })
      }

      // DEVICES: list
      if (method === 'GET' && pathname === '/devices') {
        const authId = authUserIdFromReq(req)
        if (!authId) return send(res, 401, { error: 'Unauthorized' })
        const ids = db.devicesByUser[authId] || []
        const devices = ids.map((did) => db.devices[did]).filter(Boolean)
        return send(res, 200, { devices })
      }

      return next()
    } catch (err) {
      console.error('Unhandled local API middleware error', err)
      if (!res.headersSent && !res.writableEnded) {
        if (err?.message === 'Invalid JSON body') {
          return send(res, 400, { error: 'Invalid JSON body' })
        }
        if (err?.message === 'Request body too large') {
          return send(res, 413, { error: 'Request body too large' })
        }
        return send(res, 500, { error: err?.message || 'Internal server error' })
      }

      if (!res.writableEnded) {
        try {
          res.end()
        } catch (endErr) {
          console.error('Failed to close response after middleware error', endErr)
        }
      }

      return
    }
  }
}

module.exports = { createLocalApiMiddleware }

