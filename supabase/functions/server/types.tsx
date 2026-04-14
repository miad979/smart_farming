// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "farmer" | "doctor" | "admin";
  role_bn: string;
  location?: string;
  location_bn?: string;
  specialty?: string;
  specialty_bn?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  registrationNumber?: string;
  createdAt: string;
  lastSeen?: string;
  metadata?: any;
}

// Disease Detection
export interface DiseaseRecord {
  id: string;
  userId: string;
  disease: string;
  disease_bn: string;
  confidence: number;
  image_url?: string;
  advisory_en: string;
  advisory_bn: string;
  treatment_en: string;
  treatment_bn: string;
  prevention_en: string;
  prevention_bn: string;
  crop?: string;
  crop_bn?: string;
  detectedAt: string;
  reviewed?: boolean;
  reviewedBy?: string;
}

// Irrigation
export interface IrrigationSchedule {
  id: string;
  userId: string;
  autoMode: boolean;
  moisture: number;
  nextWatering: string;
  nextWatering_bn: string;
  amount: string;
  policy: {
    crop: string;
    crop_bn: string;
    threshold: number;
    window: string;
    maxVolume: number;
  };
  alerts: Array<{
    message: string;
    message_bn: string;
    timestamp: string;
  }>;
  usage: Array<{
    id: string;
    day: string;
    day_bn: string;
    amount: number;
    date: string;
  }>;
  updatedAt: string;
}

// Consultation
export interface Consultation {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerEmail: string;
  doctorId?: string;
  doctorName?: string;
  crop: string;
  crop_bn: string;
  disease: string;
  disease_bn: string;
  description: string;
  description_en: string;
  location: string;
  location_bn: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  images?: string[];
  submittedAt: string;
  doctorResponse?: string;
  doctorResponse_en?: string;
  responseTime?: string;
  responseTime_bn?: string;
  rating?: number;
  feedback?: string;
  feedback_en?: string;
}

// Market Price
export interface MarketPrice {
  id: string;
  crop: string;
  crop_bn: string;
  price: number;
  change: number;
  trend: "up" | "down" | "stable";
  location: string;
  location_bn: string;
  market: string;
  market_bn: string;
  lastUpdated: string;
  lastUpdated_bn: string;
  history: Array<{
    date: string;
    date_bn: string;
    price: number;
  }>;
}

// Price Alert
export interface PriceAlert {
  id: string;
  userId: string;
  crop: string;
  crop_bn: string;
  targetPrice: number;
  condition: "above" | "below";
  location: string;
  active: boolean;
  createdAt: string;
}

// Device
export interface Device {
  id: string;
  userId: string;
  type: string;
  type_bn: string;
  status: "active" | "inactive";
  status_bn: string;
  lastSync: string;
}

// Weather data
export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  condition_bn: string;
  humidity: number;
  windSpeed: number;
  forecast: Array<{
    day: string;
    day_bn: string;
    temp: number;
    condition: string;
    condition_bn: string;
  }>;
  lastUpdated: string;
}