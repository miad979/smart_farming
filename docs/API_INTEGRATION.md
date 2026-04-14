# API Integration Guide

> Local Mode Override (April 2026): Primary backend is local (`server/local-api.cjs`). Supabase options in this document are optional legacy paths.

## Overview

This guide explains how to transition from mock data to a real backend API. The current implementation uses mock data for offline-first development. This document provides step-by-step instructions for integrating with a real backend.

---

## Table of Contents

1. [Backend Options](#backend-options)
2. [Environment Configuration](#environment-configuration)
3. [API Client Setup](#api-client-setup)
4. [Authentication](#authentication)
5. [Endpoint Integration](#endpoint-integration)
6. [Error Handling](#error-handling)
7. [Caching Strategy](#caching-strategy)
8. [Offline Support](#offline-support)
9. [Migration Checklist](#migration-checklist)

---

## Backend Options

### Option 1: Supabase (Recommended)

**Pros:**
- Built-in authentication
- PostgreSQL database
- Real-time subscriptions
- Row-level security
- Storage for images
- Edge functions

**Setup:**
```bash
npm install @supabase/supabase-js
```

**Configuration:**
```typescript
// src/app/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Option 2: Custom REST API

**Setup with Axios:**
```bash
npm install axios
```

**Configuration:**
```typescript
// src/app/utils/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

### Option 3: Firebase

**Setup:**
```bash
npm install firebase
```

---

## Environment Configuration

### Create .env File

```env
# .env.local (not committed to git)

# API Configuration
VITE_API_URL=https://api.smartfarming.bd
VITE_API_VERSION=v1

# Supabase (if using)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Firebase (if using)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id

# Third-party APIs
VITE_WEATHER_API_KEY=your-weather-api-key
VITE_SMS_API_KEY=your-sms-api-key

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_ANALYTICS=true
```

### Environment Types

```typescript
// src/app/types/env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WEATHER_API_KEY: string;
  readonly VITE_SMS_API_KEY: string;
  readonly VITE_ENABLE_OFFLINE_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## API Client Setup

### Create API Service Layer

```typescript
// src/app/services/api.service.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('smartFarming_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  private handleUnauthorized() {
    localStorage.removeItem('smartFarming_token');
    window.location.href = '/profile';
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  async upload<T>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  }
}

export const apiService = new ApiService();
```

---

## Authentication

### OTP Authentication Implementation

```typescript
// src/app/services/auth.service.ts
import { apiService } from './api.service';

interface SendOtpResponse {
  success: boolean;
  message: string;
}

interface VerifyOtpResponse {
  success: boolean;
  token: string;
  user: User;
}

export class AuthService {
  async sendOtp(phone: string): Promise<SendOtpResponse> {
    try {
      const response = await apiService.post<SendOtpResponse>('/api/auth/send-otp', {
        phone,
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    try {
      const response = await apiService.post<VerifyOtpResponse>('/api/auth/verify-otp', {
        phone,
        otp,
      });

      // Store token
      if (response.success && response.token) {
        localStorage.setItem('smartFarming_token', response.token);
        localStorage.setItem('smartFarming_user', JSON.stringify(response.user));
      }

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await apiService.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('smartFarming_token');
      localStorage.removeItem('smartFarming_user');
    }
  }

  async refreshToken(): Promise<string> {
    const response = await apiService.post<{ token: string }>('/api/auth/refresh');
    localStorage.setItem('smartFarming_token', response.token);
    return response.token;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('smartFarming_token');
  }

  getUser(): User | null {
    const userJson = localStorage.getItem('smartFarming_user');
    return userJson ? JSON.parse(userJson) : null;
  }

  private handleError(error: any): Error {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error.message);
    }
    return new Error('Authentication failed');
  }
}

export const authService = new AuthService();
```

### Update Profile Component

```typescript
// src/app/pages/Profile.tsx (update login logic)
import { authService } from '../services/auth.service';

const handleVerifyOtp = async () => {
  try {
    setLoading(true);
    const response = await authService.verifyOtp(phoneNumber, otp);
    
    if (response.success) {
      dispatch({ type: 'SET_USER_MODE', payload: 'logged-in' });
      dispatch({ type: 'SET_USER_ROLE', payload: response.user.role });
      dispatch({ type: 'SET_USER_ID', payload: response.user.userId });
      dispatch({ type: 'SET_USER_NAME', payload: response.user.userName });
      
      setShowOtp(false);
      // Success message
    }
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

## Endpoint Integration

### Disease Detection Service

```typescript
// src/app/services/disease.service.ts
import { apiService } from './api.service';
import { DiseaseDetection } from '../types/models';

export class DiseaseService {
  async detectDisease(
    image: File,
    userId: string,
    cropType?: string,
    onProgress?: (progress: number) => void
  ): Promise<DiseaseDetection> {
    try {
      // Upload image and get analysis
      const result = await apiService.upload<DiseaseDetection>(
        '/api/disease/detect',
        image,
        onProgress
      );
      return result;
    } catch (error) {
      throw new Error('Disease detection failed');
    }
  }

  async getHistory(userId: string, limit = 20): Promise<DiseaseDetection[]> {
    try {
      const response = await apiService.get<{ detections: DiseaseDetection[] }>(
        '/api/disease/history',
        { userId, limit }
      );
      return response.detections;
    } catch (error) {
      throw new Error('Failed to load history');
    }
  }

  async requestReview(scanId: string, userId: string, notes?: string): Promise<string> {
    try {
      const response = await apiService.post<{ consultationId: string }>(
        '/api/disease/request-review',
        { scanId, userId, notes }
      );
      return response.consultationId;
    } catch (error) {
      throw new Error('Failed to request review');
    }
  }

  async saveResult(scanId: string, userId: string): Promise<void> {
    await apiService.post('/api/disease/save', { scanId, userId });
  }
}

export const diseaseService = new DiseaseService();
```

### Update DiseaseDetection Component

```typescript
// src/app/pages/DiseaseDetection.tsx
import { diseaseService } from '../services/disease.service';
import { useState } from 'react';

export const DiseaseDetection: React.FC = () => {
  const [result, setResult] = useState<DiseaseDetection | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);

      const detection = await diseaseService.detectDisease(
        file,
        state.userId!,
        undefined,
        (progress) => setProgress(progress)
      );

      setResult(detection);
      setShowResult(true);
    } catch (error) {
      console.error('Detection failed:', error);
      alert('Failed to analyze image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {uploading ? (
        <div className="uploading-state">
          <p>Analyzing image...</p>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
          <p>{progress}%</p>
        </div>
      ) : (
        // Regular UI
      )}
    </div>
  );
};
```

### Irrigation Service

```typescript
// src/app/services/irrigation.service.ts
import { apiService } from './api.service';
import { IrrigationSystem } from '../types/models';

export class IrrigationService {
  async getStatus(userId: string): Promise<IrrigationSystem> {
    return await apiService.get<IrrigationSystem>('/api/irrigation/status', { userId });
  }

  async waterNow(systemId: string, userId: string): Promise<boolean> {
    const response = await apiService.post<{ started: boolean }>(
      '/api/irrigation/water-now',
      { systemId, userId }
    );
    return response.started;
  }

  async toggleAuto(systemId: string, userId: string, enabled: boolean): Promise<boolean> {
    const response = await apiService.put<{ autoMode: boolean }>(
      '/api/irrigation/toggle-auto',
      { systemId, userId, enabled }
    );
    return response.autoMode;
  }

  async updatePolicy(
    systemId: string,
    userId: string,
    policy: IrrigationPolicy
  ): Promise<IrrigationPolicy> {
    const response = await apiService.put<{ policy: IrrigationPolicy }>(
      '/api/irrigation/policy',
      { systemId, userId, policy }
    );
    return response.policy;
  }
}

export const irrigationService = new IrrigationService();
```

### Market Prices Service

```typescript
// src/app/services/price.service.ts
import { apiService } from './api.service';
import { MarketPrice, PriceHistory } from '../types/models';

export class PriceService {
  async getCurrentPrices(location?: string, crop?: string): Promise<MarketPrice[]> {
    const response = await apiService.get<{ prices: MarketPrice[] }>(
      '/api/prices/current',
      { location, crop }
    );
    return response.prices;
  }

  async getPriceHistory(
    crop: string,
    market: string,
    days = 7
  ): Promise<PriceHistory[]> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const response = await apiService.get<{ history: PriceHistory[] }>(
      '/api/prices/history',
      { crop, market, startDate, endDate }
    );
    return response.history;
  }

  async createPriceAlert(
    userId: string,
    crop: string,
    targetPrice: number,
    condition: 'above' | 'below'
  ): Promise<string> {
    const response = await apiService.post<{ alertId: string }>('/api/prices/alert', {
      userId,
      crop,
      targetPrice,
      condition,
    });
    return response.alertId;
  }
}

export const priceService = new PriceService();
```

### Weather Service

```typescript
// src/app/services/weather.service.ts
import { apiService } from './api.service';
import { Weather, WeatherForecast } from '../types/models';

export class WeatherService {
  async getCurrentWeather(lat: number, lon: number): Promise<Weather> {
    return await apiService.get<Weather>('/api/weather/current', { lat, lon });
  }

  async getForecast(lat: number, lon: number, days = 3): Promise<WeatherForecast[]> {
    const response = await apiService.get<{ forecast: WeatherForecast[] }>(
      '/api/weather/forecast',
      { lat, lon, days }
    );
    return response.forecast;
  }
}

export const weatherService = new WeatherService();
```

---

## Error Handling

### Global Error Handler

```typescript
// src/app/utils/errorHandler.ts

export interface ApiError {
  code: string;
  message: string;
  message_bn?: string;
  details?: any;
}

export class ErrorHandler {
  static handle(error: any, language: 'bn' | 'en' = 'bn'): string {
    // Network error
    if (!error.response) {
      return language === 'bn' 
        ? 'ইন্টারনেট সংযোগ পরীক্ষা করুন' 
        : 'Check your internet connection';
    }

    // API error
    const apiError: ApiError = error.response?.data?.error;
    if (apiError) {
      return language === 'bn' && apiError.message_bn 
        ? apiError.message_bn 
        : apiError.message;
    }

    // Default error
    return language === 'bn' 
      ? 'কিছু ভুল হয়েছে। আবার চেষ্টা করুন।' 
      : 'Something went wrong. Please try again.';
  }

  static getErrorCode(error: any): string {
    return error.response?.data?.error?.code || 'UNKNOWN_ERROR';
  }

  static isNetworkError(error: any): boolean {
    return !error.response;
  }

  static isAuthError(error: any): boolean {
    return error.response?.status === 401 || error.response?.status === 403;
  }
}
```

### Usage in Components

```typescript
import { ErrorHandler } from '../utils/errorHandler';

try {
  await diseaseService.detectDisease(file, userId);
} catch (error) {
  const errorMessage = ErrorHandler.handle(error, state.language);
  setError(errorMessage);
  
  // Log for debugging
  console.error('Detection error:', {
    code: ErrorHandler.getErrorCode(error),
    isNetwork: ErrorHandler.isNetworkError(error),
  });
}
```

---

## Caching Strategy

### Implement Cache Service

```typescript
// src/app/services/cache.service.ts

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheService {
  private cache = new Map<string, CacheItem<any>>();

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Also store in localStorage for persistence
    try {
      localStorage.setItem(
        `cache_${key}`,
        JSON.stringify({ data, timestamp: Date.now(), ttl })
      );
    } catch (e) {
      console.warn('Failed to cache to localStorage:', e);
    }
  }

  get<T>(key: string): T | null {
    // Check memory cache first
    const cached = this.cache.get(key);
    if (cached && this.isValid(cached)) {
      return cached.data;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        const item: CacheItem<T> = JSON.parse(stored);
        if (this.isValid(item)) {
          // Restore to memory cache
          this.cache.set(key, item);
          return item.data;
        }
      }
    } catch (e) {
      console.warn('Failed to read cache from localStorage:', e);
    }

    return null;
  }

  private isValid(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
      localStorage.removeItem(`cache_${key}`);
    } else {
      this.cache.clear();
      // Clear all cache items from localStorage
      Object.keys(localStorage)
        .filter((k) => k.startsWith('cache_'))
        .forEach((k) => localStorage.removeItem(k));
    }
  }

  clearExpired(): void {
    for (const [key, item] of this.cache.entries()) {
      if (!this.isValid(item)) {
        this.cache.delete(key);
        localStorage.removeItem(`cache_${key}`);
      }
    }
  }
}

export const cacheService = new CacheService();

// Clear expired cache every 10 minutes
setInterval(() => cacheService.clearExpired(), 10 * 60 * 1000);
```

### Use Cache in Services

```typescript
// src/app/services/weather.service.ts (updated)
import { cacheService } from './cache.service';

export class WeatherService {
  async getCurrentWeather(lat: number, lon: number): Promise<Weather> {
    const cacheKey = `weather_${lat}_${lon}`;
    
    // Check cache first
    const cached = cacheService.get<Weather>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const weather = await apiService.get<Weather>('/api/weather/current', { lat, lon });
    
    // Cache for 30 minutes
    cacheService.set(cacheKey, weather, 30 * 60 * 1000);
    
    return weather;
  }
}
```

---

## Offline Support

### Service Worker Setup

```typescript
// public/service-worker.js

const CACHE_NAME = 'smartfarming-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js',
  // Add other static assets
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch strategy: Network first, fall back to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
```

### Register Service Worker

```typescript
// src/main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
```

### Offline Detection

```typescript
// src/app/hooks/useOnlineStatus.ts
import { useState, useEffect } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
```

### Offline Banner Component

```typescript
// src/app/components/OfflineBanner.tsx
import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { state } = useApp();
  const lang = state.language;

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white p-3 text-center z-50">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-5 h-5" />
        <p className="text-sm font-medium">
          {lang === 'bn' 
            ? 'আপনি অফলাইনে আছেন। কিছু বৈশিষ্ট্য সীমিত হতে পারে।' 
            : 'You are offline. Some features may be limited.'}
        </p>
      </div>
    </div>
  );
};
```

---

## Migration Checklist

### Phase 1: Setup (Week 1)

- [ ] Choose backend (Supabase/Custom API)
- [ ] Set up environment variables
- [ ] Create API service layer
- [ ] Implement authentication service
- [ ] Test authentication flow

### Phase 2: Core Features (Week 2-3)

- [ ] Integrate disease detection API
- [ ] Integrate irrigation API
- [ ] Integrate market prices API
- [ ] Integrate weather API
- [ ] Test all endpoints

### Phase 3: User Management (Week 4)

- [ ] Integrate user management API
- [ ] Implement consultation API
- [ ] Implement crop logs API
- [ ] Test role-based access

### Phase 4: Admin Features (Week 5)

- [ ] Integrate doctor verification API
- [ ] Implement admin analytics
- [ ] Test admin workflows

### Phase 5: Optimization (Week 6)

- [ ] Implement caching
- [ ] Add offline support
- [ ] Optimize image uploads
- [ ] Performance testing
- [ ] Load testing

### Phase 6: Production (Week 7)

- [ ] Remove mock data
- [ ] Remove demo features (role switcher)
- [ ] Security audit
- [ ] Final testing
- [ ] Deployment

---

## Testing API Integration

### Create Test Suite

```typescript
// src/app/services/__tests__/disease.service.test.ts
import { diseaseService } from '../disease.service';

describe('DiseaseService', () => {
  it('should detect disease from image', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const result = await diseaseService.detectDisease(file, 'user_123');
    
    expect(result).toBeDefined();
    expect(result.disease).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle API errors', async () => {
    const file = new File(['invalid'], 'test.txt', { type: 'text/plain' });
    
    await expect(
      diseaseService.detectDisease(file, 'user_123')
    ).rejects.toThrow();
  });
});
```

---

## Monitoring & Analytics

### Add Error Tracking

```typescript
// src/app/utils/monitoring.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});

export const logError = (error: Error, context?: any) => {
  Sentry.captureException(error, { extra: context });
};
```

### Add Analytics

```typescript
// src/app/utils/analytics.ts
import mixpanel from 'mixpanel-browser';

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN);

export const trackEvent = (event: string, properties?: any) => {
  mixpanel.track(event, properties);
};

export const trackPageView = (page: string) => {
  trackEvent('Page View', { page });
};
```

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Integration Guide
