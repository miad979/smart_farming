# Data Models & API Documentation

## Mock Data Structure

All data is currently simulated using mock data for offline-first functionality. This document describes the data models and API contracts for future backend integration.

---

## Core Data Models

### User Model

```typescript
interface User {
  userId: string;              // Unique identifier
  userName: string;            // Display name
  userName_bn?: string;        // Bengali name (optional)
  phone: string;               // Phone number (for OTP)
  email?: string;              // Optional email
  role: UserRole;              // 'farmer' | 'doctor' | 'admin'
  status: UserStatus;          // 'active' | 'inactive' | 'suspended'
  location: Location;          // GPS coordinates
  createdAt: string;           // ISO 8601 timestamp
  lastActive: string;          // ISO 8601 timestamp
  
  // Role-specific fields
  doctorProfile?: DoctorProfile;
  farmerProfile?: FarmerProfile;
  
  // Settings
  language: 'bn' | 'en';
  notificationsEnabled: boolean;
  onboardingCompleted: boolean;
}

type UserRole = 'farmer' | 'doctor' | 'admin';
type UserStatus = 'active' | 'inactive' | 'suspended';
```

**Example:**
```json
{
  "userId": "user_abc123",
  "userName": "রহিম কৃষক",
  "userName_bn": "রহিম কৃষক",
  "phone": "+8801712345678",
  "role": "farmer",
  "status": "active",
  "location": {
    "lat": 23.8103,
    "lon": 90.4125,
    "name": "Dhaka",
    "name_bn": "ঢাকা"
  },
  "createdAt": "2025-01-15T10:30:00Z",
  "lastActive": "2026-02-21T08:45:00Z",
  "language": "bn",
  "notificationsEnabled": true,
  "onboardingCompleted": true
}
```

---

### Doctor Profile Model

```typescript
interface DoctorProfile {
  doctorId: string;
  specialization: string[];         // Array of specializations
  specialization_bn: string[];
  qualifications: string[];         // Degrees, certifications
  experience: number;               // Years
  rating: number;                   // 0-5 stars
  totalConsultations: number;
  verified: boolean;                // Admin verification status
  verifiedAt?: string;              // Verification timestamp
  verifiedBy?: string;              // Admin ID
  available: boolean;               // Online/available status
  availabilitySchedule?: Schedule[];
  consultationFee?: number;
  languages: string[];              // Supported languages
  bio?: string;
  bio_bn?: string;
}

interface Schedule {
  dayOfWeek: number;                // 0-6 (Sunday-Saturday)
  startTime: string;                // "09:00"
  endTime: string;                  // "17:00"
}
```

**Example:**
```json
{
  "doctorId": "doc_xyz789",
  "specialization": ["Crop Disease", "Pest Management"],
  "specialization_bn": ["ফসলের রোগ", "কীট ব্যবস্থাপনা"],
  "qualifications": ["BSc Agriculture", "MSc Plant Pathology"],
  "experience": 8,
  "rating": 4.8,
  "totalConsultations": 342,
  "verified": true,
  "verifiedAt": "2025-01-20T14:30:00Z",
  "verifiedBy": "admin_001",
  "available": true,
  "languages": ["bn", "en"],
  "bio": "Agricultural expert specializing in crop diseases",
  "bio_bn": "ফসলের রোগ বিশেষজ্ঞ"
}
```

---

### Disease Detection Model

```typescript
interface DiseaseDetection {
  scanId: string;                   // Unique scan identifier
  userId: string;                   // User who performed scan
  timestamp: string;                // ISO 8601
  image_ref: string;                // Image URL/reference
  
  // AI Analysis
  disease: string;                  // Disease name (English)
  disease_bn: string;               // Disease name (Bengali)
  confidence: number;               // 0-100 percentage
  severity: 'low' | 'medium' | 'high';
  
  // Crop Information
  cropType?: string;
  cropType_bn?: string;
  
  // Advisory
  advisory_en: string;
  advisory_bn: string;
  treatment_en: string;
  treatment_bn: string;
  prevention_en: string;
  prevention_bn: string;
  
  // Products
  recommendedProducts?: Product[];
  
  // Expert Review
  reviewStatus: 'pending' | 'reviewed' | 'not_required';
  reviewedBy?: string;              // Doctor ID
  reviewedAt?: string;
  expertNotes?: string;
  expertNotes_bn?: string;
  
  // User Actions
  saved: boolean;
  shared: boolean;
  consultationRequested: boolean;
}

interface Product {
  name: string;
  name_bn: string;
  type: 'pesticide' | 'fungicide' | 'fertilizer';
  dosage: string;
  dosage_bn: string;
  price?: number;
  availability?: string;
}
```

