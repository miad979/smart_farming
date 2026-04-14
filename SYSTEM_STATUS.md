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

## Default Local Admin

- `admin@smartfarming.local`
- `admin123`

## Operational Notes

- No Supabase dependency is required for local operation.
- Cloud-related docs in historical files may remain for reference only.
