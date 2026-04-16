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
- Last documentation refresh date: 2026-04-15

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

7. Optional local PostgreSQL snapshot table view
```bash
npm run db:table
```

7.1 Optional local PostgreSQL CSV export (Excel-friendly)
```bash
npm run db:csv
```

7.2 Optional live weather correctness validation
```bash
npm run test:weather:live
```

8. Production environment guard
```bash
# PowerShell
$env:NODE_ENV='production'
$env:AUTH_TOKEN_SECRET='replace_with_64_plus_chars'
$env:CORS_ALLOWED_ORIGINS='https://your-runtime-host'
$env:MARKET_VOLATILITY_PROFILE='balanced'
node server/check-production-env.cjs
```

9. Final git and CI confirmation
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

### Phase I: Guided human UAT/usability checklist (step-by-step)
- Date: 2026-04-14
- Commit: N/A (execution-only guided session)
- Context:
  - guided checklist executed interactively with user
  - public quick-tunnel URL was refreshed during run due tunnel expiry/network instability
  - final run completed on stable HTTP2 tunnel transport
- Step results:

| Step | Area | Initial Status | Final Status | Notes |
|---|---|---|---|---|
| 1 | Home load and first impression | Blocked | Pass | first URL unavailable; rerun succeeded |
| 2 | Navigation clarity | Blocked | Pass | tunnel dropped; retried on refreshed URL |
| 3 | Language toggle usability | N/A | Pass | language switch verified by user |
| 4 | Disease detection demo flow | N/A | Pass | demo report flow confirmed |
| 5 | Irrigation usability | N/A | Pass | user requested virtual pump/motor simulation feature |
| 6 | Market prices readability | N/A | Pass | values/trends readable |
| 7 | Profile/login form usability | N/A | Pass | labels/messages understandable |
| 8 | Keyboard accessibility smoke | N/A | Pass | no major keyboard focus blockers reported |
| 9 | Final UAT acceptance decision | N/A | Pass | accepted for pilot/demo use |

- Outcome summary:
  - Final UAT decision: PASS
  - Usability decision: PASS
  - Follow-up enhancement requested: virtual IoT water-pump simulation for irrigation automation testing

### Phase J: Virtual irrigation pump simulator implementation
- Date: 2026-04-15
- Commit: pending
- Summary:
  - implemented dedicated virtual pump simulator controls in irrigation UI
  - added deterministic simulation inputs (simulated moisture + manual liters)
  - added explicit force pump ON/OFF testing mode in backend simulation route
  - added dedicated UAT checklist steps for simulator verification
- Key modified files:
  - src/app/pages/Irrigation.tsx
  - src/app/utils/api.ts
  - server/local-api.cjs
  - docs/TESTING.md
- Validation:
  - npm run build: pass
  - npm run test:security: pass
  - npm run test:ui: pass (5/5)
  - no diagnostics errors in modified files

### Phase K: Supabase SQL snapshot workflow + bootstrap source correction
- Date: 2026-04-15
- Commits:
  - `2176efd` (Supabase runtime connection workflow and env shortcuts)
  - `3ccf1ba` (bootstrap source freshness fix)
- Summary:
  - added one-command Supabase snapshot connector and env-based DB URL shortcuts
  - added SQL SSL auto-detection for Supabase hosts
  - corrected startup source selection so SQL snapshot can be used when it is fresher than local JSON
- Key modified files:
  - server/connect-supabase.cjs
  - server/local-api.cjs
  - server/sync-sql-snapshot.cjs
  - server/ensure-local-postgres.cjs
  - package.json
  - .env.example
  - .env.production.example
  - README.md
  - BACKEND_SETUP.md
- Validation:
  - `npm run connect:supabase`: PASS (snapshot sync completed)
  - `npm run build`: PASS
  - live health check (`/api/health`):
    - `sqlConfigured: true`
    - `sqlConnected: true`
    - `bootstrapSource: sql-snapshot`
  - focused UI smoke (`farmer can use dashboard, disease, and irrigation routes`): PASS

### Phase L: Local PostgreSQL table formatter + CSV export tooling
- Date: 2026-04-15
- Commit: pending
- Summary:
  - added local snapshot table viewer command (`db:table`)
  - upgraded output to fixed-width structured tables to prevent terminal wrap corruption
  - added CSV export mode (single table or multi-table folder export)
- Key modified files:
  - server/show-local-postgres-table.cjs
  - package.json
  - docs/TESTING.md
