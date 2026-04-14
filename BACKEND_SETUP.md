# Backend Setup (Local API)

The backend is a local Node server in `server/local-api.cjs`.

## Start Backend via Vite Proxy

Run the app in development:

```bash
npm run dev
```

The frontend uses `/api/*` endpoints served by the local backend middleware.

## Core Local Components

- API implementation: `server/local-api.cjs`
- Local database file: `.local-db.json`
- Upload storage path: `.local-uploads/`

## PostgreSQL Connection (Optional)

You can connect the local API to PostgreSQL for persistent shared storage.

1. Add environment values in `.env` or `.env.local`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
# Optional for managed Postgres (Neon, Supabase, etc.)
SQL_SSL=require
```

2. Push current local data into PostgreSQL:

```bash
npm run sync:postgres
```

3. Start development server:

```bash
npm run dev
```

Behavior:

- If PostgreSQL snapshot exists, the backend loads from PostgreSQL first.
- If PostgreSQL is configured but empty, local `.local-db.json` is backfilled to PostgreSQL automatically.

## Local API Features

- Email/password auth
- User/doctor/admin flows
- Disease detection record storage
- Consultation and irrigation endpoints
- Realtime updates over SSE
- Assistant chat history
- Document upload metadata

## Optional Keys

Set in `.env` only if needed:

- `PLANT_ID_API_KEY`
- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GOOGLE_CLOUD_TTS_API_KEY`
- `ELEVENLABS_API_KEY`

Assistant chat provider order is:

1. `OPENAI_API_KEY`
2. `GROQ_API_KEY`
3. `OPENROUTER_API_KEY`
4. Local fallback response

Without these keys, local fallback behavior is used where implemented.

## Bangla Voice Quality

The TTS endpoint now tries Microsoft Edge neural voices first (no paid key required), then Google/ElevenLabs if configured, then browser speech fallback.

Optional `.env` overrides:

- `EDGE_TTS_ENABLED=true`
- `EDGE_TTS_BN_VOICE=bn-BD-PradeepNeural`
- `EDGE_TTS_EN_VOICE=en-US-AriaNeural`
- `EDGE_TTS_BN_RATE=-10%`
- `EDGE_TTS_EN_RATE=default`
