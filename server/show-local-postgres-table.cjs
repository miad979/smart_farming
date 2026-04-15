const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const TABLE_COLUMN_PRESETS = Object.freeze({
  users: ['id', 'name', 'role', 'email', 'location', 'verificationStatus', 'lastSeen'],
  irrigation: ['id', 'userId', 'status', 'autoMode', 'moisture', 'updatedAt'],
  consultations: ['id', 'farmerId', 'doctorId', 'status', 'createdAt', 'updatedAt'],
  prices: ['id', 'crop', 'location', 'currentPrice', 'trend', 'updatedAt'],
  devices: ['id', 'userId', 'name', 'type', 'status', 'mode', 'lastSync'],
  diseases: ['id', 'userId', 'crop', 'disease', 'severity', 'createdAt'],
  alerts: ['id', 'userId', 'crop', 'targetPrice', 'condition', 'active', 'createdAt'],
  usersByEmail: ['key', 'value'],
  devicesByUser: ['key', 'value'],
  consultationsByFarmer: ['key', 'value'],
  diseasesByUser: ['key', 'value'],
  alertsByUser: ['key', 'value'],
  uploadsByHash: ['key', 'value'],
  uploadedDocumentsByHash: ['key', 'value'],
  pendingDoctors: ['index', 'value'],
  login_security: ['key', 'value'],
})

const PRIORITY_COLUMNS = Object.freeze([
  '#',
  'id',
  'key',
  '_key',
  'name',
  'role',
  'email',
  'status',
  'userId',
  'createdAt',
  'updatedAt',
  'lastSeen',
])

function hasFlag(argv, flagName) {
  const args = Array.isArray(argv) ? argv : []
  return args.includes(flagName)
}

function getArgValue(argv, keyName) {
  const args = Array.isArray(argv) ? argv : []
  const key = String(keyName || '').trim()
  if (!key) return ''

  const keyIndex = args.findIndex((arg) => arg === key)
  if (keyIndex >= 0 && args[keyIndex + 1]) {
    return String(args[keyIndex + 1]).trim()
  }

  const inlineArg = args.find((arg) => typeof arg === 'string' && arg.startsWith(`${key}=`))
  if (!inlineArg) return ''
  return inlineArg.slice(`${key}=`.length).trim()
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

  for (const line of raw.split(/\r?\n/)) {
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

function getDatabaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()
}

function shouldUseSsl(databaseUrl) {
  const hostname = (() => {
    try {
      return new URL(databaseUrl).hostname
    } catch {
      return ''
    }
  })()

  if (/^(localhost|127\.0\.0\.1|::1)$/i.test(hostname)) {
    return false
  }

  const sslMode = String(process.env.SQL_SSL || '').trim().toLowerCase()
  if (sslMode === 'true' || sslMode === '1' || sslMode === 'require') return true
  if (sslMode === 'false' || sslMode === '0' || sslMode === 'disable') return false

  return /supabase\.co|pooler\.supabase\.com/i.test(hostname)
}

function parseLimitArg(argv) {
  const raw = getArgValue(argv, '--limit')
  if (!raw) return 20

  const value = Number(raw)

  if (!Number.isFinite(value)) return 20
  return Math.max(1, Math.min(200, Math.floor(value)))
}

function parseSnapshotKeyArg(argv) {
  return getArgValue(argv, '--key') || 'local-db'
}

function parseTableFilterArg(argv) {
  return getArgValue(argv, '--table') || ''
}

function parseColumnsArg(argv) {
  const raw = getArgValue(argv, '--columns')
  if (!raw) return []

  return raw
    .split(',')
    .map((col) => String(col || '').trim())
    .filter(Boolean)
}

function parseMaxColWidthArg(argv) {
  const value = Number(getArgValue(argv, '--max-col-width'))
  if (!Number.isFinite(value)) return 28
  return Math.max(12, Math.min(80, Math.floor(value)))
}

function parseCsvArg(argv) {
  return getArgValue(argv, '--csv')
}

function parsePayload(rawPayload) {
  if (!rawPayload) return {}
  if (typeof rawPayload === 'object') return rawPayload
  if (typeof rawPayload !== 'string') return {}

  try {
    return JSON.parse(rawPayload)
  } catch {
    return {}
  }
}

function getSectionRows(sectionValue) {
  if (Array.isArray(sectionValue)) {
    return sectionValue.map((value, index) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const row = { ...value }
        if (row.id === undefined) row.id = index
        return row
      }

      return { index, value }
    })
  }

  if (sectionValue && typeof sectionValue === 'object') {
    return Object.entries(sectionValue).map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const row = { ...value }

        if (row.id === undefined) {
          row.id = key
        } else if (String(row.id) !== key) {
          row._key = key
        }

        return row
      }

      return { key, value }
    })
  }

  if (sectionValue === undefined || sectionValue === null) return []
  return [{ value: sectionValue }]
}

