const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { createLocalApiMiddleware, flushPendingWrites } = require('./local-api.cjs')

const PORT = Number(process.env.PORT || 4173)
const DIST_DIR = path.resolve(process.cwd(), 'dist')
const CSP_REPORT_ONLY = String(process.env.CSP_REPORT_ONLY || 'false').toLowerCase() === 'true'

function buildDefaultCsp() {
  const extraConnectSrc = String(process.env.CSP_EXTRA_CONNECT_SRC || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const connectSrc = ["'self'", 'https:', 'wss:', ...extraConnectSrc].join(' ')

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    // Google Fonts (Inter, Noto Sans Bengali) are imported in src/styles/fonts.css.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

const CONTENT_SECURITY_POLICY = (process.env.CONTENT_SECURITY_POLICY || buildDefaultCsp()).trim()

function isHttpsRequest(req) {
  const proto = req.headers['x-forwarded-proto']
  return Boolean(req.socket?.encrypted || (typeof proto === 'string' && proto.toLowerCase().includes('https')))
}

function isLocalOrPrivateHost(hostHeader) {
  const host = String(hostHeader || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1'
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
}

function setSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  // The app itself needs the microphone (voice questions), geolocation (local weather) and camera;
  // other origins (iframes) stay blocked.
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  res.setHeader(CSP_REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', CONTENT_SECURITY_POLICY)

  // HSTS only for real domains: on localhost / LAN IPs it would pin the browser to https for a year.
  if (isHttpsRequest(req) && !isLocalOrPrivateHost(req.headers.host)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

function serveStatic(req, res) {
  if (!fs.existsSync(DIST_DIR)) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: "Missing dist/. Run 'npm run build' first." }))
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, HEAD')
    res.end()
    return
  }

  let pathname
  try {
    // A malformed escape (e.g. "%E0%A4%A") makes decodeURIComponent throw; that must not crash the server.
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.statusCode = 400
    res.end('Bad request')
    return
  }
  let filePath = path.join(DIST_DIR, pathname)

  // Prevent path traversal
  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
    res.statusCode = 400
    res.end('Bad request')
    return
  }

  const hasExtension = Boolean(path.extname(filePath))
  const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  if (!exists && hasExtension) {
    // A missing asset (e.g. an old hashed bundle after a deploy) must 404, not return index.html as JS.
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end('Not found')
    return
  }
  if (!exists) {
    filePath = path.join(DIST_DIR, 'index.html') // SPA route
  }

  const isHtml = filePath.endsWith('.html')
  const isHashedAsset = filePath.startsWith(path.join(DIST_DIR, 'assets') + path.sep)
  // index.html must be revalidated so a deploy is picked up; hashed assets never change.
  res.setHeader('Cache-Control', isHtml ? 'no-cache' : isHashedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600')

  const contentType = getContentType(filePath)
  res.statusCode = 200
  res.setHeader('Content-Type', contentType)
  res.setHeader('Vary', 'Accept-Encoding')

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const compressible = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/.test(contentType)
  const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))
  const stream = fs.createReadStream(filePath)
  stream.on('error', () => { if (!res.headersSent) res.statusCode = 500; res.end() })
  if (compressible && acceptsGzip) {
    res.setHeader('Content-Encoding', 'gzip')
    stream.pipe(zlib.createGzip({ level: 6 })).pipe(res)
  } else {
    stream.pipe(res)
  }
}

const apiMiddleware = createLocalApiMiddleware()

const server = http.createServer((req, res) => {
  setSecurityHeaders(req, res)

  if ((req.url || '').startsWith('/api')) {
    // Strip /api prefix for the middleware (so routes stay /health, /auth/signin, etc.)
    req.url = req.url.slice('/api'.length) || '/'
    apiMiddleware(req, res, () => {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Not found' }))
    })
    return
  }

  serveStatic(req, res)
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Preview server running at http://localhost:${PORT}`)
})

// Graceful shutdown: hosts send SIGTERM on every deploy/restart. Stop accepting connections, persist any
// pending database write, then exit. Realtime (SSE) streams never end on their own, so force after 8s.
let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  // eslint-disable-next-line no-console
  console.log(`[server] ${signal} received, shutting down...`)
  server.close()
  if (typeof server.closeAllConnections === 'function') {
    setTimeout(() => server.closeAllConnections(), 2000).unref()
  }
  const force = setTimeout(() => process.exit(0), 8000)
  force.unref()
  flushPendingWrites()
    .catch((error) => console.error('[server] Failed to flush pending writes:', error?.message || error))
    .finally(() => {
      clearTimeout(force)
      process.exit(0)
    })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Log instead of crashing on unexpected async errors; a crash would drop every user's realtime connection.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason)
})

