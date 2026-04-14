# Database Quick Reference Guide

## 🎯 Quick Start

### Run All Migrations (Supabase Dashboard)

1. Open SQL Editor in Supabase Dashboard
2. Copy and paste `001_initial_schema.sql` → Click "Run"
3. Copy and paste `002_seed_data_functions.sql` → Click "Run"
4. Done! ✅

### Verify Installation

```sql
-- Check all tables exist
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 30+ tables

-- Check sample data
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Diseases', COUNT(*) FROM disease_detections
UNION ALL
SELECT 'Prices', COUNT(*) FROM market_prices
UNION ALL
SELECT 'Weather', COUNT(*) FROM weather_data;
```

## 📊 Common Operations

### User Management

```sql
-- Create new farmer
INSERT INTO users (user_name, user_name_bn, phone, password_hash, role, language)
VALUES (
  'Kamal Hossain',
  'কামাল হোসেন',
  '+8801712345678',
  '$2b$10$hashedPasswordHere',
  'farmer',
  'bn'
);

-- Get user by phone
SELECT * FROM users WHERE phone = '+8801712345678';

-- Update user language preference
UPDATE users 
SET language = 'en' 
WHERE user_id = 'USER_UUID';

-- Get user statistics
SELECT * FROM get_user_stats('USER_UUID');
```

### Doctor Management

```sql
-- Get all pending doctor verifications (Admin)
SELECT 
  u.user_id,
  u.user_name,
  u.phone,
  dp.specialization,
  dp.qualifications,
  dp.registration_number
FROM users u
JOIN doctor_profiles dp ON u.user_id = dp.doctor_id
WHERE dp.verification_status = 'pending';

-- Verify a doctor (Admin)
UPDATE doctor_profiles
SET 
  verified = true,
  verification_status = 'approved',
  verified_at = NOW(),
  verified_by = 'ADMIN_USER_UUID'
WHERE doctor_id = 'DOCTOR_UUID';

-- Get verified doctors
SELECT * FROM active_doctors LIMIT 10;

-- Find nearby doctors
SELECT * FROM find_nearby_doctors(23.8103, 90.4125, 50);
```

### Disease Detection

```sql
-- Save new disease detection
INSERT INTO disease_detections (
  user_id,
  image_url,
  crop_type,
  crop_type_bn,
  disease,
  disease_bn,
  confidence,
  severity,
  advisory_en,
  advisory_bn
) VALUES (
  'USER_UUID',
  'https://example.com/image.jpg',
  'Rice',
  'ধান',
  'Brown Spot',
  'বাদামী দাগ',
  85.5,
  'medium',
  'Remove affected leaves...',
  'আক্রান্ত পাতা সরান...'
);

-- Get user's disease history
SELECT * FROM disease_detections
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 10;

-- Get diseases requiring expert review
SELECT * FROM disease_detections
WHERE review_status = 'pending'
ORDER BY severity DESC, created_at ASC;
```

### Consultations

```sql
-- Create new consultation
INSERT INTO consultations (
  farmer_id,
  farmer_name,
  farmer_name_bn,
  type,
  subject,
  subject_bn,
  description,
  description_bn,
  priority
) VALUES (
  'FARMER_UUID',
  'Rahim Ahmed',
  'রহিম আহমেদ',
  'disease',
  'Rice disease help needed',
  'ধানের রোগ সাহায্য প্রয়োজন',
  'My rice plants are showing yellow spots...',
  'আমার ধান গাছে হলুদ দাগ দেখা যাচ্ছে...',
  'high'
);

-- Assign consultation to doctor
UPDATE consultations
SET 
  doctor_id = 'DOCTOR_UUID',
  doctor_name = 'Dr. Abdul Karim',
  doctor_name_bn = 'ডাঃ আব্দুল করিম',
  status = 'accepted',
  accepted_at = NOW()
WHERE consultation_id = 'CONSULTATION_UUID';

-- Add message to consultation
INSERT INTO consultation_messages (
  consultation_id,
  sender_id,
  sender_role,
  content
) VALUES (
  'CONSULTATION_UUID',
  'DOCTOR_UUID',
  'doctor',
  'Based on the image, this appears to be bacterial blight...'
);

-- Get active consultations
SELECT * FROM active_consultations LIMIT 10;

-- Complete consultation
UPDATE consultations
SET 
  status = 'completed',
  completed_at = NOW(),
  diagnosis = 'Bacterial Blight',
  diagnosis_bn = 'ব্যাকটেরিয়াল ব্লাইট',
  recommendations = ARRAY['Apply copper-based spray', 'Remove affected plants']
WHERE consultation_id = 'CONSULTATION_UUID';
```

### Market Prices

