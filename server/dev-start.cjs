const path = require('path')
const { spawn, spawnSync } = require('child_process')

function runPreflight() {
  const preflightScript = path.resolve(__dirname, 'ensure-local-postgres.cjs')
  const result = spawnSync(process.execPath, [preflightScript], {
    stdio: 'inherit',
  })

  if (result.error) {
    console.error('[dev] Failed to run local PostgreSQL preflight:', result.error.message || result.error)
    return 1
  }

  return typeof result.status === 'number' ? result.status : 0
}

function resolveViteBin() {
  return path.resolve(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js')
}

function startVite(args) {
  const viteBin = resolveViteBin()
  return spawn(process.execPath, [viteBin, ...args], {
    stdio: 'inherit',
  })
}

function main() {
  const preflightExitCode = runPreflight()
  if (preflightExitCode !== 0) {
    process.exit(preflightExitCode)
  }

  // `--https`: serve over HTTPS (self-signed) on the local network. Handled here because Vite has no such flag.
  const args = process.argv.slice(2)
  if (args.includes('--https')) {
    process.env.DEV_HTTPS = '1'
    if (!args.includes('--host')) args.push('--host')
  }
  const vite = startVite(args.filter((a) => a !== '--https'))
  let interrupted = false

  const handleSignal = (signal) => {
    interrupted = true
    if (vite && !vite.killed) {
      try {
        vite.kill(signal)
      } catch {
        // No-op: process may already be gone.
      }
    }
  }

  process.on('SIGINT', () => handleSignal('SIGINT'))
  process.on('SIGTERM', () => handleSignal('SIGTERM'))

  vite.on('error', (error) => {
    console.error('[dev] Failed to start Vite:', error.message || error)
    process.exit(1)
  })

  vite.on('exit', (code, signal) => {
    if (interrupted || signal === 'SIGINT' || signal === 'SIGTERM') {
      process.exit(0)
      return
    }

    process.exit(typeof code === 'number' ? code : 0)
  })
}

main()