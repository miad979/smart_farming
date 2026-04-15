const path = require('path')
const { spawnSync } = require('child_process')
const fs = require('fs')

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

function loadEnvFiles() {
  loadEnvFromFile(path.resolve(process.cwd(), '.env'))
  loadEnvFromFile(path.resolve(process.cwd(), '.env.local'))
}

function tryGetSupabaseProjectRef() {
  const explicit = String(process.env.SUPABASE_PROJECT_REF || '').trim()
  if (explicit) return explicit

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  if (!supabaseUrl) return ''

  try {
    const hostname = new URL(supabaseUrl).hostname
    return String(hostname.split('.')[0] || '').trim()
  } catch {
    return ''
  }
}

function resolveDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()
  if (direct) return direct

  const explicitSupabase = String(process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || '').trim()
  if (explicitSupabase) return explicitSupabase

  const projectRef = tryGetSupabaseProjectRef()
  const rawPassword = String(process.env.SUPABASE_DB_PASSWORD || '').trim()
  if (!projectRef || !rawPassword) return ''

  const password = encodeURIComponent(rawPassword)
  return `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
}

function run() {
  loadEnvFiles()

  const databaseUrl = resolveDatabaseUrl()
  if (!databaseUrl) {
    console.error('Supabase connection not configured.')
    console.error('Set one of:')
    console.error('1) DATABASE_URL / POSTGRES_URL')
    console.error('2) SUPABASE_DB_URL')
    console.error('3) SUPABASE_URL + SUPABASE_DB_PASSWORD')
    process.exit(1)
  }

  process.env.DATABASE_URL = databaseUrl

  if (!process.env.SQL_SSL) {
    process.env.SQL_SSL = /supabase\.co|pooler\.supabase\.com/i.test(databaseUrl) ? 'require' : ''
  }

  console.log('Connecting runtime snapshot to Supabase PostgreSQL...')

  const sync = spawnSync(process.execPath, [path.resolve(process.cwd(), 'server', 'sync-sql-snapshot.cjs')], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  })

  if (sync.status !== 0) {
    process.exit(sync.status || 1)
  }

  console.log('Supabase snapshot sync complete. Start the app with: npm run dev')
}

run()
