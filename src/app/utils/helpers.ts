import { Language } from '../context/AppContext';

const LAST_LOCATION_STORAGE_KEY = 'sf_last_known_location';

type StoredLocation = {
  lat: number;
  lng: number;
  updatedAt: string;
};

type CurrentLocationOptions = {
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
  fallbackToLastKnown?: boolean;
};

// Convert numbers to Bengali numerals
export const toBengaliNumber = (num: number | string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
};

// Format currency with proper symbol based on language
export const formatCurrency = (amount: number, lang: Language): string => {
  if (lang === 'bn') {
    return `৳${toBengaliNumber(amount)}`;
  }
  return `৳${amount}`;
};

// Format date/time for Bengali
export const formatDateTime = (date: Date | string, lang: Language): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (lang === 'bn') {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return d.toLocaleDateString('bn-BD', options);
  }
  
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Detect if device is mobile
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const readStoredLocation = (): StoredLocation | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredLocation;
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const storeLocation = (coords: { lat: number; lng: number }) => {
  if (typeof window === 'undefined') return;

  try {
    const payload: StoredLocation = {
      lat: coords.lat,
      lng: coords.lng,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
};

export const getLastKnownLocation = (): { lat: number; lng: number } | null => {
  const stored = readStoredLocation();
  if (!stored) return null;
  return { lat: stored.lat, lng: stored.lng };
};

const normalizeGeolocationError = (error: GeolocationPositionError) => {
  if (error?.code === error.PERMISSION_DENIED) {
    return 'Location access is denied by the browser';
  }
  if (error?.code === error.TIMEOUT) {
    return 'Location request timed out';
  }
  if (error?.code === error.POSITION_UNAVAILABLE) {
    return 'Location is currently unavailable';
  }
  return error?.message || 'Unable to get live location';
};

// Detect GPS location with browser geolocation.
export const getCurrentLocation = (options: CurrentLocationOptions = {}): Promise<{ lat: number; lng: number }> => {
  const {
    timeoutMs = 15000,
    maximumAgeMs = 5 * 60 * 1000,
    enableHighAccuracy = false,
    fallbackToLastKnown = true,
  } = options;

  return new Promise((resolve, reject) => {
    const fallback = () => {
      if (!fallbackToLastKnown) return false;
      const stored = getLastKnownLocation();
      if (!stored) return false;
      resolve(stored);
      return true;
    };

    if (!('geolocation' in navigator)) {
      if (fallback()) return;
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        storeLocation(coords);
        resolve(coords);
      },
      (error) => {
        if (fallback()) return;
        reject(new Error(normalizeGeolocationError(error)));
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
      },
    );
  });
};

// Check network status
export const checkOnlineStatus = (): boolean => {
  return navigator.onLine;
};

// Generate unique ID
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
