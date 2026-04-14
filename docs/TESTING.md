# Testing Documentation (First-to-Last)

## 1) Purpose

This document is the single source of truth for testing in this repository.

It includes:
- what changed
- what was tested
- what passed or failed
- what was modified to fix failures
- how to repeat and maintain testing over time

## 2) Current Baseline

- Project: Smart Farming System
- Repository: https://github.com/miad979/smart_farming
- Active branch protection required check: required-ui-smoke
- Runtime model: full Node runtime (frontend + backend API + realtime)
- Latest verified deployment automation commit: b47edfb
- Last documentation refresh date: 2026-04-14

## 3) Testing Scope

In scope:
- frontend build health
- backend security integration checks
- role-based browser smoke coverage
- CI required-status behavior for merge control
- runtime deployment automation checks
- production environment guard validation

Out of scope (still recommended):
- exhaustive cross-browser matrix on physical devices
- full load/performance benchmark suite on production hardware
- third-party provider uptime guarantees (OpenAI/Groq/OpenRouter/Plant.id)

## 4) Test Environments

### Local developer environment
- OS: Windows
- Node/NPM: project engine requirements in package.json
- Local API: server/local-api.cjs
- Local runtime server: server/preview-server.cjs
- Local DB modes:
  - JSON file (.local-db.json)
  - optional PostgreSQL snapshot mode

### CI environment (GitHub Actions)
- Security workflow: .github/workflows/security.yml
- UI smoke workflow: .github/workflows/ui-smoke.yml
- Deploy trigger workflow: .github/workflows/deploy-render.yml

### Runtime host environment
- Render Blueprint: render.yaml
- Required runtime endpoints:
  - /api/health
  - /api/realtime/stream

## 5) First-to-Last Execution Order (Standard)

Run testing in this exact order for release readiness:

1. Install dependencies
```bash
npm ci
```

2. Build verification
```bash
npm run build
```

3. Security checks
```bash
npm run test:security
```

4. UI smoke checks (desktop + role flow)
```bash
npm run test:ui
```

5. Optional mobile-targeted smoke
```bash
npm run test:ui:mobile
```

6. Optional load checks
```bash
npm run test:load
```

7. Production environment guard
```bash
# PowerShell
$env:NODE_ENV='production'
$env:AUTH_TOKEN_SECRET='replace_with_64_plus_chars'
$env:CORS_ALLOWED_ORIGINS='https://your-runtime-host'
node server/check-production-env.cjs
```

8. Final git and CI confirmation
- ensure clean or intentional git diff
- ensure required checks are green on pushed commit

## 6) Chronological Change and Testing Log

This section records what happened first-to-last, what was modified, and how it was validated.

### Phase A: Initial import and baseline CI setup
- Commit: 2b11ca2
- Summary:
  - project imported
  - base docs/workflows/scripts added
  - UI smoke and branch protection automation foundations introduced
- Key modified files (high impact):
  - .github/workflows/ui-smoke.yml
  - .github/workflows/security.yml
  - tests/ui/role-ui-smoke.spec.js
  - playwright.config.ts
  - server/apply-branch-protection.cjs
  - server/bootstrap-github-repo.cjs

### Phase B: Required check context alignment fix
- Commit: c72a437
- Problem:
  - required status check context mismatch blocked clean merges
- Modification:
  - normalized required check context to required-ui-smoke
- Key modified files:
  - docs/BRANCH_PROTECTION.md
  - docs/TESTING.md
  - server/apply-branch-protection.cjs
  - server/bootstrap-github-repo.cjs
- Validation:
  - branch protection re-read and PR gate behavior re-tested

### Phase C: Merge-gate verification
- Commit: 45e74e4
- Summary:
  - performed explicit merge gate test for UI smoke status
- Validation result:
  - merge blocked while check pending
  - merge allowed after required-ui-smoke success

