import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useApp } from './AppContext';
import { toast } from 'sonner';
import { triggerSoftRefresh } from '../utils/softRefresh';

interface Notification {
  id: string;
  type: 'consultation' | 'price_alert' | 'irrigation' | 'disease_review' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface RealtimeContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Simulated WebSocket connection for real-time updates
class RealtimeConnection {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connected: boolean = false;
  private reconnectTimeout: any = null;
  private eventSource: EventSource | null = null;
  private reconnectAttempts: number = 0;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  private setConnected(connected: boolean) {
    this.connected = connected;
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  private scheduleReconnect(token?: string | null) {
    if (this.reconnectTimeout) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(token);
    }, delay);
  }

  connect(token?: string | null) {
    if (this.eventSource) return;

    const params = new URLSearchParams();
    if (token && (token.startsWith('sf_token_') || token.startsWith('demo_token_'))) {
      params.set('token', token);
    }
    const url = `/api/realtime/stream${params.toString() ? `?${params.toString()}` : ''}`;

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnected(true);
    };

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (payload.channel) {
          this.emit(payload.channel, payload.data);
        }
      } catch (error) {
        console.error('Failed to parse realtime event:', error);
      }
    };

    this.eventSource.onerror = () => {
      this.setConnected(false);
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.scheduleReconnect(token);
    };
  }

  disconnect() {
    this.setConnected(false);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  subscribe(channel: string, callback: (data: any) => void) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);
    
    console.log(`📡 Subscribed to channel: ${channel}`);
    
    return () => {
      this.unsubscribe(channel, callback);
    };
  }

  unsubscribe(channel: string, callback: (data: any) => void) {
    const channelListeners = this.listeners.get(channel);
    if (channelListeners) {
      channelListeners.delete(callback);
      if (channelListeners.size === 0) {
        this.listeners.delete(channel);
      }
      console.log(`📡 Unsubscribed from channel: ${channel}`);
    }
  }

  emit(channel: string, data: any) {
    const channelListeners = this.listeners.get(channel);
    if (channelListeners) {
      channelListeners.forEach(callback => callback(data));
    }
  }

  isConnected() {
    return this.connected;
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.add(callback);
    callback(this.connected);
    return () => this.connectionListeners.delete(callback);
  }

  // Simulate receiving data from server
  simulateMessage(channel: string, data: any) {
    if (this.connected) {
      this.emit(channel, data);
    }
  }
}

// Global connection instance
const realtimeConnection = new RealtimeConnection();

export const RealtimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { state } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const hadSuccessfulConnection = useRef(false);
  const previousConnectionState = useRef(false);

  // Connect/disconnect based on online status
  useEffect(() => {
    if (state.isOnline) {
      realtimeConnection.connect(state.accessToken);
    } else {
      realtimeConnection.disconnect();
    }

    return () => {
      realtimeConnection.disconnect();
    };
  }, [state.isOnline, state.accessToken]);

  useEffect(() => {
    const unsubscribe = realtimeConnection.onConnectionChange((connected) => {
      setIsConnected(connected);

      const wasConnected = previousConnectionState.current;
      if (connected) {
        if (hadSuccessfulConnection.current && !wasConnected && state.userMode !== 'guest') {
          triggerSoftRefresh('all', 'realtime-reconnected');
        }
        hadSuccessfulConnection.current = true;
      }

      previousConnectionState.current = connected;
    });
    return unsubscribe;
  }, [state.userMode]);

  // Add notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep last 50

    // Show toast notification
    const lang = state.language;
    toast.success(notification.title, {
      description: notification.message,
      duration: 5000,
    });
  }, [state.language]);

  // Subscribe to user-specific channels
  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to consultations
    const consultationUnsub = realtimeConnection.subscribe(
      `consultations:${state.user.id}`,
      (data) => {
        const lang = state.language;
        addNotification({
          type: 'consultation',
          title: lang === 'bn' ? 'নতুন পরামর্শ' : 'New Consultation',
          message: lang === 'bn' 
            ? `আপনার পরামর্শে নতুন উত্তর এসেছে`
            : `New response to your consultation`,
          data,
        });
      }
    );
    unsubscribers.push(consultationUnsub);

    // Subscribe to price alerts
    const priceUnsub = realtimeConnection.subscribe(
      `prices:${state.user.id}`,
      (data) => {
        const lang = state.language;
        addNotification({
          type: 'price_alert',
          title: lang === 'bn' ? 'দাম পরিবর্তন' : 'Price Alert',
          message: lang === 'bn'
            ? `${data.crop_bn || data.crop} এর দাম পরিবর্তিত হয়েছে: ৳${data.price}`
            : `Price changed for ${data.crop}: ৳${data.price}`,
          data,
        });
      }
    );
    unsubscribers.push(priceUnsub);

    // Subscribe to irrigation updates
    const irrigationUnsub = realtimeConnection.subscribe(
      `irrigation:${state.user.id}`,
      (data) => {
        const lang = state.language;
        addNotification({
          type: 'irrigation',
          title: lang === 'bn' ? 'সেচ আপডেট' : 'Irrigation Update',
          message: lang === 'bn'
            ? `সেচ স্বয়ংক্রিয়ভাবে ${data.status === 'on' ? 'চালু' : 'বন্ধ'} হয়েছে`
            : `Irrigation automatically turned ${data.status}`,
          data,
        });
      }
    );
    unsubscribers.push(irrigationUnsub);

    // Subscribe to disease reviews (for farmers)
    if (state.user.role === 'farmer') {
      const diseaseUnsub = realtimeConnection.subscribe(
        `diseases:${state.user.id}`,
        (data) => {
          const lang = state.language;
          addNotification({
            type: 'disease_review',
            title: lang === 'bn' ? 'রোগ পর্যালোচনা' : 'Disease Review',
            message: lang === 'bn'
              ? `আপনার রোগ সনাক্তকরণ পর্যালোচনা হয়েছে: ${data.status === 'approved' ? 'অনুমোদিত' : 'প্রত্যাখ্যাত'}`
              : `Your disease detection has been reviewed: ${data.status}`,
            data,
          });
        }
      );
      unsubscribers.push(diseaseUnsub);
    }

    // Subscribe to system notifications
    const systemUnsub = realtimeConnection.subscribe(
      'system:broadcast',
      (data) => {
        const lang = state.language;
        addNotification({
          type: 'system',
          title: data.title || (lang === 'bn' ? 'সিস্টেম বিজ্ঞপ্তি' : 'System Notification'),
          message: lang === 'bn' ? data.message_bn || data.message : data.message,
          data,
        });
      }
    );
    unsubscribers.push(systemUnsub);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [state.user.id, state.user.role, state.userMode, state.language, addNotification]);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <RealtimeContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
        isConnected,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
};

// Export connection for manual triggers (e.g., from API responses)
export { realtimeConnection };
