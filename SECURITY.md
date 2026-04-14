# Security Policy

## Our Commitment to Security

The Smart Farming Management System takes security seriously. We are committed to protecting farmers' data and ensuring the integrity of our agricultural platform.

---

## Supported Versions

We release security updates for the following versions:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 1.0.x   | :white_check_mark: | Current stable release |
| 0.9.x   | :x:                | Beta - upgrade to 1.0.x |
| < 0.9   | :x:                | No longer supported |

**Recommendation:** Always use the latest stable version.

---

## Reporting a Vulnerability

### How to Report

**We take security vulnerabilities seriously.** If you discover a security issue, please report it responsibly.

**DO NOT** create a public GitHub issue for security vulnerabilities.

**Instead, please:**

1. **Email us:** security@smartfarming.bd
2. **Subject line:** `[SECURITY] Brief description`
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
   - Your contact information

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 5 business days
- **Progress updates:** Every 7 days
- **Fix timeline:** Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Next release cycle

### Disclosure Policy

- We will work with you to understand the vulnerability
- We will keep you informed of our progress
- Once fixed, we will publicly disclose the vulnerability
- You will be credited (unless you prefer to remain anonymous)

---

## Security Features

### Current Implementation

#### Authentication & Authorization

- **OTP-based authentication** (production will use secure SMS provider)
- **Role-based access control** (RBAC)
- **Session management** via secure tokens
- **Guest mode** for privacy-conscious users

#### Data Protection

- **Local-first storage** - Data stays on device by default
- **Optional cloud sync** - User controls data sharing
- **Encryption at rest** (planned for backend)
- **Encryption in transit** (HTTPS only in production)

#### Input Validation

- **React's built-in XSS protection**
- **Input sanitization** (DOMPurify integration ready)
- **Type checking** via TypeScript
- **Form validation** on all user inputs

#### API Security

- **Strict CORS allowlist** (origin-based)
- **Route-aware rate limiting** (backend)
- **Signed, expiring access tokens**
- **API key rotation** (planned)

#### Backend Hardening (Local API)

- **Password hashing:** PBKDF2-SHA256 with per-user salt and 120000 iterations
- **Token integrity:** HMAC-signed bearer tokens with configurable expiration
- **Request limits:** JSON payload size cap to reduce abuse risk
- **Secure response defaults:** no-store caching headers and hardening headers
- **Auditability:** admin-sensitive actions recorded in audit logs
- **Role controls:** admin/super-admin privilege boundaries enforced server-side

---

## Security Best Practices

### For Users

#### Farmers

- ✅ Use strong OTP verification
- ✅ Don't share your login credentials
- ✅ Log out on shared devices
- ✅ Be cautious with crop log sharing
- ✅ Review permissions granted to doctors
- ✅ Report suspicious activity

#### Doctors

- ✅ Protect patient privacy
- ✅ Only access shared crop logs
- ✅ Don't share patient information
- ✅ Use secure connections
- ✅ Log out when done

#### Administrators

- ✅ Verify doctor credentials thoroughly
- ✅ Monitor system for unusual activity
- ✅ Keep access credentials secure
- ✅ Review security logs regularly
- ✅ Follow principle of least privilege

### For Developers

#### Code Security

```typescript
// ✅ DO: Sanitize user input
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);

// ❌ DON'T: Use dangerouslySetInnerHTML with user input
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // NEVER!

// ✅ DO: Validate and type-check inputs
const validatePhone = (phone: string): boolean => {
  return /^\+880\d{10}$/.test(phone);
};

// ❌ DON'T: Trust user input
const userId = req.body.userId; // Validate this!
```

#### Authentication

```typescript
// ✅ DO: Use secure token storage
const token = localStorage.getItem('smartFarming_token');
// Clear on logout
localStorage.removeItem('smartFarming_token');

// ❌ DON'T: Store sensitive data in localStorage
localStorage.setItem('password', password); // NEVER!

// ✅ DO: Implement token expiration
const isTokenExpired = (token: string): boolean => {
  const decoded = jwt.decode(token);
  return decoded.exp < Date.now() / 1000;
};
```