- Validation:
  - `npm run db:table -- --table users --limit 8`: PASS (readable fixed-width output)
  - `npm run db:table -- --table users --columns id,name,role,email,lastSeen --csv temp-db-export-users.csv`: PASS (30-row CSV generated)
  - `npm run db:csv`: PASS (multi-table CSV files exported under `local-db-export/`)
  - temporary CSV preview checked and cleanup completed

## 7A) Requested Full Testing Matrix Update (2026-04-15)

This section records the exact testing titles requested and the current execution status in this workspace.

  ### Unit Testing
  - Status: Not available as a dedicated standalone suite in this repository.
  - Evidence: no separate unit-only test runner or unit test directory is defined in package scripts.

  ### Component Testing
  - Status: Executed (behavior-focused component assertions through UI smoke).
  - Command: `npm run test:ui`
  - Result: PASS (5 passed).

  ### Integration Testing
  - Status: Executed.
  - Commands:
    - `npm run test:security`
    - `npm run test:actions`
  - Result: PASS.

  ### System Testing
  - Status: Executed.
  - Commands:
    - `npm run build`
    - `npm run test:ui`
  - Result: PASS.

  ### Acceptance Testing (UAT)
  - Status: Partially executed (role-flow acceptance proxy via UI smoke).
  - Command: `npm run test:ui`
  - Result: PASS for automated role acceptance proxies.
  - Note: formal business stakeholder sign-off session remains manual.

  ### Alpha Testing
  - Status: Executed as internal pre-release validation using full automated suite below.
  - Result: PASS for internal technical criteria.

  ### Beta Testing
  - Status: Not executable in this local environment.
  - Reason: requires external user cohort and feedback cycle outside local terminal scope.

  ### Functional Testing
  - Status: Executed.
  - Commands:
    - `npm run test:ui`
    - `npm run test:actions`
  - Result: PASS.

  ### Non-Functional Testing
  - Status: Executed.
  - Commands:
    - `npm run test:load`
    - `npm audit --audit-level=high`
  - Result: PASS.

  ### Performance Testing
  - Status: Executed.
  - Command: `npm run test:load`
  - Result:
    - duration: 10000ms
    - concurrency: 25
    - total requests: 2951
    - unexpected error rate: 0.00%

  ### Load Testing
  - Status: Executed.
  - Command: `npm run test:load`
  - Result: PASS (unexpected failures: 0).

  ### Stress Testing
  - Status: Executed.
  - Command: `LOAD_TEST_DURATION_MS=10000`, `LOAD_TEST_CONCURRENCY=60`, then `npm run test:load`
  - Result:
    - total requests: 1321
    - unexpected failures: 0
    - throttle rate: 58.67%
    - p95 latency: 1452.64ms

  ### Soak Testing
  - Status: Executed.
  - Command: `LOAD_TEST_DURATION_MS=60000`, `LOAD_TEST_CONCURRENCY=20`, then `npm run test:load`
  - Result:
    - total requests: 20361
    - unexpected failures: 0
    - throttle rate: 73.30%
    - p95 latency: 109.09ms

  ### Spike Testing
  - Status: Executed.
  - Command: `LOAD_TEST_DURATION_MS=5000`, `LOAD_TEST_CONCURRENCY=120`, then `npm run test:load`
  - Result:
    - total requests: 672
    - unexpected failures: 0
    - p95 latency: 2091.90ms

  ### Security Testing
  - Status: Executed.
  - Commands:
    - `npm run test:security`
    - `npm audit --audit-level=high`
    - production guard: `node server/check-production-env.cjs`
  - Result: PASS.

  ### Usability Testing
  - Status: Partially executed.
  - Evidence: role-based UI paths validated and no major blockers in automated user journeys.
  - Note: full qualitative usability interviews require human participants.

  ### Compatibility Testing
  - Status: Executed.
  - Commands:
    - `npm run test:ui` (desktop)
    - `npm run test:ui:mobile` (mobile)
  - Result: PASS (desktop 5 passed, mobile 1 passed).

  ### Regression Testing
  - Status: Executed.
  - Evidence: suites re-run after changes and all core automation remains green.

  ### Sanity Testing
  - Status: Executed.
  - Commands:
    - `npm run build`
    - `node server/check-production-env.cjs` (with required variables)
  - Result: PASS.

  ### Smoke Testing
  - Status: Executed.
  - Command: `npm run test:ui`
  - Result: PASS (5 passed).

  ### Exploratory Testing
  - Status: Partially executable in automation-only context.
  - Note: true exploratory testing is manual by design; automated smoke and route switching were executed as proxy checks.

  ### Manual Testing
  - Status: Not fully executable via terminal automation.
  - Reason: requires interactive human test sessions and observational feedback.

  ### Automated Testing
  - Status: Executed.
  - Commands run in this update:
    - `npm run build`
    - `npm run test:security`
    - `npm run test:actions`
    - `npm run test:load`
    - `npm run test:ui`
    - `npm run test:ui:mobile`
    - `npm audit --audit-level=high`
    - `node server/check-production-env.cjs`

  ### White Box Testing
  - Status: Executed (script-level internal behavior validation).
  - Evidence: server-side workflow and security scripts validate internal branches and invariants.

  ### Black Box Testing
  - Status: Executed.
  - Evidence: role-based UI flows and API outcome checks verify observable behavior without internal code assumptions.

  ### Grey Box Testing
  - Status: Executed.
  - Evidence: mixed domain-aware API and UI workflow checks using partial internal knowledge.

  ### Codeless Testing
  - Status: Not executed in this workspace.
  - Reason: no codeless platform integration is configured in this repository.

  ### Perfecto.io
  - Status: Not executed.
  - Reason: Perfecto.io account/integration is not configured in this environment.

  ### Key Testing Tools

  #### GeeksforGeeks
  - Status: Informational reference only; not a test execution tool in this repository.

  #### Selenium
  - Status: Not used in this run (project uses Playwright for browser automation).

  #### JIRA
  - Status: Not executable from this local terminal (external project management system).

  #### TestNG
  - Status: Not applicable in this JavaScript/TypeScript test stack.

  #### Postman
  - Status: Tool not used directly; API verification was executed through scripted HTTP tests.

  #### LoadRunner
  - Status: Not used; load/stress/spike/soak were executed via repository load harness (`server/load-test.cjs`).

