const http = require('http')
const fs = require('fs')
const path = require('path')
const { createLocalApiMiddleware } = require('./local-api.cjs')

const PORT = Number(process.env.PORT || 4173)
const DIST_DIR = path.resolve(process.cwd(), 'dist')

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

  const url = new URL(req.url, 'http://localhost')
  let filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname))

  // Prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 400
    res.end('Bad request')
    return
  }

  // SPA fallback
  if (url.pathname === '/' || !path.extname(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  res.statusCode = 200
  res.setHeader('Content-Type', getContentType(filePath))
  fs.createReadStream(filePath).pipe(res)
}

const apiMiddleware = createLocalApiMiddleware()

const server = http.createServer((req, res) => {
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