**Example:**
```json
{
  "scanId": "scan_202602210845",
  "userId": "user_abc123",
  "timestamp": "2026-02-21T08:45:30Z",
  "image_ref": "https://example.com/scans/scan_202602210845.jpg",
  "disease": "Late Blight",
  "disease_bn": "পাতা পচা রোগ",
  "confidence": 87,
  "severity": "high",
  "cropType": "Potato",
  "cropType_bn": "আলু",
  "advisory_en": "Remove affected leaves immediately...",
  "advisory_bn": "আক্রান্ত পাতা অবিলম্বে অপসারণ করুন...",
  "treatment_en": "Apply copper-based fungicide...",
  "treatment_bn": "তামা ভিত্তিক ছত্রাকনাশক প্রয়োগ করুন...",
  "prevention_en": "Maintain proper spacing between plants...",
  "prevention_bn": "গাছের মধ্যে সঠিক দূরত্ব বজায় রাখুন...",
  "recommendedProducts": [
    {
      "name": "Copper Oxychloride 50% WP",
      "name_bn": "কপার অক্সিক্লোরাইড ৫০% ডব্লিউপি",
      "type": "fungicide",
      "dosage": "2g per liter",
      "dosage_bn": "প্রতি লিটারে ২ গ্রাম",
      "price": 250
    }
  ],
  "reviewStatus": "pending",
  "saved": true,
  "shared": false,
  "consultationRequested": true
}
```

---

### Irrigation Model

```typescript
interface IrrigationSystem {
  systemId: string;
  userId: string;
  farmId?: string;
  
  // Current Status
  moisture: number;                 // 0-100 percentage
  moistureStatus: 'low' | 'moderate' | 'healthy';
  autoMode: boolean;
  isWatering: boolean;
  
  // Schedule
  nextWatering: string;
  nextWatering_bn: string;
  lastWatered?: string;
  
  // Configuration
  policy: IrrigationPolicy;
  
  // Sensor Data
  sensorData?: SensorReading[];
  
  // Usage History
  usage: WaterUsage[];
  
  // Alerts
  alerts: Alert[];
}

interface IrrigationPolicy {
  crop: string;
  crop_bn: string;
  threshold: number;                // Moisture % to trigger watering
  amount: string;                   // e.g., "500L"
  duration: number;                 // Minutes
  frequency: number;                // Times per day (if auto)
}

interface SensorReading {
  timestamp: string;
  moisture: number;
  temperature?: number;
  humidity?: number;
}

interface WaterUsage {
  date: string;
  day?: string;
  day_bn?: string;
  amount: number;                   // Liters
  duration: number;                 // Minutes
  automatic: boolean;
}
```

**Example:**
```json
{
  "systemId": "irr_farm123",
  "userId": "user_abc123",
  "moisture": 68,
  "moistureStatus": "moderate",
  "autoMode": true,
  "isWatering": false,
  "nextWatering": "2 hours",
  "nextWatering_bn": "২ ঘন্টা",
  "lastWatered": "2026-02-21T06:30:00Z",
  "policy": {
    "crop": "Rice",
    "crop_bn": "ধান",
    "threshold": 60,
    "amount": "500L",
    "duration": 30,
    "frequency": 2
  },
  "usage": [
    {
      "date": "2026-02-21",
      "day": "Monday",
      "day_bn": "সোমবার",
      "amount": 500,
      "duration": 30,
      "automatic": true
    }
  ],
  "alerts": [
    {
      "alertId": "alert_001",
      "type": "info",
      "message": "Watering scheduled in 2 hours",
      "message_bn": "২ ঘন্টায় সেচ নির্ধারিত",
      "timestamp": "2026-02-21T08:45:00Z",
      "read": false
    }
  ]
}
```

