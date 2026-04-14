# Smart Farming System

A Bengali-first smart farming platform with a fully local backend.

## Local-Only Runtime

This project runs without Supabase.

- Frontend: React + TypeScript + Vite
- Backend: Local Node API at `server/local-api.cjs`
- Database: Local JSON file at `.local-db.json` (default) or PostgreSQL snapshot mode (optional)
- File uploads: Local directory `.local-uploads/`
- Realtime: Server-Sent Events via `/api/realtime/stream`

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Free Public Demo (No Billing)

You can run the full app (frontend + API + realtime) locally and expose it with a free Cloudflare quick tunnel.

```bash
npm run demo:free
```

Notes:
- This starts production-mode runtime + tunnel in one command.
- Keep the terminal open; stopping it stops the public URL.
- For faster restart without rebuilding, use `npm run demo:free:skip-build`.

## Production Runtime Deployment (Render)

This app needs a long-running Node runtime because it serves both the frontend and backend API (`/api/*`) from `server/preview-server.cjs`.

1. Create runtime secrets:

```bash
npm run secret:auth
```

2. Use the production env template:

```bash
cp .env.production.example .env.production
```

3. Deploy as a Render Blueprint using `render.yaml`.
4. Set required secrets in Render (`AUTH_TOKEN_SECRET`, `CORS_ALLOWED_ORIGINS`, and any AI provider keys you use).
5. Optional: set GitHub Actions repository variable `RENDER_DEPLOY_HOOK_URL` to auto-deploy from `main` via `.github/workflows/deploy-render.yml`.

Detailed steps are in `docs/RUNTIME_DEPLOYMENT_RENDER.md`.

## PostgreSQL Mode (Optional)

You can run the same backend with PostgreSQL as persistent storage using a JSON snapshot table.

1. Add connection details to `.env` or `.env.local`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
# Optional for managed providers that require SSL
SQL_SSL=require
```

2. Migrate existing local data into PostgreSQL:

```bash
npm run sync:postgres
```

3. Start the app normally:

```bash
npm run dev
```

When PostgreSQL has a snapshot, runtime loads from PostgreSQL first. If PostgreSQL is configured but empty, the backend backfills from `.local-db.json`.
When using local PostgreSQL on `127.0.0.1:5434`, `npm run dev` automatically tries to start the local PostgreSQL instance from `.postgres-local/data` before launching Vite.

## Optional Plant.id Setup

Create `.env` in the project root and add:

```bash
PLANT_ID_API_KEY=your_real_plant_id_api_key
```

Optional custom endpoint:

```bash
PLANT_ID_HEALTH_ENDPOINT=https://api.plant.id/v2/health_assessment
```

## Optional Chat Assistant Setup

The assistant chat endpoint tries providers in this order and uses the first successful one:

1. `OPENAI_API_KEY`
2. `GROQ_API_KEY`
3. `OPENROUTER_API_KEY`
4. Local fallback response

Example `.env` values:

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant

OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=Smart Farming
```

## Bangla Voice (Natural TTS)

The `/api/tts/generate` endpoint now uses Microsoft Edge neural voices by default for more natural Bangla output.

Optional `.env` settings:

```bash
EDGE_TTS_ENABLED=true
EDGE_TTS_BN_VOICE=bn-BD-PradeepNeural
EDGE_TTS_EN_VOICE=en-US-AriaNeural
EDGE_TTS_BN_RATE=-10%
EDGE_TTS_EN_RATE=default
```

## Admin Access

Default local admin account:

- Email: `admin@smartfarming.local`
- Password: `admin123`

## Notes

- No cloud backend is required for normal development.
- Data persists locally in `.local-db.json`.
- If `.local-db.json` does not exist, it is created automatically.
