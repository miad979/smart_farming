# Production Deployment

The whole app (frontend, API, auth cookies, realtime SSE) runs as **one Node web service** started with
`node server/start-production.cjs`. Static hosting alone cannot run it (no `/api/*`, no auth, no realtime).

Two supported ways to deploy:

| Option | Use when |
|---|---|
| **Render Blueprint** (`render.yaml`) | Easiest managed hosting; deploys automatically after CI passes |
| **Docker image** (`Dockerfile`) | Any container host: a VPS, Railway, Fly.io, Render Docker runtime, Kubernetes |

---

## 1. What production requires (the server refuses to start without these)

`server/check-production-env.cjs` runs before the server and exits with a clear message if any is missing:

| Variable | Why |
|---|---|
| `AUTH_TOKEN_SECRET` | Signs login tokens. 32+ characters. Generate with `npm run secret:auth`. Render generates one for you. |
| `CORS_ALLOWED_ORIGINS` | Your public URL(s), e.g. `https://farm.example.com`. |
| `DATABASE_URL` | **Postgres connection string.** Hosting disks are wiped on every deploy/restart; app data *and uploaded doctor documents* are kept in Postgres. Render Postgres, Supabase and Neon all work. |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Creates the first admin. Password: 12+ characters with upper and lower case, a number and a symbol. |

Not allowed in production:
- The demo accounts `admin@smartfarming.local / admin123` and `super@smartfarming.local / super123` are **never created**,
  and any account still using one of those passwords is **refused at sign-in**. If you migrate data from a demo, set
  `BOOTSTRAP_ADMIN_EMAIL=admin@smartfarming.local` once and its demo password is replaced by your bootstrap password.
- `ALLOW_EPHEMERAL_STORAGE=true` lets the server run without `DATABASE_URL`. Use it only for throwaway demos or
  a host with a real persistent disk.

Recommended:
- `PLANT_ID_API_KEY` (real disease detection; otherwise a fallback is used)
- one AI key: `OPENAI_API_KEY`, `GROQ_API_KEY` or `OPENROUTER_API_KEY` (otherwise the chat uses local fallback answers)
- `TRUST_PROXY_HOPS` — number of proxies in front of the app that append to `X-Forwarded-For` (Render: `1`, the
  default; a bare VPS without a proxy: `0`). Or `CLIENT_IP_HEADER=cf-connecting-ip` behind Cloudflare. Rate limits
  and sign-in lockout use this; the client-supplied part of `X-Forwarded-For` is never trusted.

All variables are listed in `.env.production.example`.

---

## 2. Deploy on Render

1. Create a Postgres database (Render → **New → Postgres**, or Supabase/Neon). Copy its **external** connection string.
2. Render → **New → Blueprint** → select this repository. Render reads `render.yaml`.
3. Fill in the variables marked *sync: false*: `DATABASE_URL`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`,
   and any API keys. Change `CORS_ALLOWED_ORIGINS` / `OPENROUTER_SITE_URL` if your service URL or custom domain differs.
4. Deploy. Render builds with `npm ci --ignore-scripts && npm run build` on Node 22 (`.node-version`).

How later deploys happen:
- `render.yaml` sets `autoDeployTrigger: checksPass`: on each push to the branch, Render waits for the GitHub
  checks (**Security CI** and **UI smoke**) and deploys only if they pass. A failing commit is never deployed.
- `.github/workflows/deploy-render.yml` is now a **manual** redeploy button (Actions → *Deploy Runtime (Render)* →
  *Run workflow*), using the repository variable `RENDER_DEPLOY_HOOK_URL`.

Why `--ignore-scripts`: the `msedge-tts` dependency ships a pnpm-only `preinstall` guard (`npx only-allow pnpm`)
that can abort an npm install. No dependency of this app needs its install script; the build, all server tests and
the Playwright suite pass on an install made this way.

---

## 3. Deploy with Docker (any host)

```bash
docker build -t smart-farming .
docker run -d --name smart-farming -p 8080:8080 --env-file .env.production --restart unless-stopped smart-farming
```

- Multi-stage image on `node:22-alpine`; runs as the non-root `node` user; only production dependencies.
- Built-in `HEALTHCHECK` on `/api/health`.
- Put HTTPS in front (Caddy, nginx, Cloudflare, or the platform's load balancer) and set `TRUST_PROXY_HOPS`
  to the number of proxies in front of the container.
- Without a load balancer providing HTTPS, browsers will not allow the microphone or GPS on phones.

---

## 4. Go-live checklist

- [ ] `DATABASE_URL` points at a Postgres database with backups enabled
- [ ] `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` set; sign in once and confirm the admin panel opens
- [ ] `CORS_ALLOWED_ORIGINS` and `OPENROUTER_SITE_URL` match the real URL (custom domain if any)
- [ ] `https://<your-url>/api/health` returns `200` with `"sqlConnected": true`
- [ ] Sign up a farmer and a doctor; verify the doctor as admin; send a consultation and reply — the doctor panel unlocks live
- [ ] Upload a doctor certificate, **redeploy**, and confirm it still opens in the admin verification page
- [ ] Optional keys set: `PLANT_ID_API_KEY`, an AI provider key
- [ ] Remove `ALLOW_EPHEMERAL_STORAGE` if it was used for a trial

### Verification commands

```bash
curl -i https://<your-url>/api/health                 # 200, JSON, "sqlConnected": true
curl -I https://<your-url>/                           # 200, Content-Security-Policy, Strict-Transport-Security
curl -I https://<your-url>/assets/does-not-exist.js   # 404 (not the app page)
curl -N https://<your-url>/api/realtime/stream        # 200 text/event-stream (Ctrl+C to stop)
```

---

## 5. What the runtime does for you

- **Graceful shutdown:** on `SIGTERM` (every deploy/restart) the server stops accepting requests, writes any pending
  database change to Postgres, closes the pool and exits. Start commands run `node` directly so the signal arrives.
- **Uploads:** stored on local disk *and* in the Postgres table `app_uploaded_files`; after a redeploy files are restored from Postgres on first access.
- **Static files:** gzip compression, `immutable` caching for hashed `/assets/*`, `no-cache` for `index.html`
  (new deploys are picked up immediately), real `404` for missing assets, malformed URLs answered with `400`.
- **Security headers:** CSP, HSTS (real domains only), `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`.
- **Rate limits / lockout:** per client IP (see `TRUST_PROXY_HOPS`); production defaults are in `render.yaml`.

### Known limits (single-instance design)

- App state is one JSON document, loaded on each request and mirrored to Postgres (`app_state_snapshots`).
  Run **one instance** only; several instances would overwrite each other's writes. Fine for a pilot or a few
  thousand users; a larger rollout needs a migration to normalized SQL tables.
- Realtime uses Server-Sent Events from that single instance.

---

## 6. Local checks before deploying

```bash
npm run build
npm run test:production          # production-mode checks (demo passwords, proxy IPs, static server, headers)
# with a disposable Postgres database, also checks that data and uploads survive a wiped disk:
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/scratch npm run test:production
```

PowerShell: `$env:TEST_DATABASE_URL='postgresql://...'; npm run test:production`

CI runs the same test against a Postgres service container on every push (`.github/workflows/security.yml`).

---

## 7. Temporary public demo from your own computer (no hosting)

```bash
npm run demo:free            # builds, runs production mode on port 4180, opens a Cloudflare quick tunnel
npm run demo:free:skip-build
```

- Your computer must stay on; the URL changes on every restart; not for real users.
- It uses your local data file. It runs in production mode, so demo passwords are disabled; set
  `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` to use an admin account.
