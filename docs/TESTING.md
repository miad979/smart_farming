# Testing Guide

## Overview

This guide covers testing strategies, patterns, and best practices for the Smart Farming Management System. While the current version (1.0.0) uses manual testing, this document prepares for automated testing implementation.

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Manual Testing](#manual-testing)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Accessibility Testing](#accessibility-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [Branch Protection](#branch-protection)
- [Testing Checklist](#testing-checklist)

---

## Testing Philosophy

### Testing Pyramid

```
         /\
        /  \    E2E Tests (Few)
       /----\   
      /      \  Integration Tests (Some)
     /--------\ 
    /          \ Unit Tests (Many)
   /____________\
```

**Priorities:**
1. **Many unit tests** - Fast, isolated, specific
2. **Some integration tests** - Component interactions
3. **Few E2E tests** - Critical user flows

### Goals

- ✅ Prevent regressions
- ✅ Document expected behavior
- ✅ Enable confident refactoring
- ✅ Catch bugs early
- ✅ Ensure accessibility
- ✅ Verify performance

---

## Manual Testing

### Current Version (1.0.0)

All testing is currently manual. Follow this comprehensive checklist before each release.

### Pre-Release Manual Testing Checklist

#### 🌐 Browser Testing

**Desktop Browsers:**
- [ ] Chrome (latest version)
- [ ] Firefox (latest version)
- [ ] Safari (latest version)
- [ ] Edge (latest version)

**Mobile Browsers:**
- [ ] Chrome on Android
- [ ] Safari on iOS
- [ ] Samsung Internet

**Test in each browser:**
- [ ] All pages load correctly
- [ ] Navigation works
- [ ] Forms submit properly
- [ ] Charts render correctly
- [ ] Images display
- [ ] No console errors

#### 📱 Device Testing

**Screen Sizes:**
- [ ] 320px width (Small mobile)
- [ ] 375px width (iPhone SE)
- [ ] 414px width (iPhone Pro Max)
- [ ] 768px width (Tablet)
- [ ] 1024px width (Desktop)
- [ ] 1920px width (Large desktop)

**Test on each size:**
- [ ] Layout is responsive
- [ ] Navigation is accessible
- [ ] Touch targets are adequate (44px+)
- [ ] Text is readable
- [ ] No horizontal scrolling
- [ ] Charts scale properly

#### 🌍 Language Testing

**Bengali (বাংলা):**
- [ ] All UI text in Bengali
- [ ] Chart labels in Bengali
- [ ] Error messages in Bengali
- [ ] Date/time formats correct
- [ ] Numbers formatted correctly
- [ ] Voice player works (when implemented)

**English:**
- [ ] All UI text in English
- [ ] Can toggle to Bengali and back
- [ ] Preference persists across sessions

#### 👥 Role Testing

**Guest User:**
- [ ] Can view dashboard
- [ ] Can detect diseases
- [ ] Can check irrigation
- [ ] Can view prices
- [ ] Can see weather
- [ ] Cannot save results
- [ ] Cannot request consultations
- [ ] See "Login" prompts appropriately

**Farmer (Logged In):**
- [ ] All guest features work
- [ ] Can login with OTP
- [ ] Can save disease scans
- [ ] Can manage crop logs
- [ ] Can request consultations
- [ ] Can share crop logs
- [ ] Can logout
- [ ] Session persists

**Doctor (Unverified):**
- [ ] Cannot access doctor panel
- [ ] See verification pending page
- [ ] Can use basic features
- [ ] Clear messaging about status

**Doctor (Verified):**
- [ ] Can access doctor dashboard
- [ ] Can view consultation queue
- [ ] Can review disease scans
- [ ] Can access shared crop logs
- [ ] Can provide consultations
- [ ] Cannot access admin features

**Admin:**
- [ ] Can access admin dashboard
- [ ] Can view all users
- [ ] Can manage users
- [ ] Can verify doctors
- [ ] Can see system analytics
- [ ] Full system access

#### 🎯 Feature Testing

**Disease Detection:**
- [ ] Upload photo works
- [ ] Camera capture works (when implemented)
- [ ] AI analysis displays correctly
- [ ] Confidence percentage shows
- [ ] Advisory text displays
- [ ] Voice player works
- [ ] Save button works (logged in)
- [ ] Share button works
- [ ] Chat assistant works
- [ ] Expert consultation request works
- [ ] Results in history (logged in)

**Irrigation:**
- [ ] Moisture level displays correctly
- [ ] Color-coded status (green/blue/orange)
- [ ] Auto-mode toggle works
- [ ] Manual water button works
- [ ] Next watering time shows
- [ ] Usage chart renders
- [ ] Alerts display
- [ ] Policy settings show

**Market Prices:**
- [ ] Current prices display
- [ ] Trend indicators show (↑↓)
- [ ] Price change percentages correct
- [ ] Historical chart renders
- [ ] Multiple crops display
- [ ] Multiple markets display
- [ ] Data refreshes

**Weather:**
- [ ] Current temperature shows
- [ ] Weather condition displays
- [ ] Humidity and rainfall show
- [ ] Weather alerts display (when present)
- [ ] 3-day forecast shows
- [ ] Icons render correctly
- [ ] Location is correct

**Consultations:**
- [ ] Expert list displays
- [ ] Can filter by specialization
- [ ] Doctor profiles show
- [ ] Contact methods work
- [ ] Consultation history shows
- [ ] Status updates correctly

**Crop Logs:**
- [ ] Can create new log
- [ ] Can add activities
- [ ] Can upload photos
- [ ] Can share with doctor
- [ ] Can revoke access
- [ ] Permission system works
- [ ] Timeline displays correctly

**Admin - User Management:**
- [ ] User list displays
- [ ] Search works
- [ ] Filters work
- [ ] Can view user details
- [ ] Can change roles
- [ ] Can suspend users
- [ ] Activity tracking shows

**Admin - Doctor Verification:**
- [ ] Pending queue displays
- [ ] Can view application details
- [ ] Can approve doctors
- [ ] Can reject with reason
- [ ] Notifications sent
- [ ] History tracked

#### 🔄 State Management

**Context State:**
- [ ] Language persists across pages
- [ ] User role maintained
- [ ] Login state persists
- [ ] Logout clears state correctly
- [ ] Settings saved to localStorage
- [ ] Navigation respects role

#### 🚨 Error Handling

**Network Errors:**
- [ ] Offline message displays
- [ ] Graceful degradation
- [ ] Cached data shows when offline
- [ ] Error messages are user-friendly
- [ ] Error messages in correct language

**Form Validation:**
- [ ] Required fields validated
- [ ] Format validation (phone, email)
- [ ] Error messages clear
- [ ] Cannot submit invalid forms

**Edge Cases:**
- [ ] Empty states handled
- [ ] Loading states show
- [ ] Long text doesn't break layout
- [ ] Large images handled
- [ ] Network timeouts handled

#### ♿ Accessibility

**Keyboard Navigation:**
- [ ] Tab order is logical
- [ ] Can navigate entire app with keyboard
- [ ] Focus indicators visible
- [ ] Skip links work
- [ ] Modal traps focus appropriately

**Screen Reader:**
- [ ] All images have alt text
- [ ] Form labels associated
- [ ] ARIA labels where needed
- [ ] Headings hierarchical
- [ ] Announcements for dynamic content

**Color Contrast:**
- [ ] Text contrast ≥ 4.5:1
- [ ] Interactive elements ≥ 3:1
- [ ] Status not by color alone

#### 🚀 Performance

**Load Times:**
- [ ] Initial page load < 3 seconds
- [ ] Time to interactive < 5 seconds
- [ ] Charts load smoothly
- [ ] Images optimized
- [ ] No layout shift

**Responsiveness:**
- [ ] Actions respond immediately
- [ ] No lag in interactions
- [ ] Smooth animations
- [ ] No memory leaks (long sessions)

---

## Branch Protection

To enforce merge blocking based on UI checks:

1. Require this status check in branch protection:
  required-ui-smoke
2. Enable "Require branches to be up to date before merging".
3. Apply the rule to main (and master if used).

See [Branch Protection Setup](./BRANCH_PROTECTION.md) for full steps.

---

## Unit Testing

### Setup (Future Implementation)

```bash
# Install testing libraries
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Testing Components

```typescript
// src/app/components/__tests__/WeatherWidget.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherWidget } from '../WeatherWidget';
import { AppProvider } from '../../context/AppContext';

describe('WeatherWidget', () => {
  it('renders weather data', () => {
    render(
      <AppProvider>
        <WeatherWidget />
      </AppProvider>
    );
    
    expect(screen.getByText(/temperature/i)).toBeInTheDocument();
    expect(screen.getByText(/humidity/i)).toBeInTheDocument();
  });

  it('displays in Bengali when language is bn', () => {
    // Mock context with Bengali language
    render(
      <AppProvider initialState={{ language: 'bn' }}>
        <WeatherWidget />
      </AppProvider>
    );
    
    expect(screen.getByText(/তাপমাত্রা/)).toBeInTheDocument();
  });

  it('shows weather alerts when present', () => {
    // Test alert display
  });
});
```

### Testing Utilities

```typescript
// src/app/utils/__tests__/translations.test.ts
import { describe, it, expect } from 'vitest';
import { t, translations } from '../translations';

describe('translations', () => {
  it('returns Bengali text when lang is bn', () => {
    expect(t('welcome', 'bn')).toBe('স্বাগতম');
  });

  it('returns English text when lang is en', () => {
    expect(t('welcome', 'en')).toBe('Welcome');
  });

  it('has translations for all keys in both languages', () => {
    Object.keys(translations).forEach(key => {
      expect(translations[key]).toHaveProperty('bn');
      expect(translations[key]).toHaveProperty('en');
    });
  });
});
```

### Testing Hooks

```typescript
// src/app/hooks/__tests__/useOnlineStatus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  it('returns true when online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current).toBe(true);
  });

  it('returns false when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current).toBe(false);
  });

  it('updates when online status changes', () => {
    const { result } = renderHook(() => useOnlineStatus());
    
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    expect(result.current).toBe(false);
    
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    expect(result.current).toBe(true);
  });
});
```

### Testing Services

```typescript
// src/app/services/__tests__/disease.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diseaseService } from '../disease.service';
import { apiService } from '../api.service';

