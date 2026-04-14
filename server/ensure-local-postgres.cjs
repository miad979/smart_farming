const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

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
  loadEnvFromFile(path.resolve(process.cwd(), '.env'))
  loadEnvFromFile(path.resolve(process.cwd(), '.env.local'))
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  })
}

function printOutput(prefix, result) {
  const out = String(result?.stdout || '').trim()
  const err = String(result?.stderr || '').trim()
  if (out) {
    console.log(`${prefix} ${out}`)
  }
  if (err) {
    console.log(`${prefix} ${err}`)
  }
}

function isTruthy(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function shouldManageLocalPostgres(databaseUrl, forceStart) {
  if (forceStart) return true
  if (!databaseUrl) return true
  return databaseUrl.includes('127.0.0.1:5434') || databaseUrl.includes('localhost:5434')
}

function failOrWarn(message, strictMode) {
  if (strictMode) {
    console.error(message)
    process.exit(1)
  }
  console.warn(`${message} Continuing startup without blocking Vite.`)
}

function main() {
  loadLocalEnvFiles()

  const disabled = isTruthy(process.env.LOCAL_POSTGRES_AUTOSTART_DISABLED)
  if (disabled) {
    console.log('[db] LOCAL_POSTGRES_AUTOSTART_DISABLED=true, skipping local PostgreSQL startup')
    return
  }

  const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()
  const forceStart = isTruthy(process.env.LOCAL_POSTGRES_FORCE_START)
  const strictMode = isTruthy(process.env.LOCAL_POSTGRES_STRICT)

  if (!shouldManageLocalPostgres(databaseUrl, forceStart)) {
    console.log('[db] DATABASE_URL points to non-local database, skipping local PostgreSQL startup')
    return
  }

  const binDir = process.env.LOCAL_POSTGRES_BIN_DIR || 'C:\\Program Files\\PostgreSQL\\16\\bin'
  const pgCtl = path.join(binDir, 'pg_ctl.exe')
  const pgIsReady = path.join(binDir, 'pg_isready.exe')
  const pgPort = String(process.env.LOCAL_POSTGRES_PORT || '5434')
  const pgUser = process.env.LOCAL_POSTGRES_USER || 'postgres'
  const dataDir = process.env.LOCAL_POSTGRES_DATA_DIR || path.resolve(process.cwd(), '.postgres-local', 'data')
  const logFile = process.env.LOCAL_POSTGRES_LOG_FILE || path.resolve(process.cwd(), '.postgres-local', 'postgres.log')

  if (!fs.existsSync(pgCtl) || !fs.existsSync(pgIsReady)) {
    console.log('[db] PostgreSQL binaries not found, skipping local PostgreSQL startup')
    return
  }

  if (!fs.existsSync(dataDir)) {
    console.log(`[db] Local PostgreSQL data directory not found at ${dataDir}`)
    console.log('[db] Start skipped. Create the local cluster first if you want auto-start.')
    return
  }

  const logDir = path.dirname(logFile)
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const readyBefore = runCommand(pgIsReady, ['-h', '127.0.0.1', '-p', pgPort, '-U', pgUser])
  const readyBeforeText = `${readyBefore.stdout || ''}${readyBefore.stderr || ''}`
  if (readyBeforeText.toLowerCase().includes('accepting connections')) {
    console.log(`[db] Local PostgreSQL already running on 127.0.0.1:${pgPort}`)
    return
  }

  const startResult = runCommand(pgCtl, ['-D', dataDir, '-l', logFile, '-o', `-p ${pgPort}`, 'start'])
  printOutput('[db]', startResult)

  const readyAfter = runCommand(pgIsReady, ['-h', '127.0.0.1', '-p', pgPort, '-U', pgUser])
  const readyAfterText = `${readyAfter.stdout || ''}${readyAfter.stderr || ''}`

  if (!readyAfterText.toLowerCase().includes('accepting connections')) {
    printOutput('[db]', readyAfter)
    failOrWarn(`[db] Failed to verify PostgreSQL on 127.0.0.1:${pgPort}`, strictMode)
    return
  }

  console.log(`[db] Local PostgreSQL is ready on 127.0.0.1:${pgPort}`)
}

main()
