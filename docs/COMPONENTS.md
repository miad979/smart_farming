# Technical Documentation - Component Architecture

## Component Hierarchy

```
App.tsx (Root)
├── RouterProvider
│   └── routes.ts
│       ├── RootLayout
│       │   ├── AppProvider (Context)
│       │   ├── MobileNav (Mobile only)
│       │   ├── Sidebar (Desktop only)
│       │   └── Outlet (Page content)
│       │
│       ├── Pages (Routes)
│       │   ├── Dashboard (/)
│       │   ├── DiseaseDetection (/detect)
│       │   ├── Irrigation (/irrigation)
│       │   ├── MarketPrices (/prices)
│       │   ├── Profile (/profile)
│       │   ├── Consultations (/consultations)
│       │   ├── CropLogs (/crop-logs)
│       │   ├── DoctorDashboard (/doctor)
│       │   ├── DoctorQueue (/doctor/queue)
│       │   ├── DoctorReviews (/doctor/reviews)
│       │   ├── DoctorPending (/doctor/pending)
│       │   ├── AdminDashboard (/admin)
│       │   ├── AdminUsers (/admin/users)
│       │   ├── AdminVerification (/admin/verification)
│       │   └── NotFound (404)
│       │
│       └── Shared Components
│           ├── WeatherWidget
│           ├── OnboardingBanner
│           ├── RoleSwitcherBanner
│           ├── VoicePlayer
│           └── (other reusable components)
```

---

## Core Components

### 1. App.tsx

**Location:** `/src/app/App.tsx`

**Purpose:** Application entry point, sets up routing

**Key Features:**
- Initializes RouterProvider
- Imports global styles
- No direct UI rendering

```tsx
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return <RouterProvider router={router} />;
}
```

---

### 2. RootLayout.tsx

**Location:** `/src/app/layouts/RootLayout.tsx`

**Purpose:** Main application layout wrapper

**Responsibilities:**
- Wraps all pages with AppProvider (Context)
- Renders MobileNav or Sidebar based on screen size
- Manages responsive layout
- Provides consistent page structure

**Structure:**
```tsx
<AppProvider>
  <div className="layout-container">
    {/* Desktop: Sidebar */}
    <Sidebar />
    
    {/* Main Content */}
    <main>
      <Outlet /> {/* Pages render here */}
    </main>
    
    {/* Mobile: Bottom Nav */}
    <MobileNav />
  </div>
</AppProvider>
```

**Responsive Behavior:**
- Mobile (< 768px): Shows MobileNav (bottom fixed)
- Desktop (≥ 768px): Shows Sidebar (left fixed)

---

## Page Components

### Dashboard.tsx

**Route:** `/`

**Role Access:** All users

**Key Features:**
- Role switcher banner (demo mode)
- Onboarding banner (first-time users)
- Weather widget
- Urgent alerts section (top priority)
- Quick stats grid (4 cards):
  - Disease Detection status
  - Irrigation status
  - Yield forecast
  - Market prices
- Weekly irrigation usage chart
- Price trends list
- General alerts

**Data Sources:**
- `mockDiseaseResult` - Latest disease detection
- `mockIrrigation` - Irrigation data and alerts
- `mockPrices` - Market price data
- `mockWeather` - Weather info

**State:**
- Uses `AppContext` for language and user info
- No local state

**Responsive:**
- Grid: 1 col (mobile) → 2 cols (tablet) → 4 cols (desktop)

---

### DiseaseDetection.tsx

**Route:** `/detect`

**Role Access:** All users

**Key Features:**
- Empty state: Camera/Upload options
- Result state: 
  - Disease image preview
  - AI analysis results
  - Confidence percentage
  - Treatment advisory
  - Prevention tips
  - Voice playback
  - Save/Share actions
- Chat assistant
- Quick reply buttons
- Expert consultation request
- Available experts list

**Local State:**
```typescript
const [showResult, setShowResult] = useState(true);
const [showChat, setShowChat] = useState(false);
const [showExperts, setShowExperts] = useState(false);
const [chatMessages, setChatMessages] = useState([...]);
```

**Components Used:**
- `VoicePlayer` - Text-to-speech
- Lucide icons: Camera, Upload, Share2, Save, MessageCircle, etc.

**Data Flow:**
```
User uploads image
  ↓
Mock AI analysis (mockDiseaseResult)
  ↓
Display results + advisory
  ↓
Optional: Request expert consultation
```

---

### Irrigation.tsx

**Route:** `/irrigation`

**Role Access:** All users

**Key Features:**
- Moisture level gauge (color-coded)
- Auto-mode toggle
- Next watering schedule
- Status indicator (Healthy/Moderate/Low)
- Alerts section
- Manual watering button
- Weekly usage chart
- Irrigation policy settings (expandable)

