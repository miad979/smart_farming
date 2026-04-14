const crypto = require('crypto')

const bytes = Number(process.argv[2] || 48)
if (!Number.isFinite(bytes) || bytes < 32) {
  console.error('Usage: node server/generate-auth-secret.cjs [bytes>=32]')
  process.exit(1)
}

console.log(crypto.randomBytes(bytes).toString('hex'))
