# Smart Farming System

A Bengali-first smart farming platform with a fully local backend.

## Local-First Runtime

This project runs locally by default and can also connect to Supabase PostgreSQL.

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

### Test on a phone (same Wi-Fi, HTTPS)

```bash
npm run dev:https
```

Vite prints `Network:` addresses such as `https://192.168.0.103:5173` — open the Wi-Fi one on the phone.

- The certificate is self-signed, so the phone shows a warning once: tap **Advanced → Proceed** (Chrome)
  or **Show Details → visit this website** (Safari). The connection is still encrypted.
- HTTPS gives the page a secure context, which phones require for the **microphone (voice questions)** and **GPS (local weather)**.
- Allow Node.js through the Windows firewall (Private networks) if the phone cannot connect.
- Anyone on the same network can reach the app while this runs; change the default admin password first.
- `npm run dev:lan` is the same over plain `http://` (voice and GPS will not work on the phone).
- For a trusted certificate with no warning, use the public tunnel below (`npm run demo:free`).
- The app is laid out for phones down to 320px wide (bottom navigation, floating Detect/Help buttons).

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

Deploy with the Render Blueprint (`render.yaml`) or the `Dockerfile` on any container host.
The server refuses to start in production unless these are set:

| Variable | Purpose |
|---|---|
| `AUTH_TOKEN_SECRET` | Token signing secret (`npm run secret:auth`; Render generates one) |
| `CORS_ALLOWED_ORIGINS` | Your public URL |
| `DATABASE_URL` | Postgres — hosting disks are wiped on every deploy; data and uploads live here |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First admin account (strong password) |

Render deploys automatically **only after CI passes** (`autoDeployTrigger: checksPass`).
Full guide, Docker instructions and go-live checklist: `docs/RUNTIME_DEPLOYMENT_RENDER.md`.

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

### Supabase PostgreSQL Quick Connect

You can connect to Supabase with either a full `DATABASE_URL` or a simplified pair:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_DB_PASSWORD=your_database_password
SQL_SSL=require
```

Then sync current local data and start:

```bash
npm run connect:supabase
npm run dev
```

When PostgreSQL has a snapshot, runtime loads from PostgreSQL first. If PostgreSQL is configured but empty, the backend backfills from `.local-db.json`.
When using local PostgreSQL on `127.0.0.1:5434`, `npm run dev` automatically tries to start the local PostgreSQL instance from `.postgres-local/data` before launching Vite.

Local PostgreSQL layout (all gitignored): cluster in `.postgres-local/data` (127.0.0.1:5434 only, password auth),
database and owner role `smart_farming`, connection string in `.env.local` (`DATABASE_URL`, `SQL_SSL=false`),
superuser password in `.postgres-local/superuser-password.txt`. Stop it with
`"C:/Program Files/PostgreSQL/16/bin/pg_ctl.exe" -D .postgres-local/data stop`.

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

Default **local development** admin account:

- Email: `admin@smartfarming.local`
- Password: `admin123`

These demo accounts are never created in production, and their passwords are refused there
(the first production admin comes from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`).

## Notes

- No cloud backend is required for normal development.
- Data persists locally in `.local-db.json`.
- If `.local-db.json` does not exist, it is created automatically.
