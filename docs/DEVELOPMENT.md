# Development Guide - Smart Farming System

> Local Mode Override (April 2026): Development workflow uses local backend/database by default. Any Supabase instructions in this file are optional reference only.

## Development Setup

### Prerequisites

- Node.js 18+ and npm/pnpm
- Modern code editor (VS Code recommended)
- Git for version control
- Basic understanding of React, TypeScript, Tailwind CSS

### Project Structure

```
smart-farming/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # Entry point
│   │   ├── routes.ts               # Route configuration
│   │   ├── components/             # Reusable components
│   │   │   ├── MobileNav.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── WeatherWidget.tsx
│   │   │   ├── VoicePlayer.tsx
│   │   │   ├── OnboardingBanner.tsx
│   │   │   └── RoleSwitcherBanner.tsx
│   │   ├── pages/                  # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DiseaseDetection.tsx
│   │   │   ├── Irrigation.tsx
│   │   │   ├── MarketPrices.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Consultations.tsx
│   │   │   ├── CropLogs.tsx
│   │   │   ├── DoctorDashboard.tsx
│   │   │   ├── DoctorQueue.tsx
│   │   │   ├── DoctorReviews.tsx
│   │   │   ├── DoctorPending.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminUsers.tsx
│   │   │   ├── AdminVerification.tsx
│   │   │   └── NotFound.tsx
│   │   ├── layouts/                # Layout components
│   │   │   └── RootLayout.tsx
│   │   ├── context/                # State management
│   │   │   └── AppContext.tsx
│   │   └── utils/                  # Utilities
│   │       ├── translations.ts     # i18n translations
│   │       └── mockData.ts         # Mock data
│   ├── styles/
│   │   ├── global.css              # Global styles
│   │   ├── theme.css               # Theme variables
│   │   └── fonts.css               # Font imports
│   └── index.html
├── docs/                            # Documentation
│   ├── SYSTEM_OVERVIEW.md
│   ├── COMPONENTS.md
│   ├── DATA_MODELS.md
│   ├── USER_GUIDE.md
│   └── DEVELOPMENT.md (this file)
├── UX_IMPROVEMENTS.md
├── package.json
└── README.md
```

---

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd smart-farming

# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
# or
pnpm dev

# Open browser
http://localhost:5173
```

### Environment Variables

Currently no environment variables needed (mock data mode).

For production with real backend:

```env
VITE_API_URL=https://api.smartfarming.bd
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_UNSPLASH_ACCESS_KEY=xxx
```

---

## Development Workflow

### 1. Creating a New Page

**Step 1: Create Page Component**

```tsx
// src/app/pages/MyNewPage.tsx
import React from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';

export const MyNewPage: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {t('myPageTitle', lang)}
      </h1>
      
      {/* Page content */}
    </div>
  );
};
```

**Step 2: Add Translation Keys**

```typescript
// src/app/utils/translations.ts
export const translations = {
  myPageTitle: {
    bn: 'আমার নতুন পাতা',
    en: 'My New Page',
  },
  // ... more keys
};
```

**Step 3: Add Route**

```typescript
// src/app/routes.ts
import { MyNewPage } from './pages/MyNewPage';

const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      // ... existing routes
      { 
        path: "my-new-page", 
        Component: MyNewPage 
      },
    ],
  },
]);
```

**Step 4: Add Navigation Link**

```tsx
// In MobileNav.tsx or Sidebar.tsx
<NavLink to="/my-new-page" icon={IconName}>
  {t('myPageTitle', lang)}
</NavLink>
```

---

### 2. Creating a Reusable Component

**Component Template:**

```tsx
// src/app/components/MyComponent.tsx
import React from 'react';
import { useApp } from '../context/AppContext';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
  variant?: 'primary' | 'secondary';
}

export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onAction,
  variant = 'primary',
}) => {
  const { state } = useApp();
  
  return (
    <div className={`component-wrapper ${variant}`}>
      <h3>{title}</h3>
      {onAction && (
        <button onClick={onAction}>
          Action
        </button>
      )}
    </div>
  );
};

// Default export for lazy loading
export default MyComponent;
```

**Usage:**

```tsx
import { MyComponent } from './components/MyComponent';

<MyComponent 
  title="Test Title"
  onAction={() => console.log('clicked')}
  variant="primary"
/>
```

---

### 3. Adding Mock Data

**Step 1: Define Data Structure**

```typescript
// src/app/utils/mockData.ts

// Define interface
export interface MyDataType {
  id: string;
  name: string;
  name_bn: string;
  value: number;
  timestamp: string;
}

