# Database Schema Diagram

## 📊 Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SMART FARMING SYSTEM - DATABASE SCHEMA                 │
│                                  Version 1.0.0                                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION & USERS                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│      USERS          │  Primary table for all system users
├─────────────────────┤
│ PK user_id          │
│    user_name        │
│    user_name_bn     │
│    email (unique)   │
│    phone (unique)   │◄──┐
│    password_hash    │   │
│    role             │   │ Referenced by
│    status           │   │ multiple tables
│    language         │   │
│    location (JSONB) │   │
│    location_point   │   │
│    settings         │   │
│    created_at       │   │
│    last_active      │   │
└─────────────────────┘   │
         │                │
         │                │
         ├────────────────┼────────────────────┐
         │                │                    │
         ▼                ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ FARMER_PROFILES  │ │ DOCTOR_PROFILES  │ │    SESSIONS      │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ PK,FK farmer_id  │ │ PK,FK doctor_id  │ │ PK session_id    │
│ farm_name        │ │ specialization[] │ │ FK user_id       │
│ farm_size        │ │ qualifications[] │ │ access_token     │
│ primary_crops[]  │ │ experience       │ │ refresh_token    │
│ farming_type[]   │ │ rating           │ │ expires_at       │
│ verified         │ │ total_consult.   │ │ is_active        │
└──────────────────┘ │ verified         │ └──────────────────┘
                     │ available        │
                     │ consultation_fee │
                     └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DISEASE DETECTION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│    DISEASE_DETECTIONS       │  AI-powered disease identification
├─────────────────────────────┤
│ PK scan_id                  │
│ FK user_id      ────────────┼──> USERS
│    image_url                │
│    crop_type                │
│    crop_type_bn             │
│    disease                  │
│    disease_bn               │
│    confidence               │
│    severity                 │
│    advisory_en              │
│    advisory_bn              │
│    treatment_en             │
│    treatment_bn             │
│    prevention_en            │
│    prevention_bn            │
│    review_status            │
│ FK reviewed_by  ────────────┼──> USERS (doctor)
│    expert_notes             │
│    saved                    │
│    consultation_requested   │
│    location (JSONB)         │
│    created_at               │
└─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SMART IRRIGATION                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│  IRRIGATION_SYSTEMS     │  IoT irrigation control
├─────────────────────────┤
│ PK system_id            │
│ FK user_id  ────────────┼──> USERS
│    system_name          │
│    system_type          │
│    moisture             │
│    moisture_status      │
│    auto_mode            │
│    is_watering          │
│    next_watering        │
│    last_watered         │
│    policy (JSONB)       │
│    threshold            │
│    current_crop         │
│    location_point       │
└─────────────────────────┘
         │
         │ One to Many
         │
         ├──────────────────────┬──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ IRRIGATION_SENSOR_   │ │ WATER_USAGE_HISTORY │ │                      │
│     READINGS         │ │                      │ │                      │
├──────────────────────┤ ├──────────────────────┤ │                      │
│ PK reading_id        │ │ PK usage_id          │ │                      │
│ FK system_id         │ │ FK system_id         │ │                      │
│    moisture          │ │    date              │ │                      │
│    temperature       │ │    amount (liters)   │ │                      │
│    humidity          │ │    duration (min)    │ │                      │
│    soil_ph           │ │    automatic         │ │                      │
│    soil_ec           │ │    moisture_before   │ │                      │
│    recorded_at       │ │    moisture_after    │ │                      │
└──────────────────────┘ │    started_at        │ │                      │
                         └──────────────────────┘ │                      │

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARKET PRICES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│    MARKET_PRICES        │  Real-time crop pricing
├─────────────────────────┤
│ PK price_id             │
│    crop                 │
│    crop_bn              │
│    market               │
│    market_bn            │
│    district             │
│    location (JSONB)     │
│    location_point       │
│    price                │
│    unit                 │
│    previous_price       │
│    change (%)           │
│    trend                │
│    quality              │
│    source               │
│    verified             │
│    price_date           │
│    recorded_at          │
└─────────────────────────┘
         │
         │ Historical tracking
         │
         ▼