---

### Market Price Model

```typescript
interface MarketPrice {
  priceId: string;
  crop: string;
  crop_bn: string;
  market: string;
  market_bn: string;
  location: Location;
  
  // Current Price
  price: number;                    // Per kg in BDT (৳)
  unit: 'kg' | 'quintal' | 'ton';
  currency: 'BDT';
  
  // Trends
  change: number;                   // Percentage change
  trend: 'up' | 'down' | 'stable';
  previousPrice: number;
  
  // Historical Data
  history: PriceHistory[];
  
  // Metadata
  quality?: 'premium' | 'standard' | 'low';
  source: string;                   // Data source
  lastUpdated: string;
  nextUpdate?: string;
}

interface PriceHistory {
  date: string;                     // YYYY-MM-DD
  price: number;
  volume?: number;                  // Trading volume
}
```

**Example:**
```json
{
  "priceId": "price_rice_dhaka_001",
  "crop": "Rice",
  "crop_bn": "ধান",
  "market": "Dhaka Wholesale Market",
  "market_bn": "ঢাকা পাইকারি বাজার",
  "location": {
    "lat": 23.7104,
    "lon": 90.4074,
    "name": "Dhaka",
    "name_bn": "ঢাকা"
  },
  "price": 450,
  "unit": "kg",
  "currency": "BDT",
  "change": 5.2,
  "trend": "up",
  "previousPrice": 428,
  "history": [
    { "date": "2026-02-21", "price": 450 },
    { "date": "2026-02-20", "price": 445 },
    { "date": "2026-02-19", "price": 440 }
  ],
  "quality": "standard",
  "source": "DAM (Department of Agricultural Marketing)",
  "lastUpdated": "2026-02-21T09:00:00Z",
  "nextUpdate": "2026-02-22T09:00:00Z"
}
```

---

### Weather Model

```typescript
interface Weather {
  locationId: string;
  location: Location;
  
  // Current Weather
  current: CurrentWeather;
  
  // Forecast
  forecast: WeatherForecast[];
  
  // Alerts
  alerts: WeatherAlert[];
  
  // Agricultural Data
  agricultural?: AgriculturalWeather;
  
  // Metadata
  lastUpdated: string;
  source: string;
}

interface CurrentWeather {
  temp: number;                     // Celsius
  feelsLike?: number;
  condition: string;
  condition_bn: string;
  humidity: number;                 // Percentage
  rainfall: number;                 // Probability %
  windSpeed?: number;               // km/h
  pressure?: number;                // hPa
  uvIndex?: number;
}

interface WeatherForecast {
  date: string;
  day: string;
  day_bn: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  condition: string;
  condition_bn: string;
  rainfall: number;                 // Probability %
  humidity: number;
}

interface WeatherAlert {
  alertId: string;
  type: 'storm' | 'heavy_rain' | 'drought' | 'frost' | 'heatwave';
  severity: 'low' | 'medium' | 'high';
  message: string;
  message_bn: string;
  validFrom: string;
  validUntil: string;
  issued: string;
}

interface AgriculturalWeather {
  soilTemperature?: number;
  soilMoisture?: number;
  evapotranspiration?: number;
  growingDegreeDays?: number;
  recommendations?: string[];
  recommendations_bn?: string[];
}
```

**Example:**
```json
{
  "locationId": "loc_dhaka",
  "location": {
    "lat": 23.8103,
    "lon": 90.4125,
    "name": "Dhaka",
    "name_bn": "ঢাকা"
  },
  "current": {
    "temp": 28,
    "feelsLike": 32,
    "condition": "Partly Cloudy",
    "condition_bn": "আংশিক মেঘলা",
    "humidity": 75,
    "rainfall": 40,
    "windSpeed": 12,
    "uvIndex": 7
  },
  "forecast": [
    {
      "date": "2026-02-22",
      "day": "Tomorrow",
      "day_bn": "আগামীকাল",
      "temp": 29,
      "tempMin": 22,
      "tempMax": 32,
      "condition": "Sunny",
      "condition_bn": "রৌদ্রোজ্জ্বল",
      "rainfall": 20,
      "humidity": 70
    }
  ],
  "alerts": [
    {
      "alertId": "alert_weather_001",
      "type": "heavy_rain",
      "severity": "medium",
      "message": "Heavy rain expected in next 24 hours",
      "message_bn": "আগামী ২৪ ঘন্টায় ভারী বৃষ্টির সম্ভাবনা",
      "validFrom": "2026-02-22T00:00:00Z",
      "validUntil": "2026-02-23T00:00:00Z",
      "issued": "2026-02-21T10:00:00Z"
    }
  ],
  "agricultural": {
    "soilTemperature": 25,
    "recommendations": [
      "Good time for transplanting rice seedlings"
    ],
    "recommendations_bn": [
      "ধানের চারা রোপণের জন্য উপযুক্ত সময়"
    ]
  },
  "lastUpdated": "2026-02-21T10:00:00Z",
  "source": "BMD (Bangladesh Meteorological Department)"
}
```

