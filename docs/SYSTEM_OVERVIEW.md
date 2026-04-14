# Smart Farming Management System - System Overview

## Executive Summary

The Smart Farming Management System is a comprehensive web application designed for farmers in Bangladesh with a Bengali-first, offline-first approach. The system provides AI-powered crop disease detection, smart irrigation management, market price tracking, weather monitoring, and agricultural expert consultation services.

---

## System Architecture

### Technology Stack

**Frontend Framework:**
- React 18+ (with TypeScript)
- React Router v7 (Data mode pattern)
- Tailwind CSS v4

**Key Libraries:**
- `recharts` - Data visualization (charts/graphs)
- `lucide-react` - Icon system
- `react-router` - Routing and navigation

**State Management:**
- React Context API (`AppContext`)
- Local Storage for persistence

**Deployment:**
- Figma Make platform
- Static web application (SPA)

---

## Core Design Principles

### 1. **Bengali-First Design**
- Bengali is the default language
- All content available in both Bengali (বাংলা) and English
- Translation system (`t()` function) throughout
- Cultural considerations for farming terminology

### 2. **Offline-First Architecture**
- Full functionality without internet connection
- Local storage for data persistence
- Mock data for development/offline mode
- Optional cloud sync with login

### 3. **Mobile-First Responsive Design**
- Android portrait-first optimization
- Bottom navigation for mobile devices
- Sidebar navigation for desktop/tablet
- Adaptive layouts (mobile/desktop breakpoints)

### 4. **Role-Based Access Control**
- **Farmers** (Primary Users): Full farming features
- **Doctors** (Agricultural Experts): Consultation management
- **Admins**: System management and user verification

### 5. **Guest-First Experience**
- No login required for core features
- Optional authentication for cloud sync
- OTP-based login system
- Privacy-focused (no PII collection emphasis)

---

## System Features Overview

### For Farmers 🌾

#### 1. **Disease Detection**
- AI-powered image analysis
- Camera/upload photo options
- Bengali & English disease names
- Confidence percentage
- Treatment recommendations
- Prevention tips
- Voice advisory playback
- Save & share results
- Chat assistant for follow-up questions
- Expert consultation request

#### 2. **Smart Irrigation Management**
- Real-time soil moisture monitoring
- Auto-watering mode (toggle on/off)
- Manual watering controls
- Moisture level visualization (gauge)
- Next watering schedule
- Usage history (weekly charts)
- Irrigation policy settings
- Water amount configuration
- Low moisture alerts

#### 3. **Market Price Tracking**
- Real-time crop prices
- Multiple market locations
- Price trend indicators (↑↓)
- Historical price charts
- Change percentage tracking
- Price alerts/notifications
- Market comparison

#### 4. **Weather Monitoring**
- Current temperature & conditions
- Humidity & rainfall percentage
- Wind information
- 3-day forecast
- Weather alerts (storms, heavy rain)
- GPS-based location detection
- Bengali weather descriptions

#### 5. **Yield Prediction**
- Expected yield forecasting
- Trend analysis (vs previous period)
- Tons per acre calculation
- Historical comparison

#### 6. **Crop Log Management**
- Personal crop records
- Permission-based sharing
- Activity tracking
- Harvest history

#### 7. **Expert Consultation**
- Browse available doctors
- View doctor profiles (specialization, rating)
- Request consultations
- Multiple contact methods (call, video, message)
- Consultation history

### For Doctors (Agricultural Experts) 👨‍⚕️

#### 1. **Verification System**
- Must be verified by admin before access
- Pending verification page
- Status notifications
- Application review process

#### 2. **Consultation Management**
- Active consultation queue
- Patient/farmer information
- Disease case reviews
- Consultation history
- Status updates (pending/completed)

#### 3. **Disease Review System**
- Review farmer-submitted disease cases
- View images and AI analysis
- Provide expert diagnosis
- Recommend treatments
- Approve/reject AI suggestions
- Add additional notes

#### 4. **Doctor Dashboard**
- Consultation statistics
- Active cases count
- Pending reviews
- Performance metrics
- Patient feedback

### For Admins 👑

#### 1. **User Management**
- View all users (farmers, doctors, admins)
- User statistics
- Role assignment
- Account status management

#### 2. **Doctor Verification**
- Review doctor applications
- Approve/reject with comments
- View doctor credentials
- Verification queue management
- Notification system

#### 3. **System Analytics**
- Total users (by role)
- Active consultations
- Disease detection statistics
- System health metrics
- Usage trends

#### 4. **Content Management**
- System settings
- Alert management
- Announcement system

---

## User Roles & Permissions

### Role Hierarchy

```
Guest (Default)
  ↓
Farmer (Logged In)
  ↓
Doctor (Verified)
  ↓
Admin
```

### Permission Matrix