vi.mock('../api.service');

describe('DiseaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectDisease', () => {
    it('uploads image and returns detection', async () => {
      const mockDetection = {
        disease: 'Late Blight',
        confidence: 87,
      };
      
      vi.spyOn(apiService, 'upload').mockResolvedValue(mockDetection);
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await diseaseService.detectDisease(file, 'user_123');
      
      expect(result).toEqual(mockDetection);
      expect(apiService.upload).toHaveBeenCalledWith(
        '/api/disease/detect',
        file,
        expect.any(Function)
      );
    });

    it('reports upload progress', async () => {
      const progressCallback = vi.fn();
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      await diseaseService.detectDisease(file, 'user_123', undefined, progressCallback);
      
      expect(progressCallback).toHaveBeenCalled();
    });

    it('throws error on failure', async () => {
      vi.spyOn(apiService, 'upload').mockRejectedValue(new Error('Network error'));
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      await expect(
        diseaseService.detectDisease(file, 'user_123')
      ).rejects.toThrow('Disease detection failed');
    });
  });

  describe('getHistory', () => {
    it('fetches user detection history', async () => {
      const mockHistory = [
        { scanId: '1', disease: 'Late Blight' },
        { scanId: '2', disease: 'Rust' },
      ];
      
      vi.spyOn(apiService, 'get').mockResolvedValue({ detections: mockHistory });
      
      const result = await diseaseService.getHistory('user_123');
      
      expect(result).toEqual(mockHistory);
      expect(apiService.get).toHaveBeenCalledWith('/api/disease/history', {
        userId: 'user_123',
        limit: 20,
      });
    });
  });
});
```

---

## Integration Testing

### Testing Component Interactions

```typescript
// src/app/pages/__tests__/Dashboard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { AppProvider } from '../../context/AppContext';
import { BrowserRouter } from 'react-router';