---

### Consultation Model

```typescript
interface Consultation {
  consultationId: string;
  farmerId: string;
  farmerName: string;
  farmerName_bn: string;
  doctorId: string;
  doctorName: string;
  doctorName_bn: string;
  
  // Consultation Details
  type: 'disease' | 'general' | 'pest' | 'soil' | 'nutrition';
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  
  // Related Data
  diseaseDetectionId?: string;      // If related to disease scan
  cropLogId?: string;               // If related to crop log
  
  // Content
  subject: string;
  subject_bn: string;
  description: string;
  description_bn: string;
  images?: string[];
  
  // Communication
  messages: Message[];
  
  // Scheduling
  requestedAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  
  // Outcome
  diagnosis?: string;
  diagnosis_bn?: string;
  recommendations?: string[];
  recommendations_bn?: string[];
  prescriptions?: Prescription[];
  followUpRequired: boolean;
  followUpDate?: string;
  
  // Feedback
  rating?: number;
  feedback?: string;
}

interface Message {
  messageId: string;
  senderId: string;
  senderRole: 'farmer' | 'doctor';
  content: string;
  timestamp: string;
  read: boolean;
  attachments?: string[];
}

interface Prescription {
  product: string;
  product_bn: string;
  type: 'pesticide' | 'fungicide' | 'fertilizer' | 'medicine';
  dosage: string;
  dosage_bn: string;
  frequency: string;
  frequency_bn: string;
  duration: string;
  duration_bn: string;
  notes?: string;
  notes_bn?: string;
}
```

---

### Crop Log Model

```typescript
interface CropLog {
  logId: string;
  userId: string;
  farmId?: string;
  
  // Crop Information
  crop: string;
  crop_bn: string;
  variety?: string;
  variety_bn?: string;
  
  // Timeline
  plantedDate: string;
  expectedHarvest: string;
  actualHarvest?: string;
  
  // Area
  area: number;                     // In acres or hectares
  unit: 'acre' | 'hectare';
  location?: Location;
  
  // Activities
  activities: CropActivity[];
  
  // Performance
  yield?: Yield;
  health: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Sharing
  sharedWith: string[];             // Doctor IDs with access
  shareRequests: ShareRequest[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface CropActivity {
  activityId: string;
  date: string;
  type: 'planting' | 'watering' | 'fertilizing' | 'pesticide' | 'weeding' | 'harvesting' | 'other';
  description: string;
  description_bn: string;
  products?: string[];              // Products used
  cost?: number;
  notes?: string;
  notes_bn?: string;
  images?: string[];
}

interface Yield {
  amount: number;
  unit: 'kg' | 'quintal' | 'ton';
  quality: 'premium' | 'standard' | 'low';
  marketValue?: number;
}

interface ShareRequest {
  requestId: string;
  doctorId: string;
  doctorName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
}
```

---

## Mock Data Files

### Location: `/src/app/utils/mockData.ts`

**Exported Data:**
- `mockDiseaseResult` - Sample disease detection result
- `mockIrrigation` - Sample irrigation system data
- `mockPrices` - Sample market prices (array)
- `mockWeather` - Sample weather data
- `mockExperts` - Sample doctor profiles (array)
- `mockUsers` - Sample user data (array)
- `mockConsultations` - Sample consultations (array)
- `mockCropLogs` - Sample crop logs (array)

---

