const { spawn, spawnSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const skipBuild = args.includes('--skip-build')
const port = parsePort(readFlagValue('--port', process.env.DEMO_PORT || '4180'))

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const runtimeUrl = `http://localhost:${port}`

let runtimeProc = null
let tunnelProc = null
let shuttingDown = false
let publicUrl = ''

main()

function main() {
  const cloudflaredPath = resolveCloudflaredPath()
  if (!cloudflaredPath) {
    fail('cloudflared is not installed or not discoverable. Install it first, then retry.')
  }

  log(`Using cloudflared at: ${cloudflaredPath}`)

  if (!skipBuild) {
    log('Building frontend assets...')
    runOrFail(npmCommand, ['run', 'build'])
  } else {
    log('Skipping build (--skip-build).')
  }

  const authTokenSecret = String(process.env.AUTH_TOKEN_SECRET || '').trim() || crypto.randomBytes(48).toString('hex')

  const runtimeEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    AUTH_TOKEN_SECRET: authTokenSecret,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || runtimeUrl,
  }

  log(`Starting runtime at ${runtimeUrl}...`)
  runtimeProc = spawn(process.execPath, [path.resolve(process.cwd(), 'server/preview-server.cjs')], {
    cwd: process.cwd(),
    env: runtimeEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let runtimeReady = false
  const runtimeReadyTimeout = setTimeout(() => {
    if (!runtimeReady) {
      log('Runtime did not become ready in time.')
      shutdown(1)
    }
  }, 40000)

  runtimeProc.stdout.on('data', (chunk) => {
    const text = String(chunk)
    relay('runtime', text)

    if (!runtimeReady && text.includes('Preview server running at')) {
      runtimeReady = true
      clearTimeout(runtimeReadyTimeout)
      startTunnel(cloudflaredPath)
    }
  })

  runtimeProc.stderr.on('data', (chunk) => {
    relay('runtime:err', String(chunk))
  })

  runtimeProc.on('exit', (code) => {
    if (shuttingDown) return
    log(`Runtime exited with code ${code ?? 0}.`)
    shutdown(code ?? 1)
  })

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))
}

function startTunnel(cloudflaredPath) {
  log(`Starting Cloudflare quick tunnel for ${runtimeUrl}...`)

  tunnelProc = spawn(cloudflaredPath, ['tunnel', '--url', runtimeUrl, '--no-autoupdate'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const onTunnelData = (chunk, source) => {
    const text = String(chunk)
    relay(source, text)

    if (!publicUrl) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
      if (match && match[0]) {
        publicUrl = match[0]
        log('Public URL is ready:')
        log(publicUrl)
        log('Press Ctrl+C once to stop both runtime and tunnel.')
      }
    }
  }

  tunnelProc.stdout.on('data', (chunk) => onTunnelData(chunk, 'tunnel'))
  tunnelProc.stderr.on('data', (chunk) => onTunnelData(chunk, 'tunnel:err'))

  tunnelProc.on('exit', (code) => {
    if (shuttingDown) return
    log(`Tunnel exited with code ${code ?? 0}.`)
    shutdown(code ?? 1)
  })
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true

  log('Stopping tunnel and runtime...')
  stopProcess(tunnelProc)
  stopProcess(runtimeProc)

  setTimeout(() => process.exit(code), 300)
}

function stopProcess(proc) {
  if (!proc || proc.exitCode !== null) return

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
  } else {
    proc.kill('SIGTERM')
  }
}

function runOrFail(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })

  if (result.status !== 0) {
    fail(`Command failed: ${command} ${commandArgs.join(' ')}`)
  }
}

function resolveCloudflaredPath() {
  const envPath = String(process.env.CLOUDFLARED_PATH || '').trim()
  if (envPath && fs.existsSync(envPath)) return envPath

  if (process.platform === 'win32') {
    const winCandidates = [
      'C:/Program Files/cloudflared/cloudflared.exe',
      'C:/Program Files (x86)/cloudflared/cloudflared.exe',
      'C:/Program Files/Cloudflare/cloudflared/cloudflared.exe',
      'C:/Program Files/Cloudflare/Cloudflared/cloudflared.exe',
    ]

    for (const candidate of winCandidates) {
      const normalized = path.normalize(candidate)
      if (fs.existsSync(normalized)) return normalized
    }

    const whereResult = spawnSync('where', ['cloudflared'], { encoding: 'utf8', shell: true })
    if (whereResult.status === 0 && whereResult.stdout) {
      const first = whereResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)
      if (first) return first
    }
  }

  const versionCheck = spawnSync('cloudflared', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' })
  if (versionCheck.status === 0) return 'cloudflared'

  return null
}

function readFlagValue(flag, fallbackValue) {
  const idx = args.indexOf(flag)
  if (idx === -1) return fallbackValue
  const next = args[idx + 1]
  if (!next || next.startsWith('--')) return fallbackValue
  return next
}

function parsePort(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    fail(`Invalid port: ${value}`)
  }
  return Math.floor(parsed)
}

function relay(prefix, text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line)

  for (const line of lines) {
    console.log(`[${prefix}] ${line}`)
  }
}

function log(message) {
  console.log(`[demo] ${message}`)
}

function fail(message) {
  console.error(`[demo] ${message}`)
  process.exit(1)
}
