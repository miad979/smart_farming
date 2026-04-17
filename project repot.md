# Project Report: Smart Farming System

## 1. Executive Summary
The Smart Farming System is a Bengali-first, local-first web platform for farmers in Bangladesh. It provides AI-assisted disease detection, smart irrigation control, market price tracking, weather monitoring, and expert consultation workflows. The solution is designed to run fully locally by default, with optional PostgreSQL connectivity and production deployment on Render.

## 2. Objectives
- Provide accessible farming decision support in a bilingual (Bengali-first) experience.
- Enable offline-friendly operation with local data storage.
- Support role-based access for farmers, agricultural experts (doctors), and admins.
- Provide reliable and measurable quality through automated and manual testing.

## 3. Scope
In scope:
- Frontend web application
- Local backend API with realtime updates
- Disease detection workflow
- Irrigation control and analytics
- Market price and weather monitoring
- Consultation and verification workflows

Out of scope (current release):
- Full cross-browser lab testing on physical devices
- Production-scale performance benchmarking
- Third-party provider uptime guarantees

## 4. Stakeholders and Users
- Farmers (primary users)
- Agricultural experts (doctors)
- Administrators
- Academic reviewers and project evaluators

## 5. System Architecture
### 5.1 Frontend
- React + TypeScript + Vite
- Tailwind CSS for styling
- React Router for navigation

### 5.2 Backend
- Node.js local API (`server/local-api.cjs`)
- Realtime updates via Server-Sent Events (`/api/realtime/stream`)

### 5.3 Data Storage
- Default: local JSON file (`.local-db.json`)
- Optional: PostgreSQL snapshot mode

### 5.4 Deployment
- Local-first runtime by default
- Production deployment via Render Blueprint (`render.yaml`)

## 6. Core Features
### 6.1 Farmer Features
- Disease detection with advisory output
- Smart irrigation management with auto mode
- Market prices and trend visualization
- Weather monitoring and alerts
- Consultation requests with experts

### 6.2 Doctor Features
- Verification by admin before access
- Consultation queue management
- Case review and response workflow

### 6.3 Admin Features
- User and role management
- Doctor verification queue
- System analytics overview

## 7. Key Modules
- Disease Detection
- Irrigation Management
- Market Price Tracking
- Weather Monitoring
- Consultation Management
- Admin Verification and Governance

## 8. Data Models (Summary)
- User: role-based user profile with farmer/doctor/admin status
- DoctorProfile: specialization, verification state, availability
- DiseaseDetection: scan results, advisory, and review status
- IrrigationSystem: moisture, policy, schedule, and usage history

## 9. Tools and Languages
### Languages
- TypeScript (frontend)
- JavaScript (Node.js runtime and tests)
- SQL (migrations)
- Markdown (documentation)

### Tools
- Playwright (UI testing)
- Jest (unit testing)
- axe-core/playwright (accessibility testing)
- Custom Node load harness (`server/load-test.cjs`)
- npm audit (security)

## 10. Testing and Validation
### Reliability
- Failed requests (unexpected): 0
- Total requests: 3688
- SystemReliability = 1 - (0/3688) = 1.00 (100%)

### Availability
- Observed availability: ~100% during soak and continuous test window

### SLA (Service Level Objectives)
Targets:
- API success rate >= 99%
- p95 latency <= 500 ms (normal load)
- Error rate <= 1%
- Security vulnerabilities: 0 high/critical

Measured results:
- Success rate: 100%
- p95 latency: ~88 to 222 ms
- Error rate: 0%
- Security: 0 vulnerabilities

Conclusion: all SLA targets satisfied.

## 11. Risk Analysis
| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Weather API failure | Medium | Medium | Retry + cached fallback |
| DB corruption (.local-db.json) | High | Low | Auto-backup + SQL snapshot restore |
| High traffic spike | Medium | High | Rate limiting (already implemented) |
| Auth secret misconfiguration | Critical | Low | Production env guard |
| UI text contract change | Low | Medium | Flexible assertion patterns |

## 12. Security and Compliance
- Production environment guard blocks unsafe startup
- Secrets managed via environment variables
- npm audit used for dependency vulnerability checks

## 13. Deployment and Operations
- Local development: `npm run dev`
- Production: Render Blueprint via `render.yaml`
- Required production variables: AUTH_TOKEN_SECRET, CORS_ALLOWED_ORIGINS, MARKET_VOLATILITY_PROFILE

## 14. Limitations
- No full lab-based cross-browser device testing in this cycle
- External provider uptime is not guaranteed by this system
- Production telemetry is not included in local-only testing logs

## 15. Future Work
- Expanded cross-browser and device matrix
- Production monitoring dashboards and SLO reporting
- Additional automation for regression and performance suites

## 16. Owner and Authorship
Owner: Miadul Islam Nizzan (Undergraduate, BSc in CSE, Green University of Bangladesh; Sole Developer)

## 17. References
- README.md
- docs/SYSTEM_OVERVIEW.md
- docs/COMPONENTS.md
- docs/DATA_MODELS.md
- docs/USER_GUIDE.md
- docs/TESTING.md

---

Document: Project Report
Version: 1.0
Date: 2026-04-16
