# Smart Farming System - Database Schema Documentation

## 📋 Overview

This directory contains the complete PostgreSQL database schema for the Smart Farming System, including:
- Complete table definitions
- Indexes for optimal performance
- Row-level security policies
- Helper functions and triggers
- Sample seed data
- Migration scripts

## 🗄️ Database Structure

### Core Tables (30+ tables)

#### 1. **Authentication & Users**
- `users` - Main user table with multi-role support
- `sessions` - JWT token management
- `farmer_profiles` - Extended farmer information
- `doctor_profiles` - Agricultural expert profiles

#### 2. **Disease Detection**
- `disease_detections` - AI-powered disease scans with expert review

#### 3. **Smart Irrigation**
- `irrigation_systems` - Irrigation system management
- `irrigation_sensor_readings` - Sensor data history
- `water_usage_history` - Water usage tracking

#### 4. **Market Information**
- `market_prices` - Real-time crop prices
- `price_history` - Historical price trends
- `price_alerts` - User price notifications

#### 5. **Consultations**
- `consultations` - Farmer-doctor consultations
- `consultation_messages` - Chat messages
- `prescriptions` - Treatment prescriptions

#### 6. **Crop Management**
- `crop_logs` - Crop lifecycle tracking
- `crop_activities` - Farm activity logs

#### 7. **Weather**
- `weather_data` - Current weather observations
- `weather_forecasts` - Weather predictions
- `weather_alerts` - Weather warnings

#### 8. **IoT & Devices**
- `devices` - IoT device registry
- `device_readings` - Sensor telemetry data

#### 9. **System**
- `notifications` - User notifications
- `user_activities` - Activity tracking
- `audit_logs` - Security audit trail
- `system_settings` - Application configuration

#### 10. **AI & File Storage**
- `assistant_chat_sessions` - Assistant chat session metadata
- `assistant_chat_messages` - Assistant and user message history
- `uploaded_documents` - Doctor and profile document storage metadata

## 🚀 Setup Instructions

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   ```
   https://app.supabase.com/project/YOUR_PROJECT_ID/editor
   ```

2. **Run Migration Files**
   - Navigate to SQL Editor
   - Copy content from `001_initial_schema.sql`
   - Click "Run"
   - Wait for completion
   - Copy content from `002_seed_data_functions.sql`
   - Click "Run"
  - Copy content from `003_system_storage_tables.sql`
  - Click "Run"

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### Option 3: Direct PostgreSQL Connection

```bash
# Connect to your database
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"

# Run migrations
\i supabase/migrations/001_initial_schema.sql
\i supabase/migrations/002_seed_data_functions.sql
\\i supabase/migrations/003_system_storage_tables.sql
```

## 📊 Key Features

### 1. **Multi-Language Support**
- All user-facing tables have `_bn` (Bengali) columns
- Supports Bengali-first design with English fallback

### 2. **Geospatial Support**
- PostGIS extension enabled
- Geography columns for location-based queries
- Helper functions for distance calculations

### 3. **Role-Based Access Control (RLS)**
- Row-level security policies on all sensitive tables
- Users can only access their own data
- Doctors see assigned consultations
- Admins have full access

### 4. **Real-time Support**
- Tables optimized for Supabase Realtime
- Triggers for real-time notifications
- Automatic counter updates

### 5. **Offline-First Ready**
- Timestamp columns on all tables
- Optimistic locking support
- Sync-friendly structure

## 🔧 Helper Functions

### Distance Calculation
```sql
SELECT calculate_distance(23.8103, 90.4125, 24.3636, 88.6241);
-- Returns distance in kilometers
```

### Find Nearby Doctors
```sql
SELECT * FROM find_nearby_doctors(23.8103, 90.4125, 50);
-- Returns doctors within 50km radius
```

### User Statistics
```sql
SELECT * FROM get_user_stats('user-uuid-here');
-- Returns comprehensive user statistics
```

### Calculate Crop Profitability
```sql
SELECT calculate_crop_profitability('log-uuid-here');
-- Returns cost, revenue, profit, and ROI
```

## 📈 Performance Optimization

### Indexes Created
- **100+ indexes** for optimal query performance
- Composite indexes for common query patterns
- GIN indexes for array and JSONB columns
- GiST indexes for geospatial queries
- Full-text search indexes

### Query Optimization
```sql
-- Analyze tables for query planner
ANALYZE users;
ANALYZE disease_detections;
ANALYZE consultations;
```

## 🔐 Security Features

### Row-Level Security (RLS)
```sql
-- Users can only see their own data
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = user_id);

-- Doctors see assigned consultations
CREATE POLICY consultations_select ON consultations
  FOR SELECT USING (
    auth.uid() = farmer_id OR 
    auth.uid() = doctor_id
  );
```

### Password Security
- Passwords stored with bcrypt hashing
- Default admin password: `admin123` (change immediately!)
- Session tokens with expiry

## 📝 Default Credentials

### Admin Account
```
Email: admin@smartfarming.com
Phone: +8801700000001
Password: admin123
Role: admin
```