┌─────────────────────────┐        ┌──────────────────────┐
│    PRICE_HISTORY        │        │    PRICE_ALERTS      │
├─────────────────────────┤        ├──────────────────────┤
│ PK history_id           │        │ PK alert_id          │
│    crop                 │        │ FK user_id ──────────┼──> USERS
│    market               │        │    crop              │
│    date                 │        │    target_price      │
│    price                │        │    condition         │
│    volume               │        │    is_active         │
└─────────────────────────┘        │    triggered         │
                                   │    notify_by_app     │
                                   │    notify_by_sms     │
                                   └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            CONSULTATIONS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│     CONSULTATIONS        │  Farmer-Doctor interactions
├──────────────────────────┤
│ PK consultation_id       │
│ FK farmer_id ────────────┼──> USERS
│ FK doctor_id ────────────┼──> USERS
│    type                  │
│    status                │
│    priority              │
│    subject               │
│    subject_bn            │
│    description           │
│    description_bn        │
│ FK disease_detection_id ─┼──> DISEASE_DETECTIONS
│    message_count         │
│    requested_at          │
│    accepted_at           │
│    completed_at          │
│    diagnosis             │
│    recommendations[]     │
│    rating                │
│    feedback              │
└──────────────────────────┘
         │
         │ One to Many
         │
         ├──────────────────────┬──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ CONSULTATION_        │ │   PRESCRIPTIONS      │ │                      │
│    MESSAGES          │ │                      │ │                      │
├──────────────────────┤ ├──────────────────────┤ │                      │
│ PK message_id        │ │ PK prescription_id   │ │                      │
│ FK consultation_id   │ │ FK consultation_id   │ │                      │
│ FK sender_id         │ │ FK doctor_id         │ │                      │
│    sender_role       │ │    product           │ │                      │
│    content           │ │    product_bn        │ │                      │
│    message_type      │ │    product_type      │ │                      │
│    attachments[]     │ │    dosage            │ │                      │
│    read              │ │    frequency         │ │                      │
│    created_at        │ │    duration          │ │                      │
└──────────────────────┘ │    precautions       │ │                      │
                         │    prescribed_at     │ │                      │
                         └──────────────────────┘ │                      │

┌─────────────────────────────────────────────────────────────────────────────┐
│                            CROP MANAGEMENT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│      CROP_LOGS           │  Lifecycle tracking
├──────────────────────────┤
│ PK log_id                │
│ FK user_id ──────────────┼──> USERS
│    crop                  │
│    crop_bn               │
│    variety               │
│    planted_date          │
│    expected_harvest      │
│    actual_harvest        │
│    growth_stage          │
│    area                  │
│    unit                  │
│    location (JSONB)      │
│    location_point        │
│    health                │
│    expected_yield        │
│    actual_yield          │
│    total_investment      │
│    total_revenue         │
│    profit_loss           │
│    status                │
│    created_at            │
└──────────────────────────┘
         │
         │ Activity logging
         │
         ▼
┌──────────────────────────┐
│    CROP_ACTIVITIES       │
├──────────────────────────┤
│ PK activity_id           │
│ FK log_id                │
│ FK user_id ──────────────┼──> USERS
│    date                  │
│    activity_type         │
│    description           │
│    description_bn        │
│    products[]            │
│    quantity              │
│    cost                  │
│    labor_hours           │
│    notes                 │
│    images[]              │
│    created_at            │
└──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              WEATHER DATA                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐        ┌──────────────────────────┐
│     WEATHER_DATA         │        │   WEATHER_FORECASTS      │
├──────────────────────────┤        ├──────────────────────────┤
│ PK weather_id            │        │ PK forecast_id           │
│    location (JSONB)      │        │    location (JSONB)      │
│    location_point        │        │    location_point        │
│    location_name         │        │    forecast_date         │
│    district              │        │    forecast_day          │
│    temperature           │        │    temp_min              │
│    feels_like            │        │    temp_max              │
│    condition             │        │    condition             │
│    condition_bn          │        │    rainfall_probability  │
│    humidity              │        │    humidity              │
│    rainfall_probability  │        │    uv_index              │
│    wind_speed            │        │    recommendations[]     │
│    uv_index              │        │    valid_from            │
│    soil_temperature      │        │    valid_until           │
│    observation_time      │        └──────────────────────────┘
└──────────────────────────┘
                                   ┌──────────────────────────┐
                                   │    WEATHER_ALERTS        │
                                   ├──────────────────────────┤
                                   │ PK alert_id              │
                                   │    location (JSONB)      │
                                   │    districts[]           │
                                   │    alert_type            │
                                   │    severity              │
                                   │    message               │
                                   │    message_bn            │
                                   │    agricultural_impact   │
                                   │    affected_crops[]      │
                                   │    valid_from            │
                                   │    valid_until           │
                                   │    status                │
                                   └──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            IoT DEVICES                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│        DEVICES           │  IoT device registry
