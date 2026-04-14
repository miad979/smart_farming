-- =====================================================
-- Smart Farming System - Seed Data & Helper Functions
-- =====================================================
-- Version: 1.0.0
-- Date: April 6, 2026
-- Description: Sample data and utility functions
-- =====================================================

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate distance between two points (in kilometers)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371; -- Earth radius in km
  dLat DOUBLE PRECISION;
  dLon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  a := sin(dLat/2) * sin(dLat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dLon/2) * sin(dLon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby doctors
CREATE OR REPLACE FUNCTION find_nearby_doctors(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  doctor_id UUID,
  doctor_name VARCHAR,
  specialization TEXT[],
  rating DECIMAL,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.user_id,
    u.user_name,
    dp.specialization,
    dp.rating,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
      u.location_point
    ) / 1000 as distance_km
  FROM users u
  JOIN doctor_profiles dp ON u.user_id = dp.doctor_id
  WHERE 
    u.role = 'doctor' 
    AND u.status = 'active'
    AND dp.verified = TRUE
    AND dp.available = TRUE
    AND u.location_point IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
      u.location_point,
      radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_scans BIGINT,
  total_consultations BIGINT,
  total_crop_logs BIGINT,
  total_devices BIGINT,
  unread_notifications BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM disease_detections WHERE user_id = p_user_id) as total_scans,
    (SELECT COUNT(*) FROM consultations WHERE farmer_id = p_user_id OR doctor_id = p_user_id) as total_consultations,
    (SELECT COUNT(*) FROM crop_logs WHERE user_id = p_user_id) as total_crop_logs,
    (SELECT COUNT(*) FROM devices WHERE user_id = p_user_id AND is_active = TRUE) as total_devices,
    (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND read = FALSE) as unread_notifications;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate crop profitability
