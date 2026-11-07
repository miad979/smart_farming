# System Status

## Current Mode

Local-only runtime is active.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node local API (`server/local-api.cjs`)
- Persistence: `.local-db.json`
- Uploads: `.local-uploads/`
- Realtime: SSE (`/api/realtime/stream`)

## Health Checks

- `npm install` completed
- `node -c server/local-api.cjs` passed
- App can run with `npm run dev`
- Last full audit: 2026-11-07 (see `docs/TESTING.md` section 18)
- Verified: build, strict type check, `test:consultations` (13/13), `test:actions`, `test:security`,
  role and admin smoke tests, unit tests (9/9), Playwright UI + a11y (9/9)

## Realtime Channels

- `consultations:{userId}` (farmer), `consultations:all` (doctors/admins, filtered per case)
- `alerts:{userId}`, `prices:*`, `irrigation:{userId}`, `devices:{userId}`, `diseases:{userId}`, `system:broadcast`
- Details: `REALTIME_FEATURES.md`

## Production

- Entry: `node server/start-production.cjs` (env check, then server; graceful SIGTERM shutdown)
- Requires `DATABASE_URL` (Postgres) and `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
- Deploy: Render Blueprint (deploys after CI passes) or `Dockerfile`; guide: `docs/RUNTIME_DEPLOYMENT_RENDER.md`
- Verified: `npm run test:production` (incl. redeploy persistence against PostgreSQL 16)

## Default Local Admin (development only; disabled in production)

- `admin@smartfarming.local`
- `admin123`

## Operational Notes

- No Supabase dependency is required for local operation.
- Cloud-related docs in historical files may remain for reference only.