## API Endpoints (Future Implementation)

### Authentication

#### POST /api/auth/send-otp
```typescript
Request: {
  phone: string;
}

Response: {
  success: boolean;
  message: string;
  otpSent: boolean;
}
```

#### POST /api/auth/verify-otp
```typescript
Request: {
  phone: string;
  otp: string;
}

Response: {
  success: boolean;
  token: string;
  user: User;
}
```

#### POST /api/auth/logout
```typescript
Request: {
  token: string;
}

Response: {
  success: boolean;
}
```

---

### Disease Detection

#### POST /api/disease/detect
```typescript
Request: FormData {
  image: File;
  userId: string;
  cropType?: string;
}

Response: {
  success: boolean;
  detection: DiseaseDetection;
}
```

#### GET /api/disease/history
```typescript
Query: {
  userId: string;
  limit?: number;
  offset?: number;
}

Response: {
  success: boolean;
  detections: DiseaseDetection[];
  total: number;
}
```

#### POST /api/disease/request-review
```typescript
Request: {
  scanId: string;
  userId: string;
  notes?: string;
}

Response: {
  success: boolean;
  consultationId: string;
}
```

---

### Irrigation

#### GET /api/irrigation/status
```typescript
Query: {
  userId: string;
  systemId?: string;
}

Response: {
  success: boolean;
  system: IrrigationSystem;
}
```

#### POST /api/irrigation/water-now
```typescript
Request: {
  systemId: string;
  userId: string;
  duration?: number;
  amount?: number;
}

Response: {
  success: boolean;
  started: boolean;
  estimatedDuration: number;
}
```

#### PUT /api/irrigation/toggle-auto
```typescript
Request: {
  systemId: string;
  userId: string;
  enabled: boolean;
}

Response: {
  success: boolean;
  autoMode: boolean;
}
```

#### PUT /api/irrigation/policy
```typescript
Request: {
  systemId: string;
  userId: string;
  policy: IrrigationPolicy;
}

Response: {
  success: boolean;
  policy: IrrigationPolicy;
}
```

---

### Market Prices

#### GET /api/prices/current
```typescript
Query: {
  location?: string;
  crop?: string;
  market?: string;
}

Response: {
  success: boolean;
  prices: MarketPrice[];
}
```

#### GET /api/prices/history
```typescript
Query: {
  crop: string;
  market: string;
  startDate: string;
  endDate: string;
}

Response: {
  success: boolean;
  history: PriceHistory[];
}
```

#### POST /api/prices/alert
```typescript
Request: {
  userId: string;
  crop: string;
  targetPrice: number;
  condition: 'above' | 'below';
}

Response: {
  success: boolean;
  alertId: string;
}
```

---

### Weather

#### GET /api/weather/current
```typescript
Query: {
  lat: number;
  lon: number;
}

Response: {
  success: boolean;
  weather: Weather;
}
```

#### GET /api/weather/forecast
```typescript
Query: {
  lat: number;
  lon: number;
  days: number;
}

Response: {
  success: boolean;
  forecast: WeatherForecast[];
}
```

---

### Consultations

#### POST /api/consultations/request
```typescript
Request: {
  farmerId: string;
  doctorId?: string;
  type: string;
  subject: string;
  description: string;
  images?: string[];
}

Response: {
  success: boolean;
  consultation: Consultation;
}
```

#### GET /api/consultations/list
```typescript
Query: {
  userId: string;
  role: 'farmer' | 'doctor';
  status?: string;
}

Response: {
  success: boolean;
  consultations: Consultation[];
}
```

#### POST /api/consultations/message
```typescript
Request: {
  consultationId: string;
  senderId: string;
  content: string;
}

Response: {
  success: boolean;
  message: Message;
}
```

---

### Admin - User Management

#### GET /api/admin/users
```typescript
Query: {
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

Response: {
  success: boolean;
  users: User[];
  total: number;
}
```

#### PUT /api/admin/users/:userId
```typescript
Request: {
  role?: UserRole;
  status?: UserStatus;
}

Response: {
  success: boolean;
  user: User;
}
```

---

### Admin - Doctor Verification

#### GET /api/admin/verification/pending
```typescript
Response: {
  success: boolean;
  applications: DoctorProfile[];
}
```