## 7B) Continued Testing Run (2026-04-15)

Additional full-pass execution was completed after the matrix update to confirm ongoing stability.

### Core Automated Suite
- `npm run build`: PASS
- `npm run test:security`: PASS
- `npm run test:actions`: PASS
- `npm run test:load` (baseline): PASS
  - duration: 10000ms
  - concurrency: 25
  - total requests: 3151
  - unexpected failures: 0
  - p95 latency: 222.89ms
- `npm run test:ui`: PASS (5 passed)
- `npm run test:ui:mobile`: PASS (1 passed)
- `npm audit --audit-level=high`: PASS (0 vulnerabilities)

### Extended Performance Suite
- Stress (`LOAD_TEST_DURATION_MS=10000`, `LOAD_TEST_CONCURRENCY=60`): PASS
  - total requests: 3657
  - unexpected failures: 0
  - throttle rate: 72.27%
  - p95 latency: 204.81ms
- Spike (`LOAD_TEST_DURATION_MS=5000`, `LOAD_TEST_CONCURRENCY=120`): PASS
  - total requests: 1458
  - unexpected failures: 0
  - throttle rate: 66.80%
  - p95 latency: 1211.98ms
- Soak (`LOAD_TEST_DURATION_MS=60000`, `LOAD_TEST_CONCURRENCY=20`): PASS
  - total requests: 24161
  - unexpected failures: 0
  - throttle rate: 74.07%
  - p95 latency: 88.17ms

### Production Environment Guard
- First attempt: expected FAIL due short test secret (< 32 chars).
- Re-run with valid secret length: PASS (`[env] Production environment check passed.`).

## 7C) Local PostgreSQL Snapshot Visibility Run (2026-04-15)

This run validates structured local table visibility and CSV export for snapshot-backed app data.

### Structured terminal table rendering
- Command: `npm run db:table -- --table users --limit 8`
- Result: PASS
- Evidence:
  - fixed-width row rendering preserved alignment in PowerShell
  - long values truncated safely without breaking table borders

### Column-scoped readability check
- Command: `npm run db:table -- --table users --columns id,name,role,email,lastSeen`
- Result: PASS
- Evidence:
  - default preview shows 20 rows
  - high-signal columns remained readable without horizontal corruption

### CSV export (Excel-friendly)
- Command: `npm run db:table -- --table users --columns id,name,role,email,lastSeen --csv temp-db-export-users.csv`
- Result: PASS
- Evidence:
  - CSV created with 30 rows
  - header + sample rows validated from terminal preview
  - temporary validation CSV cleaned up after check

