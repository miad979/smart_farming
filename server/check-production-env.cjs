const { URL } = require('url')

function validateSameSiteEnv(name, fallback) {
  const value = String(process.env[name] || fallback || '').trim().toLowerCase()
  if (!['lax', 'strict', 'none'].includes(value)) {
    console.error(`[env] ${name} must be one of: Lax, Strict, None`)
    process.exit(1)
  }
  return value
}

function validatePositiveIntegerEnv(name) {
  const raw = process.env[name]
  if (raw === undefined || raw === null || String(raw).trim() === '') return
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`[env] ${name} must be a positive integer when set.`)
    process.exit(1)
  }
}

const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
const isProduction = nodeEnv === 'production'

if (!isProduction) {
  console.log('[env] NODE_ENV is not production; skipping strict production checks.')
  process.exit(0)
}

const requiredVars = ['AUTH_TOKEN_SECRET', 'CORS_ALLOWED_ORIGINS']
const missing = requiredVars.filter((name) => !String(process.env[name] || '').trim())

if (missing.length > 0) {
  console.error(`[env] Missing required production variables: ${missing.join(', ')}`)
  process.exit(1)
}

const authTokenSecret = String(process.env.AUTH_TOKEN_SECRET || '').trim()
if (authTokenSecret.length < 32) {
  console.error('[env] AUTH_TOKEN_SECRET must be at least 32 characters in production.')
  process.exit(1)
}

const corsOriginsRaw = String(process.env.CORS_ALLOWED_ORIGINS || '')
const corsOrigins = corsOriginsRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (corsOrigins.length === 0) {
  console.error('[env] CORS_ALLOWED_ORIGINS must contain at least one origin.')
  process.exit(1)
}

for (const origin of corsOrigins) {
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    console.error(`[env] Invalid CORS origin: ${origin}`)
    process.exit(1)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    console.error(`[env] Unsupported origin protocol for CORS_ALLOWED_ORIGINS: ${origin}`)
    process.exit(1)
  }
}

const authCookieSameSite = validateSameSiteEnv('AUTH_COOKIE_SAME_SITE', 'Lax')
validateSameSiteEnv('CSRF_COOKIE_SAME_SITE', authCookieSameSite)

const rateLimitVars = [
  'RATE_LIMIT_GLOBAL_PER_MINUTE',
  'RATE_LIMIT_SIGNIN_PER_10_MINUTES',
  'RATE_LIMIT_SIGNUP_PER_10_MINUTES',
  'RATE_LIMIT_UPLOADS_PER_5_MINUTES',
  'RATE_LIMIT_USERS_MUTATION_PER_MINUTE',
  'RATE_LIMIT_DOCTOR_VERIFY_PER_MINUTE',
  'RATE_LIMIT_SIGNIN_EMAIL_PER_10_MINUTES',
  'RATE_LIMIT_REALTIME_CONNECT_PER_MINUTE',
  'RATE_LIMIT_REALTIME_CONNECTIONS_PER_IP',
]

for (const name of rateLimitVars) {
  validatePositiveIntegerEnv(name)
}

// --- Persistent storage -------------------------------------------------------------------------------
// The app keeps its state in a JSON snapshot. On hosts with ephemeral disks (Render, Railway, Fly, Docker
// without a volume) that file is wiped on every deploy/restart, so production needs a Postgres database.
const databaseUrl = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || '').trim()
const allowEphemeral = String(process.env.ALLOW_EPHEMERAL_STORAGE || '').trim().toLowerCase() === 'true'
if (!databaseUrl && !allowEphemeral) {
  console.error('[env] DATABASE_URL is required in production: without it all users, consultations and uploads are')
  console.error('      lost on every deploy or restart. Set DATABASE_URL to a Postgres connection string, or set')
  console.error('      ALLOW_EPHEMERAL_STORAGE=true only for throwaway demos (or a host with a persistent disk).')
  process.exit(1)
}
if (!databaseUrl && allowEphemeral) {
  console.warn('[env] ALLOW_EPHEMERAL_STORAGE=true: data is stored only on local disk.')
}

// --- First administrator ------------------------------------------------------------------------------
// The demo accounts (admin123 / super123) are never created in production and cannot sign in there.
const bootstrapEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim()
const bootstrapPassword = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '')
if (!bootstrapEmail || !bootstrapPassword) {
  console.error('[env] BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required in production (they create the')
  console.error('      first admin account; an existing account with that email keeps its password).')
  process.exit(1)
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bootstrapEmail)) {
  console.error('[env] BOOTSTRAP_ADMIN_EMAIL is not a valid email address.')
  process.exit(1)
}
const strongPassword = bootstrapPassword.length >= 12
  && /[a-z]/.test(bootstrapPassword) && /[A-Z]/.test(bootstrapPassword)
  && /[0-9]/.test(bootstrapPassword) && /[^A-Za-z0-9]/.test(bootstrapPassword)
if (!strongPassword || ['admin123', 'super123'].includes(bootstrapPassword)) {
  console.error('[env] BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters with upper and lower case letters,')
  console.error('      a number and a symbol.')
  process.exit(1)
}

const hasAiProvider = Boolean(
  String(process.env.OPENAI_API_KEY || '').trim()
    || String(process.env.GROQ_API_KEY || '').trim()
    || String(process.env.OPENROUTER_API_KEY || '').trim(),
)

if (!hasAiProvider) {
  console.warn('[env] No AI provider key found. Chat assistant will use local fallback responses.')
}

if (!String(process.env.PLANT_ID_API_KEY || '').trim()) {
  console.warn('[env] PLANT_ID_API_KEY is missing. Disease detection will use fallback behavior.')
}

console.log('[env] Production environment check passed.')