// Create mock data
export const mockMyData: MyDataType[] = [
  {
    id: 'item1',
    name: 'Item One',
    name_bn: 'আইটেম এক',
    value: 100,
    timestamp: '2026-02-21T10:00:00Z',
  },
  {
    id: 'item2',
    name: 'Item Two',
    name_bn: 'আইটেম দুই',
    value: 200,
    timestamp: '2026-02-21T11:00:00Z',
  },
];
```

**Step 2: Use in Component**

```tsx
import { mockMyData } from '../utils/mockData';

export const MyPage: React.FC = () => {
  return (
    <div>
      {mockMyData.map((item) => (
        <div key={item.id}>
          <h3>{lang === 'bn' ? item.name_bn : item.name}</h3>
          <p>{item.value}</p>
        </div>
      ))}
    </div>
  );
};
```

---

### 4. Working with Context (State Management)

**Reading State:**

```tsx
import { useApp } from '../context/AppContext';

const MyComponent = () => {
  const { state } = useApp();
  
  console.log(state.userRole);      // 'farmer' | 'doctor' | 'admin'
  console.log(state.language);      // 'bn' | 'en'
  console.log(state.userMode);      // 'guest' | 'logged-in'
  
  return <div>...</div>;
};
```

**Updating State:**

```tsx
import { useApp } from '../context/AppContext';

const MyComponent = () => {
  const { dispatch } = useApp();
  
  const handleLogin = () => {
    dispatch({
      type: 'SET_USER_MODE',
      payload: 'logged-in',
    });
    
    dispatch({
      type: 'SET_USER_ROLE',
      payload: 'farmer',
    });
    
    dispatch({
      type: 'SET_USER_ID',
      payload: 'user_123',
    });
  };
  
  return <button onClick={handleLogin}>Login</button>;
};
```

**Available Actions:**

```typescript
// Language
dispatch({ type: 'SET_LANGUAGE', payload: 'bn' | 'en' });

// User
dispatch({ type: 'SET_USER_MODE', payload: 'guest' | 'logged-in' });
dispatch({ type: 'SET_USER_ROLE', payload: 'farmer' | 'doctor' | 'admin' });
dispatch({ type: 'SET_USER_ID', payload: string | null });
dispatch({ type: 'SET_USER_NAME', payload: string | null });

// Doctor
dispatch({ type: 'SET_DOCTOR_VERIFIED', payload: boolean });

// Settings
dispatch({ type: 'SET_LOCATION', payload: Location });
dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: boolean });
dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: boolean });

// Logout
dispatch({ type: 'LOGOUT' });
```

---

### 5. Implementing Role-Based Access

**Route Protection:**

```tsx
// src/app/routes.ts
import { Navigate } from 'react-router';

// Protected route wrapper
const ProtectedRoute = ({ children, requiredRole }) => {
  const { state } = useApp();
  
  if (state.userMode === 'guest') {
    return <Navigate to="/profile" />;
  }
  
  if (requiredRole && state.userRole !== requiredRole) {
    return <Navigate to="/" />;
  }
  
  return children;
};

// In routes
{
  path: "consultations",
  element: (
    <ProtectedRoute requiredRole="farmer">
      <Consultations />
    </ProtectedRoute>
  ),
}
```

**Component-Level Protection:**

```tsx
const MyComponent = () => {
  const { state } = useApp();
  
  // Check role
  if (state.userRole !== 'admin') {
    return <div>Access Denied</div>;
  }
  
  // Check verification (for doctors)
  if (state.userRole === 'doctor' && !state.doctorVerified) {
    return <Navigate to="/doctor/pending" />;
  }
  
  return <div>Admin Content</div>;
};
```

**Conditional Rendering:**

```tsx
const Dashboard = () => {
  const { state } = useApp();
  
  return (
    <div>
      {/* Everyone */}
      <WeatherWidget />
      
      {/* Logged in only */}
      {state.userMode === 'logged-in' && (
        <SavedResults />
      )}
      
      {/* Farmers only */}
      {state.userRole === 'farmer' && (
        <CropLogsSummary />
      )}
      
      {/* Doctors only */}
      {state.userRole === 'doctor' && state.doctorVerified && (
        <ConsultationQueue />
      )}
      
      {/* Admins only */}
      {state.userRole === 'admin' && (
        <AdminPanel />
      )}
    </div>
  );
};
```

---

### 6. Adding Translations

**Add Translation Keys:**

```typescript
// src/app/utils/translations.ts
export const translations: Translations = {
  // Existing keys...
  
  // Add new keys
  myNewFeature: {
    bn: 'আমার নতুন বৈশিষ্ট্য',
    en: 'My New Feature',
  },
  actionButton: {
    bn: 'ক্লিক করুন',
    en: 'Click Here',
  },
  longDescription: {
    bn: 'এটি একটি দীর্ঘ বিবরণ যা বাংলায় লেখা...',
    en: 'This is a long description written in English...',
  },
};
```

**Use in Components:**

```tsx
import { t } from '../utils/translations';
import { useApp } from '../context/AppContext';