CREATE OR REPLACE FUNCTION calculate_crop_profitability(p_log_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_cost DECIMAL(12,2);
  total_revenue DECIMAL(12,2);
  profit DECIMAL(12,2);
  roi DECIMAL(5,2);
BEGIN
  -- Calculate total cost from activities
  SELECT COALESCE(SUM(cost + labor_cost), 0)
  INTO total_cost
  FROM crop_activities
  WHERE log_id = p_log_id;
  
  -- Get revenue from crop log
  SELECT COALESCE(total_revenue, 0)
  INTO total_revenue
  FROM crop_logs
  WHERE log_id = p_log_id;
  
  -- Calculate profit and ROI
  profit := total_revenue - total_cost;
  
  IF total_cost > 0 THEN
    roi := (profit / total_cost) * 100;
  ELSE
    roi := 0;
  END IF;
  
  result := jsonb_build_object(
    'total_cost', total_cost,
    'total_revenue', total_revenue,
    'profit', profit,
    'roi_percentage', roi
  );
  
  -- Update crop log
  UPDATE crop_logs
  SET 
    total_investment = total_cost,
    profit_loss = profit
  WHERE log_id = p_log_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-expire old sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE sessions
  SET is_active = FALSE
  WHERE is_active = TRUE 
    AND expires_at < NOW();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE 
    (read = TRUE AND created_at < NOW() - INTERVAL '30 days')
    OR (expires_at IS NOT NULL AND expires_at < NOW());
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update doctor rating
CREATE OR REPLACE FUNCTION update_doctor_rating(p_doctor_id UUID)
RETURNS VOID AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  total_rated INTEGER;
BEGIN
  SELECT 
    COALESCE(AVG(rating), 0),
    COUNT(*)
  INTO avg_rating, total_rated
  FROM consultations
  WHERE 
    doctor_id = p_doctor_id 
    AND status = 'completed'
    AND rating IS NOT NULL;
  
  UPDATE doctor_profiles
  SET 
    rating = avg_rating,
    total_consultations = total_rated
  WHERE doctor_id = p_doctor_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update doctor rating after consultation completion
CREATE OR REPLACE FUNCTION trigger_update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.rating IS NOT NULL AND NEW.doctor_id IS NOT NULL THEN
    PERFORM update_doctor_rating(NEW.doctor_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultation_completed_update_rating
AFTER UPDATE ON consultations
FOR EACH ROW
WHEN (NEW.status = 'completed' AND NEW.rating IS NOT NULL)
EXECUTE FUNCTION trigger_update_doctor_rating();

-- Function to increment message counters in consultations
CREATE OR REPLACE FUNCTION increment_message_counter()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE consultations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    last_message_by = NEW.sender_id,
    unread_farmer = CASE 
      WHEN NEW.sender_role = 'doctor' THEN unread_farmer + 1 
      ELSE unread_farmer 
    END,
    unread_doctor = CASE 
      WHEN NEW.sender_role = 'farmer' THEN unread_doctor + 1 
      ELSE unread_doctor 
    END
  WHERE consultation_id = NEW.consultation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultation_message_counter
AFTER INSERT ON consultation_messages
FOR EACH ROW
EXECUTE FUNCTION increment_message_counter();

-- =====================================================
-- SAMPLE/SEED DATA
-- =====================================================

-- Create a default admin user (password: admin123)
INSERT INTO users (
  user_id,
  user_name,
  user_name_bn,
  email,
  phone,
  password_hash,
  role,
  status,
  language,
  location,
  onboarding_completed
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'System Admin',
  'সিস্টেম অ্যাডমিন',
  'admin@smartfarming.com',
  '+8801700000001',
  '$2b$10$rKvZvZJxJxJxJxJxJxJxJeMtQgV9YqvqV9YqvqV9YqvqV9YqvqV9Y', -- hashed 'admin123'
  'admin',
  'active',
  'bn',
  '{"lat": 23.8103, "lon": 90.4125, "name": "Dhaka", "name_bn": "ঢাকা"}'::jsonb,
  true
) ON CONFLICT (user_id) DO NOTHING;

-- Sample verified doctor
INSERT INTO users (
  user_id,
  user_name,
  user_name_bn,
  email,
  phone,
  password_hash,
  role,
  status,
  language,
  location,
  onboarding_completed
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Dr. Abdul Karim',
  'ডাঃ আব্দুল করিম',
  'karim@smartfarming.com',
  '+8801700000002',
  '$2b$10$rKvZvZJxJxJxJxJxJxJxJeMtQgV9YqvqV9YqvqV9YqvqV9YqvqV9Y',
  'doctor',
  'active',
  'bn',
  '{"lat": 23.7104, "lon": 90.4074, "name": "Dhaka", "name_bn": "ঢাকা"}'::jsonb,
  true
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO doctor_profiles (
  doctor_id,
  specialization,
  specialization_bn,
  qualifications,
  experience,
  bio,
  bio_bn,
  verified,
  verification_status,
  verified_at,
  verified_by,
  rating,
  total_consultations,
  available,
  consultation_fee,
  languages,
  registration_number
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  ARRAY['Crop Disease Management', 'Pest Control', 'Soil Health'],
  ARRAY['ফসলের রোগ ব্যবস্থাপনা', 'কীটপতঙ্গ নিয়ন্ত্রণ', 'মাটির স্বাস্থ্য'],
  ARRAY['BSc in Agriculture', 'MSc in Plant Pathology', 'PhD in Agricultural Sciences'],
  15,
  'Agricultural expert with 15 years of experience in crop disease management and sustainable farming practices.',
  'ফসলের রোগ ব্যবস্থাপনা এবং টেকসই কৃষি পদ্ধতিতে ১৫ বছরের অভিজ্ঞতা সহ কৃষি বিশেষজ্ঞ।',
  true,
  'approved',
  NOW(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  4.8,
  156,
  true,
  500,
  ARRAY['bn', 'en'],
  'DAE-BD-2010-12345'
) ON CONFLICT (doctor_id) DO NOTHING;

-- Sample farmer user
INSERT INTO users (
  user_id,
  user_name,
  user_name_bn,
  email,
  phone,
  password_hash,
  role,
  status,
  language,
  location,
  onboarding_completed
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Rahim Ahmed',
  'রহিম আহমেদ',
  'rahim@example.com',
  '+8801700000003',
  '$2b$10$rKvZvZJxJxJxJxJxJxJxJeMtQgV9YqvqV9YqvqV9YqvqV9YqvqV9Y',
  'farmer',
  'active',
  'bn',
  '{"lat": 24.3636, "lon": 88.6241, "name": "Rajshahi", "name_bn": "রাজশাহী"}'::jsonb,
  true
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO farmer_profiles (
  farmer_id,
  farm_name,
  farm_name_bn,
  farm_size,
  farm_size_unit,
  primary_crops,
  primary_crops_bn,
  farming_experience,
  farming_type,
  verified
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Green Valley Farm',
  'গ্রীন ভ্যালি ফার্ম',
  5.5,
  'acre',
  ARRAY['Rice', 'Wheat', 'Potato'],
  ARRAY['ধান', 'গম', 'আলু'],
  12,
  ARRAY['conventional', 'mixed'],
  true
) ON CONFLICT (farmer_id) DO NOTHING;

-- Sample crop diseases
INSERT INTO disease_detections (
  scan_id,
  user_id,
  image_url,
  crop_type,
  crop_type_bn,
  disease,
  disease_bn,
  confidence,
  severity,
  advisory_en,
  advisory_bn,
  treatment_en,
  treatment_bn,
  prevention_en,
  prevention_bn,
  review_status,
  saved
) VALUES 
(
  uuid_generate_v4(),
  '00000000-0000-0000-0000-000000000003'::uuid,
  'https://example.com/images/rice_blast.jpg',
  'Rice',
  'ধান',
  'Rice Blast',
  'ধান ব্লাস্ট',
  92.5,
  'high',
  'Rice blast is a serious fungal disease. Remove affected plants immediately and apply fungicide.',
  'ধান ব্লাস্ট একটি মারাত্মক ছত্রাক রোগ। আক্রান্ত গাছ অবিলম্বে অপসারণ করুন এবং ছত্রাকনাশক প্রয়োগ করুন।',
  'Apply Tricyclazole 75% WP @ 0.6g/liter water. Spray at 7-day intervals.',
  'ট্রাইসাইক্লাজল ৭৫% ডব্লিউপি @ ০.৬ গ্রাম/লিটার পানি প্রয়োগ করুন। ৭ দিনের ব্যবধানে স্প্রে করুন।',
  'Maintain proper plant spacing. Avoid excessive nitrogen fertilization. Use disease-resistant varieties.',
  'সঠিক উদ্ভিদ দূরত্ব বজায় রাখুন। অতিরিক্ত নাইট্রোজেন সার এড়িয়ে চলুন। রোগ প্রতিরোধী জাত ব্যবহার করুন।',
  'reviewed',
  true
),
(
  uuid_generate_v4(),
  '00000000-0000-0000-0000-000000000003'::uuid,
  'https://example.com/images/potato_blight.jpg',
  'Potato',
  'আলু',
  'Late Blight',
  'পাতা পচা রোগ',
  88.3,
  'medium',
  'Late blight affects potato leaves and tubers. Apply copper-based fungicide immediately.',
  'পাতা পচা রোগ আলুর পাতা ও কন্দকে আক্রান্ত করে। তামা ভিত্তিক ছত্রাকনাশক অবিলম্বে প্রয়োগ করুন।',
  'Apply Copper Oxychloride 50% WP @ 2g/liter water every 7-10 days.',
  'কপার অক্সিক্লোরাইড ৫০% ডব্লিউপি @ ২ গ্রাম/লিটার পানি প্রতি ৭-১০ দিনে প্রয়োগ করুন।',
  'Plant resistant varieties. Ensure good drainage. Remove infected plant debris.',
  'প্রতিরোধী জাত রোপণ করুন। ভালো নিকাশ নিশ্চিত করুন। সংক্রামিত উদ্ভিদ অবশিষ্টাংশ অপসারণ করুন।',
  'not_required',
  false
);

-- Sample market prices
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
  change,
  trend,
  quality,
  source,
  source_type,
  verified,
  price_date
) VALUES
('Rice', 'ধান', 'Dhaka Wholesale Market', 'ঢাকা পাইকারি বাজার', 'Dhaka', 'ঢাকা', 450.00, 'kg', 428.00, 5.14, 'up', 'standard', 'DAM', 'official', true, CURRENT_DATE),
('Wheat', 'গম', 'Dhaka Wholesale Market', 'ঢাকা পাইকারি বাজার', 'Dhaka', 'ঢাকা', 380.00, 'kg', 385.00, -1.30, 'down', 'standard', 'DAM', 'official', true, CURRENT_DATE),
('Potato', 'আলু', 'Rajshahi Market', 'রাজশাহী বাজার', 'Rajshahi', 'রাজশাহী', 28.00, 'kg', 30.00, -6.67, 'down', 'premium', 'DAM', 'official', true, CURRENT_DATE),
('Tomato', 'টমেটো', 'Chittagong Market', 'চট্টগ্রাম বাজার', 'Chittagong', 'চট্টগ্রাম', 45.00, 'kg', 42.00, 7.14, 'up', 'standard', 'DAM', 'official', true, CURRENT_DATE),
('Onion', 'পেঁয়াজ', 'Dhaka Wholesale Market', 'ঢাকা পাইকারি বাজার', 'Dhaka', 'ঢাকা', 65.00, 'kg', 65.00, 0.00, 'stable', 'standard', 'DAM', 'official', true, CURRENT_DATE);

-- Sample weather data
INSERT INTO weather_data (
  location,
  location_name,
  location_name_bn,
  district,
  district_bn,
  temperature,
  feels_like,
  condition,
  condition_bn,
  humidity,
  rainfall_probability,
  wind_speed,
  pressure,
  uv_index,
  source,
  source_type,
  observation_time
) VALUES
('{"lat": 23.8103, "lon": 90.4125}'::jsonb, 'Dhaka', 'ঢাকা', 'Dhaka', 'ঢাকা', 28.5, 32.0, 'Partly Cloudy', 'আংশিক মেঘলা', 75.0, 40.0, 12.5, 1013.25, 7, 'BMD', 'ground_station', NOW()),
('{"lat": 24.3636, "lon": 88.6241}'::jsonb, 'Rajshahi', 'রাজশাহী', 'Rajshahi', 'রাজশাহী', 30.2, 33.5, 'Sunny', 'রৌদ্রোজ্জ্বল', 68.0, 20.0, 10.0, 1012.50, 8, 'BMD', 'ground_station', NOW()),
('{"lat": 22.3569, "lon": 91.7832}'::jsonb, 'Chittagong', 'চট্টগ্রাম', 'Chittagong', 'চট্টগ্রাম', 27.8, 31.0, 'Cloudy', 'মেঘলা', 82.0, 60.0, 15.0, 1011.00, 6, 'BMD', 'ground_station', NOW());

-- Sample weather forecast
INSERT INTO weather_forecasts (
  location,
  district,
  forecast_date,
  forecast_day,
  forecast_day_bn,
  temp_min,
  temp_max,
  temp_avg,
  condition,
  condition_bn,
  rainfall_probability,
  humidity,
  uv_index
) VALUES
('{"lat": 23.8103, "lon": 90.4125}'::jsonb, 'Dhaka', CURRENT_DATE + 1, 'Tomorrow', 'আগামীকাল', 22.0, 30.0, 26.0, 'Partly Cloudy', 'আংশিক মেঘলা', 30.0, 70.0, 7),
('{"lat": 23.8103, "lon": 90.4125}'::jsonb, 'Dhaka', CURRENT_DATE + 2, 'Day After Tomorrow', 'পরশু', 23.0, 31.0, 27.0, 'Sunny', 'রৌদ্রোজ্জ্বল', 10.0, 65.0, 8),
('{"lat": 23.8103, "lon": 90.4125}'::jsonb, 'Dhaka', CURRENT_DATE + 3, '3 Days', '৩ দিন পর', 22.0, 29.0, 25.5, 'Rainy', 'বৃষ্টি', 80.0, 85.0, 5);

-- Sample system notifications
INSERT INTO notifications (
  user_id,
  type,
  title,
  title_bn,
  message,
  message_bn,
  priority
) VALUES
(
  '00000000-0000-0000-0000-000000000003'::uuid,
  'info',
  'Welcome to Smart Farming!',
  'স্মার্ট ফার্মিং-এ স্বাগতম!',
  'Start by detecting crop diseases or consulting with our agricultural experts.',
  'ফসলের রোগ সনাক্তকরণ বা আমাদের কৃষি বিশেষজ্ঞদের সাথে পরামর্শ শুরু করুন।',
  'normal'
);

-- =====================================================
-- SCHEDULED JOBS (Using pg_cron if available)
-- =====================================================

-- Note: These require pg_cron extension to be installed
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule session expiry check (every hour)
-- SELECT cron.schedule('expire-sessions', '0 * * * *', 'SELECT expire_old_sessions();');

-- Schedule notification cleanup (daily at 2 AM)
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications();');

-- =====================================================
-- INDEXES FOR FULL TEXT SEARCH (Optional)
-- =====================================================

-- Add GIN indexes for text search on consultations
CREATE INDEX IF NOT EXISTS idx_consultations_subject_search 
  ON consultations USING GIN(to_tsvector('english', subject));

CREATE INDEX IF NOT EXISTS idx_consultations_description_search 
  ON consultations USING GIN(to_tsvector('english', description));

-- Add GIN indexes for text search on disease detections
CREATE INDEX IF NOT EXISTS idx_disease_detections_disease_search 
  ON disease_detections USING GIN(to_tsvector('english', disease));

-- =====================================================
-- MATERIALIZED VIEWS FOR ANALYTICS (Optional)
-- =====================================================

-- Daily statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_statistics AS
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) FILTER (WHERE role = 'farmer') as new_farmers,
  COUNT(DISTINCT user_id) FILTER (WHERE role = 'doctor') as new_doctors,
  (SELECT COUNT(*) FROM disease_detections WHERE DATE(created_at) = DATE(users.created_at)) as scans,
  (SELECT COUNT(*) FROM consultations WHERE DATE(requested_at) = DATE(users.created_at)) as consultations
FROM users
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE INDEX ON daily_statistics(date DESC);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_daily_statistics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_statistics;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATABASE MAINTENANCE
-- =====================================================

-- Vacuum and analyze function
CREATE OR REPLACE FUNCTION maintain_database()
RETURNS VOID AS $$
BEGIN
  VACUUM ANALYZE users;
  VACUUM ANALYZE disease_detections;
  VACUUM ANALYZE consultations;
  VACUUM ANALYZE market_prices;
  VACUUM ANALYZE notifications;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION TRACKING
-- =====================================================

INSERT INTO schema_migrations (version, description) VALUES
('002_seed_data_functions', 'Seed data, helper functions, and database utilities');

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Smart Farming System Database Setup Complete!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables created: 30+';
  RAISE NOTICE 'Indexes created: 100+';
  RAISE NOTICE 'Functions created: 15+';
  RAISE NOTICE 'Sample data inserted: Yes';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Default Admin Credentials:';
  RAISE NOTICE 'Email: admin@smartfarming.com';
  RAISE NOTICE 'Phone: +8801700000001';
  RAISE NOTICE 'Password: admin123';
  RAISE NOTICE '================================================';
END $$;