#### API Calls

```typescript
// ✅ DO: Use environment variables for sensitive config
const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

// ❌ DON'T: Hardcode secrets
const API_KEY = 'sk_live_12345'; // NEVER!

// ✅ DO: Validate responses
const response = await api.get('/data');
if (!response || !response.data) {
  throw new Error('Invalid response');
}
```

---

## Known Security Considerations

### Current Version (1.0.0)

#### Demo Mode Limitations

⚠️ **The following are for DEMO purposes only and must be changed in production:**

1. **OTP Acceptance**
   - Currently accepts any 6-digit code
   - **Production:** Integrate real SMS provider
   - **Risk:** Unauthorized access

2. **Role Switcher**
   - Demo banner allows instant role switching
   - **Production:** Remove `RoleSwitcherBanner` component
   - **Risk:** Unauthorized privilege escalation

3. **Mock Data**
   - All data is simulated
   - **Production:** Use real database with proper security
   - **Risk:** No real data protection

#### Client-Side Storage

- LocalStorage is used for data persistence
- **Limitation:** Data is unencrypted in browser
- **Mitigation:** Don't store sensitive data; use for preferences only
- **Production:** Move sensitive data to secure backend

#### Backend Deployment Requirements

For production deployments of the local API middleware, set these environment variables:

- `AUTH_TOKEN_SECRET`: high-entropy secret for signing access tokens (required in production)
- `AUTH_TOKEN_TTL_MS`: token lifetime in milliseconds (default 12 hours)
- `CORS_ALLOWED_ORIGINS`: comma-separated origin allowlist
- `MAX_JSON_BODY_BYTES`: maximum accepted JSON request size
- `LEGACY_DEMO_TOKEN_FALLBACK=false`: keep disabled in production

Without a fixed `AUTH_TOKEN_SECRET`, tokens become invalid after server restart.

#### Secret Rotation Schedule (Required)

- Rotate `AUTH_TOKEN_SECRET` at least every 30 days.
- Rotate immediately after any suspected leak, incident, or staff access change.
- Keep exactly two active secrets during rotation (current + previous) and phase out previous after max token TTL.
- Store secrets only in deployment secret managers (never in source control).

#### Session & CSRF Model

- Access token is set as `HttpOnly` cookie (`sf_access_token`) with `SameSite=Lax`.
- CSRF token is set as `sf_csrf` cookie and must be sent in `X-CSRF-Token` for authenticated write requests.
- Client-side localStorage/sessionStorage should not store bearer tokens.

#### Account Lockout & Alerts

- Repeated failed sign-ins trigger temporary account lockout.
- Lockout and repeated failures are written to audit logs.
- Admin/security users receive security alerts for lockout events.

#### CI Security Automation

- Dependency scanning: `npm audit --audit-level=high` in CI.
- Automated security integration checks: `npm run test:security`.
- Scheduled weekly security workflow to detect newly disclosed vulnerabilities.

---

## Vulnerability Categories

### Critical (Immediate Action Required)

- Remote code execution
- SQL injection (when backend added)
- Authentication bypass
- Data breach

**Response Time:** 24-48 hours

### High (Urgent)

- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Privilege escalation
- Unauthorized data access

**Response Time:** 3-7 days

### Medium (Important)

- Information disclosure
- Session management issues
- Input validation problems
- Weak encryption

**Response Time:** 7-30 days

### Low (Nice to Fix)

- Minor information leaks
- Best practice violations
- Deprecated dependencies

**Response Time:** Next release cycle

---

## Security Checklist for Production

### Pre-Deployment Security Audit

- [ ] Remove demo/development features
  - [ ] Remove `RoleSwitcherBanner`
  - [ ] Remove mock OTP acceptance
  - [ ] Remove mock data
  - [ ] Remove console.log statements

- [ ] Implement proper authentication
  - [ ] Real OTP via SMS provider
  - [ ] JWT token authentication
  - [ ] Token refresh mechanism
  - [ ] Secure session management