const MyComponent = () => {
  const { state } = useApp();
  const lang = state.language;
  
  return (
    <div>
      <h1>{t('myNewFeature', lang)}</h1>
      <button>{t('actionButton', lang)}</button>
      <p>{t('longDescription', lang)}</p>
    </div>
  );
};
```

**Pluralization (Custom):**

```typescript
// For counts that need different Bengali forms
const getCountText = (count: number, lang: Language) => {
  if (lang === 'bn') {
    return count === 1 ? 'টি আইটেম' : 'টি আইটেম';
  }
  return count === 1 ? 'item' : 'items';
};

// Usage
<p>{count} {getCountText(count, lang)}</p>
```

---

## Styling Guide

### Tailwind CSS Best Practices

**1. Use Semantic Class Names:**

```tsx
// ❌ Don't
<div className="bg-blue-500 text-white p-4 rounded-lg">

// ✅ Do (use custom classes for repeated patterns)
<div className="card-primary">
```

**2. Responsive Design:**

```tsx
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-4 
  gap-4
">
  {/* Mobile: 1 col, Tablet: 2 cols, Desktop: 4 cols */}
</div>
```

**3. Color System:**

```tsx
// Status colors (from UX improvements)
// Green: Healthy/Success
<div className="bg-green-50 text-green-700 border-green-200">

// Blue: Information/Moderate
<div className="bg-blue-50 text-blue-700 border-blue-200">

// Orange: Warning
<div className="bg-orange-50 text-orange-700 border-orange-200">

// Red: Error/Critical
<div className="bg-red-50 text-red-700 border-red-200">
```

**4. Consistent Spacing:**

```tsx
// Page container
<div className="space-y-6">

// Card padding
<div className="p-5">        // Feature cards
<div className="p-4">        // Secondary cards

// Gaps
<div className="gap-4">      // Standard
<div className="gap-6">      // Comfortable
```

**5. Border Radius:**

```tsx
<div className="rounded-lg">    // Small (10px)
<div className="rounded-xl">    // Large (12px)
<div className="rounded-full">  // Pills/badges
```

---

### Custom CSS (When Needed)

**Add to theme.css:**

```css
/* src/styles/theme.css */

@layer components {
  .card-primary {
    @apply bg-white rounded-xl shadow-sm p-5 border-2 border-gray-100;
  }
  
  .btn-primary {
    @apply px-6 py-3 bg-blue-600 text-white rounded-xl 
           hover:bg-blue-700 transition-colors font-semibold;
  }
  
  .status-badge {
    @apply px-3 py-1.5 rounded-full text-xs font-semibold;
  }
}
```

---

## Testing

### Manual Testing Checklist

**Before Each Commit:**

- [ ] Test in mobile view (DevTools responsive mode)
- [ ] Test in desktop view
- [ ] Switch between Bengali and English
- [ ] Test as Guest
- [ ] Test as Farmer (logged in)
- [ ] Test as Doctor (verified & unverified)
- [ ] Test as Admin
- [ ] Check console for errors
- [ ] Verify no broken links
- [ ] Test back button navigation

---

## Debugging

### Common Issues

**Issue: Component not re-rendering**

```tsx
// Make sure to use proper dependencies
useEffect(() => {
  // Effect code
}, [dependency1, dependency2]); // Don't forget dependencies!

// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return calculateSomething(data);
}, [data]);
```

**Issue: Context state not updating**

```tsx
// Check dispatch is being called correctly
const { dispatch } = useApp();

dispatch({
  type: 'SET_LANGUAGE',  // Correct action type
  payload: 'bn',         // Correct payload
});

// Not like this:
dispatch({ language: 'bn' }); // ❌ Wrong format
```

**Issue: Translation not showing**

```tsx
// Make sure key exists in translations.ts
console.log(translations.myKey); // Check if defined

// Make sure using correct function
t('myKey', lang)  // ✅ Correct
t('myKey')        // ❌ Missing language parameter
```

**Issue: Route not working**

```tsx
// Check route is registered in routes.ts
// Check exact path spelling
// Check if route is nested correctly
// Use Navigate for redirects, not window.location
```

---

## Performance Optimization

### Code Splitting

```tsx
// Lazy load heavy components
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### Memoization

```tsx
import { memo, useMemo, useCallback } from 'react';

// Memoize components
export const MyComponent = memo(({ data }) => {
  return <div>{data}</div>;
});

// Memoize expensive calculations
const expensiveResult = useMemo(() => {
  return calculateExpensive(data);
}, [data]);

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

---

## Git Workflow

### Branching Strategy

```bash
main                    # Production-ready code
  ├── develop          # Integration branch
  │   ├── feature/disease-detection-v2
  │   ├── feature/consultation-chat
  │   ├── bugfix/irrigation-toggle
  │   └── hotfix/login-otp