| Feature | Guest | Farmer | Doctor | Admin |
|---------|-------|--------|--------|-------|
| Disease Detection | ✅ | ✅ | ✅ | ✅ |
| View Results | ✅ | ✅ | ✅ | ✅ |
| Save Results | ❌ | ✅ | ✅ | ✅ |
| Irrigation Management | ✅ | ✅ | ✅ | ✅ |
| Price Tracking | ✅ | ✅ | ✅ | ✅ |
| Weather | ✅ | ✅ | ✅ | ✅ |
| Crop Logs (Own) | ❌ | ✅ | ❌ | ✅ |
| Crop Logs (Others) | ❌ | ❌ | ✅* | ✅ |
| Request Consultation | ❌ | ✅ | ❌ | ✅ |
| Doctor Panel | ❌ | ❌ | ✅** | ✅ |
| Review Diseases | ❌ | ❌ | ✅** | ✅ |
| Verify Doctors | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ✅ |
| System Settings | ❌ | ❌ | ❌ | ✅ |

*With permission granted by farmer  
**Only after admin verification

---

## User Flows

### Primary User Journey (Farmer)

```
1. Open App (Guest Mode)
   ↓
2. View Dashboard (Weather, Alerts, Quick Stats)
   ↓
3. Take Disease Photo
   ↓
4. View AI Analysis Results
   ↓
5. Read Advisory (Bengali voice supported)
   ↓
6. [Optional] Request Expert Consultation
   ↓
7. Check Irrigation Status
   ↓
8. [If needed] Water Crops Manually
   ↓
9. Check Market Prices
   ↓
10. [Optional] Login for Cloud Sync
```

### Doctor Verification Flow

```
1. Doctor registers/logs in
   ↓
2. System detects unverified doctor role
   ↓
3. Redirect to Verification Pending page
   ↓
4. Admin reviews application
   ↓
5a. APPROVED → Doctor gains full access
   ↓
5b. REJECTED → Doctor sees rejection reason
   ↓
6. [If approved] Access Doctor Panel
```

### Disease Detection Flow

```
1. Navigate to Disease Detection
   ↓
2. Choose: Take Photo OR Upload Photo
   ↓
3. AI Analysis Processing (mock)
   ↓
4. Display Results:
   - Disease name (Bengali/English)
   - Confidence percentage
   - Image preview
   ↓
5. View Advisory:
   - Treatment recommendations
   - Prevention tips
   - Recommended products
   ↓
6. Voice Playback (optional)
   ↓
7. Actions:
   - Save result
   - Share result
   - Ask questions (chat)
   - Request expert review
```

---

## Data Flow Architecture

### State Management

```
AppContext (Global State)
├── User State
│   ├── userMode: 'guest' | 'logged-in'
│   ├── userRole: 'farmer' | 'doctor' | 'admin'
│   ├── userId: string | null
│   └── userName: string | null
├── Language State
│   └── language: 'bn' | 'en'
├── Settings
│   ├── location: { lat, lon, name }
│   ├── onboardingCompleted: boolean
│   └── notifications: boolean
└── Data Cache
    ├── diseaseResults: []
    ├── irrigationData: {}
    ├── priceData: []
    └── weatherData: {}
```

### Local Storage Schema

```javascript
{
  "smartFarming_userMode": "guest" | "logged-in",
  "smartFarming_userRole": "farmer" | "doctor" | "admin",
  "smartFarming_userId": "user_123",
  "smartFarming_userName": "রহিম কৃষক",
  "smartFarming_language": "bn" | "en",
  "smartFarming_location": "{\"lat\":23.8103,\"lon\":90.4125,\"name\":\"Dhaka\"}",
  "smartFarming_onboardingCompleted": "true",
  "smartFarming_notificationsEnabled": "true"
}
```

---

## Navigation Structure

### Mobile Navigation (Bottom Nav)

```
┌─────────────────────────────────────┐
│         Content Area                │
│                                     │
└─────────────────────────────────────┘
┌─────┬─────┬─────┬─────┬─────┐
│ 🏠  │ 🔍  │ 💧  │ 💰  │ 👤  │
│Home │Det. │Irr. │Price│Prof.│
└─────┴─────┴─────┴─────┴─────┘
```

**Routes:**
- `/` - Dashboard
- `/detect` - Disease Detection
- `/irrigation` - Irrigation Management
- `/prices` - Market Prices
- `/profile` - User Profile

### Desktop Navigation (Sidebar)

```
┌──────┬──────────────────────────┐
│ 🏠   │                          │
│ Home │                          │
│      │                          │
│ 🔍   │      Content Area        │
│Det.  │                          │
│      │                          │
│ 💧   │                          │
│Irr.  │                          │
│      │                          │
│ 💰   │                          │
│Price │                          │
│      │                          │
│ 👤   │                          │
│Prof. │                          │
└──────┴──────────────────────────┘
```

### Role-Based Navigation

**Farmer Navigation:**
- Dashboard
- Disease Detection
- Irrigation
- Market Prices
- Profile
- Crop Logs (if logged in)
- Consultations (if logged in)

**Doctor Navigation (After Verification):**
- Doctor Dashboard
- Consultation Queue
- Disease Reviews
- Profile

**Admin Navigation:**
- Admin Dashboard
- User Management
- Doctor Verification
- System Analytics
- Settings

---

## Responsive Breakpoints

```css
Mobile (Portrait):   320px - 767px   [Bottom Nav]
Tablet:              768px - 1023px  [Sidebar Nav]
Desktop:             1024px+         [Sidebar Nav]
```