### Phase D: Dev startup reliability hardening
- Commit: ca2f4a6
- Problem:
  - local startup path could fail hard on PostgreSQL readiness edge case
- Modification:
  - made local postgres readiness behavior non-fatal by default
  - strict mode preserved through LOCAL_POSTGRES_STRICT=true
- Key modified file:
  - server/ensure-local-postgres.cjs
- Validation:
  - npm run dev startup behavior re-tested successfully

### Phase E: Runtime deployment and production secret hardening
- Commit: b47edfb
- Summary:
  - full runtime-host deployment automation added
  - production secret guard and docs completed
- Key modified files:
  - render.yaml
  - .env.production.example
  - .github/workflows/deploy-render.yml
  - server/check-production-env.cjs
  - server/generate-auth-secret.cjs
  - server/local-api.cjs
  - README.md
  - docs/DEPLOYMENT.md
  - docs/RUNTIME_DEPLOYMENT_RENDER.md
  - package.json
- Validation:
  - local build passed
  - production env guard passed with required vars
  - GitHub workflows for commit b47edfb completed successfully:
    - Deploy Runtime (Render)
    - UI Smoke CI
    - Security CI

### Phase F: Final production hardening pass (CSP, cookies, rate limits)
- Date: 2026-04-14
- Summary:
  - runtime CSP headers were added at the preview server layer
  - production cookie behavior hardened and same-site made configurable
  - route-level rate limits moved to configurable production-tuned defaults
  - realtime endpoint now has connection rate and per-IP concurrent connection controls
  - deployment templates/docs updated with new hardening variables
- Key modified files:
  - server/preview-server.cjs
  - server/local-api.cjs
  - server/check-production-env.cjs
  - .env.example
  - .env.production.example
  - render.yaml
  - docs/RUNTIME_DEPLOYMENT_RENDER.md
- Validation:
  - npm run build: pass
  - npm run test:security: pass
  - npm run test:ui: pass (5/5)
  - production-mode local runtime verification passed for:
    - / (CSP and hardening headers)
    - /api/health (status 200)
    - /api/realtime/stream (status 200, text/event-stream)

### Phase G: One-command free runtime+tunnel launcher
- Date: 2026-04-14
- Summary:
  - added one-command launcher for full runtime + Cloudflare quick tunnel
  - launcher auto-detects cloudflared, starts production runtime, prints public URL, and shuts down both processes on Ctrl+C
  - added npm scripts and docs for repeatable no-billing demos
- Key modified files:
  - server/start-free-demo.cjs
  - package.json
  - README.md
  - docs/RUNTIME_DEPLOYMENT_RENDER.md
- Validation:
  - command tested: `node server/start-free-demo.cjs --skip-build --port 4181`
  - generated public tunnel URL successfully
  - public `/api/health` returned status JSON
  - public `/api/realtime/stream` returned `200` with `text/event-stream`

### Phase H: Comprehensive taxonomy execution (core levels + categories + methods)
- Date: 2026-04-14
- Commit: N/A (execution-only verification run)
- Summary:
  - executed full available automated matrix mapped to requested testing taxonomy
  - added explicit black-box checks via public tunnel URL
  - added accessibility smoke heuristics via Playwright browser probe
  - validated dependency security via npm audit
- Commands executed:
  - `npm run build`
  - `npm run test:security`
  - `npm run test:actions`
  - `npm run test:load`
  - `npm run test:ui`
  - `npm run test:ui:mobile`
  - `npm audit --audit-level=high`
  - black-box live checks on `https://files-maintains-persian-cnet.trycloudflare.com`
  - accessibility smoke probe using Playwright (`A11Y_SMOKE`)
- Results:
  - build: pass
  - security integration: pass
  - action/integration workflow: pass
  - load/performance: pass (unexpected error rate 0.00%)
  - UI smoke: pass (5/5)
  - mobile UI smoke: pass (1/1)
  - dependency security audit: pass (0 high vulnerabilities)
  - live black-box endpoints: pass (`/`, `/api/health`, `/api/realtime/stream`)
  - accessibility smoke output: `{"title":"Smart Farming System","h1Count":3,"lang":"en"}`

