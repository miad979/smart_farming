import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const WATCH_DIAGNOSTICS_ENABLED = String(process.env.VITE_WATCH_DIAGNOSTICS || 'true').toLowerCase() !== 'false'

function normalizeWatchPath(filePath: string) {
  return String(filePath || '').replace(/\\/g, '/').toLowerCase()
}

function isRuntimeArtifactPath(filePath: string) {
  const file = normalizeWatchPath(filePath)
  return file.endsWith('/.local-db.json')
    || file.includes('/.local-uploads/')
    || file.includes('/.postgres-local/')
    || file.includes('/dist/')
    || /\/\.tmp-.*\.json$/.test(file)
    || file.endsWith('.log')
}

function isViteConfigPath(filePath: string) {
  return /\/vite\.config\.(ts|js|mts|mjs|cts|cjs)$/.test(normalizeWatchPath(filePath))
}

export default defineConfig({
  server: {
    watch: {
      ignored: [
        '**/.local-db.json',
        '**/.local-uploads/**',
        '**/.postgres-local/**',
        '**/dist/**',
        '**/.tmp-*.json',
        '**/*.log',
      ],
    },
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      name: 'smart-farming-local-api',
      configureServer(server) {
        const { createLocalApiMiddleware } = require('./server/local-api.cjs')
        server.middlewares.use('/api', createLocalApiMiddleware())
      },
    },
    {
      name: 'smart-farming-ignore-runtime-hmr',
      handleHotUpdate(ctx) {
        if (isRuntimeArtifactPath(String(ctx.file || ''))) {
          // Ignore backend runtime artifact writes so frontend state is not interrupted.
          return []
        }

        return undefined
      },
    },
    {
      name: 'smart-farming-watch-diagnostics',
      configureServer(server) {
        if (!WATCH_DIAGNOSTICS_ENABLED) return

        const recentEvents = new Map<string, number>()
        const dedupeMs = 500

        const logEvent = (eventName: string, filePath: string) => {
          const normalized = normalizeWatchPath(filePath)
          if (!normalized || isRuntimeArtifactPath(normalized)) return

          const key = `${eventName}:${normalized}`
          const now = Date.now()
          const last = recentEvents.get(key) || 0
          if (now - last < dedupeMs) return
          recentEvents.set(key, now)

          const hhmmss = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })

          const restartHint = isViteConfigPath(normalized)
            ? ' -> triggers full dev-server restart'
            : ''

          console.log(`[watch:${hhmmss}] ${eventName.toUpperCase()} ${normalized}${restartHint}`)
        }

        server.watcher.on('change', (filePath) => logEvent('change', filePath))
        server.watcher.on('add', (filePath) => logEvent('add', filePath))
        server.watcher.on('unlink', (filePath) => logEvent('unlink', filePath))
      },
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
