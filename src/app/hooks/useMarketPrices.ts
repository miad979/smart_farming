import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { realtimeConnection } from '../context/RealtimeContext';
import * as api from '../utils/api';

interface MarketPrice {
  id: string;
  crop: string;
  crop_bn: string;
  variety?: string;
  price: number;
  unit: string;
  location: string;
  location_bn: string;
  market: string;
  date: Date | string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  change?: number;
  lastUpdated?: string;
  lastUpdated_bn?: string;
}

export const useMarketPrices = (location?: string, crop?: string) => {
  const { state } = useApp();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      setError(null);
      const { prices: data } = await api.getMarketPrices(location, crop);
      setPrices(data || []);
    } catch (err: any) {
      console.error('Failed to fetch prices:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [location, crop]);

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Real-time updates for price changes
  useEffect(() => {
    const unsubscribe = realtimeConnection.subscribe('prices:broadcast', (data) => {
      console.log('Real-time price update:', data);
      
      if (data.action === 'update') {
        // Update existing price
        setPrices(prev => {
          const index = prev.findIndex(p => 
            p.crop === data.price.crop && 
            p.location === data.price.location
          );
          
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data.price;
            return updated;
          } else {
            return [data.price, ...prev];
          }
        });
      } else if (data.action === 'new') {
        // Add new price
        setPrices(prev => [data.price, ...prev]);
      }
    });

    return unsubscribe;
  }, []);

  // Subscribe to user-specific price alerts
  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const unsubscribe = realtimeConnection.subscribe(
      `prices:${state.user.id}`,
      (data) => {
        // This is handled by the notification system
        // But we can also update the prices list
        if (data.action === 'alert') {
          setPrices(prev => {
            const index = prev.findIndex(p => 
              p.crop === data.crop && 
              p.location === data.location
            );
            
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...updated[index], price: data.price };
              return updated;
            }
            return prev;
          });
        }
      }
    );

    return unsubscribe;
  }, [state.user.id, state.userMode]);

  // Refresh data
  const refresh = () => {
    setIsLoading(true);
    fetchPrices();
  };

  return {
    prices,
    isLoading,
    error,
    refresh,
  };
};