## 7) Detailed Test Results (Latest Recorded)

Date: 2026-04-14

### Build
Command:
```bash
npm run build
```
Result:
- PASS
- dist generated successfully
- known warning: large chunk size warning only (non-blocking)

### Security Integration
Command:
```bash
npm run test:security
```
Result:
- PASS
- output included: Security integration tests passed

### UI Role Smoke (Playwright)
Command:
```bash
npm run test:ui
```
Result:
- PASS
- 5/5 tests passed

Coverage focus:
- farmer route flow
- farmer refresh and route switching stability
- mobile smoke route coverage
- doctor dashboard access flow
- admin dashboard and doctor verification access flow

### Production Env Guard
Command:
```bash
node server/check-production-env.cjs
```
Result:
- PASS when required variables are set
- FAIL (expected) when required production variables are missing

### Runtime Header and Endpoint Verification (Production Mode)
Commands (local production simulation):
```bash
npm run start:prod
curl -i http://localhost:4180/
curl -i http://localhost:4180/api/health
curl -i http://localhost:4180/api/realtime/stream
```
Result:
- PASS
- `/` returned CSP and key security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
- `/api/health` returned 200 with JSON status payload
- `/api/realtime/stream` returned 200 with `Content-Type: text/event-stream`

### Integration Workflow Test
Command:
```bash
npm run test:actions
```
Result:
- PASS
- doctor verification state transitions, permission checks, and audit log assertions passed

### Performance / Load Test
Command:
```bash
npm run test:load
```
Result:
- PASS
- total requests: 1676
- failed requests (unexpected): 0
- throttled requests (429): 1003 (expected under hardening limits)
- unexpected error rate: 0.00%
- latency p95: 404.73ms

### Dependency Security Audit
Command:
```bash
npm audit --audit-level=high
```
Result:
- PASS
- reported vulnerabilities: 0

### Black-Box Live Endpoint Check (Public Tunnel)
Target:
- `https://files-maintains-persian-cnet.trycloudflare.com`

Result:
- PASS
- root path returned 200 with CSP and hardening headers
- `/api/health` returned status JSON
- `/api/realtime/stream` returned 200 and `text/event-stream`

### Accessibility Smoke Heuristic
Command:
```bash
node -e "...Playwright probe..."
```
Result:
- PASS (smoke)
- output: `A11Y_SMOKE={"title":"Smart Farming System","h1Count":3,"lang":"en"}`
- note: this is a lightweight heuristic, not a full WCAG audit

### Taxonomy Coverage Mapping

- Core levels:
  - Unit testing: not available as dedicated suite in repository (no standalone unit test files found)
  - Integration testing: covered by `test:security` and `test:actions`
  - System testing: covered by build + UI smoke + live endpoint checks
  - Acceptance testing: approximated by role-based UI smoke; formal end-user UAT remains manual

- Major categories:
  - Functional: covered (API + role UI + workflow)
  - Non-functional: covered (performance load, security audit/integration)
  - Performance: covered (`test:load`)
  - Security: covered (`test:security`, `npm audit`, hardened headers/cookies/rate limits active)
  - Usability: requires human exploratory/UAT session (not fully automatable)
  - Accessibility: partially covered by Playwright smoke heuristic; full axe/WCAG audit pending

- Execution methods:
  - Automated testing: executed extensively (all listed automated commands above)
  - Manual testing: limited in this run; full manual/UAT requires stakeholder-driven scenarios

- Structural approaches:
  - Black-box: public tunnel endpoint checks and UI smoke behavior checks
  - White-box: internal workflow scripts validating lockout, CSRF, audit log internals
  - Grey-box: role/action workflow tests combining API behavior with domain knowledge

## 8) What Was Modified to Improve Testability