describe('Dashboard', () => {
  it('displays all dashboard sections', async () => {
    render(
      <BrowserRouter>
        <AppProvider>
          <Dashboard />
        </AppProvider>
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/weather/i)).toBeInTheDocument();
      expect(screen.getByText(/irrigation/i)).toBeInTheDocument();
      expect(screen.getByText(/disease/i)).toBeInTheDocument();
      expect(screen.getByText(/prices/i)).toBeInTheDocument();
    });
  });

  it('shows alerts when present', () => {
    // Test alert display
  });

  it('adapts to user role', () => {
    // Test role-based rendering
  });
});
```

### Testing User Flows

```typescript
// src/app/__tests__/authentication.flow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('Authentication Flow', () => {
  it('allows user to login with OTP', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Navigate to profile
    await user.click(screen.getByRole('link', { name: /profile/i }));
    
    // Click login button
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    // Enter phone number
    await user.type(screen.getByLabelText(/phone/i), '+8801712345678');
    await user.click(screen.getByRole('button', { name: /send otp/i }));
    
    // Enter OTP
    await waitFor(() => {
      expect(screen.getByLabelText(/otp/i)).toBeInTheDocument();
    });
    
    await user.type(screen.getByLabelText(/otp/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));
    
    // Check logged in
    await waitFor(() => {
      expect(screen.getByText(/logged in/i)).toBeInTheDocument();
    });
  });

  it('handles OTP errors gracefully', async () => {
    // Test error handling
  });
});
```

---

## End-to-End Testing

### Setup with Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

### E2E Test Example

```typescript
// tests/e2e/disease-detection.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Disease Detection Flow', () => {
  test('complete disease detection flow', async ({ page }) => {
    // Navigate to disease detection
    await page.goto('/detect');
    
    // Upload image
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/leaf.jpg');
    
    // Wait for analysis
    await expect(page.locator('[data-testid="analysis-result"]')).toBeVisible({
      timeout: 10000,
    });
    
    // Check results
    const disease = await page.locator('[data-testid="disease-name"]').textContent();
    expect(disease).toBeTruthy();
    
    const confidence = await page.locator('[data-testid="confidence"]').textContent();
    expect(parseInt(confidence!)).toBeGreaterThan(0);
    
    // Check advisory
    await expect(page.locator('[data-testid="advisory"]')).toBeVisible();
    
    // Test save functionality (logged in users)
    // Test voice player
    // Test chat assistant
  });

  test('works in Bengali', async ({ page }) => {
    await page.goto('/detect');
    
    // Switch to Bengali
    await page.click('[data-testid="language-toggle"]');
    
    // Check UI is in Bengali
    await expect(page.locator('text=রোগ শনাক্তকরণ')).toBeVisible();
  });
});
```

### Critical Paths to Test

1. **Disease Detection Flow**
   - Upload → Analyze → View Results → Save/Share

2. **Consultation Flow**
   - Browse Doctors → Request → Message → Complete

3. **Irrigation Control**
   - View Status → Toggle Auto → Manual Water

4. **Admin Verification**
   - View Applications → Review → Approve/Reject

---

## Accessibility Testing

### Automated Tools

```bash
# Install axe-core
npm install -D @axe-core/playwright
```

### Accessibility Test

```typescript
// tests/a11y/dashboard.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('dashboard should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('supports keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Check focus visible
    const focused = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    
    expect(['A', 'BUTTON', 'INPUT']).toContain(focused);
  });
});
```

### Manual A11y Checklist

- [ ] Keyboard navigation works
- [ ] Screen reader announces properly
- [ ] Color contrast sufficient
- [ ] Focus indicators visible
- [ ] Alt text on images
- [ ] ARIA labels present
- [ ] Heading hierarchy correct
- [ ] Form labels associated

---

## Performance Testing

### Lighthouse CI

```bash
# Install Lighthouse CI
npm install -D @lhci/cli