```sql
-- Add new market price
INSERT INTO market_prices (
  crop,
  crop_bn,
  market,
  market_bn,
  district,
  district_bn,
  price,
  unit,
  previous_price,
  quality,
  source,
  source_type,
  verified,
  price_date
) VALUES (
  'Tomato',
  'টমেটো',
  'Dhaka Wholesale Market',
  'ঢাকা পাইকারি বাজার',
  'Dhaka',
  'ঢাকা',
  50.00,
  'kg',
  48.00,
  'standard',
  'DAM',
  'official',
  true,
  CURRENT_DATE
);

-- Get latest prices
SELECT * FROM latest_market_prices WHERE crop = 'Rice';

-- Get price trend for last 30 days
SELECT 
  crop,
  market,
  date,
  price,
  AVG(price) OVER (
    PARTITION BY crop, market 
    ORDER BY date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as moving_avg_7d
FROM price_history
WHERE crop = 'Rice'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### Price Alerts

```sql
-- Create price alert
INSERT INTO price_alerts (
  user_id,
  crop,
  crop_bn,
  target_price,
  condition,
  notify_by_app,
  notify_by_sms
) VALUES (
  'USER_UUID',
  'Rice',
  'ধান',
  500.00,
  'above',
  true,
  true
);

-- Get active alerts
SELECT * FROM price_alerts
WHERE user_id = 'USER_UUID'
  AND is_active = true
ORDER BY created_at DESC;

-- Trigger alert (when price condition met)
UPDATE price_alerts
SET 
  triggered = true,
  triggered_at = NOW()
WHERE alert_id = 'ALERT_UUID';
```

### Irrigation Management

```sql
-- Create irrigation system
INSERT INTO irrigation_systems (
  user_id,
  system_name,
  system_name_bn,
  system_type,
  current_crop,
  current_crop_bn,
  auto_mode,
  threshold,
  target_moisture
) VALUES (
  'USER_UUID',
  'Main Field System',
  'প্রধান ক্ষেত্র সিস্টেম',
  'drip',
  'Rice',
  'ধান',
  true,
  60.0,
  80.0
);

-- Record sensor reading
INSERT INTO irrigation_sensor_readings (
  system_id,
  moisture,
  temperature,
  humidity,
  soil_ph
) VALUES (
  'SYSTEM_UUID',
  68.5,
  28.0,
  75.0,
  6.8
);

-- Get current irrigation status
SELECT * FROM irrigation_systems
WHERE user_id = 'USER_UUID';

-- Record water usage
INSERT INTO water_usage_history (
  system_id,
  date,
  amount,
  duration,
  automatic,
  moisture_before,
  moisture_after,
  triggered_by,
  started_at,
  ended_at
) VALUES (
  'SYSTEM_UUID',
  CURRENT_DATE,
  500,
  30,
  true,
  55.0,
  78.0,
  'threshold',
  NOW() - INTERVAL '30 minutes',
  NOW()
);
```

### Crop Logs

```sql
-- Create new crop log
INSERT INTO crop_logs (
  user_id,
  crop,
  crop_bn,
  variety,
  variety_bn,
  planted_date,
  expected_harvest,
  area,
  unit,
  expected_yield,
  yield_unit
) VALUES (
  'USER_UUID',
  'Rice',
  'ধান',
  'BRRI dhan28',
  'ব্রি ধান২৮',
  '2026-01-15',
  '2026-05-15',
  2.5,
  'acre',
  5000,
  'kg'
);

-- Add activity to crop log
INSERT INTO crop_activities (
  log_id,
  user_id,
  date,
  activity_type,
  description,
  description_bn,
  cost,
  labor_hours
) VALUES (
  'LOG_UUID',
  'USER_UUID',
  CURRENT_DATE,
  'fertilizing',
  'Applied urea fertilizer',
  'ইউরিয়া সার প্রয়োগ করা হয়েছে',
  1500.00,
  2.5
);

-- Get crop profitability
SELECT calculate_crop_profitability('LOG_UUID');

-- Update crop health
UPDATE crop_logs
SET 
  health = 'good',
  health_notes = 'Plants are growing well',
  updated_at = NOW()
WHERE log_id = 'LOG_UUID';
```

### Weather Data

```sql
-- Get current weather for location
SELECT * FROM weather_data
WHERE district = 'Dhaka'
ORDER BY observation_time DESC
LIMIT 1;

-- Get weather forecast
SELECT * FROM weather_forecasts
WHERE district = 'Dhaka'
  AND forecast_date >= CURRENT_DATE
ORDER BY forecast_date ASC
LIMIT 7;

-- Get active weather alerts
SELECT * FROM weather_alerts
WHERE status = 'active'
  AND 'Dhaka' = ANY(districts)
  AND valid_until > NOW()
ORDER BY severity DESC;
```

### Notifications

```sql
-- Create notification
INSERT INTO notifications (
  user_id,
  type,
  title,
  title_bn,
  message,
  message_bn,
  priority,
  related_entity_type,
  related_entity_id
) VALUES (
  'USER_UUID',
  'price_alert',
  'Price Alert Triggered',
  'মূল্য সতর্কতা সক্রিয়',
  'Rice price has reached your target of ৳500/kg',
  'ধানের দাম আপনার লক্ষ্য ৳৫০০/কেজিতে পৌঁছেছে',
  'high',
  'price_alert',
  'ALERT_UUID'
);