**Local State:**
```typescript
const [autoMode, setAutoMode] = useState(mockIrrigation.autoMode);
const [showPolicy, setShowPolicy] = useState(false);
```

**Color Coding:**
- Green (70%+): Healthy level
- Blue (50-69%): Moderate level
- Orange (<50%): Low level - Action needed

**Mock Data:**
```javascript
{
  moisture: 68,
  autoMode: true,
  amount: "500L",
  nextWatering: "2 hours",
  nextWatering_bn: "২ ঘন্টা",
  policy: { crop, threshold, duration, amount },
  usage: [daily water usage],
  alerts: [alert messages]
}
```

---

### MarketPrices.tsx

**Route:** `/prices`

**Role Access:** All users

**Key Features:**
- Current price display
- Multiple crops
- Multiple markets
- Price trends (↑↓)
- Change percentage
- Historical chart (7-day)
- Alert settings
- Location selector

**Data Structure:**
```javascript
{
  crop: "Rice",
  crop_bn: "ধান",
  price: 450,
  market: "Dhaka",
  market_bn: "ঢাকা",
  change: 5.2,
  trend: "up",
  history: [{ date, price }]
}
```

**Chart:**
- Line chart showing 7-day price trend
- Responsive container
- Tooltip on hover

---

### Profile.tsx

**Route:** `/profile`

**Role Access:** All users

**Key Features:**
- User information display
- Language toggle (Bengali ⇄ English)
- Login/Logout functionality
- OTP login flow (simulated)
- Location settings
- Notification preferences
- Role display
- Sync status (for guests)

**State Management:**
- Reads from `AppContext`
- Updates via `dispatch()`
- Persists to localStorage

**Login Flow:**
```
Guest Mode
  ↓
Click "Login with OTP"
  ↓
Enter phone number
  ↓
Enter OTP (any 6 digits accepted)
  ↓
Logged In (role: farmer by default)
```

---

### Consultations.tsx

**Route:** `/consultations`

**Role Access:** Logged-in farmers only

**Key Features:**
- Available experts list
- Doctor profiles:
  - Name (Bengali + English)
  - Specialization
  - Rating (stars)
  - Availability
- Contact options:
  - Call
  - Video call
  - Message
- Consultation history
- Filter by specialization

**Data Source:**
```javascript
mockExperts = [
  {
    id: "doc1",
    name: "Dr. Rahman",
    name_bn: "ডাঃ রহমান",
    specialization: "Crop Disease",
    specialization_bn: "ফসলের রোগ",
    rating: 4.8,
    available: true
  }
]
```

---

### CropLogs.tsx

**Route:** `/crop-logs`

**Role Access:** Logged-in farmers, doctors (with permission), admins

**Key Features:**
- Crop activity log
- Planting dates
- Harvest records
- Treatment history
- Permission management
- Share with doctors
- Grant/revoke access

**Permission System:**
```javascript
{
  logId: "log123",
  ownerId: "farmer456",
  sharedWith: ["doc1", "doc2"],
  activities: [
    { date, type, crop, notes }
  ]
}
```

---

## Doctor Components

### DoctorDashboard.tsx

**Route:** `/doctor`

**Role Access:** Verified doctors only

**Features:**
- Active consultations count
- Pending reviews count
- Completed consultations
- Quick stats
- Recent activity
- Navigation to queue/reviews

**Verification Check:**
```typescript
if (!state.doctorVerified) {
  return <Navigate to="/doctor/pending" />;
}
```

---

### DoctorQueue.tsx

**Route:** `/doctor/queue`

**Role Access:** Verified doctors only

**Features:**
- List of active consultations
- Farmer information
- Disease case summary
- Priority indicators
- Action buttons:
  - View details
  - Start consultation
  - Complete
- Filter by status
- Sort by date/priority

---

### DoctorReviews.tsx

**Route:** `/doctor/reviews`

**Role Access:** Verified doctors only

**Features:**
- Disease detection reviews
- AI analysis results
- Image viewing
- Expert diagnosis input
- Treatment recommendations
- Approve/reject AI suggestions
- Add notes
- Submit review

**Review Flow:**
```
Farmer submits disease photo
  ↓
AI analyzes (mockDiseaseResult)
  ↓
Added to doctor review queue
  ↓
Doctor reviews and confirms/modifies
  ↓
Farmer receives expert-verified diagnosis
```

---

### DoctorPending.tsx

**Route:** `/doctor/pending`

**Role Access:** Unverified doctors only

**Features:**
- Verification status message
- Waiting state illustration
- Expected timeline
- Contact admin option
- Logout option

**State Check:**
```typescript
if (state.doctorVerified) {
  return <Navigate to="/doctor" />;
}
```

---

## Admin Components

### AdminDashboard.tsx

**Route:** `/admin`

**Role Access:** Admins only