# Run Lighthouse
lhci autorun
```

### Performance Budget

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:5173/"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "interactive": ["error", {"maxNumericValue": 5000}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    }
  }
}
```

### Performance Monitoring

```typescript
// Measure component render time
import { Profiler } from 'react';

const onRenderCallback = (
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) => {
  console.log(`${id} ${phase} took ${actualDuration}ms`);
};

<Profiler id="Dashboard" onRender={onRenderCallback}>
  <Dashboard />
</Profiler>
```

---

## Security Testing

### Security Checklist

- [ ] XSS prevention (React escapes by default)
- [ ] CSRF protection
- [ ] Input sanitization
- [ ] SQL injection prevention (backend)
- [ ] Authentication working
- [ ] Authorization enforced
- [ ] Sensitive data not logged
- [ ] HTTPS only in production
- [ ] Security headers configured
- [ ] Dependencies audited

### Security Audit

```bash
# Run npm audit
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

---

## Testing Checklist

### Before Each Commit

- [ ] Code linted (`npm run lint`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Manual testing of changed features
- [ ] No console.log statements
- [ ] Works in Bengali and English

### Before Each PR

- [ ] All commit checklist items
- [ ] Tested on mobile and desktop
- [ ] Tested in multiple browsers
- [ ] Accessibility checked
- [ ] Performance acceptable
- [ ] Documentation updated

### Before Each Release

- [ ] Complete manual testing checklist
- [ ] All features tested
- [ ] All roles tested
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Changelog updated
- [ ] Documentation reviewed

---

## Continuous Integration

### GitHub Actions (Future)

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Unit tests
        run: npm test
      
      - name: Build
        run: npm run build
```

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Testing Guide
