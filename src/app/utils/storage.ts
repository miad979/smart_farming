// Local storage utilities for offline-first data persistence

const STORAGE_PREFIX = 'smart-farming-';

export const storage = {
  // Get item from local storage
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : (defaultValue ?? null);
    } catch (error) {
      console.error('Error reading from storage:', error);
      return defaultValue ?? null;
    }
  },

  // Set item in local storage
  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to storage:', error);
      return false;
    }
  },

  // Remove item from local storage
  remove: (key: string): void => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  },

  // Clear all app data from local storage
  clear: (): void => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },

  // Get storage size in bytes
  getSize: (): number => {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (key.startsWith(STORAGE_PREFIX)) {
          total += localStorage[key].length + key.length;
        }
      }
      return total;
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return 0;
    }
  },
};

// Storage keys
export const STORAGE_KEYS = {
  LANGUAGE: 'language',
  USER_MODE: 'user-mode',
  USER_DATA: 'user-data',
  ACCESS_TOKEN: 'access-token',
  DISEASE_RESULTS: 'disease-results',
  IRRIGATION_DATA: 'irrigation-data',
  PRICE_ALERTS: 'price-alerts',
  FAVORITES: 'favorites',
  SETTINGS: 'settings',
  LAST_SYNC: 'last-sync',
  ONBOARDING_DISMISSED: 'onboarding-dismissed',
} as const;

// Initialize storage with default values
export const initializeStorage = (): void => {
  // Set defaults if not already set
  if (storage.get(STORAGE_KEYS.LANGUAGE) === null) {
    storage.set(STORAGE_KEYS.LANGUAGE, 'bn');
  }
  if (storage.get(STORAGE_KEYS.USER_MODE) === null) {
    storage.set(STORAGE_KEYS.USER_MODE, 'guest');
  }
  if (storage.get(STORAGE_KEYS.SETTINGS) === null) {
    storage.set(STORAGE_KEYS.SETTINGS, {
      notifications: {
        disease: true,
        irrigation: true,
        price: true,
        weather: true,
      },
      voiceSpeed: 1,
      theme: 'light',
    });
  }
};
