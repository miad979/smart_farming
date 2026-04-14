const { URL } = require('url')

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