**Features:**
- System overview statistics
- User counts by role
- Active consultations
- Disease detections count
- Pending doctor verifications
- Quick action buttons
- Recent activity feed
- System health indicators

---

### AdminUsers.tsx

**Route:** `/admin/users`

**Role Access:** Admins only

**Features:**
- User list (all roles)
- Search functionality
- Filter by role
- User details:
  - Name, phone, role
  - Join date
  - Last active
  - Status (active/inactive)
- Actions:
  - View profile
  - Change role
  - Suspend/activate
  - Delete (soft delete)

**Data Structure:**
```javascript
{
  userId: "user123",
  userName: "রহিম কৃষক",
  phone: "01712345678",
  role: "farmer",
  joinDate: "2025-01-15",
  lastActive: "2026-02-21",
  status: "active",
  consultations: 5,
  diseaseScans: 12
}
```

---

### AdminVerification.tsx

**Route:** `/admin/verification`

**Role Access:** Admins only

**Features:**
- Pending doctor verifications list
- Doctor application details:
  - Name
  - Specialization
  - Credentials
  - Experience
  - Application date
- Review actions:
  - Approve (activate doctor account)
  - Reject (with reason)
  - Request more info
- Verification history

**Verification Flow:**
```
Doctor registers
  ↓
System creates unverified doctor account
  ↓
Admin receives verification request
  ↓
Admin reviews credentials
  ↓
APPROVE → Doctor gains full access
REJECT → Doctor sees rejection reason
  ↓
Notification sent to doctor
```

**State Update on Approval:**
```typescript
dispatch({
  type: 'SET_DOCTOR_VERIFIED',
  payload: true
});
```

---

## Shared Components

### WeatherWidget.tsx

**Location:** `/src/app/components/WeatherWidget.tsx`

**Used In:** Dashboard

**Features:**
- Current weather display
- Temperature (large, bold)
- Condition (Bengali/English)
- Humidity percentage
- Rainfall probability
- Weather alerts (if any)
- 3-day forecast

**Props:** None (uses AppContext for language)

**Data Source:** `mockWeather`

**Styling:**
- Gradient background: `from-blue-50 to-cyan-50`
- Color-coded icons
- Responsive grid layout

---

### VoicePlayer.tsx

**Location:** `/src/app/components/VoicePlayer.tsx`

**Used In:** DiseaseDetection, (future: other advisory pages)

**Features:**
- Text-to-speech playback
- Bengali and English support
- Play/Pause button
- Volume control
- Speed control
- Progress indicator

**Props:**
```typescript
interface VoicePlayerProps {
  text: string;        // Bengali text
  textEn: string;      // English text
}
```

**Implementation:**
```tsx
<VoicePlayer
  text={mockDiseaseResult.advisory_bn}
  textEn={mockDiseaseResult.advisory_en}
/>
```

**Note:** Currently simulated (Web Speech API to be integrated)

---

### OnboardingBanner.tsx

**Location:** `/src/app/components/OnboardingBanner.tsx`

**Used In:** Dashboard

**Features:**
- Welcome message for first-time users
- Quick feature overview
- Dismissible
- Shows only once (localStorage flag)

**State:**
```typescript
const [show, setShow] = useState(!state.onboardingCompleted);
```

**Dismiss Action:**
```typescript
const handleDismiss = () => {
  dispatch({ type: 'SET_ONBOARDING_COMPLETED', payload: true });
  setShow(false);
};
```

---

### RoleSwitcherBanner.tsx

**Location:** `/src/app/components/RoleSwitcherBanner.tsx`

**Used In:** Dashboard (DEMO MODE ONLY)

**Features:**
- Quick role switching for testing
- Options: Farmer, Doctor (Verified), Doctor (Unverified), Admin
- Prominent banner at top of dashboard
- Color-coded per role

**⚠️ Important:** Remove in production!

**Implementation:**
```typescript
const handleRoleSwitch = (role: UserRole) => {
  dispatch({ type: 'SET_USER_ROLE', payload: role });
  if (role === 'doctor') {
    dispatch({ type: 'SET_DOCTOR_VERIFIED', payload: true });
  }
};
```

---

## Navigation Components

### MobileNav.tsx

**Location:** `/src/app/components/MobileNav.tsx`

**Display:** Mobile only (< 768px)

**Position:** Fixed bottom

**Structure:**
```tsx
<nav className="fixed bottom-0 left-0 right-0">
  <NavLink to="/" icon={Home} label="Home" />
  <NavLink to="/detect" icon={Camera} label="Detect" />
  <NavLink to="/irrigation" icon={Droplets} label="Irrigation" />
  <NavLink to="/prices" icon={TrendingUp} label="Prices" />
  <NavLink to="/profile" icon={User} label="Profile" />
</nav>
```

