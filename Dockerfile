# Production image for any container host (VPS, Railway, Fly.io, Render "Docker" runtime, Kubernetes).
#   docker build -t smart-farming .
#   docker run -p 8080:8080 --env-file .env.production smart-farming
# Required env: see .env.production.example (AUTH_TOKEN_SECRET, CORS_ALLOWED_ORIGINS, DATABASE_URL,
# BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD).

# ---- build: install all deps and build the frontend ---------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: msedge-tts ships a pnpm-only preinstall guard; no dependency needs its install script.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- runtime: production deps + server + built assets only ------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# Local cache directories (the durable copy lives in Postgres via DATABASE_URL).
RUN mkdir -p .local-uploads && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
# Run node directly (not via npm) so SIGTERM reaches the server for a graceful shutdown.
CMD ["node", "server/start-production.cjs"]
