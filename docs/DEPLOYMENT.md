# Production Deployment Guide

> Local Mode Override (April 2026): Default deployment target is local API + local storage. Supabase deployment sections are legacy/optional.

## Pre-Deployment Checklist

### Code Quality

- [ ] Remove all `console.log` statements
- [ ] Remove `RoleSwitcherBanner` component
- [ ] Remove demo OTP acceptance (any 6 digits)
- [ ] Remove mock data imports
- [ ] Update all API endpoints to production URLs
- [ ] Run TypeScript type checker: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Fix all linter warnings
- [ ] Run security audit: `npm audit`
- [ ] Fix critical vulnerabilities

### Environment Configuration

- [ ] Create production `.env` file
- [ ] Set all production API keys
- [ ] Configure production database
- [ ] Set up CDN for assets
- [ ] Configure CORS settings
- [ ] Set up SSL certificates
- [ ] Configure domain DNS

### Testing

- [ ] All features tested on real devices
- [ ] Tested on Android (Chrome)
- [ ] Tested on iOS (Safari)
- [ ] Tested on desktop (Chrome, Firefox, Edge)
- [ ] Bengali language fully tested
- [ ] English language fully tested
- [ ] All user roles tested (Farmer, Doctor, Admin)
- [ ] Performance testing completed
- [ ] Load testing completed
- [ ] Security testing completed

### Documentation

- [ ] README updated
- [ ] API documentation finalized
- [ ] User guide reviewed
- [ ] Admin guide created
- [ ] Changelog updated
- [ ] License file added

### Monitoring

- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (Google Analytics/Mixpanel)
- [ ] Performance monitoring setup
- [ ] Uptime monitoring configured
- [ ] Log aggregation setup

---

## Build Configuration

### Production Build

```bash
# Create optimized production build
npm run build

# Preview build locally
npm run preview

# Test production build
# Open http://localhost:4173
```

### Build Optimization

**vite.config.ts:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router'],
          'charts': ['recharts'],
          'icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
```

---

## Deployment Platforms

### Option 1: Vercel (Recommended)

**Steps:**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

**vercel.json:**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Option 2: Netlify

**Steps:**

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

**netlify.toml:**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### Option 3: AWS S3 + CloudFront

**Setup:**

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://smartfarming-app
   ```

2. **Configure Static Website Hosting**
   ```bash
   aws s3 website s3://smartfarming-app \
     --index-document index.html \
     --error-document index.html
   ```

3. **Upload Build**
   ```bash
   aws s3 sync dist/ s3://smartfarming-app --delete
   ```

4. **Create CloudFront Distribution**
   - Point to S3 bucket
   - Enable HTTPS
   - Configure custom domain
   - Set up caching rules

### Option 4: Docker + Custom Server

**Dockerfile:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf:**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Deploy:**

```bash
# Build image
docker build -t smartfarming:latest .

# Run container
docker run -d -p 80:80 smartfarming:latest

# Or push to registry
docker tag smartfarming:latest your-registry/smartfarming:latest
docker push your-registry/smartfarming:latest
```

---

## Environment Variables (Production)

### Create .env.production

```env
# API Configuration
VITE_API_URL=https://api.smartfarming.bd/v1
VITE_API_TIMEOUT=15000

# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-key

# Third-party Services
VITE_WEATHER_API_KEY=your-production-weather-key
VITE_SMS_API_KEY=your-production-sms-key
VITE_MAPS_API_KEY=your-production-maps-key

# Monitoring
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=production
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
VITE_MIXPANEL_TOKEN=your-mixpanel-token

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_TRACKING=true
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_BETA_FEATURES=false

# Security
VITE_ENABLE_HTTPS_ONLY=true
VITE_CSRF_PROTECTION=true
```

### Secure Environment Variables

**Never commit `.env` files!**

**For Vercel:**
```bash
vercel env add VITE_API_URL
# Enter value when prompted
```

**For Netlify:**
```bash
netlify env:set VITE_API_URL "https://api.smartfarming.bd/v1"
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load routes
import { lazy } from 'react';

const DiseaseDetection = lazy(() => import('./pages/DiseaseDetection'));
const Irrigation = lazy(() => import('./pages/Irrigation'));
const MarketPrices = lazy(() => import('./pages/MarketPrices'));
```

### Image Optimization

```bash
# Install image optimization tools
npm install -D vite-plugin-imagemin

# Configure in vite.config.ts
import viteImagemin from 'vite-plugin-imagemin';

export default defineConfig({
  plugins: [
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: {
        plugins: [
          { name: 'removeViewBox', active: false },
          { name: 'removeEmptyAttrs', active: true },
        ],
      },
    }),
  ],
});
```

### Bundle Analysis

```bash
# Install bundle analyzer
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});

# Run build and view analysis
npm run build
```

### Lighthouse Score Goals

- **Performance**: 90+
- **Accessibility**: 95+
- **Best Practices**: 95+
- **SEO**: 90+

---

## Security Hardening

### Content Security Policy

**Add to index.html:**

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.smartfarming.bd https://*.supabase.co;
  frame-ancestors 'none';
">
```

### Security Headers

Configure in server/CDN:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(self)
```

### Input Sanitization

```typescript
// src/app/utils/sanitize.ts
import DOMPurify from 'dompurify';

export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  });
};
```

---

## Monitoring Setup

### Error Tracking (Sentry)

```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 1.0,
    beforeSend(event, hint) {
      // Filter out known issues
      if (event.exception?.values?.[0]?.value?.includes('ChunkLoadError')) {
        return null; // Don't send
      }
      return event;
    },
  });
}
```

### Analytics (Google Analytics)