- [ ] Backend security
  - [ ] Input validation on server
  - [ ] SQL injection prevention
  - [ ] Rate limiting
  - [ ] CORS configuration
  - [ ] API authentication

- [ ] Data protection
  - [ ] HTTPS only
  - [ ] Encryption at rest
  - [ ] Encryption in transit
  - [ ] Secure headers
  - [ ] CSP configuration

- [ ] Access control
  - [ ] Role-based permissions
  - [ ] Row-level security (RLS)
  - [ ] API key management
  - [ ] Service account security

- [ ] Monitoring
  - [ ] Security logging
  - [ ] Intrusion detection
  - [ ] Error tracking (Sentry)
  - [ ] Audit trails

### Security Headers

Configure these headers in production:

```nginx
# Security Headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(self), camera=(self)" always;
```

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://trusted-cdn.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.smartfarming.bd;
  frame-ancestors 'none';
">
```

---

## Dependency Security

### Automated Scanning

```bash
# Run npm audit
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

### Dependency Updates

- **Regular updates:** Monthly security patch review
- **Critical updates:** Immediate for security fixes
- **Testing:** All updates tested before deployment
- **Lockfile:** Use package-lock.json or pnpm-lock.yaml

### Known Vulnerabilities

Check [GitHub Security Advisories](https://github.com/advisories) regularly.

---

## Incident Response Plan

### If a Security Breach Occurs

1. **Immediate Actions (0-1 hour)**
   - Contain the breach
   - Preserve evidence
   - Notify security team
   - Begin incident log

2. **Assessment (1-4 hours)**
   - Determine scope of breach
   - Identify affected systems/users
   - Assess data exposure
   - Evaluate attack vector

3. **Mitigation (4-24 hours)**
   - Patch vulnerability
   - Reset compromised credentials
   - Notify affected users
   - Deploy fixes

4. **Recovery (24-72 hours)**
   - Restore normal operations
   - Monitor for further attacks
   - Verify fix effectiveness

5. **Post-Incident (1-2 weeks)**
   - Complete investigation report
   - Update security measures
   - Conduct team debrief
   - Public disclosure (if appropriate)
   - Improve processes

---

## Security Contacts

### Reporting

- **Email:** security@smartfarming.bd
- **PGP Key:** [Coming soon]
- **Response Time:** 48 hours

### Escalation

- **Critical issues:** Call +880-XXX-XXXXXX
- **After hours:** security-urgent@smartfarming.bd

---

## Security Resources

### For Developers

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://react.dev/learn/security)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

### For Users

- [Staying Safe Online](https://staysafeonline.org/)
- [Privacy Rights](https://www.privacyrights.org/)

---

## Compliance

### Data Protection

- **GDPR considerations** (if applicable)
- **Local data protection laws** (Bangladesh)
- **Agricultural data privacy**
- **Health data protection** (for consultations)

### Standards

- Following [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) guidelines
- Implementing [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Privacy Policy

For information about how we collect and use data, see our [Privacy Policy](PRIVACY.md) (coming soon).

Key points:
- Data minimization
- User consent required
- Transparent data usage
- Right to deletion
- Data portability

---

## Updates to This Policy

This security policy is reviewed and updated:
- Quarterly (routine review)
- After security incidents
- When adding new features
- When vulnerabilities are discovered

**Last Updated:** February 2026  
**Next Review:** May 2026

---

## Acknowledgments

We thank the security research community for responsibly disclosing vulnerabilities. Contributors will be acknowledged in our [Security Hall of Fame](SECURITY_HALL_OF_FAME.md) (coming soon).

---

## Bug Bounty Program

**Status:** Coming soon

We plan to launch a bug bounty program to reward security researchers who help us keep Smart Farming secure.

**Rewards:**
- Critical: $500 - $2,000
- High: $200 - $500
- Medium: $50 - $200
- Low: Recognition

---

**Questions about security?**  
Contact: security@smartfarming.bd

**Thank you for helping keep Smart Farming secure!** 🔒🌾
