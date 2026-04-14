-- =====================================================
-- Smart Farming System - Complete Database Schema
-- =====================================================
-- Version: 1.0.0
-- Date: April 6, 2026
-- Description: Production-ready PostgreSQL schema for
--              Smart Farming System with Bengali-first design
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for location data (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

-- Main users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_name VARCHAR(255) NOT NULL,
  user_name_bn VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'doctor', 'admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  language VARCHAR(2) DEFAULT 'bn' CHECK (language IN ('bn', 'en')),
  
  -- Location data
  location JSONB,
  location_point GEOGRAPHY(POINT),
  
  -- Settings
  notifications_enabled BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  device_info JSONB,
  app_version VARCHAR(20),
  
  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_phone CHECK (phone ~ '^\+?[0-9]{10,15}$')
);

-- Create indexes for users
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_last_active ON users(last_active DESC);
CREATE INDEX idx_users_location_point ON users USING GIST(location_point);

-- Sessions table for JWT token management
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_access_token ON sessions(access_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);

-- =====================================================
-- FARMER PROFILES
-- =====================================================

CREATE TABLE farmer_profiles (
  farmer_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Farm Information
  farm_name VARCHAR(255),
  farm_name_bn VARCHAR(255),
  farm_size DECIMAL(10, 2),
  farm_size_unit VARCHAR(20) DEFAULT 'acre' CHECK (farm_size_unit IN ('acre', 'hectare', 'bigha')),
  
  -- Primary crops
  primary_crops TEXT[],
  primary_crops_bn TEXT[],
  
  -- Experience
  farming_experience INTEGER, -- years
  farming_type VARCHAR(50)[], -- ['organic', 'conventional', 'mixed']
  
  -- Contact preferences
  preferred_contact_method VARCHAR(20) DEFAULT 'phone' CHECK (preferred_contact_method IN ('phone', 'sms', 'whatsapp', 'app')),
  whatsapp_number VARCHAR(20),
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verification_documents JSONB,
  
  -- Statistics
  total_scans INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_farmer_profiles_verified ON farmer_profiles(verified);
CREATE INDEX idx_farmer_profiles_primary_crops ON farmer_profiles USING GIN(primary_crops);

-- =====================================================
-- DOCTOR/EXPERT PROFILES
-- =====================================================

CREATE TABLE doctor_profiles (
  doctor_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Professional Information
  specialization TEXT[] NOT NULL,
  specialization_bn TEXT[],
  qualifications TEXT[],
  registration_number VARCHAR(100),
  registration_authority VARCHAR(255),
  
  -- Experience
  experience INTEGER NOT NULL, -- years
  bio TEXT,
  bio_bn TEXT,
  
  -- Ratings & Performance
  rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  total_consultations INTEGER DEFAULT 0,
  completed_consultations INTEGER DEFAULT 0,
  average_response_time INTEGER, -- minutes
  success_rate DECIMAL(5, 2), -- percentage
  
  -- Verification Status
  verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(user_id),
  verification_notes TEXT,
  verification_documents JSONB,
  rejection_reason TEXT,
  
  -- Availability
  available BOOLEAN DEFAULT TRUE,
  availability_schedule JSONB,
  max_daily_consultations INTEGER DEFAULT 20,
  
  -- Consultation Details
  consultation_fee DECIMAL(10, 2) DEFAULT 0,
  consultation_fee_currency VARCHAR(3) DEFAULT 'BDT',
  languages TEXT[] DEFAULT ARRAY['bn', 'en'],
  
  -- Contact Information
  professional_email VARCHAR(255),
  professional_phone VARCHAR(20),
  office_address TEXT,
  office_address_bn TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_available_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_doctor_profiles_verified ON doctor_profiles(verified);
CREATE INDEX idx_doctor_profiles_verification_status ON doctor_profiles(verification_status);
CREATE INDEX idx_doctor_profiles_available ON doctor_profiles(available);
CREATE INDEX idx_doctor_profiles_specialization ON doctor_profiles USING GIN(specialization);
CREATE INDEX idx_doctor_profiles_rating ON doctor_profiles(rating DESC);

-- =====================================================
-- DISEASE DETECTION
-- =====================================================

CREATE TABLE disease_detections (
  scan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  
  -- Image Information
  image_url TEXT NOT NULL,
  image_ref VARCHAR(255),
  thumbnail_url TEXT,
  
  -- Crop Information
  crop_type VARCHAR(100),
  crop_type_bn VARCHAR(100),
  crop_variety VARCHAR(100),
  crop_variety_bn VARCHAR(100),
  
  -- AI Analysis Results
  disease VARCHAR(255),
  disease_bn VARCHAR(255),
  confidence DECIMAL(5, 2) CHECK (confidence >= 0 AND confidence <= 100),
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Advisory Content
  advisory_en TEXT,
  advisory_bn TEXT,
  treatment_en TEXT,
  treatment_bn TEXT,
  prevention_en TEXT,
  prevention_bn TEXT,
  
  -- Additional Details
  symptoms TEXT[],
  symptoms_bn TEXT[],
  affected_parts TEXT[], -- ['leaf', 'stem', 'root', 'fruit']
  
  -- Recommendations
  recommended_products JSONB,
  estimated_cost DECIMAL(10, 2),
  treatment_duration INTEGER, -- days
  
  -- Expert Review
  review_status VARCHAR(20) DEFAULT 'not_required' CHECK (review_status IN ('pending', 'reviewed', 'not_required')),
  reviewed_by UUID REFERENCES users(user_id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  expert_notes TEXT,
  expert_notes_bn TEXT,
  expert_confidence DECIMAL(5, 2),
  expert_diagnosis VARCHAR(255),
  expert_diagnosis_bn VARCHAR(255),
  
  -- User Actions
  saved BOOLEAN DEFAULT FALSE,
  shared BOOLEAN DEFAULT FALSE,
  consultation_requested BOOLEAN DEFAULT FALSE,
  consultation_id UUID,
  
  -- Location
  location JSONB,
  location_point GEOGRAPHY(POINT),
  
  -- Metadata
  scan_source VARCHAR(20) DEFAULT 'mobile' CHECK (scan_source IN ('mobile', 'web', 'api')),
  model_version VARCHAR(20),
  processing_time INTEGER, -- milliseconds
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_disease_detections_user_id ON disease_detections(user_id);
CREATE INDEX idx_disease_detections_disease ON disease_detections(disease);
CREATE INDEX idx_disease_detections_severity ON disease_detections(severity);
CREATE INDEX idx_disease_detections_review_status ON disease_detections(review_status);
CREATE INDEX idx_disease_detections_created_at ON disease_detections(created_at DESC);
CREATE INDEX idx_disease_detections_location_point ON disease_detections USING GIST(location_point);

-- =====================================================
-- IRRIGATION SYSTEMS
-- =====================================================

CREATE TABLE irrigation_systems (
  system_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  farm_id UUID,
  
  -- System Details
  system_name VARCHAR(255),
  system_name_bn VARCHAR(255),
  system_type VARCHAR(50) CHECK (system_type IN ('drip', 'sprinkler', 'flood', 'manual', 'smart')),
  
  -- Current Status
  moisture DECIMAL(5, 2) CHECK (moisture >= 0 AND moisture <= 100),
  moisture_status VARCHAR(20) CHECK (moisture_status IN ('low', 'moderate', 'healthy', 'saturated')),
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  
  -- Control
  auto_mode BOOLEAN DEFAULT FALSE,
  is_watering BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT TRUE,
  
  -- Schedule
  next_watering TIMESTAMP WITH TIME ZONE,
  last_watered TIMESTAMP WITH TIME ZONE,
  watering_duration INTEGER, -- minutes
  
  -- Policy Configuration
  policy JSONB,
  threshold DECIMAL(5, 2) DEFAULT 60, -- moisture % to trigger watering
  target_moisture DECIMAL(5, 2) DEFAULT 80,
  
  -- Crop Information
  current_crop VARCHAR(100),
  current_crop_bn VARCHAR(100),
  planting_date DATE,
  
  -- Water Usage
  daily_water_limit DECIMAL(10, 2), -- liters
  current_daily_usage DECIMAL(10, 2) DEFAULT 0,
  total_water_used DECIMAL(12, 2) DEFAULT 0,
  
  -- Device Information
  device_id VARCHAR(255),
  device_model VARCHAR(100),
  firmware_version VARCHAR(20),
  
  -- Location
  location JSONB,
  location_point GEOGRAPHY(POINT),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_irrigation_systems_user_id ON irrigation_systems(user_id);
CREATE INDEX idx_irrigation_systems_auto_mode ON irrigation_systems(auto_mode);
CREATE INDEX idx_irrigation_systems_is_watering ON irrigation_systems(is_watering);
CREATE INDEX idx_irrigation_systems_is_online ON irrigation_systems(is_online);
CREATE INDEX idx_irrigation_systems_next_watering ON irrigation_systems(next_watering);

-- Sensor readings for irrigation
CREATE TABLE irrigation_sensor_readings (
  reading_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES irrigation_systems(system_id) ON DELETE CASCADE,
  
  -- Sensor Data
  moisture DECIMAL(5, 2),
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  soil_ph DECIMAL(4, 2),
  soil_ec DECIMAL(6, 2), -- electrical conductivity
  light_intensity INTEGER, -- lux
  
  -- Metadata
  sensor_type VARCHAR(50),
  reading_quality VARCHAR(20) CHECK (reading_quality IN ('excellent', 'good', 'fair', 'poor')),
  
  -- Timestamp
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_irrigation_sensor_readings_system_id ON irrigation_sensor_readings(system_id);
CREATE INDEX idx_irrigation_sensor_readings_recorded_at ON irrigation_sensor_readings(recorded_at DESC);

-- Water usage history
CREATE TABLE water_usage_history (
  usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES irrigation_systems(system_id) ON DELETE CASCADE,
  
  -- Usage Details
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL, -- liters
  duration INTEGER NOT NULL, -- minutes
  automatic BOOLEAN DEFAULT TRUE,
  
  -- Context
  moisture_before DECIMAL(5, 2),
  moisture_after DECIMAL(5, 2),
  weather_condition VARCHAR(50),
  triggered_by VARCHAR(50), -- 'schedule', 'manual', 'threshold', 'weather'
  
  -- Cost
  estimated_cost DECIMAL(10, 2),
  
  -- Timestamp
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_water_usage_history_system_id ON water_usage_history(system_id);
CREATE INDEX idx_water_usage_history_date ON water_usage_history(date DESC);
CREATE INDEX idx_water_usage_history_automatic ON water_usage_history(automatic);

-- =====================================================
-- MARKET PRICES
-- =====================================================

CREATE TABLE market_prices (
  price_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Crop Information
  crop VARCHAR(100) NOT NULL,
  crop_bn VARCHAR(100),
  variety VARCHAR(100),
  variety_bn VARCHAR(100),
  
  -- Market Information
  market VARCHAR(255) NOT NULL,
  market_bn VARCHAR(255),
  market_type VARCHAR(50) CHECK (market_type IN ('wholesale', 'retail', 'farm_gate', 'export')),
  
  -- Location
  location JSONB,
  location_point GEOGRAPHY(POINT),
  district VARCHAR(100),
  district_bn VARCHAR(100),
  division VARCHAR(100),
  division_bn VARCHAR(100),
  
  -- Price Details
  price DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'kg' CHECK (unit IN ('kg', 'quintal', 'ton', 'piece', 'dozen')),
  currency VARCHAR(3) DEFAULT 'BDT',
  
  -- Price Trends
  previous_price DECIMAL(10, 2),
  change DECIMAL(5, 2), -- percentage
  trend VARCHAR(10) CHECK (trend IN ('up', 'down', 'stable')),
  change_amount DECIMAL(10, 2),
  
  -- Quality & Grade
  quality VARCHAR(20) CHECK (quality IN ('premium', 'standard', 'low', 'mixed')),
  grade VARCHAR(10),
  
  -- Volume & Supply
  available_quantity DECIMAL(12, 2),
  demand_level VARCHAR(20) CHECK (demand_level IN ('very_high', 'high', 'moderate', 'low', 'very_low')),
  
  -- Source & Verification
  source VARCHAR(255),
  source_type VARCHAR(50) CHECK (source_type IN ('official', 'verified', 'reported', 'estimated')),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(user_id),
  
  -- Forecasting
  predicted_next_price DECIMAL(10, 2),
  forecast_confidence DECIMAL(5, 2),
  
  -- Timestamps
  price_date DATE NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_update TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_market_prices_crop ON market_prices(crop);
CREATE INDEX idx_market_prices_market ON market_prices(market);
CREATE INDEX idx_market_prices_location_point ON market_prices USING GIST(location_point);
CREATE INDEX idx_market_prices_price_date ON market_prices(price_date DESC);
CREATE INDEX idx_market_prices_recorded_at ON market_prices(recorded_at DESC);
CREATE INDEX idx_market_prices_district ON market_prices(district);

-- Price history for trend analysis
CREATE TABLE price_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop VARCHAR(100) NOT NULL,
  market VARCHAR(255) NOT NULL,
  location JSONB,
  
  -- Price Data
  date DATE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'kg',
  volume DECIMAL(12, 2), -- trading volume
  
  -- Timestamps
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(crop, market, date)
);

CREATE INDEX idx_price_history_crop ON price_history(crop);
CREATE INDEX idx_price_history_market ON price_history(market);
CREATE INDEX idx_price_history_date ON price_history(date DESC);

-- =====================================================
-- PRICE ALERTS
-- =====================================================

CREATE TABLE price_alerts (
  alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Alert Configuration
  crop VARCHAR(100) NOT NULL,
  crop_bn VARCHAR(100),
  market VARCHAR(255),
  location JSONB,
  
  -- Trigger Conditions
  target_price DECIMAL(10, 2) NOT NULL,
  condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below', 'equal')),
  unit VARCHAR(20) DEFAULT 'kg',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP WITH TIME ZONE,
  last_checked TIMESTAMP WITH TIME ZONE,
  
  -- Notification Preferences
  notify_by_app BOOLEAN DEFAULT TRUE,
  notify_by_sms BOOLEAN DEFAULT FALSE,
  notify_by_email BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_crop ON price_alerts(crop);
CREATE INDEX idx_price_alerts_is_active ON price_alerts(is_active);
CREATE INDEX idx_price_alerts_triggered ON price_alerts(triggered);

-- =====================================================
-- CONSULTATIONS
-- =====================================================

CREATE TABLE consultations (
  consultation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Parties
  farmer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  farmer_name VARCHAR(255),
  farmer_name_bn VARCHAR(255),
  doctor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  doctor_name VARCHAR(255),
  doctor_name_bn VARCHAR(255),
  
  -- Consultation Details
  type VARCHAR(50) NOT NULL CHECK (type IN ('disease', 'general', 'pest', 'soil', 'nutrition', 'irrigation', 'emergency')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'cancelled', 'expired')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Content
  subject TEXT NOT NULL,
  subject_bn TEXT,
  description TEXT NOT NULL,
  description_bn TEXT,
  images TEXT[],
  attachments JSONB,
  
  -- Related Records
  disease_detection_id UUID REFERENCES disease_detections(scan_id),
  crop_log_id UUID,
  
  -- Communication
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_by UUID REFERENCES users(user_id),
  unread_farmer INTEGER DEFAULT 0,
  unread_doctor INTEGER DEFAULT 0,
  
  -- Scheduling
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  
  -- Outcome
  diagnosis TEXT,
  diagnosis_bn TEXT,
  recommendations TEXT[],
  recommendations_bn TEXT[],
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  follow_up_notes TEXT,
  
  -- Payment (if applicable)
  fee DECIMAL(10, 2) DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  
  -- Feedback & Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  farmer_satisfaction INTEGER CHECK (farmer_satisfaction >= 1 AND farmer_satisfaction <= 5),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consultations_farmer_id ON consultations(farmer_id);
CREATE INDEX idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_priority ON consultations(priority);
CREATE INDEX idx_consultations_type ON consultations(type);
CREATE INDEX idx_consultations_requested_at ON consultations(requested_at DESC);
CREATE INDEX idx_consultations_completed_at ON consultations(completed_at DESC);

-- Messages within consultations
CREATE TABLE consultation_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID NOT NULL REFERENCES consultations(consultation_id) ON DELETE CASCADE,
  
  -- Sender Information
  sender_id UUID NOT NULL REFERENCES users(user_id),
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('farmer', 'doctor', 'system')),
  
  -- Message Content
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'file', 'system')),
  
  -- Attachments
  attachments TEXT[],
  images TEXT[],
  voice_url TEXT,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consultation_messages_consultation_id ON consultation_messages(consultation_id);
CREATE INDEX idx_consultation_messages_sender_id ON consultation_messages(sender_id);
CREATE INDEX idx_consultation_messages_created_at ON consultation_messages(created_at DESC);
CREATE INDEX idx_consultation_messages_read ON consultation_messages(read);

-- Prescriptions from consultations
CREATE TABLE prescriptions (
  prescription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID NOT NULL REFERENCES consultations(consultation_id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Product Information
  product VARCHAR(255) NOT NULL,
  product_bn VARCHAR(255),
  product_type VARCHAR(50) CHECK (product_type IN ('pesticide', 'fungicide', 'fertilizer', 'medicine', 'supplement', 'organic')),
  
  -- Dosage Instructions
  dosage VARCHAR(255) NOT NULL,
  dosage_bn VARCHAR(255),
  frequency VARCHAR(255) NOT NULL,
  frequency_bn VARCHAR(255),
  duration VARCHAR(255) NOT NULL,
  duration_bn VARCHAR(255),
  
  -- Additional Instructions
  application_method VARCHAR(255),
  application_method_bn VARCHAR(255),
  precautions TEXT,
  precautions_bn TEXT,
  notes TEXT,
  notes_bn TEXT,
  
  -- Safety
  safety_period INTEGER, -- days before harvest
  reentry_period INTEGER, -- hours before entering field
  
  -- Cost
  estimated_cost DECIMAL(10, 2),
  where_to_buy TEXT,
  
  -- Timestamps
  prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_product_type ON prescriptions(product_type);

-- =====================================================
-- CROP LOGS
-- =====================================================

CREATE TABLE crop_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  farm_id UUID,
  
  -- Crop Information
  crop VARCHAR(100) NOT NULL,
  crop_bn VARCHAR(100),
  variety VARCHAR(100),
  variety_bn VARCHAR(100),
  
  -- Timeline
  planted_date DATE NOT NULL,
  expected_harvest DATE,
  actual_harvest DATE,
  growth_stage VARCHAR(50) CHECK (growth_stage IN ('seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest')),
  days_to_harvest INTEGER,
  
  -- Area
  area DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'acre' CHECK (unit IN ('acre', 'hectare', 'bigha', 'sqm')),
  plot_number VARCHAR(50),
  
  -- Location
  location JSONB,
  location_point GEOGRAPHY(POINT),
  soil_type VARCHAR(100),
  
  -- Health & Performance
  health VARCHAR(20) DEFAULT 'good' CHECK (health IN ('excellent', 'good', 'fair', 'poor', 'critical')),
  health_notes TEXT,
  disease_count INTEGER DEFAULT 0,
  pest_count INTEGER DEFAULT 0,
  
  -- Yield Information
  expected_yield DECIMAL(10, 2),
  actual_yield DECIMAL(10, 2),
  yield_unit VARCHAR(20) DEFAULT 'kg',
  yield_quality VARCHAR(20) CHECK (yield_quality IN ('premium', 'standard', 'low', 'mixed')),
  
  -- Financial
  total_investment DECIMAL(12, 2) DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  profit_loss DECIMAL(12, 2),
  market_value DECIMAL(12, 2),
  
  -- Sharing & Collaboration
  shared_with UUID[],
  share_mode VARCHAR(20) DEFAULT 'private' CHECK (share_mode IN ('private', 'shared', 'public')),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_crop_logs_user_id ON crop_logs(user_id);
CREATE INDEX idx_crop_logs_crop ON crop_logs(crop);
CREATE INDEX idx_crop_logs_status ON crop_logs(status);
CREATE INDEX idx_crop_logs_planted_date ON crop_logs(planted_date DESC);
CREATE INDEX idx_crop_logs_expected_harvest ON crop_logs(expected_harvest);
CREATE INDEX idx_crop_logs_location_point ON crop_logs USING GIST(location_point);

-- Crop activities log
CREATE TABLE crop_activities (
  activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id UUID NOT NULL REFERENCES crop_logs(log_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Activity Details
  date DATE NOT NULL,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('planting', 'watering', 'fertilizing', 'pesticide', 'weeding', 'pruning', 'thinning', 'harvesting', 'monitoring', 'other')),
  
  -- Description
  description TEXT NOT NULL,
  description_bn TEXT,
  
  -- Products Used
  products TEXT[],
  products_bn TEXT[],
  
  -- Quantities
  quantity DECIMAL(10, 2),
  quantity_unit VARCHAR(50),
  
  -- Cost
  cost DECIMAL(10, 2),
  labor_hours DECIMAL(5, 2),
  labor_cost DECIMAL(10, 2),
  
  -- Observations
  notes TEXT,
  notes_bn TEXT,
  weather_condition VARCHAR(50),
  images TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crop_activities_log_id ON crop_activities(log_id);
CREATE INDEX idx_crop_activities_user_id ON crop_activities(user_id);
CREATE INDEX idx_crop_activities_date ON crop_activities(date DESC);
CREATE INDEX idx_crop_activities_activity_type ON crop_activities(activity_type);

-- =====================================================
-- WEATHER DATA
-- =====================================================

CREATE TABLE weather_data (
  weather_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Location
  location JSONB NOT NULL,
  location_point GEOGRAPHY(POINT),
  location_name VARCHAR(255),
  location_name_bn VARCHAR(255),
  district VARCHAR(100),
  district_bn VARCHAR(100),
  
  -- Current Weather
  temperature DECIMAL(5, 2),
  feels_like DECIMAL(5, 2),
  condition VARCHAR(100),
  condition_bn VARCHAR(100),
  condition_code VARCHAR(20),
  
  -- Details
  humidity DECIMAL(5, 2),
  rainfall_probability DECIMAL(5, 2),
  rainfall_amount DECIMAL(6, 2), -- mm
  wind_speed DECIMAL(6, 2), -- km/h
  wind_direction VARCHAR(10),
  pressure DECIMAL(7, 2), -- hPa
  uv_index INTEGER,
  visibility DECIMAL(6, 2), -- km
  cloud_cover DECIMAL(5, 2), -- percentage
  
  -- Agricultural Data
  soil_temperature DECIMAL(5, 2),
  soil_moisture DECIMAL(5, 2),
  evapotranspiration DECIMAL(6, 2),
  growing_degree_days DECIMAL(6, 2),
  
  -- Source
  source VARCHAR(100),
  source_type VARCHAR(50) CHECK (source_type IN ('api', 'satellite', 'ground_station', 'forecast')),
  
  -- Timestamps
  observation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weather_data_location_point ON weather_data USING GIST(location_point);
CREATE INDEX idx_weather_data_district ON weather_data(district);
CREATE INDEX idx_weather_data_observation_time ON weather_data(observation_time DESC);

-- Weather forecasts
CREATE TABLE weather_forecasts (
  forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Location
  location JSONB NOT NULL,
  location_point GEOGRAPHY(POINT),
  district VARCHAR(100),
  
  -- Forecast Date
  forecast_date DATE NOT NULL,
  forecast_day VARCHAR(50),
  forecast_day_bn VARCHAR(50),
  
  -- Temperature
  temp_min DECIMAL(5, 2),
  temp_max DECIMAL(5, 2),
  temp_avg DECIMAL(5, 2),
  
  -- Conditions
  condition VARCHAR(100),
  condition_bn VARCHAR(100),
  condition_code VARCHAR(20),
  
  -- Precipitation
  rainfall_probability DECIMAL(5, 2),
  rainfall_amount DECIMAL(6, 2),
  
  -- Other
  humidity DECIMAL(5, 2),
  wind_speed DECIMAL(6, 2),
  uv_index INTEGER,
  
  -- Agricultural Recommendations
  recommendations TEXT[],
  recommendations_bn TEXT[],
  
  -- Timestamps
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_weather_forecasts_location_point ON weather_forecasts USING GIST(location_point);
CREATE INDEX idx_weather_forecasts_forecast_date ON weather_forecasts(forecast_date);
CREATE INDEX idx_weather_forecasts_district ON weather_forecasts(district);

-- Weather alerts
CREATE TABLE weather_alerts (
  alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Location
  location JSONB,
  location_point GEOGRAPHY(POINT),
  districts TEXT[],
  divisions TEXT[],
  affected_area VARCHAR(50) CHECK (affected_area IN ('local', 'district', 'division', 'national')),
  
  -- Alert Details
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('storm', 'heavy_rain', 'flood', 'drought', 'frost', 'heatwave', 'cyclone', 'tornado', 'fog', 'thunderstorm')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'extreme')),
  certainty VARCHAR(20) CHECK (certainty IN ('possible', 'likely', 'very_likely', 'certain')),
  
  -- Message
  message TEXT NOT NULL,
  message_bn TEXT NOT NULL,
  headline TEXT,
  headline_bn TEXT,
  instructions TEXT,
  instructions_bn TEXT,
  
  -- Agricultural Impact
  agricultural_impact TEXT,
  agricultural_impact_bn TEXT,
  affected_crops TEXT[],
  recommended_actions TEXT[],
  recommended_actions_bn TEXT[],
  
  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  issued_by VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'superseded')),
  
  -- Notifications
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  affected_users_count INTEGER DEFAULT 0
);

CREATE INDEX idx_weather_alerts_location_point ON weather_alerts USING GIST(location_point);
CREATE INDEX idx_weather_alerts_districts ON weather_alerts USING GIN(districts);
CREATE INDEX idx_weather_alerts_alert_type ON weather_alerts(alert_type);
CREATE INDEX idx_weather_alerts_severity ON weather_alerts(severity);
CREATE INDEX idx_weather_alerts_status ON weather_alerts(status);
CREATE INDEX idx_weather_alerts_valid_from ON weather_alerts(valid_from DESC);

-- =====================================================
-- DEVICES & IoT
-- =====================================================

CREATE TABLE devices (
  device_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Device Information
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('sensor', 'controller', 'gateway', 'camera', 'weather_station', 'soil_monitor', 'irrigation_valve')),
  device_model VARCHAR(100),
  manufacturer VARCHAR(100),
  serial_number VARCHAR(100) UNIQUE,
  
  -- Connection
  connection_type VARCHAR(50) CHECK (connection_type IN ('wifi', 'bluetooth', 'lora', 'gsm', 'ethernet', 'zigbee')),
  ip_address INET,
  mac_address MACADDR,
  
  -- Status
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'maintenance', 'disabled')),
  is_active BOOLEAN DEFAULT TRUE,
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
  signal_strength INTEGER CHECK (signal_strength >= 0 AND signal_strength <= 100),
  
  -- Firmware
  firmware_version VARCHAR(50),
  last_firmware_update TIMESTAMP WITH TIME ZONE,
  
  -- Location
  location JSONB,
  location_point GEOGRAPHY(POINT),
  installation_location TEXT,
  
  -- Configuration
  configuration JSONB,
  update_interval INTEGER, -- seconds
  
  -- Statistics
  total_readings INTEGER DEFAULT 0,
  last_reading_at TIMESTAMP WITH TIME ZONE,
  total_uptime INTEGER, -- hours
  error_count INTEGER DEFAULT 0,
  
  -- Timestamps
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE,
  last_maintenance TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_device_type ON devices(device_type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_is_active ON devices(is_active);
CREATE INDEX idx_devices_last_seen ON devices(last_seen DESC);
CREATE INDEX idx_devices_location_point ON devices USING GIST(location_point);

-- Device telemetry/readings
CREATE TABLE device_readings (
  reading_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  
  -- Reading Data (flexible JSON structure)
  data JSONB NOT NULL,
  
  -- Common fields (extracted for indexing)
  reading_type VARCHAR(50),
  value DECIMAL(10, 4),
  unit VARCHAR(20),
  
  -- Quality
  quality VARCHAR(20) CHECK (quality IN ('excellent', 'good', 'fair', 'poor', 'error')),
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Timestamp
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_readings_device_id ON device_readings(device_id);
CREATE INDEX idx_device_readings_reading_type ON device_readings(reading_type);
CREATE INDEX idx_device_readings_recorded_at ON device_readings(recorded_at DESC);
CREATE INDEX idx_device_readings_data ON device_readings USING GIN(data);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Notification Content
  type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'warning', 'alert', 'success', 'error', 'consultation', 'price_alert', 'weather_alert', 'system', 'message')),
  title VARCHAR(255) NOT NULL,
  title_bn VARCHAR(255),
  message TEXT NOT NULL,
  message_bn TEXT,
  
  -- Context
  action_url TEXT,
  action_label VARCHAR(100),
  action_label_bn VARCHAR(100),
  related_entity_type VARCHAR(50), -- 'consultation', 'disease', 'price', etc.
  related_entity_id UUID,
  
  -- Priority
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery
  delivered_via TEXT[] DEFAULT ARRAY['app'], -- ['app', 'sms', 'email', 'push']
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  
  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at);

-- =====================================================
-- ANALYTICS & LOGS
-- =====================================================

CREATE TABLE user_activities (
  activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  
  -- Activity Details
  activity_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  
  -- Action
  action VARCHAR(50) NOT NULL, -- 'view', 'create', 'update', 'delete', 'share', etc.
  description TEXT,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50),
  platform VARCHAR(50),
  
  -- Metadata
  metadata JSONB,
  duration INTEGER, -- milliseconds
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_activity_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);

-- System audit logs
CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User & Action
  user_id UUID REFERENCES users(user_id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('success', 'failed', 'partial')),
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- ADMIN SETTINGS
-- =====================================================

CREATE TABLE system_settings (
  setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Setting Details
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50) CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
  
  -- Description
  description TEXT,
  description_bn TEXT,
  
  -- Category
  category VARCHAR(50),
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  default_value TEXT,
  validation_rules JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX idx_system_settings_setting_key ON system_settings(setting_key);
CREATE INDEX idx_system_settings_category ON system_settings(category);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_farmer_profiles_updated_at BEFORE UPDATE ON farmer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_profiles_updated_at BEFORE UPDATE ON doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disease_detections_updated_at BEFORE UPDATE ON disease_detections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_irrigation_systems_updated_at BEFORE UPDATE ON irrigation_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crop_logs_updated_at BEFORE UPDATE ON crop_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_active on user login
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET last_active = NOW() WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_last_active_on_session
AFTER INSERT ON sessions
FOR EACH ROW EXECUTE FUNCTION update_user_last_active();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active doctors view
CREATE OR REPLACE VIEW active_doctors AS
SELECT 
  u.user_id,
  u.user_name,
  u.user_name_bn,
  u.phone,
  u.email,
  dp.*
FROM users u
JOIN doctor_profiles dp ON u.user_id = dp.doctor_id
WHERE u.status = 'active' 
  AND dp.verified = TRUE 
  AND dp.available = TRUE;

-- Recent disease detections view
CREATE OR REPLACE VIEW recent_disease_detections AS
SELECT 
  dd.*,
  u.user_name,
  u.user_name_bn,
  u.phone
FROM disease_detections dd
LEFT JOIN users u ON dd.user_id = u.user_id
ORDER BY dd.created_at DESC
LIMIT 100;

-- Active consultations view
CREATE OR REPLACE VIEW active_consultations AS
SELECT 
  c.*,
  fu.user_name as farmer_name_full,
  fu.user_name_bn as farmer_name_bn_full,
  du.user_name as doctor_name_full,
  du.user_name_bn as doctor_name_bn_full
FROM consultations c
LEFT JOIN users fu ON c.farmer_id = fu.user_id
LEFT JOIN users du ON c.doctor_id = du.user_id
WHERE c.status IN ('pending', 'accepted', 'active')
ORDER BY c.priority DESC, c.requested_at ASC;

-- Latest market prices view
CREATE OR REPLACE VIEW latest_market_prices AS
SELECT DISTINCT ON (crop, market)
  *
FROM market_prices
ORDER BY crop, market, price_date DESC, recorded_at DESC;

-- User statistics view
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  u.user_id,
  u.user_name,
  u.role,
  u.created_at,
  COUNT(DISTINCT dd.scan_id) as total_scans,
  COUNT(DISTINCT c.consultation_id) as total_consultations,
  COUNT(DISTINCT cl.log_id) as total_crop_logs,
  MAX(u.last_active) as last_active
FROM users u
LEFT JOIN disease_detections dd ON u.user_id = dd.user_id
LEFT JOIN consultations c ON u.user_id = c.farmer_id
LEFT JOIN crop_logs cl ON u.user_id = cl.user_id
GROUP BY u.user_id;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = user_id OR role = 'admin');

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = user_id);

-- Disease detections - users can view their own
CREATE POLICY disease_detections_select_own ON disease_detections
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM users WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
  ));