```typescript
// src/app/utils/analytics.ts
import ReactGA from 'react-ga4';

export const initAnalytics = () => {
  if (import.meta.env.PROD && import.meta.env.VITE_GA_TRACKING_ID) {
    ReactGA.initialize(import.meta.env.VITE_GA_TRACKING_ID);
  }
};

export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: 'pageview', page: path });
};

export const trackEvent = (category: string, action: string, label?: string) => {
  ReactGA.event({
    category,
    action,
    label,
  });
};
```

**Use in App:**

```typescript
// src/app/App.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { initAnalytics, trackPageView } from './utils/analytics';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

  return <RouterProvider router={router} />;
}
```

### Performance Monitoring

```typescript
// src/app/utils/performance.ts

export const measurePerformance = () => {
  if ('PerformanceObserver' in window) {
    // Measure Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.startTime);
      // Send to analytics
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Measure First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        console.log('FID:', entry.processingStart - entry.startTime);
        // Send to analytics
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Measure Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsScore += (entry as any).value;
        }
      }
      console.log('CLS:', clsScore);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }
};
```

---

## Database Migration

### Supabase Setup

```sql
-- Run these migrations in Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_name VARCHAR(255) NOT NULL,
  user_name_bn VARCHAR(255),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('farmer', 'doctor', 'admin')),
  status VARCHAR(20) DEFAULT 'active',
  language VARCHAR(2) DEFAULT 'bn',
  location JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP,
  settings JSONB
);

-- Create indexes
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin can view all
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Data Migration Script

```typescript
// scripts/migrate-data.ts
import { createClient } from '@supabase/supabase-js';
import { mockUsers } from '../src/app/utils/mockData';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateUsers() {
  console.log('Migrating users...');
  
  for (const user of mockUsers) {
    const { error } = await supabase.from('users').insert({
      user_name: user.userName,
      user_name_bn: user.userName_bn,
      phone: user.phone,
      role: user.role,
      status: user.status,
      language: user.language,
    });

    if (error) {
      console.error('Failed to migrate user:', user.userId, error);
    } else {
      console.log('Migrated user:', user.userId);
    }
  }

  console.log('Migration complete!');
}

migrateUsers();
```

---

## Backup Strategy

### Automated Backups

```bash
# Daily database backup (cron job)
0 2 * * * /scripts/backup-db.sh

# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > /backups/smartfarming_$DATE.sql
gzip /backups/smartfarming_$DATE.sql

# Upload to S3
aws s3 cp /backups/smartfarming_$DATE.sql.gz s3://smartfarming-backups/

# Keep only last 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Disaster Recovery Plan

1. **Backup Frequency**: Daily at 2 AM
2. **Backup Retention**: 30 days
3. **Recovery Time Objective (RTO)**: 4 hours
4. **Recovery Point Objective (RPO)**: 24 hours

---

## Monitoring Checklist

### Metrics to Monitor

- [ ] **Uptime**: Target 99.9%
- [ ] **Response Time**: < 2 seconds
- [ ] **Error Rate**: < 0.1%
- [ ] **API Success Rate**: > 99%
- [ ] **Page Load Time**: < 3 seconds
- [ ] **Mobile Performance**: Lighthouse score > 90

### Alerts to Configure

- [ ] API downtime
- [ ] Error rate spike (> 1%)
- [ ] Slow response time (> 5s)
- [ ] High memory usage (> 80%)
- [ ] Database connection issues
- [ ] SSL certificate expiration

---

## Launch Checklist

### Week Before Launch

- [ ] Code freeze
- [ ] Final testing round
- [ ] Security audit
- [ ] Performance testing
- [ ] Backup verification
- [ ] Documentation review
- [ ] Support team training
- [ ] Monitoring setup verification

### Day Before Launch

- [ ] Database migration rehearsal
- [ ] Rollback plan tested
- [ ] Team on standby
- [ ] Communication plan ready
- [ ] Status page prepared

### Launch Day

- [ ] Deploy to production
- [ ] Verify all features working
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Test user flows
- [ ] Announce launch
- [ ] Monitor social media
- [ ] Ready to rollback if needed

### Week After Launch

- [ ] Daily monitoring
- [ ] User feedback collection
- [ ] Bug triage
- [ ] Performance optimization
- [ ] Post-mortem meeting

---

## Rollback Plan

### Quick Rollback

```bash
# Vercel
vercel rollback

# Netlify
netlify rollback

# Docker
docker stop smartfarming-new
docker start smartfarming-old

# Manual
git revert HEAD
npm run build
# Deploy previous version
```

### Database Rollback

```bash
# Restore from backup
psql $DATABASE_URL < /backups/smartfarming_YYYYMMDD.sql

# Or use Supabase dashboard:
# Settings → Database → Backups → Restore
```

---

## Post-Launch Maintenance

### Daily Tasks

- Monitor error logs
- Check performance metrics
- Review user feedback
- Respond to support tickets

### Weekly Tasks

- Review analytics
- Update documentation
- Bug fixes
- Minor improvements

### Monthly Tasks

- Security updates
- Dependency updates
- Performance audit
- Backup verification
- Team retrospective

### Quarterly Tasks

- Major feature releases
- Infrastructure review
- Security audit
- Disaster recovery drill

---

## Support Resources

### Documentation

- User Guide: `/docs/USER_GUIDE.md`
- API Docs: `/docs/DATA_MODELS.md`
- Development Guide: `/docs/DEVELOPMENT.md`

### Monitoring Dashboards

- Uptime: https://status.smartfarming.bd
- Analytics: Google Analytics Dashboard
- Errors: Sentry Dashboard
- Performance: Lighthouse CI

### Emergency Contacts

- DevOps: devops@smartfarming.bd
- Security: security@smartfarming.bd
- Support: support@smartfarming.bd

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Production Ready Guide