-- Get unread notifications
SELECT * FROM notifications
WHERE user_id = 'USER_UUID'
  AND read = false
ORDER BY priority DESC, created_at DESC;

-- Mark notification as read
UPDATE notifications
SET 
  read = true,
  read_at = NOW()
WHERE notification_id = 'NOTIFICATION_UUID';
```

### IoT Devices

```sql
-- Register new device
INSERT INTO devices (
  user_id,
  device_name,
  device_type,
  device_model,
  serial_number,
  connection_type,
  status
) VALUES (
  'USER_UUID',
  'Soil Moisture Sensor 1',
  'sensor',
  'DHT22-Pro',
  'SN123456789',
  'wifi',
  'online'
);

-- Record device reading
INSERT INTO device_readings (
  device_id,
  data,
  reading_type,
  value,
  unit
) VALUES (
  'DEVICE_UUID',
  '{"moisture": 68.5, "temperature": 28.0, "battery": 85}'::jsonb,
  'moisture',
  68.5,
  'percent'
);

-- Get device status
SELECT 
  d.*,
  dr.data as latest_reading
FROM devices d
LEFT JOIN LATERAL (
  SELECT data 
  FROM device_readings 
  WHERE device_id = d.device_id 
  ORDER BY recorded_at DESC 
  LIMIT 1
) dr ON true
WHERE d.user_id = 'USER_UUID';
```

## 🔧 Maintenance Operations

```sql
-- Expire old sessions (run hourly)
SELECT expire_old_sessions();

-- Clean up old notifications (run daily)
SELECT cleanup_old_notifications();

-- Refresh statistics (run daily)
SELECT refresh_daily_statistics();

-- Database maintenance (run weekly)
SELECT maintain_database();

-- Update doctor rating
SELECT update_doctor_rating('DOCTOR_UUID');
```

## 📊 Analytics Queries

```sql
-- Daily user registrations
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE role = 'farmer') as farmers,
  COUNT(*) FILTER (WHERE role = 'doctor') as doctors,
  COUNT(*) as total
FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Most common diseases
SELECT 
  disease,
  disease_bn,
  COUNT(*) as count,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM disease_detections
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY disease, disease_bn
ORDER BY count DESC
LIMIT 10;

-- Top performing doctors
SELECT 
  u.user_name,
  dp.rating,
  dp.total_consultations,
  dp.completed_consultations,
  ROUND((dp.completed_consultations::numeric / 
         NULLIF(dp.total_consultations, 0) * 100), 2) as completion_rate
FROM users u
JOIN doctor_profiles dp ON u.user_id = dp.doctor_id
WHERE dp.verified = true
ORDER BY dp.rating DESC
LIMIT 10;

-- Crop price volatility
SELECT 
  crop,
  STDDEV(price) as price_volatility,
  AVG(price) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM market_prices
WHERE price_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY crop
ORDER BY price_volatility DESC;

-- User engagement metrics
SELECT 
  u.user_id,
  u.user_name,
  COUNT(DISTINCT dd.scan_id) as total_scans,
  COUNT(DISTINCT c.consultation_id) as total_consultations,
  COUNT(DISTINCT cl.log_id) as active_crops,
  MAX(u.last_active) as last_active
FROM users u
LEFT JOIN disease_detections dd ON u.user_id = dd.user_id
LEFT JOIN consultations c ON u.user_id = c.farmer_id
LEFT JOIN crop_logs cl ON u.user_id = cl.user_id AND cl.status = 'active'
WHERE u.role = 'farmer'
GROUP BY u.user_id, u.user_name
ORDER BY total_scans DESC
LIMIT 20;
```

## 🔍 Debugging Queries

```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find slow queries (requires pg_stat_statements)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## ⚠️ Important Notes

1. **Always use prepared statements** to prevent SQL injection
2. **Never store plain passwords** - always use bcrypt hashing
3. **Change default passwords** before production
4. **Enable RLS** on all sensitive tables
5. **Regular backups** are essential
6. **Monitor query performance** and optimize as needed
7. **Use transactions** for multi-step operations

## 🎓 Best Practices

```sql
-- Use transactions for multiple operations
BEGIN;
  INSERT INTO crop_logs (...) RETURNING log_id INTO new_log_id;
  INSERT INTO crop_activities (log_id, ...) VALUES (new_log_id, ...);
COMMIT;

-- Use UPSERT for idempotent operations
INSERT INTO market_prices (...)
VALUES (...)
ON CONFLICT (crop, market, price_date)
DO UPDATE SET price = EXCLUDED.price;

-- Use indexes for frequently queried columns
-- Already created in migrations, but add custom ones as needed

-- Use EXPLAIN ANALYZE to optimize queries
EXPLAIN ANALYZE
SELECT * FROM consultations WHERE status = 'pending';
```

---

**Quick Reference Version:** 1.0.0  
**Last Updated:** April 6, 2026
