# Runtime Deployment (Render)

This guide deploys the full app as one Node runtime service so frontend, backend API, auth cookies, and SSE realtime all run in production.

## Why Runtime Hosting

Static hosting cannot run:
- `/api/*` backend endpoints
- auth token signing and cookie issuance
- realtime stream endpoint (`/api/realtime/stream`)

This project should run with `server/preview-server.cjs` behind a Node host.

## Files Added for Automation

- `render.yaml` - Render Blueprint service definition
- `.env.production.example` - production variable template
- `.github/workflows/deploy-render.yml` - optional deploy hook trigger from `main`
- `server/check-production-env.cjs` - strict runtime env validation
- `server/generate-auth-secret.cjs` - secure token secret generator

## One-Time Setup

1. Push repository to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Render reads `render.yaml` and creates the web service.
4. Set/update environment variables in Render dashboard.

## Required Production Secrets

These must be set before release:

- `AUTH_TOKEN_SECRET`
- `CORS_ALLOWED_ORIGINS`

Recommended hardening values:

- `FORCE_SECURE_COOKIES=true`
- `AUTH_COOKIE_SAME_SITE=Lax`
- `CSRF_COOKIE_SAME_SITE=Lax`

Recommended:

- `DATABASE_URL` (if using PostgreSQL snapshot storage)
- `PLANT_ID_API_KEY`
- one or more AI provider keys:
  - `OPENAI_API_KEY`
  - `GROQ_API_KEY`
  - `OPENROUTER_API_KEY`

## Generate a Strong Auth Secret

```bash
npm run secret:auth
```

Use the generated value for `AUTH_TOKEN_SECRET`.

## Local Production Check (Before Deploy)

```bash
NODE_ENV=production node server/check-production-env.cjs
```

On PowerShell:

```powershell
$env:NODE_ENV='production'; node server/check-production-env.cjs
```

## Final Hardening Pass

The runtime now supports stricter hardening controls:

- CSP on runtime responses (default enabled)
- secure cookie enforcement in production
- configurable route and auth rate limits
- realtime connection throttling per IP

Optional CSP and throttling overrides are listed in `.env.production.example`.

## Deploy and Verify

1. Trigger a Render deploy.
2. Verify health endpoint:
   - `https://<your-service>.onrender.com/api/health`
3. Open app and confirm these flows:
   - login/logout
   - disease detection
   - chat assistant
   - realtime updates

### Endpoint Verification Commands

Replace `<service-url>` with your Render URL.

```bash
curl -i https://<service-url>/api/health
curl -i https://<service-url>/
curl -i https://<service-url>/api/realtime/stream
```

Expected:
- `/api/health` returns `200` and JSON status
- `/` returns `200` and includes `Content-Security-Policy` header
- `/api/realtime/stream` returns `200` with `text/event-stream`

## Optional GitHub Auto-Deploy

Set repository variable:

- `RENDER_DEPLOY_HOOK_URL` (Render deploy hook URL)

Then pushes to `main` trigger `.github/workflows/deploy-render.yml` and call Render automatically.