├──────────────────────────┤
│ PK device_id             │
│ FK user_id ──────────────┼──> USERS
│    device_name           │
│    device_type           │
│    device_model          │
│    serial_number         │
│    connection_type       │
│    status                │
│    is_active             │
│    battery_level         │
│    signal_strength       │
│    firmware_version      │
│    location (JSONB)      │
│    location_point        │
│    configuration (JSONB) │
│    last_seen             │
└──────────────────────────┘
         │
         │ Telemetry data
         │
         ▼
┌──────────────────────────┐
│    DEVICE_READINGS       │
├──────────────────────────┤
│ PK reading_id            │
│ FK device_id             │
│    data (JSONB)          │
│    reading_type          │
│    value                 │
│    unit                  │
│    quality               │
│    recorded_at           │
└──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM & NOTIFICATIONS                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐        ┌──────────────────────────┐
│     NOTIFICATIONS        │        │   SYSTEM_SETTINGS        │
├──────────────────────────┤        ├──────────────────────────┤
│ PK notification_id       │        │ PK setting_id            │
│ FK user_id ──────────────┼──> ┐   │    setting_key (unique)  │
│    type                  │    │   │    setting_value         │
│    title                 │    │   │    setting_type          │
│    title_bn              │    │   │    description           │
│    message               │    │   │    category              │
│    message_bn            │    │   │    is_public             │
│    priority              │    │   │    created_at            │
│    related_entity_type   │    │   │    updated_at            │
│    related_entity_id     │    │   │ FK updated_by ───────────┼──> USERS
│    read                  │    │   └──────────────────────────┘
│    expires_at            │    │
│    created_at            │    │
└──────────────────────────┘    │
                                │
┌──────────────────────────┐    │   ┌──────────────────────────┐
│    USER_ACTIVITIES       │    │   │      AUDIT_LOGS          │
├──────────────────────────┤    │   ├──────────────────────────┤
│ PK activity_id           │    │   │ PK audit_id              │
│ FK user_id ──────────────┼────┘   │ FK user_id ──────────────┼──> USERS
│    activity_type         │        │    action                │
│    entity_type           │        │    entity_type           │
│    entity_id             │        │    entity_id             │
│    action                │        │    old_values (JSONB)    │
│    ip_address            │        │    new_values (JSONB)    │
│    user_agent            │        │    changes (JSONB)       │
│    metadata (JSONB)      │        │    status                │
│    created_at            │        │    created_at            │
└──────────────────────────┘        └──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              VIEWS (Read-Only)                               │
└─────────────────────────────────────────────────────────────────────────────┘

VIEW: active_doctors                 - Verified, available doctors
VIEW: recent_disease_detections      - Last 100 disease scans
VIEW: active_consultations           - Pending/active consultations
VIEW: latest_market_prices           - Most recent prices per crop/market
VIEW: user_statistics                - Comprehensive user stats
VIEW: daily_statistics (MAT)         - Aggregated daily metrics

┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY RELATIONSHIPS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

USERS (1) ──< (Many) DISEASE_DETECTIONS
USERS (1) ──< (Many) CONSULTATIONS (as farmer)
USERS (1) ──< (Many) CONSULTATIONS (as doctor)
USERS (1) ──< (Many) CROP_LOGS
USERS (1) ──< (Many) IRRIGATION_SYSTEMS
USERS (1) ──< (Many) DEVICES
USERS (1) ──< (Many) NOTIFICATIONS
USERS (1) ──< (Many) PRICE_ALERTS

