import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { checkOnlineStatus } from '../utils/helpers';
import { initializeStorage, storage, STORAGE_KEYS } from '../utils/storage';
import * as api from '../utils/api';

export type Language = 'bn' | 'en';
export type UserMode = 'guest' | 'logged-in';
export type UserRole = 'farmer' | 'doctor' | 'admin' | 'super_admin';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type Theme = 'light' | 'dark' | 'system';

interface User {
  id?: string;
  email?: string;
  phone?: string;
  name: string;
  language: Language;
  favorites: string[];
  consent_flags: boolean;
  role: UserRole;
  verificationStatus?: VerificationStatus;
  verificationDocuments?: string[];
  location?: string;
  location_bn?: string;
  specialty?: string;
  specialty_bn?: string;
  registrationNumber?: string;
}

interface AppState {
  language: Language;
  userMode: UserMode;
  user: User;
  isOnline: boolean;
  lastSync: Date | null;
  theme: Theme;
  accessToken: string | null;
}

interface AppContextType {
  state: AppState;
  setLanguage: (lang: Language) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: any) => Promise<{ success: boolean; error?: string; requiresApproval?: boolean; message?: string }>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setOnlineStatus: (status: boolean) => void;
  setTheme: (theme: Theme) => void;
  syncData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to apply theme to document
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.classList.toggle('dark', systemTheme === 'dark');
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize storage on mount
  useEffect(() => {
    initializeStorage();
  }, []);

  const [state, setState] = useState<AppState>(() => {
    // Load initial state from storage
    const savedLanguage = storage.get<Language>(STORAGE_KEYS.LANGUAGE) || 'bn';
    const savedUserMode = storage.get<UserMode>(STORAGE_KEYS.USER_MODE) || 'guest';
    const savedUserData = storage.get<User>(STORAGE_KEYS.USER_DATA);
    const savedAccessToken = storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN);
    const lastSync = storage.get<string>(STORAGE_KEYS.LAST_SYNC);
    const savedTheme = storage.get<Theme>('theme') || 'light';

    return {
      language: savedLanguage,
      userMode: savedUserMode,
      user: savedUserData || {
        name: savedLanguage === 'bn' ? 'অতিথি' : 'Guest',
        language: savedLanguage,
        favorites: [],
        consent_flags: true,
        role: 'farmer',
      },
      isOnline: checkOnlineStatus(),
      lastSync: lastSync ? new Date(lastSync) : null,
      theme: savedTheme,
      accessToken: savedUserMode === 'logged-in' ? (savedAccessToken || 'cookie-session') : null,
    };
  });

  // Check and restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (state.userMode === 'logged-in') {
        try {
          const { user } = await api.getCurrentUser(state.accessToken || 'cookie-session');
          if (user) {
            setState(prev => ({
              ...prev,
              user: {
                ...prev.user,
                ...user,
                favorites: prev.user.favorites,
                consent_flags: prev.user.consent_flags,
              },
              accessToken: prev.accessToken || 'cookie-session',
            }));
          }
        } catch (error: any) {
          const status = Number(error?.status || 0);
          const unauthorized = status === 401 || status === 403;

          if (unauthorized) {
            console.error('Session expired during restore. Logging out.');
            logout();
            return;
          }

          // Do not force logout on transient failures (dev server restart/network hiccup).
          // Retry once; if it still fails, keep local session marker and let next API action re-check auth.
          console.warn('Session restore failed, retrying once:', error);
          setTimeout(() => {
            void api.getCurrentUser(state.accessToken || 'cookie-session')
              .then(({ user }) => {
                if (!user) return;
                setState(prev => ({
                  ...prev,
                  user: {
                    ...prev.user,
                    ...user,
                    favorites: prev.user.favorites,
                    consent_flags: prev.user.consent_flags,
                  },
                  accessToken: prev.accessToken || 'cookie-session',
                }));
              })
              .catch((retryError: any) => {
                const retryStatus = Number(retryError?.status || 0);
                if (retryStatus === 401 || retryStatus === 403) {
                  logout();
                }
              });
          }, 500);
        }
      }
    };

    restoreSession();
  }, []);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(state.theme);
  }, [state.theme]);

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (state.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [state.theme]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setState(prev => {
      const newState = {
        ...prev,
        language: lang,
        user: { ...prev.user, language: lang },
      };
      storage.set(STORAGE_KEYS.LANGUAGE, lang);
      storage.set(STORAGE_KEYS.USER_DATA, newState.user);
      return newState;
    });
  };

  const setTheme = (theme: Theme) => {
    setState(prev => {
      storage.set('theme', theme);
      return { ...prev, theme };
    });
  };

  const signup = async (data: any) => {
    try {
      const response = await api.signUp(data);

      if (response.user && !response.requiresApproval) {
        const nextAccessToken = response.accessToken || 'cookie-session';
        setState(prev => ({
          ...prev,
          userMode: 'logged-in',
          user: {
            ...prev.user,
            ...response.user,
            language: prev.language,
            favorites: [],
            consent_flags: true,
          },
          accessToken: nextAccessToken,
          lastSync: new Date(),
        }));

        storage.set(STORAGE_KEYS.USER_MODE, 'logged-in');
        storage.set(STORAGE_KEYS.USER_DATA, response.user);
        storage.set(STORAGE_KEYS.ACCESS_TOKEN, nextAccessToken);
        storage.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

        return { success: true };
      }

      if (response.user && response.requiresApproval) {
        return {
          success: true,
          requiresApproval: true,
          message: response.message,
        };
      }
      
      return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.signIn(email, password);
      
      if (response.user) {
        const nextAccessToken = response.accessToken || 'cookie-session';
        setState(prev => ({
          ...prev,
          userMode: 'logged-in',
          user: {
            ...prev.user,
            ...response.user,
            language: prev.language,
            favorites: prev.user.favorites || [],
            consent_flags: prev.user.consent_flags ?? true,
          },
          accessToken: nextAccessToken,
          lastSync: new Date(),
        }));

        storage.set(STORAGE_KEYS.USER_MODE, 'logged-in');
        storage.set(STORAGE_KEYS.USER_DATA, response.user);
        storage.set(STORAGE_KEYS.ACCESS_TOKEN, nextAccessToken);
        storage.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

        return { success: true };
      }
      
      return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    void api.signOut(state.accessToken || undefined).catch(() => {
      // Ignore network logout errors; local cleanup still runs.
    });

    setState(prev => {
      const newState = {
        ...prev,
        userMode: 'guest' as UserMode,
        user: {
          name: prev.language === 'bn' ? 'অতিথি' : 'Guest',
          language: prev.language,
          favorites: [],
          consent_flags: true,
          role: 'farmer' as UserRole,
        },
        lastSync: null,
        accessToken: null,
      };
      storage.set(STORAGE_KEYS.USER_MODE, 'guest');
      storage.set(STORAGE_KEYS.USER_DATA, newState.user);
      storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
      storage.remove(STORAGE_KEYS.LAST_SYNC);
      return newState;
    });
  };

  const updateUser = (updates: Partial<User>) => {
    setState(prev => {
      const newState = {
        ...prev,
        user: { ...prev.user, ...updates },
      };
      storage.set(STORAGE_KEYS.USER_DATA, newState.user);
      return newState;
    });
  };

  const setOnlineStatus = (status: boolean) => {
    setState(prev => ({ ...prev, isOnline: status }));
  };

  const syncData = async () => {
    if (!state.isOnline || state.userMode !== 'logged-in') {
      return;
    }

    try {
      // Sync user data from server
      const { user } = await api.getCurrentUser(state.accessToken || 'cookie-session');
      if (user) {
        updateUser(user);
      }

      setState(prev => ({
        ...prev,
        lastSync: new Date(),
      }));
      storage.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  return (
    <AppContext.Provider value={{ 
      state, 
      setLanguage, 
      login, 
      signup,
      logout, 
      updateUser, 
      setOnlineStatus, 
      setTheme,
      syncData,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};