function getSectionCount(sectionValue) {
  if (Array.isArray(sectionValue)) return sectionValue.length
  if (sectionValue && typeof sectionValue === 'object') return Object.keys(sectionValue).length
  if (sectionValue === undefined || sectionValue === null) return 0
  return 1
}

function compactCell(value, maxLength = 180) {
  if (value === undefined || value === null) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength - 3)}...`
  }

  try {
    const asText = JSON.stringify(value)
    if (!asText) return ''
    if (asText.length <= maxLength) return asText
    return `${asText.slice(0, maxLength - 3)}...`
  } catch {
    return String(value)
  }
}

function sortColumnsWithPriority(columns) {
  const all = Array.isArray(columns) ? [...columns] : []
  const priority = PRIORITY_COLUMNS.filter((col) => all.includes(col))
  const rest = all.filter((col) => !priority.includes(col)).sort((a, b) => a.localeCompare(b))
  return [...priority, ...rest]
}

function toSingleLineText(value) {
  const compact = compactCell(value, 1000)
  if (compact === undefined || compact === null) return ''
  return String(compact).replace(/[\r\n\t]+/g, ' ').trim()
}

function padRight(text, width) {
  const raw = String(text || '')
  if (raw.length >= width) return raw
  return `${raw}${' '.repeat(width - raw.length)}`
}

function truncateText(text, width) {
  const raw = String(text || '')
  if (raw.length <= width) return raw
  if (width <= 3) return raw.slice(0, width)
  return `${raw.slice(0, width - 3)}...`
}

function computeColumnWidths(rows, columns, maxColWidth) {
  const widths = {}

  for (const column of columns) {
    let longest = String(column).length

    for (let i = 0; i < rows.length; i += 1) {
      const cellText = toSingleLineText(rows[i]?.[column])
      if (cellText.length > longest) {
        longest = cellText.length
      }
    }

    widths[column] = Math.max(3, Math.min(maxColWidth, longest))
  }

  return widths
}

function totalTableWidth(columns, widths) {
  if (!columns.length) return 0
  const contentWidth = columns.reduce((sum, col) => sum + (widths[col] || 0), 0)
  return contentWidth + (3 * columns.length) + 1
}

function shrinkColumnsToTerminal(columns, widths, terminalWidth, minColumns = 3) {
  const activeColumns = [...columns]
  const safeTerminalWidth = Math.max(60, Number(terminalWidth || 120))

  while (activeColumns.length > minColumns && totalTableWidth(activeColumns, widths) > safeTerminalWidth) {
    const removable = activeColumns.slice(1).reverse().find((col) => !PRIORITY_COLUMNS.includes(col))
    const fallback = activeColumns[activeColumns.length - 1]
    const nextToRemove = removable || fallback

    if (!nextToRemove || nextToRemove === '#') break
    const index = activeColumns.indexOf(nextToRemove)
    if (index >= 0) activeColumns.splice(index, 1)
  }

  while (totalTableWidth(activeColumns, widths) > safeTerminalWidth) {
    const growable = activeColumns
      .filter((col) => (widths[col] || 0) > 10)
      .sort((a, b) => (widths[b] || 0) - (widths[a] || 0))[0]

    if (!growable) break
    widths[growable] -= 1
  }

  return activeColumns
}

function chooseColumnsForTable(rows, tableName, explicitColumns) {
  if (!rows.length) return []

  const allColumns = new Set()
  for (const row of rows) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      Object.keys(row).forEach((key) => allColumns.add(key))
    }
  }

  if (explicitColumns.length) {
    return explicitColumns.filter((col) => allColumns.has(col))
  }

  const preset = TABLE_COLUMN_PRESETS[tableName] || []
  const presetColumns = preset.filter((col) => allColumns.has(col))
  if (presetColumns.length) return presetColumns

  const preferred = PRIORITY_COLUMNS.filter((col) => allColumns.has(col) && col !== '#')
  const others = [...allColumns].filter((col) => !preferred.includes(col))
  return sortColumnsWithPriority([...preferred, ...others])
}

function chooseExportColumns(rowsWithIndex, explicitColumns) {
  if (!rowsWithIndex.length) return []

  const available = new Set()
  for (const row of rowsWithIndex) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    Object.keys(row).forEach((key) => available.add(key))
  }

  const wantsAll = explicitColumns.includes('*') || explicitColumns.includes('all')
  if (explicitColumns.length && !wantsAll) {
    return explicitColumns.filter((col) => available.has(col))
  }

  return sortColumnsWithPriority([...available])
}

function safeFileName(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'table'
  return raw.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'table'
}

function resolveCsvOutputPath(csvArg, tableName, isMultiTableExport) {
  const absoluteBase = path.resolve(process.cwd(), String(csvArg || '').trim())
  const ext = path.extname(absoluteBase).toLowerCase()

  if (ext === '.csv') {
    if (!isMultiTableExport) return absoluteBase
    const dir = path.dirname(absoluteBase)
    const baseName = path.basename(absoluteBase, '.csv')
    return path.join(dir, `${baseName}.${safeFileName(tableName)}.csv`)
  }

  if (isMultiTableExport) {
    return path.join(absoluteBase, `${safeFileName(tableName)}.csv`)
  }

  return `${absoluteBase}.csv`
}

function escapeCsvCell(value) {
  const text = toSingleLineText(value)
  if (!text) return ''
  const escaped = text.replace(/"/g, '""')
  if (/[",\n]/.test(escaped)) {
    return `"${escaped}"`
  }
  return escaped
}

function writeCsvFile(filePath, rows, columns) {
  const dirName = path.dirname(filePath)
  fs.mkdirSync(dirName, { recursive: true })

  const header = columns.map(escapeCsvCell).join(',')
  const lines = [header]

  for (const row of rows) {
    const values = columns.map((column) => escapeCsvCell(row?.[column]))
    lines.push(values.join(','))
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

function renderStructuredTable(rows, tableName, options = {}) {
  const explicitColumns = Array.isArray(options.columns) ? options.columns : []
  const maxColWidth = Number(options.maxColWidth || 28)
  const terminalWidth = Number(options.terminalWidth || 120)

  const rowsWithIndex = rows.map((row, idx) => ({
    '#': idx + 1,
    ...(row && typeof row === 'object' && !Array.isArray(row) ? row : { value: row }),
  }))

  let columns = chooseColumnsForTable(rowsWithIndex, tableName, explicitColumns)
  if (!columns.includes('#')) {
    columns = ['#', ...columns]
  }

  if (!columns.length) {
    console.log('(no printable columns)')
    return
  }

  const widths = computeColumnWidths(rowsWithIndex, columns, maxColWidth)
  const visibleColumns = shrinkColumnsToTerminal(columns, widths, terminalWidth, 3)

  const separator = `+${visibleColumns.map((col) => '-'.repeat((widths[col] || 0) + 2)).join('+')}+`
  const header = `|${visibleColumns.map((col) => ` ${padRight(col, widths[col])} `).join('|')}|`

  console.log(separator)
  console.log(header)
  console.log(separator)

  for (const row of rowsWithIndex) {
    const line = `|${visibleColumns.map((col) => {
      const text = truncateText(toSingleLineText(row[col]), widths[col])
      return ` ${padRight(text, widths[col])} `
    }).join('|')}|`
    console.log(line)
  }

  console.log(separator)
}

function printUsage() {
  console.log('Usage: npm run db:table -- [--all] [--limit 20] [--table users] [--columns id,name,email] [--csv export.csv] [--key local-db]')
  console.log('')
  console.log('Options:')
  console.log('  --all          Show all rows for selected table(s), no preview limit')
  console.log('  --limit <n>    Rows per table when --all is not used (default: 20, max: 200)')
  console.log('  --table <name> Show only one logical table from the snapshot payload')
  console.log('  --columns ...  Comma-separated column names, or use all/* for full columns')
  console.log('  --max-col-width <n>  Max width per column before truncation (default: 28)')
  console.log('  --csv <path>   Export current result to CSV file or folder')
  console.log('  --key <value>  Snapshot key in app_state_snapshots (default: local-db)')
}

async function run() {
  loadEnvFiles()

  const args = process.argv.slice(2)
  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printUsage()
    return
  }

  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL/POSTGRES_URL is missing. Set your local Postgres URL in .env or .env.local.')
  }

  const limit = parseLimitArg(args)
  const showAllRows = hasFlag(args, '--all')
  const tableFilter = parseTableFilterArg(args)
  const snapshotKey = parseSnapshotKeyArg(args)
  const explicitColumns = parseColumnsArg(args)
  const maxColWidth = parseMaxColWidthArg(args)
  const csvArg = parseCsvArg(args)
  const terminalWidth = Number(process.stdout.columns || 120)

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  })

  try {
    const version = await pool.query('SELECT version() AS pg_version')
    console.log(`Connected DB: ${version?.rows?.[0]?.pg_version || 'unknown'}`)

    const latest = await pool.query(
      `
      SELECT
        snapshot_key,
        updated_at,
        payload
      FROM app_state_snapshots
      WHERE snapshot_key = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [snapshotKey],
    )

    const latestRow = latest?.rows?.[0]
    if (!latestRow) {
      console.log(`No row found in app_state_snapshots for snapshot_key="${snapshotKey}".`)
      return
    }

    const payload = parsePayload(latestRow.payload)
    const sectionNames = Object.keys(payload).sort((a, b) => a.localeCompare(b))

    console.log('')
    console.table([
      {
        snapshot_key: latestRow.snapshot_key,
        updated_utc: latestRow.updated_at instanceof Date
          ? latestRow.updated_at.toISOString()
          : String(latestRow.updated_at || ''),
        sections: sectionNames.length,
      },
    ])

    const summaryRows = sectionNames.map((name) => ({
      table: name,
      rows: getSectionCount(payload[name]),
    }))

    console.log('Table summary:')
    console.table(summaryRows)

    const selectedTables = tableFilter
      ? sectionNames.filter((name) => name === tableFilter)
      : sectionNames

    const isMultiTableExport = Boolean(csvArg) && selectedTables.length > 1

    if (tableFilter && selectedTables.length === 0) {
      console.log(`\nTable "${tableFilter}" was not found in payload.`)
      console.log(`Available tables: ${sectionNames.join(', ')}`)
      return
    }

    for (const tableName of selectedTables) {
      const allRows = getSectionRows(payload[tableName])
      if (!allRows.length) continue

      const shownRows = showAllRows ? allRows : allRows.slice(0, limit)
      const omittedCount = allRows.length - shownRows.length

      console.log(`\n${tableName} (${allRows.length} rows${omittedCount > 0 ? `, showing ${shownRows.length}` : ''}):`)
      renderStructuredTable(shownRows, tableName, {
        columns: explicitColumns,
        maxColWidth,
        terminalWidth,
      })

      if (csvArg) {
        const rowsWithIndexForCsv = allRows.map((row, idx) => ({
          '#': idx + 1,
          ...(row && typeof row === 'object' && !Array.isArray(row) ? row : { value: row }),
        }))

        const csvColumns = chooseExportColumns(rowsWithIndexForCsv, explicitColumns)
        if (!csvColumns.length) {
          console.log('Skipping CSV export for this table because no columns were selected.')
        } else {
          const csvPath = resolveCsvOutputPath(csvArg, tableName, isMultiTableExport)
          writeCsvFile(csvPath, rowsWithIndexForCsv, csvColumns)
          console.log(`CSV exported: ${csvPath} (${rowsWithIndexForCsv.length} rows)`)
        }
      }

      if (omittedCount > 0) {
        console.log(`... ${omittedCount} more rows not shown. Re-run with --all to print everything.`)
      }
    }

    if (csvArg) {
      console.log('\nCSV export completed.')
    }

    console.log(`\nDone. Use --table <name> to inspect one table or --all for full rows.`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