### Test infrastructure
- Added and stabilized Playwright config and role-based smoke suite.
- Added mobile-tagged smoke execution path.
- Added artifact-friendly CI workflows.

### Branch protection and merge safety
- Standardized required check context: required-ui-smoke.
- Enforced strict up-to-date branch rule for merge safety.

### Reliability
- Reduced local startup brittleness in postgres preflight.

### Deployment safety
- Added strict production startup guard for AUTH_TOKEN_SECRET and CORS_ALLOWED_ORIGINS.
- Added secret generator utility for safe auth token setup.

## 9) Required Checks for Main Branch

Branch protection must require:
- required-ui-smoke

Recommended additional checks:
- security

Policy settings:
- Require branches to be up to date before merging: enabled
- Include merge queue if used: enabled

## 10) Regression Checklist (Release Gate)

### Functional
- [ ] login and logout flow
- [ ] disease detection upload and advisory
- [ ] irrigation status and control flow
- [ ] market prices and weather render correctly
- [ ] role-gated pages enforce permissions

### Security
- [ ] npm audit has no critical vulnerabilities
- [ ] auth cookie behavior correct under HTTPS
- [ ] CORS_ALLOWED_ORIGINS matches production host(s)
- [ ] AUTH_TOKEN_SECRET is set and sufficiently long

### Runtime
- [ ] /api/health returns status ok
- [ ] /api/realtime/stream is reachable
- [ ] production runtime starts with npm run start:prod

### CI and governance
- [ ] UI smoke required check is green
- [ ] security workflow is green
- [ ] deploy workflow behavior is expected (triggered or intentionally skipped)

## 11) Production Smoke Checklist (Post-Deploy)

Run immediately after deployment:

1. Health and API
- [ ] GET /api/health returns 200 and storage metadata

2. Auth and session
- [ ] sign in works
- [ ] sign out works
- [ ] cookies set with secure behavior under HTTPS

3. Feature smoke
- [ ] disease detection returns result
- [ ] assistant response path works (provider or fallback)
- [ ] realtime updates stream is active

4. Role smoke
- [ ] farmer routes accessible for farmer
- [ ] doctor routes require doctor role
- [ ] admin routes require admin role

5. Logging and errors
- [ ] no startup crash logs
- [ ] no repeated 5xx bursts in logs

## 12) Defects and Fix Log

| ID | Issue | Impact | Fix | Status |
|---|---|---|---|---|
| DEF-001 | Required check context mismatch | Merge blocked incorrectly | Standardized to required-ui-smoke | Closed |
| DEF-002 | Local postgres readiness hard-fail | Local dev startup instability | Made check non-fatal by default; strict mode optional | Closed |
| DEF-003 | Runtime deployment without env guard risk | Production auth/cors misconfiguration risk | Added server/check-production-env.cjs and enforced production secret requirement | Closed |

## 13) Artifacts and Evidence

Store or review artifacts from:
- Playwright output folders:
  - playwright-report/
  - test-results/
- GitHub Actions run logs:
  - Security CI
  - UI Smoke CI
  - Deploy Runtime (Render)

## 14) Maintenance Process for This Document

Update this document after every testing-impacting change.

Required update fields:
1. date and commit hash
2. what changed (files and behavior)
3. what tests were run
4. pass/fail outcome
5. defects found and fix status
6. residual risks (if any)

Use this mini-template for each new entry:

```md
### Phase X: <short title>
- Date:
- Commit:
- What changed:
- Files modified:
- Tests run:
- Result:
- Defects and follow-up:
```

## 15) Quick Command Reference

```bash
npm ci
npm run build
npm run test:security
npm run test:ui
npm run test:ui:mobile
npm run test:load
npm run secret:auth
npm run demo:free
npm run demo:free:skip-build
node server/check-production-env.cjs
```

---

Document version: 2.3
Status: Active and maintained
Last updated: 2026-04-14
Owner: Engineering / QA