### Bulk CSV export helper
- Command: `npm run db:csv`
- Result: PASS
- Output pattern:
  - exported files generated under `local-db-export/` (e.g., `users.csv`, `irrigation.csv`, `consultations.csv`)

## 7D) Live Weather Correctness Validation Run (2026-04-16)

This run validates that app weather output matches live provider data and is not stale.

### Automated command
- Command: `npm run test:weather:live`
- Result: PASS

### Validation criteria covered
- app endpoint matches Open-Meteo live values for:
  - current temperature, feels-like, humidity, rainfall
  - wind speed/gust/direction, cloud cover, UV, weather code
  - 3-day forecast temperature, rain probability, precipitation sum, UV
- app payload freshness:
  - `updatedAt` age within 120 seconds
  - sequential calls produce newer `updatedAt`

### Run evidence summary
- Base URL: `http://localhost:5173`
- Coordinates validated:
  - Dhaka (23.8103, 90.4125)
  - Chattogram (22.3569, 91.7832)
- Result snapshot:
  - point-level checks: PASS on both locations
  - freshness check: PASS (`updatedAt` changed between sequential calls)
  - overall pass rate: 100% (55/55 checks)

### Testing Performance Formula

Testing performance is calculated as:

`TestingPerformance(%) = (SuccessfulTestCases / TotalNumberOfTestCases) × 100`

Applied to this run:

- Successful test cases: 55
- Total number of test cases: 55
- `TestingPerformance(%) = (55 / 55) × 100 = 100%`

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

### Local data observability
- Added `server/show-local-postgres-table.cjs` for structured snapshot-table visibility.
- Added `npm run db:table` and `npm run db:csv` for repeatable local data inspection and export.

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
- [ ] virtual pump simulator auto/force cycles
- [ ] market prices and weather render correctly
- [ ] role-gated pages enforce permissions

### Security
- [ ] npm audit has no critical vulnerabilities
- [ ] auth cookie behavior correct under HTTPS
- [ ] CORS_ALLOWED_ORIGINS matches production host(s)
- [ ] AUTH_TOKEN_SECRET is set and sufficiently long
- [ ] MARKET_VOLATILITY_PROFILE is intentionally set (stable, balanced, or aggressive)

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

6. Virtual Pump Simulator (Dedicated UAT)
- [ ] set simulated moisture below threshold and click "Run Auto Decision" -> verify pump turns ON
- [ ] click "Force Pump ON (Test)" with custom liters -> verify watering event and liters reflected
- [ ] click "Force Pump OFF (Test)" -> verify pump state returns to OFF/idle
- [ ] confirm latest result message updates after each simulator action
- [ ] confirm sensor history shows new points for simulator cycles

## 12) Defects and Fix Log

| ID | Issue | Impact | Fix | Status |
|---|---|---|---|---|
| DEF-001 | Required check context mismatch | Merge blocked incorrectly | Standardized to required-ui-smoke | Closed |
| DEF-002 | Local postgres readiness hard-fail | Local dev startup instability | Made check non-fatal by default; strict mode optional | Closed |
| DEF-003 | Runtime deployment without env guard risk | Production auth/cors misconfiguration risk | Added server/check-production-env.cjs and enforced production secret requirement | Closed |
| DEF-004 | SQL connected but startup source remained local-json | Supabase-backed runtime validation mismatch | Added SQL snapshot freshness comparison in startup bootstrap selection | Closed |
| DEF-005 | Local snapshot table output wrapped and appeared broken | Data review friction in terminal | Replaced raw wide console table dumps with fixed-width structured rendering + column filters | Closed |

## 13) Artifacts and Evidence

Store or review artifacts from:
- Playwright output folders:
  - playwright-report/
  - test-results/
- GitHub Actions run logs:
  - Security CI
  - UI Smoke CI
  - Deploy Runtime (Render)
- Local DB evidence:
  - terminal output from `npm run db:table`
  - CSV exports from `npm run db:csv` (folder: `local-db-export/`)

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
npm run test:weather:live
npm run secret:auth
npm run demo:free
npm run demo:free:skip-build
npm run db:table
npm run db:csv
node server/check-production-env.cjs
```

---

Document version: 2.10
Status: Active and maintained
Last updated: 2026-04-16
Owner: Engineering / QA