-- Consultations - farmers see their own, doctors see assigned
CREATE POLICY consultations_select ON consultations
  FOR SELECT USING (
    auth.uid() = farmer_id OR 
    auth.uid() = doctor_id OR 
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Notifications - users see their own
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- INITIAL DATA SEEDS (Optional)
-- =====================================================

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, description_bn) VALUES
('app_name', 'Smart Farming System', 'string', 'general', 'Application name', 'অ্যাপ্লিকেশন নাম'),
('default_language', 'bn', 'string', 'general', 'Default language', 'ডিফল্ট ভাষা'),
('max_upload_size_mb', '10', 'number', 'uploads', 'Maximum file upload size in MB', 'সর্বোচ্চ ফাইল আপলোড আকার (এমবি)'),
('enable_realtime', 'true', 'boolean', 'features', 'Enable real-time features', 'রিয়েল-টাইম বৈশিষ্ট্য সক্রিয় করুন'),
('otp_expiry_minutes', '10', 'number', 'auth', 'OTP expiry time in minutes', 'OTP মেয়াদ শেষ সময় (মিনিট)'),
('max_consultations_per_day', '20', 'number', 'consultations', 'Maximum consultations per doctor per day', 'প্রতি ডাক্তার প্রতিদিন সর্বোচ্চ পরামর্শ'),
('price_update_frequency_hours', '6', 'number', 'market', 'Market price update frequency in hours', 'বাজার মূল্য আপডেট ফ্রিকোয়েন্সি (ঘন্টা)'),
('weather_update_frequency_hours', '3', 'number', 'weather', 'Weather data update frequency in hours', 'আবহাওয়া ডেটা আপডেট ফ্রিকোয়েন্সি (ঘন্টা)');

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Main users table with multi-role support (farmer, doctor, admin)';
COMMENT ON TABLE doctor_profiles IS 'Extended profile information for agricultural experts/doctors';
COMMENT ON TABLE disease_detections IS 'AI-powered disease detection results with expert review';
COMMENT ON TABLE irrigation_systems IS 'Smart irrigation system management with auto/manual control';
COMMENT ON TABLE consultations IS 'Farmer-doctor consultations with messaging and prescriptions';
COMMENT ON TABLE market_prices IS 'Real-time market prices with trend analysis';
COMMENT ON TABLE weather_data IS 'Weather observations and agricultural weather data';
COMMENT ON TABLE crop_logs IS 'Crop lifecycle tracking with activities and yield management';
COMMENT ON TABLE devices IS 'IoT device registry and management';

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Create composite indexes for common query patterns
CREATE INDEX idx_consultations_status_priority ON consultations(status, priority) WHERE status IN ('pending', 'accepted');
CREATE INDEX idx_disease_detections_user_created ON disease_detections(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read = FALSE;
CREATE INDEX idx_market_prices_crop_date ON market_prices(crop, price_date DESC);
CREATE INDEX idx_crop_logs_user_status ON crop_logs(user_id, status) WHERE status = 'active';

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE doctor_profiles;
ANALYZE disease_detections;
ANALYZE consultations;
ANALYZE market_prices;

-- =====================================================
-- SCHEMA VERSION & MIGRATION INFO
-- =====================================================

CREATE TABLE schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description) VALUES
('001_initial_schema', 'Complete initial database schema with all tables, indexes, and constraints');

-- =====================================================
-- END OF SCHEMA
-- =====================================================

-- Grant necessary permissions (adjust based on your Supabase setup)
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
