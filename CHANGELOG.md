# Changelog

All notable changes to the Smart Farming Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Farmer **My Consultations** page (`/consultations`): live status, farmer ↔ doctor chat, doctor advice, 1–5 star rating
- Doctor dashboard: accept & chat, respond & complete, mark complete (advice required), real statistics and 7-day chart, real crop photos
- Admin **Consultation oversight** panel: live list, filters, priority, admin note, return a case to the queue
- `POST /api/auth/change-password` and a change-password form in Profile → Security
- Voice questions (speech-to-text, বাংলা/English) in the disease assistant chat
- Live account alerts (`alerts:{userId}`): doctor verification decisions now notify the doctor and unlock the panel without re-login
- `npm run test:consultations` end-to-end workflow test (14 checks)
- `npm run test:weather`: live weather workflow test with simulated providers (7 checks, runs in CI)
- Optional `WEATHER_PROVIDERS` env var to set the weather provider order (default `open-meteo,met-norway`)
- Weather widget: "Use my location" and "Try again" buttons
- `npm run dev:lan` to open the dev server from a phone on the same Wi-Fi
- `npm run dev:https`: local-network HTTPS dev server (self-signed via `@vitejs/plugin-basic-ssl`) so phones get a secure context for voice and GPS
- Admin "Weekly Activity" chart now shows real detections and consultations (`GET /api/admin/activity`)

### Fixed
- Live weather returned HTTP 500 on the deployed server: requests now time out after 8 s, Open-Meteo is retried once on transient errors, MET Norway is used as a fallback, a recent cached forecast is served if every provider fails, and otherwise a clear 503 is returned instead of a crash
- Hourly rain forecast window was computed in server UTC instead of the farm's local time zone
- Place names used a non-existent geocoding endpoint (now OpenStreetMap Nominatim, cached 24 h)
- GPS jitter triggered repeated weather reloads (coordinates rounded to ~1 km; simultaneous requests share one provider call)
- Yield advice failed entirely when weather was unavailable
- Doctor advice was saved under a field the dashboard never displayed
- Consultation requests ignored the chosen expert; "Call" dialed a placeholder number
- `VoiceRecorder` component could not compile (missing declaration)
- API client lost server error messages on 403 responses and crashed on non-JSON error bodies
- ~25 API calls skipped CSRF retry and credentials; realtime stream ignored `VITE_API_BASE_URL`
- Unknown `/api/*` routes returned the app HTML with status 200 (now JSON 404)
- One failing realtime handler stopped delivery to all other handlers on that channel
- Hook-order bug in the doctor dashboard when verification status changed
- Mobile: farmer bottom navigation overflowed on phones (Profile cut off); floating Help / RT Test / Detect / Live buttons stacked over page content (incl. the chat composer); admin page scrolled sideways at 320px (pie labels, unbreakable emails)
- Admin "Weekly Activity" chart displayed hard-coded sample numbers
- "RT Test" developer panel was shown to farmers and doctors in production builds
- Production server sent `Permissions-Policy: camera=(), microphone=(), geolocation=()` on the app page, which blocked voice questions and GPS weather; now `(self)` as documented in DEPLOYMENT.md / SECURITY.md

- `npm run demo:free` failed at the build step on current Node (spawning `npm.cmd` without a shell is refused since Node 18.20 / 20.12); it now runs Vite directly

- `npm run dev` hung forever when it had to start the local PostgreSQL (`ensure-local-postgres.cjs` captured pg_ctl output that the server keeps open on Windows); now starts in ~3 s

- Admins did not see a new doctor application until they reloaded the page: admins now get a live "New doctor application" notification and the Doctor Verification page and admin dashboard update by themselves (also on returning to the tab and every 30 s as a fallback)
- Role/admin smoke tests and the Playwright suite used the developer's real local database (they failed once the local admin password changed and left test data behind); they now run on isolated temporary data (`SF_DATA_DIR`)

- Doctor registration: step 1 now checks the same password rules as the server (live checklist), a valid email and phone, and whether the email is already registered before step 2; step 1 and step 2 data (including uploaded documents) are kept when going back and forth or refreshing (the password is kept in memory only); specialty and license are asked once; step 2 shows field-level errors and an "Edit account details" shortcut; unused SignupModal with an outdated 6-character rule removed