CONSULTATIONS (1) ──< (Many) CONSULTATION_MESSAGES
CONSULTATIONS (1) ──< (Many) PRESCRIPTIONS
CROP_LOGS (1) ──< (Many) CROP_ACTIVITIES
IRRIGATION_SYSTEMS (1) ──< (Many) IRRIGATION_SENSOR_READINGS
IRRIGATION_SYSTEMS (1) ──< (Many) WATER_USAGE_HISTORY
DEVICES (1) ──< (Many) DEVICE_READINGS

┌─────────────────────────────────────────────────────────────────────────────┐
│                          SPECIAL FEATURES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

🌍 GEOSPATIAL:
   - location_point columns use PostGIS GEOGRAPHY type
   - Efficient distance calculations
   - Spatial indexing with GiST

🌐 MULTI-LANGUAGE:
   - All user-facing text has _bn (Bengali) variant
   - Supports Bengali-first design

🔐 SECURITY:
   - Row-Level Security (RLS) on all sensitive tables
   - Password hashing with bcrypt
   - JWT session management
   - Audit logging

⚡ PERFORMANCE:
   - 100+ indexes for fast queries
   - Composite indexes for complex filters
   - GIN indexes for arrays/JSON
   - Materialized views for analytics

🔄 REAL-TIME:
   - Optimized for Supabase Realtime
   - Automatic triggers
   - Timestamp tracking

📱 OFFLINE-FIRST:
   - Comprehensive timestamps
   - Sync-friendly structure
   - Conflict resolution support
```

## 📈 Data Flow Examples

### User Registration Flow
```
1. INSERT INTO users (...)
2. INSERT INTO farmer_profiles (...) OR doctor_profiles (...)
3. INSERT INTO sessions (...)
4. INSERT INTO notifications (welcome message)
```

### Disease Detection Flow
```
1. INSERT INTO disease_detections (user_id, image_url, ...)
2. IF consultation_requested:
   INSERT INTO consultations (farmer_id, disease_detection_id, ...)
3. INSERT INTO notifications (disease result)
```

### Consultation Flow
```
1. INSERT INTO consultations (farmer_id, ...)
2. UPDATE consultations SET doctor_id = ... (doctor accepts)
3. INSERT INTO consultation_messages (...)
4. INSERT INTO prescriptions (...)
5. UPDATE consultations SET status = 'completed', rating = ...
6. TRIGGER update_doctor_rating()
```

### Market Price Update Flow
```
1. INSERT INTO market_prices (crop, market, price, ...)
2. INSERT INTO price_history (crop, market, price, ...)
3. SELECT * FROM price_alerts WHERE condition_met
4. INSERT INTO notifications (price alert triggered)
5. UPDATE price_alerts SET triggered = true
```

## 🔧 Helper Functions

```sql
-- Calculate distance between two GPS points
SELECT calculate_distance(23.8103, 90.4125, 24.3636, 88.6241);

-- Find nearby doctors within radius
SELECT * FROM find_nearby_doctors(lat, lon, radius_km);

-- Get comprehensive user statistics
SELECT * FROM get_user_stats(user_id);

-- Calculate crop profitability
SELECT calculate_crop_profitability(log_id);

-- Clean up expired data
SELECT expire_old_sessions();
SELECT cleanup_old_notifications();
SELECT maintain_database();
```

## 📊 Index Strategy

### Single Column Indexes
- All foreign keys
- Common filter columns (role, status, type)
- Date columns for sorting

### Composite Indexes
- (status, priority) for consultations
- (user_id, created_at) for user-specific queries
- (crop, price_date) for market prices

### Special Indexes
- GIN for arrays (specialization[], crops[])
- GIN for JSONB (location, settings, data)
- GiST for geospatial (location_point)
- Full-text for search (subject, description)

---

**Schema Version:** 1.0.0  
**Last Updated:** April 6, 2026  
**Total Tables:** 30+  
**Total Indexes:** 100+