### Layout Adaptations

**Dashboard Cards:**
- Mobile: 1 column (`grid-cols-1`)
- Tablet: 2 columns (`md:grid-cols-2`)
- Desktop: 4 columns (`lg:grid-cols-4`)

**Charts:**
- Mobile: Full width, reduced height (200px)
- Desktop: Full width, standard height (300px)

**Navigation:**
- Mobile: Bottom fixed navigation (56px height)
- Desktop: Sidebar navigation (256px width)

---

## Security Considerations

### Authentication
- OTP-based login (simulated)
- No password storage
- Session management via Context
- Local storage for persistence

### Authorization
- Role-based access control
- Route protection
- Feature gating
- Permission validation

### Data Privacy
- No sensitive data collection
- Local-first storage
- Optional cloud sync
- Clear privacy messaging

### Mock Data Security
- No real user data
- Demo mode clearly indicated
- Role switcher for testing only
- Production notes in code

---

## Performance Optimization

### Code Splitting
- React Router lazy loading
- Component-level code splitting
- Route-based chunks

### Asset Optimization
- Lucide icons (tree-shakeable)
- Optimized image loading
- SVG for graphics

### State Optimization
- Context memoization
- Minimal re-renders
- Efficient data structures

### Caching Strategy
- Local storage for persistence
- Mock data caching
- Weather data refresh intervals

---

## Internationalization (i18n)

### Supported Languages
- Bengali (বাংলা) - Primary
- English - Secondary

### Translation System
- Centralized translation file (`translations.ts`)
- Function-based: `t('key', 'bn')`
- Consistent key naming
- Missing translation fallbacks

### RTL Support
- Currently: LTR only
- Future: RTL consideration for Bengali script variations

---

## Accessibility (a11y)

### WCAG 2.1 AA Compliance
- ✅ Color contrast ratios (4.5:1 minimum)
- ✅ Touch target sizes (44×44px minimum)
- ✅ Keyboard navigation support
- ✅ Semantic HTML structure
- ✅ ARIA labels where needed

### Assistive Technology Support
- Screen reader friendly
- Voice advisory feature
- High contrast mode support
- Large text options

### Inclusive Design
- Low literacy considerations
- Icon-based navigation
- Visual status indicators
- Simple language (Bengali)

---

## Browser Compatibility

**Supported Browsers:**
- Chrome/Edge (Chromium) 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (Android Chrome, iOS Safari)

**Progressive Enhancement:**
- Core features work on all modern browsers
- Advanced features degrade gracefully
- Fallbacks for unsupported features

---

## Future Roadmap

### Phase 2 (Planned)
- [ ] Real backend integration (Supabase)
- [ ] True offline mode (Service Workers)
- [ ] Push notifications
- [ ] Camera API integration
- [ ] Geolocation API
- [ ] Voice commands (Bengali)

### Phase 3 (Future)
- [ ] Mobile app (React Native)
- [ ] IoT sensor integration
- [ ] ML model deployment
- [ ] Community features
- [ ] Marketplace integration
- [ ] Government subsidy integration

---

## System Limitations (Current Version)

### Mock Data Limitations
- All data is simulated
- No real AI disease detection
- No actual IoT sensor integration
- No real-time data updates
- No actual SMS/OTP system

### Feature Limitations
- No offline mode (requires online access)
- No file uploads (simulated)
- No real payment integration
- No actual expert consultation
- Demo role switcher (production should remove)

### Scale Limitations
- Client-side only (no backend)
- Limited data storage (localStorage)
- No multi-device sync
- No collaborative features

---

## Deployment Information

### Build Configuration
- Platform: Figma Make
- Build tool: Vite (inferred)
- Output: Static HTML/CSS/JS

### Environment Variables
- None currently (mock data)
- Future: API keys, endpoints

### Production Checklist
- [ ] Remove demo role switcher
- [ ] Remove mock data
- [ ] Integrate real APIs
- [ ] Configure analytics
- [ ] Set up error tracking
- [ ] Enable production optimizations
- [ ] Configure CDN
- [ ] Set up monitoring

---

## Support & Maintenance

### Monitoring
- Error tracking (to be implemented)
- Usage analytics (to be implemented)
- Performance monitoring (to be implemented)

### Updates
- Feature updates via git
- Translation updates
- Mock data updates
- UI refinements

### Known Issues
- None currently documented
- Report issues via project repository

---

## Contact & Resources

**Project Type:** Web Application  
**Platform:** Figma Make  
**Target Users:** Bangladeshi Farmers  
**Languages:** Bengali (Primary), English  
**Status:** Development/Demo  

---

## Glossary

**Kisan (কৃষক):** Farmer  
**Rog (রোগ):** Disease  
**Sech (সেচ):** Irrigation  
**Fasal (ফসল):** Crop  
**Mosham (মৌসুম):** Season/Weather  
**Kaj (কাজ):** Work/Task  
**Bisheshoggo (বিশেষজ্ঞ):** Expert  
**OTP:** One-Time Password  
**AI:** Artificial Intelligence  
**GPS:** Global Positioning System  

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Living Document
