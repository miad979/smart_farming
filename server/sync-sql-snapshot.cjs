const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const DB_PATH = path.resolve(process.cwd(), '.local-db.json')

function getArgValue(argv = [], key) {
  const args = Array.isArray(argv) ? argv : []
  const keyName = String(key || '').trim()
  if (!keyName) return ''

  const flagIndex = args.findIndex((arg) => arg === keyName)
  if (flagIndex >= 0 && args[flagIndex + 1]) {
    return String(args[flagIndex + 1]).trim()
  }

  const inline = args.find((arg) => typeof arg === 'string' && arg.startsWith(`${keyName}=`))
  if (!inline) return ''
  return inline.slice(`${keyName}=`.length).trim()
}

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
  const envPath = path.resolve(process.cwd(), '.env')
  const localEnvPath = path.resolve(process.cwd(), '.env.local')
  loadEnvFromFile(envPath)
  loadEnvFromFile(localEnvPath)
}

function getDatabaseUrl() {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()
}

function getDatabaseUrlFromArgs(argv = []) {
  return getArgValue(argv, '--url')
}

function getSnapshotKeyFromArgs(argv = []) {
  return getArgValue(argv, '--key')
}

function getDbPathFromArgs(argv = []) {
  const fromArg = getArgValue(argv, '--from')
  if (!fromArg) return DB_PATH
  return path.isAbsolute(fromArg) ? fromArg : path.resolve(process.cwd(), fromArg)
}

function countEntries(section) {
  if (!section || typeof section !== 'object') return 0
  return Object.keys(section).length
}

function summarizeLocalDb(parsed) {
  return {
    users: countEntries(parsed?.users),
    pendingDoctors: Array.isArray(parsed?.pendingDoctors) ? parsed.pendingDoctors.length : 0,
    diseases: countEntries(parsed?.diseases),
    irrigation: countEntries(parsed?.irrigation),
    consultations: countEntries(parsed?.consultations),
    prices: countEntries(parsed?.prices),
    alerts: countEntries(parsed?.alerts),
    devices: countEntries(parsed?.devices),
    uploads: countEntries(parsed?.uploads),
    uploadedDocuments: countEntries(parsed?.uploaded_documents),
    assistantChatSessions: countEntries(parsed?.assistant_chat_sessions),
    assistantChatMessages: countEntries(parsed?.assistant_chat_messages),
    assistantChatsLegacy: countEntries(parsed?.assistantChats),
  }
}

function readLocalDbSnapshot(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Local DB file not found: ${dbPath}`)
  }

  const raw = fs.readFileSync(dbPath, 'utf8')
  const parsed = raw ? JSON.parse(raw) : {}
  return {
    parsed,
    payload: JSON.stringify(parsed),
  }
}

async function run() {
  loadEnvFiles()
  const args = process.argv.slice(2)
  const databaseUrl = getDatabaseUrlFromArgs(args) || getDatabaseUrl()
  const snapshotKey = getSnapshotKeyFromArgs(args) || process.env.SQL_SNAPSHOT_KEY || 'local-db'
  const dbPath = getDbPathFromArgs(args)

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL (or POSTGRES_URL) is required. Set it in your shell/.env or pass --url "postgresql://..."',
    )
  }

  const sslMode = (process.env.SQL_SSL || '').toLowerCase()
  const useSsl = sslMode === 'true' || sslMode === '1' || sslMode === 'require'

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  })

  try {
    const { parsed, payload: snapshotPayload } = readLocalDbSnapshot(dbPath)
    const summary = summarizeLocalDb(parsed)

    await pool.query('SELECT 1')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state_snapshots (
        snapshot_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await pool.query(
      `
      INSERT INTO app_state_snapshots (snapshot_key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (snapshot_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [snapshotKey, snapshotPayload],
    )

    const verify = await pool.query(
      `
      SELECT snapshot_key, updated_at
      FROM app_state_snapshots
      WHERE snapshot_key = $1
      LIMIT 1
      `,
      [snapshotKey],
    )

    const updatedAt = verify?.rows?.[0]?.updated_at
    console.log(`SQL snapshot sync complete. key=${snapshotKey}`)
    console.log(`Source: ${dbPath}`)
    console.log(`Updated at: ${updatedAt ? new Date(updatedAt).toISOString() : 'unknown'}`)
    console.log(`Summary: ${JSON.stringify(summary)}`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  const message = error?.message || error?.code || error?.name || 'Unknown error'
  console.error(`SQL snapshot sync failed: ${message}`)
  process.exit(1)
})
