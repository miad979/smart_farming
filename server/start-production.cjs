// Production entry point: validate the environment, then run the server in this same process so the
// host's SIGTERM reaches it directly (graceful shutdown flushes pending database writes).
const path = require('path')
const { spawnSync } = require('child_process')

const check = spawnSync(process.execPath, [path.resolve(__dirname, 'check-production-env.cjs')], { stdio: 'inherit' })
if (check.status !== 0) {
  process.exit(check.status || 1)
}

require('./preview-server.cjs')