- Doctors could not upload the same certificate/resume again after an earlier failed or abandoned attempt ("already uploaded"); a leftover copy is now reused, only a document already on another registered account is refused, and picking the same file again in the file picker works

- Irrigation: auto mode now waters by itself as the soil dries (the page used to pin the moisture value); the server ends pump runs on time even if the page is closed; no more invented weekly usage, "45L" or fixed "Tomorrow 6 AM" (real per-date usage and next-watering text); crop changes bring their own threshold; sensor ticks no longer revert saved settings; ~1 request/15 s instead of a re-render loop; background ticks no longer disable the Water Now / Stop buttons; battery drains by time
- All requests now share one in-memory copy of the data, so two simultaneous requests can no longer overwrite each other's changes (and requests no longer reload the whole database from disk and Postgres)
- Google Fonts (incl. Noto Sans Bengali) were blocked by the production Content Security Policy

### Deployment
- Production refuses to start without `DATABASE_URL` (or an explicit `ALLOW_EPHEMERAL_STORAGE=true`) and without `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
- Uploaded documents are stored in Postgres (`app_uploaded_files`) and restored after a redeploy wipes the disk
- Graceful shutdown on `SIGTERM`: pending database writes are flushed; new single-process entry `server/start-production.cjs`
- Production static server: gzip, immutable caching for hashed assets, `no-cache` index.html, 404 for missing assets, 400 (not a crash) for malformed URLs
- `Dockerfile` / `.dockerignore` (multi-stage, non-root, health check) for any container host
- Render deploys only after CI passes (`autoDeployTrigger: checksPass`); the hook workflow is now manual-only (no double, untested deploys)
- Node 22 pinned (`.node-version`, CI); installs use `npm ci --ignore-scripts` (msedge-tts ships a pnpm-only preinstall guard)
- `npm run test:production` (production-mode checks, optional Postgres redeploy test) runs in CI with a Postgres service

### Security
- Doctor documents uploaded during an application that is never submitted are no longer kept forever: unattached uploads are deleted automatically after 24 hours (`UPLOAD_DRAFT_TTL_HOURS`) from disk and Postgres; a registration that references an expired upload is refused with "upload again", and step 2 tells applicants about the 24-hour retention
- Production no longer creates the public demo accounts (`admin123` / `super123`) and refuses those passwords at sign-in
- Client IP for rate limits and lockout no longer trusts the client-supplied part of `X-Forwarded-For` (`TRUST_PROXY_HOPS`, `CLIENT_IP_HEADER`)
- Dependency vulnerabilities fixed without breaking upgrades: 1 critical + 14 high → 0 high/critical (incl. react-router 7.18.5, vite 6.4.5, tar, ws, axios, dompurify)
- Consultation realtime events are delivered only to users allowed to see the case (previously broadcast to every client, including farmer phone numbers)
- Doctors can only change status/advice on their own or open cases (previously any field on any case)
- `DELETE /api/uploads/documents/:id` now requires the owner or an admin for documents attached to an account
- Production 500 responses no longer expose internal error messages
- HSTS is no longer sent for localhost / private-network hosts (prevented pinning `localhost` to HTTPS for a year during local HTTPS dev)

### Planned
- Real backend API integration
- Actual AI disease detection model
- IoT sensor connectivity
- Push notifications
- Service Worker for true offline mode
- Camera API integration
- Payment gateway integration

---

## [1.0.0] - 2026-02-21

### Added - Initial Release 🎉

#### Core Features
- **Disease Detection System**
  - AI-powered crop disease detection (mock)
  - Image upload and camera capture UI
  - Disease identification with confidence percentage
  - Treatment recommendations in Bengali and English
  - Prevention tips and advisory
  - Voice playback support for advisories
  - Save and share functionality
  - Chat assistant for follow-up questions
  - Expert consultation request feature

- **Smart Irrigation Management**
  - Real-time soil moisture monitoring (mock sensor data)
  - Auto-watering mode with toggle control
  - Manual watering controls
  - Moisture level visualization with color-coded gauge
  - Next watering schedule display
  - Weekly usage analytics chart
  - Irrigation policy configuration
  - Low moisture alerts

- **Market Price Tracking**
  - Real-time crop prices from multiple markets
  - Price trend indicators (up/down arrows)
  - 7-day historical price charts
  - Percentage change tracking
  - Market comparison functionality
  - Multiple crop types support

- **Weather Monitoring**
  - Current weather conditions
  - Temperature, humidity, rainfall display
  - Weather alerts (storms, heavy rain)
  - 3-day forecast
  - GPS-based location detection
  - Agricultural weather recommendations

- **Crop Logs**
  - Personal farming activity tracking
  - Planting to harvest timeline
  - Activity recording (planting, watering, fertilizing, etc.)
  - Permission-based sharing with experts
  - Harvest records and yield tracking

- **Expert Consultation System**
  - Browse available agricultural experts
  - Doctor profiles with specialization and ratings
  - Multiple contact methods (call, video, message)
  - Consultation request workflow
  - Consultation history

#### User Management

- **Role-Based Access Control**
  - Guest mode (no login required)
  - Farmer role with full features
  - Doctor role with verification requirement
  - Admin role with system management

- **Doctor Verification System**
  - Admin-controlled verification workflow
  - Pending verification page for doctors
  - Approve/reject functionality with reasons
  - Notification system for verification status
  - Automatic access grant upon approval

- **Authentication**
  - OTP-based login system (demo mode)
  - Guest mode by default
  - Optional cloud sync with login
  - Logout functionality
  - Session persistence

#### Doctor Features

- **Doctor Dashboard**
  - Active consultations count
  - Pending reviews display
  - Performance metrics
  - Quick action buttons

- **Consultation Queue**
  - Active consultations list
  - Priority indicators
  - Farmer information display
  - Disease case summaries
  - Status management

- **Disease Review System**
  - AI detection review workflow
  - Image viewing
  - Expert diagnosis input
  - Approve/modify/correct options
  - Treatment recommendations
  - Notes and feedback

#### Admin Features

- **Admin Dashboard**
  - System overview statistics
  - User counts by role
  - Active consultations tracking
  - Disease detection metrics
  - Quick action links

- **User Management**
  - View all users
  - Search and filter functionality
  - Role management
  - Account status control
  - User activity tracking

- **Doctor Verification**
  - Pending applications queue
  - Credential review interface
  - Approve/reject with comments
  - Verification history
  - Doctor performance monitoring

#### UI/UX

- **Responsive Design**
  - Mobile-first approach (Android portrait optimized)
  - Bottom navigation for mobile
  - Sidebar navigation for desktop
  - Adaptive layouts across breakpoints
  - Touch-friendly interfaces (44px+ targets)

- **Design System**
  - Consistent color-coded status system:
    - Green (70%+): Healthy/Success
    - Blue (50-69%): Moderate/Information
    - Orange (<50%): Warning
    - Red: Critical/Error
  - Enhanced visual hierarchy
  - Prominent alert positioning
  - Discoverable action buttons
  - Professional card styling
  - Gradient backgrounds for emphasis

- **Accessibility**
  - WCAG 2.1 AA compliance
  - Color contrast ratios (4.5:1 minimum)
  - Large touch targets
  - Semantic HTML
  - Screen reader support
  - Voice advisory feature
  - Low literacy design considerations

#### Internationalization

- **Multi-Language Support**
  - Bengali (বাংলা) as default language
  - English language option
  - Real-time language switching
  - Comprehensive translation system
  - 200+ translated strings
  - Cultural considerations for farming terms

#### Components

- **Navigation**
  - MobileNav with bottom navigation
  - Sidebar with role-based menu
  - Active state highlighting
  - Language-aware labels

- **Shared Components**
  - WeatherWidget with forecast
  - VoicePlayer for text-to-speech
  - OnboardingBanner for first-time users
  - RoleSwitcherBanner (demo mode)
  - Alert displays
  - Status badges

#### Technical Infrastructure

- **State Management**
  - React Context API
  - LocalStorage persistence
  - Role-based state
  - Language preferences
  - User session management

- **Routing**
  - React Router v7 (Data mode)
  - Role-based route protection
  - Nested routing structure
  - 404 error handling
  - Redirect logic

- **Data Layer**
  - Mock data infrastructure
  - Type-safe interfaces
  - Comprehensive mock datasets
  - Future API contract definitions

#### Documentation

- **Complete Documentation Package** (200+ pages)
  - System Overview (25 pages)
  - Component Documentation (30 pages)
  - Data Models & API Specs (35 pages)
  - User Guide (40 pages)
  - Development Guide (35 pages)
  - API Integration Guide (30 pages)
  - Deployment Guide (25 pages)
  - UX Improvements Document (15 pages)
  - Documentation Index

### Changed

- **Dashboard Layout**
  - Moved alerts to top for immediate visibility
  - Enhanced card designs with hover states
  - Improved spacing consistency
  - Better visual hierarchy

- **Status Indicators**
  - Standardized color system across all features
  - Added status labels (Healthy/Moderate/Low)
  - Color-coded progress bars
  - Enhanced badge visibility

- **Action Buttons**
  - Increased button sizes for better discoverability
  - Added hover animations and transitions
  - Gradient backgrounds for primary actions
  - Better visual distinction

- **Typography**
  - Increased primary metric sizes (text-4xl)
  - Better font weight hierarchy
  - Improved contrast for readability
  - Optimized for Bengali script

### Fixed

- Alert visibility issues (now prominent at top)
- Inconsistent spacing across cards
- Small touch targets on mobile
- Status color ambiguity
- Information density issues

### Security

- Input sanitization ready (DOMPurify integration planned)
- XSS protection via React
- CSRF protection planned
- Secure header configuration ready
- Row-level security patterns documented

### Performance

- Code splitting structure ready
- Component lazy loading patterns
- Image optimization guidelines
- Bundle size optimizations
- Caching strategy documented

---

## [0.9.0] - 2026-02-15 (Beta)

### Added
- Initial beta release
- Core feature implementation
- Basic UI/UX
- Mock data structure

### Known Issues
- Role switcher should be removed in production
- OTP accepts any 6-digit code (demo mode)
- Voice player is simulated
- All data is mock (no backend)

---

## [0.5.0] - 2026-02-01 (Alpha)

### Added
- Project initialization
- Basic routing structure
- Initial component framework
- Translation system setup

---

## Version History Summary

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-02-21 | Released | Production-ready with mock data |
| 0.9.0 | 2026-02-15 | Beta | Feature complete |
| 0.5.0 | 2026-02-01 | Alpha | Initial development |

---

## Upgrade Guide

### From 0.9.0 to 1.0.0

**Breaking Changes:**
- None (first major release)

**New Features:**
- Complete UX improvements
- Doctor verification system
- Enhanced admin panel
- Comprehensive documentation

**Migration Steps:**
1. Pull latest code
2. Run `npm install`
3. Clear localStorage: `localStorage.clear()`
4. Restart development server

---

## Future Releases

### [1.1.0] - Planned Q2 2026
- Backend API integration
- Real OTP system
- Database connectivity
- User authentication with JWT

### [1.2.0] - Planned Q3 2026
- Real AI disease detection model
- IoT sensor integration
- Camera API implementation
- Push notifications

### [2.0.0] - Planned Q4 2026
- Mobile app (React Native)
- Offline-first with Service Workers
- Payment integration
- Community features
- Marketplace

---

## Deprecation Warnings

### To Be Removed in 1.1.0
- `RoleSwitcherBanner` component (demo only)
- Mock OTP acceptance (any 6 digits)
- All mock data (will use real API)

### To Be Removed in 2.0.0
- LocalStorage for primary data (move to backend)
- Simulated voice player (use Web Speech API)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## Support

- 📧 Email: support@smartfarming.bd
- 💬 GitHub Issues: [Report bugs](https://github.com/miad979/smart_farming/issues)
- 📚 Documentation: [Read the docs](/docs)

---

## Links

- [Homepage](https://smartfarming.bd)
- [Documentation](/docs/INDEX.md)
- [User Guide](/docs/USER_GUIDE.md)
- [API Documentation](/docs/DATA_MODELS.md)

---

**[Unreleased]:** https://github.com/miad979/smart_farming/compare/v1.0.0...HEAD  
**[1.0.0]:** https://github.com/miad979/smart_farming/releases/tag/v1.0.0  
**[0.9.0]:** https://github.com/miad979/smart_farming/releases/tag/v0.9.0  
**[0.5.0]:** https://github.com/miad979/smart_farming/releases/tag/v0.5.0