**Features:**
- Active state highlighting
- Icon + label
- Bengali/English labels
- Role-based item visibility

---

### Sidebar.tsx

**Location:** `/src/app/components/Sidebar.tsx`

**Display:** Desktop only (≥ 768px)

**Position:** Fixed left

**Structure:**
```tsx
<aside className="fixed left-0 top-0 h-screen w-64">
  <Logo />
  <nav>
    <NavLink to="/" icon={Home} label="Dashboard" />
    {/* Farmer Links */}
    {state.userRole === 'farmer' && (
      <>
        <NavLink to="/detect" icon={Camera} label="Disease Detection" />
        <NavLink to="/irrigation" icon={Droplets} label="Irrigation" />
        ...
      </>
    )}
    {/* Doctor Links */}
    {state.userRole === 'doctor' && state.doctorVerified && (
      <>
        <NavLink to="/doctor" icon={Stethoscope} label="Dashboard" />
        <NavLink to="/doctor/queue" icon={Users} label="Queue" />
        ...
      </>
    )}
    {/* Admin Links */}
    {state.userRole === 'admin' && (
      <>
        <NavLink to="/admin" icon={Settings} label="Admin" />
        <NavLink to="/admin/users" icon={Users} label="Users" />
        ...
      </>
    )}
  </nav>
  <UserInfo />
</aside>
```

**Features:**
- Collapsible (future enhancement)
- Role-based navigation
- Active state highlighting
- User info at bottom
- Language toggle

---

## Utility Components

### StatusBadge

**Purpose:** Consistent status indicators

**Usage:**
```tsx
<StatusBadge status="healthy" />
<StatusBadge status="warning" />
<StatusBadge status="critical" />
```

**Variants:**
- Healthy: Green background, green text
- Warning: Orange background, orange text
- Critical: Red background, red text

---

### LoadingSpinner

**Purpose:** Loading states

**Usage:**
```tsx
<LoadingSpinner size="sm" | "md" | "lg" />
```

---

### EmptyState

**Purpose:** No data states

**Usage:**
```tsx
<EmptyState
  icon={Camera}
  title="No scans yet"
  description="Take your first photo"
  action={<button>Scan Now</button>}
/>
```

---

## Component Design Patterns

### 1. Container/Presenter Pattern

**Example:** DiseaseDetection.tsx

```tsx
// Container (handles logic)
export const DiseaseDetection: React.FC = () => {
  const { state } = useApp();
  const [localState, setLocalState] = useState(...);
  
  // Business logic here
  
  return <DiseaseDetectionUI data={...} handlers={...} />;
};

// Presenter (pure UI)
const DiseaseDetectionUI: React.FC<Props> = ({ data, handlers }) => {
  return <div>...</div>;
};
```

### 2. Compound Components

**Example:** Card components

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>
```

### 3. Render Props

**Example:** VoicePlayer

```tsx
<VoicePlayer text="...">
  {({ isPlaying, play, pause }) => (
    <button onClick={isPlaying ? pause : play}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  )}
</VoicePlayer>
```

### 4. Higher-Order Components

**Example:** withAuth

```tsx
const withAuth = (Component: React.FC) => {
  return (props: any) => {
    const { state } = useApp();
    if (state.userMode === 'guest') {
      return <Navigate to="/profile" />;
    }
    return <Component {...props} />;
  };
};

export const ProtectedPage = withAuth(SomePage);
```

---

## Component Testing Strategy

### Unit Tests
- Individual component rendering
- Props validation
- State management
- Event handlers

### Integration Tests
- Component interaction
- Context integration
- Navigation flow
- Form submissions

### E2E Tests
- Complete user flows
- Role-based access
- Multi-language support
- Responsive behavior

---

## Performance Optimization

### Code Splitting
```typescript
const DiseaseDetection = lazy(() => import('./pages/DiseaseDetection'));
const Irrigation = lazy(() => import('./pages/Irrigation'));
```

### Memoization
```typescript
const MemoizedWeatherWidget = memo(WeatherWidget);

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);
```

### Virtual Scrolling
For long lists (e.g., price history, user lists):
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>{items[index]}</div>
  )}
</FixedSizeList>
```

---

## Component Documentation Standards

Each component should include:

```typescript
/**
 * DiseaseDetection Component
 * 
 * AI-powered crop disease detection interface.
 * Allows farmers to capture/upload leaf images and receive analysis.
 * 
 * @route /detect
 * @access Public (all users)
 * @features
 * - Image capture/upload
 * - AI analysis display
 * - Treatment recommendations
 * - Voice advisory
 * - Expert consultation request
 * 
 * @example
 * <DiseaseDetection />
 */
export const DiseaseDetection: React.FC = () => {
  // Implementation
};
```

---

**Document Version:** 1.0  
**Last Updated:** February 2026