#### POST /api/admin/verification/approve
```typescript
Request: {
  doctorId: string;
  adminId: string;
  notes?: string;
}

Response: {
  success: boolean;
  doctor: DoctorProfile;
}
```

#### POST /api/admin/verification/reject
```typescript
Request: {
  doctorId: string;
  adminId: string;
  reason: string;
}

Response: {
  success: boolean;
}
```

---

## Error Responses

### Standard Error Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    message_bn?: string;
    details?: any;
  };
}
```

**Common Error Codes:**
- `AUTH_REQUIRED` - Authentication required
- `INVALID_TOKEN` - Invalid or expired token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMIT` - Too many requests
- `SERVER_ERROR` - Internal server error

---

## Database Schema (Supabase/PostgreSQL)

### Tables

```sql
-- Users
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Doctor Profiles
CREATE TABLE doctor_profiles (
  doctor_id UUID PRIMARY KEY REFERENCES users(user_id),
  specialization TEXT[],
  specialization_bn TEXT[],
  qualifications TEXT[],
  experience INTEGER,
  rating DECIMAL(2,1),
  total_consultations INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES users(user_id),
  available BOOLEAN DEFAULT TRUE,
  bio TEXT,
  bio_bn TEXT
);

-- Disease Detections
CREATE TABLE disease_detections (
  scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  timestamp TIMESTAMP DEFAULT NOW(),
  image_url TEXT NOT NULL,
  disease VARCHAR(255),
  disease_bn VARCHAR(255),
  confidence INTEGER,
  severity VARCHAR(20),
  crop_type VARCHAR(100),
  advisory_en TEXT,
  advisory_bn TEXT,
  treatment_en TEXT,
  treatment_bn TEXT,
  prevention_en TEXT,
  prevention_bn TEXT,
  review_status VARCHAR(20) DEFAULT 'not_required',
  reviewed_by UUID REFERENCES users(user_id),
  reviewed_at TIMESTAMP,
  saved BOOLEAN DEFAULT FALSE
);

-- Irrigation Systems
CREATE TABLE irrigation_systems (
  system_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  moisture INTEGER,
  auto_mode BOOLEAN DEFAULT FALSE,
  is_watering BOOLEAN DEFAULT FALSE,
  next_watering TIMESTAMP,
  policy JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Market Prices
CREATE TABLE market_prices (
  price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop VARCHAR(100) NOT NULL,
  crop_bn VARCHAR(100),
  market VARCHAR(255) NOT NULL,
  market_bn VARCHAR(255),
  location JSONB,
  price DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'kg',
  change DECIMAL(5,2),
  trend VARCHAR(10),
  quality VARCHAR(20),
  source VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Consultations
CREATE TABLE consultations (
  consultation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES users(user_id),
  doctor_id UUID REFERENCES users(user_id),
  type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  subject TEXT,
  subject_bn TEXT,
  description TEXT,
  description_bn TEXT,
  disease_detection_id UUID REFERENCES disease_detections(scan_id),
  requested_at TIMESTAMP DEFAULT NOW(),
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  rating INTEGER,
  feedback TEXT
);

-- Crop Logs
CREATE TABLE crop_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  crop VARCHAR(100) NOT NULL,
  crop_bn VARCHAR(100),
  planted_date DATE,
  expected_harvest DATE,
  actual_harvest DATE,
  area DECIMAL(10,2),
  unit VARCHAR(20),
  health VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## LocalStorage Keys

```typescript
// User State
'smartFarming_userMode': 'guest' | 'logged-in'
'smartFarming_userRole': 'farmer' | 'doctor' | 'admin'
'smartFarming_userId': string
'smartFarming_userName': string
'smartFarming_doctorVerified': 'true' | 'false'

// Settings
'smartFarming_language': 'bn' | 'en'
'smartFarming_location': JSON string
'smartFarming_onboardingCompleted': 'true' | 'false'
'smartFarming_notificationsEnabled': 'true' | 'false'

// Cache
'smartFarming_weatherCache': JSON string
'smartFarming_priceCache': JSON string
'smartFarming_lastSync': ISO timestamp string
```

---

**Document Version:** 1.0  
**Last Updated:** February 2026