```

### Commit Message Convention

```bash
# Format: type(scope): message

# Types:
feat: Add new feature
fix: Fix bug
docs: Documentation only
style: Code style changes (formatting)
refactor: Code refactoring
test: Add tests
chore: Maintenance tasks

# Examples:
git commit -m "feat(disease): add export to PDF functionality"
git commit -m "fix(irrigation): toggle not persisting state"
git commit -m "docs(api): update endpoint documentation"
git commit -m "style(dashboard): improve card spacing"
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested in mobile view
- [ ] Tested in desktop view
- [ ] Tested Bengali translation
- [ ] Tested all user roles

## Screenshots
(if applicable)

## Related Issues
Closes #123
```

---

## Deployment

### Build for Production

```bash
# Create production build
npm run build
# or
pnpm build

# Output in /dist folder
```

### Pre-Deployment Checklist

- [ ] Remove `RoleSwitcherBanner` component
- [ ] Remove demo OTP acceptance (any 6 digits)
- [ ] Configure real API endpoints
- [ ] Set environment variables
- [ ] Test build locally
- [ ] Run security audit: `npm audit`
- [ ] Verify all images load
- [ ] Test on real devices
- [ ] Check analytics integration
- [ ] Verify error tracking works

---

## Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Type Checking

```bash
# Run TypeScript type checker
npm run type-check
```

### Code Formatting

```bash
# Format with Prettier
npm run format

# Check formatting
npm run format:check
```

---

## Best Practices

### 1. Component Design

```tsx
// ✅ Good: Small, focused components
const UserCard = ({ user }) => (
  <div className="card">
    <h3>{user.name}</h3>
    <p>{user.email}</p>
  </div>
);

// ❌ Bad: Large, multi-purpose components
const UserManagement = () => {
  // 500 lines of code doing everything
};
```

### 2. State Management

```tsx
// ✅ Good: Use Context for global state
const { state } = useApp();

// ✅ Good: Use local state for component-specific
const [isOpen, setIsOpen] = useState(false);

// ❌ Bad: Prop drilling through many levels
<Parent>
  <Child level1={...}>
    <Child level2={...}>
      <Child level3={data} />
    </Child>
  </Child>
</Parent>
```

### 3. Error Handling

```tsx
// ✅ Good: Handle errors gracefully
try {
  const result = await fetchData();
  setData(result);
} catch (error) {
  console.error('Failed to fetch:', error);
  setError('Unable to load data');
}

// ❌ Bad: Ignore errors
const result = await fetchData(); // Could fail silently
```

### 4. Accessibility

```tsx
// ✅ Good: Semantic HTML, ARIA labels
<button 
  aria-label="Close dialog"
  onClick={handleClose}
>
  <X />
</button>

// ❌ Bad: Non-semantic, no labels
<div onClick={handleClose}>
  <X />
</div>
```

---

## Resources

### Documentation

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com)
- [Recharts](https://recharts.org)

### Tools

- [React DevTools](https://react.dev/learn/react-developer-tools)
- [VS Code Extensions](https://code.visualstudio.com/docs):
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (Volar)

---

## Troubleshooting Development Issues

### Build Errors

**Error: Module not found**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

**Error: Port already in use**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Or use different port
npm run dev -- --port 3000
```

### Runtime Errors

**Error: Cannot read property of undefined**
```tsx
// Use optional chaining
const name = user?.profile?.name; // ✅ Safe
const name = user.profile.name;    // ❌ Can crash
```

**Error: Maximum update depth exceeded**
```tsx
// ❌ Don't call setState directly in render
function Component() {
  setState(newValue); // Infinite loop!
  return <div>...</div>;
}

// ✅ Use useEffect or event handlers
function Component() {
  useEffect(() => {
    setState(newValue);
  }, []);
  
  return <div>...</div>;
}
```

---

## Contributing

### Code Review Guidelines

**Reviewers should check:**
- Code follows project conventions
- Tests are included
- Documentation is updated
- No console.log statements
- Translations added for new text
- Responsive design tested
- Accessibility considered

**Submitters should:**
- Write clear PR description
- Link related issues
- Include screenshots
- Test on multiple browsers
- Update CHANGELOG

---

## Next Steps

1. **Read System Overview** (`docs/SYSTEM_OVERVIEW.md`)
2. **Review Components** (`docs/COMPONENTS.md`)
3. **Understand Data Models** (`docs/DATA_MODELS.md`)
4. **Try User Guide** (`docs/USER_GUIDE.md`)
5. **Start Coding!**

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**For Developers:** Smart Farming System