### Doctor Account
```
Email: karim@smartfarming.com
Phone: +8801700000002
Password: admin123
Role: doctor
Status: Verified
```

### Farmer Account
```
Email: rahim@example.com
Phone: +8801700000003
Password: admin123
Role: farmer
```

**⚠️ IMPORTANT: Change all default passwords before production use!**

## 🗂️ Migration History

| Version | File | Description |
|---------|------|-------------|
| 001 | `001_initial_schema.sql` | Complete database schema with all tables, indexes, constraints |
| 002 | `002_seed_data_functions.sql` | Seed data, helper functions, and utilities |

## 🔄 Database Maintenance

### Regular Tasks

1. **Expire Old Sessions** (Recommended: Hourly)
   ```sql
   SELECT expire_old_sessions();
   ```

2. **Clean Up Notifications** (Recommended: Daily)
   ```sql
   SELECT cleanup_old_notifications();
   ```

3. **Refresh Statistics** (Recommended: Daily)
   ```sql
   SELECT refresh_daily_statistics();
   ```

4. **Database Maintenance** (Recommended: Weekly)
   ```sql
   SELECT maintain_database();
   ```

### Automated Jobs (using pg_cron)

If you have `pg_cron` extension:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule jobs
SELECT cron.schedule('expire-sessions', '0 * * * *', 
  'SELECT expire_old_sessions();');

SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 
  'SELECT cleanup_old_notifications();');
```

## 📦 Backup & Restore

### Backup Database

```bash
# Full backup
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" > backup.sql

# Schema only
pg_dump --schema-only "postgresql://..." > schema.sql

# Data only
pg_dump --data-only "postgresql://..." > data.sql
```

### Restore Database

```bash
# Restore from backup
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" < backup.sql
```

## 🧪 Testing Queries

### Verify Installation

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check sample data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM market_prices;
SELECT COUNT(*) FROM disease_detections;

-- Check functions
SELECT proname FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
AND prokind = 'f';
```

### Test Queries

```sql
-- Get active doctors
SELECT * FROM active_doctors LIMIT 10;

-- Get recent disease detections
SELECT * FROM recent_disease_detections LIMIT 10;

-- Get user statistics
SELECT * FROM user_statistics LIMIT 10;

-- Get latest market prices
SELECT * FROM latest_market_prices LIMIT 10;
```

## 📚 Schema Visualization

### Entity Relationship Overview

```
Users (1) ──── (1) Farmer_Profiles
      │
      ├──── (1) Doctor_Profiles
      │
      ├──── (many) Disease_Detections
      │
      ├──── (many) Consultations ──── (many) Consultation_Messages
      │                          └──── (many) Prescriptions
      │
      ├──── (many) Crop_Logs ──── (many) Crop_Activities
      │
      ├──── (many) Irrigation_Systems ──── (many) Sensor_Readings
      │                               └──── (many) Water_Usage_History
      │
      ├──── (many) Devices ──── (many) Device_Readings
      │
      ├──── (many) Notifications
      │
      └──── (many) Price_Alerts
```

## 🔍 Common Queries

### Get User Dashboard Data
```sql
SELECT 
  u.*,
  (SELECT COUNT(*) FROM disease_detections WHERE user_id = u.user_id) as total_scans,
  (SELECT COUNT(*) FROM consultations WHERE farmer_id = u.user_id) as total_consultations,
  (SELECT COUNT(*) FROM notifications WHERE user_id = u.user_id AND read = false) as unread_notifications
FROM users u
WHERE u.user_id = 'USER_UUID_HERE';
```

### Get Doctor Performance
```sql
SELECT 
  u.user_name,
  dp.rating,
  dp.total_consultations,
  dp.completed_consultations,
  ROUND((dp.completed_consultations::numeric / NULLIF(dp.total_consultations, 0) * 100), 2) as completion_rate
FROM users u
JOIN doctor_profiles dp ON u.user_id = dp.doctor_id
WHERE dp.verified = true
ORDER BY dp.rating DESC;
```

### Get Market Price Trends
```sql
SELECT 
  crop,
  market,
  price,
  previous_price,
  change,
  trend,
  price_date
FROM market_prices
WHERE crop = 'Rice'
ORDER BY price_date DESC
LIMIT 30;
```

## 🛠️ Troubleshooting

### Issue: Permission Denied

```sql
-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

### Issue: Extension Not Found

```sql
-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Issue: RLS Blocking Access

```sql
-- Temporarily disable RLS for debugging (NOT for production!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Re-enable when done
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

## 📖 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Supabase Documentation](https://supabase.com/docs)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)

## 🤝 Support

For issues or questions:
1. Check the main `README.md`
2. Review the `COMPLETE_SETUP.md`
3. Consult the API documentation in `/docs/`

## 📄 License

This database schema is part of the Smart Farming System project.

---

**Last Updated:** April 6, 2026  
**Schema Version:** 1.0.0  
**Compatible With:** PostgreSQL 13+, Supabase
