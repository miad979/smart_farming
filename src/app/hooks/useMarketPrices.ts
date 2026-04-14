import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { realtimeConnection } from '../context/RealtimeContext';
import { subscribeSoftRefresh } from '../utils/softRefresh';
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

type MarketVolatilityProfile = 'stable' | 'balanced' | 'aggressive';

const LIVE_REFRESH_MS = 25000;
const STALE_AFTER_MS = 120000;
const STALE_CLOCK_TICK_MS = 10000;

function getPriceIdentity(price: Partial<MarketPrice> | null | undefined) {
  if (!price) return '';
  return String(price.id || `${price.crop || ''}|${price.location || ''}|${price.market || ''}`).toLowerCase();
}

function sortMarketPrices(items: MarketPrice[]) {
  return [...items].sort((a, b) => {
    const locationDelta = String(a.location || '').localeCompare(String(b.location || ''));
    if (locationDelta !== 0) return locationDelta;

    const cropDelta = String(a.crop || '').localeCompare(String(b.crop || ''));
    if (cropDelta !== 0) return cropDelta;

    return String(a.market || '').localeCompare(String(b.market || ''));
  });
}

export const useMarketPrices = (location?: string, crop?: string) => {
  const { state } = useApp();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [marketProfile, setMarketProfile] = useState<MarketVolatilityProfile>('balanced');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(realtimeConnection.isConnected());
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const normalizeProfile = useCallback((value: unknown): MarketVolatilityProfile => {
    const next = String(value || '').trim().toLowerCase();
    if (next === 'stable' || next === 'aggressive') return next;
    return 'balanced';
  }, []);

  const matchesFilters = useCallback((priceItem?: Partial<MarketPrice> | null) => {
    if (!priceItem) return false;
    if (location && String(priceItem.location || '').toLowerCase() !== location.toLowerCase()) {
      return false;
    }
    if (crop && String(priceItem.crop || '').toLowerCase() !== crop.toLowerCase()) {
      return false;
    }
    return true;
  }, [location, crop]);

  const mergeIncomingPrices = useCallback((incomingList: MarketPrice[]) => {
    if (!Array.isArray(incomingList) || incomingList.length === 0) return;

    setPrices((prev) => {
      const merged = new Map<string, MarketPrice>();

      for (const item of prev) {
        if (!matchesFilters(item)) continue;
        merged.set(getPriceIdentity(item), item);
      }

      for (const incoming of incomingList) {
        const key = getPriceIdentity(incoming);
        if (!key) continue;

        if (!matchesFilters(incoming)) {
          merged.delete(key);
          continue;
        }

        merged.set(key, incoming);
      }

      return sortMarketPrices(Array.from(merged.values()));
    });
  }, [matchesFilters]);

  // Fetch prices
  const fetchPrices = useCallback(async (mode: 'initial' | 'refresh' | 'background' = 'initial') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      setError(null);
      const { prices: data, updatedAt, profile } = await api.getLiveMarketPrices(location, crop);
      const nextPrices = Array.isArray(data) ? data.filter((item) => matchesFilters(item)) : [];
      setPrices(sortMarketPrices(nextPrices));
      setLastUpdated(updatedAt ? new Date(updatedAt) : new Date());
      setMarketProfile(normalizeProfile(profile));
    } catch (err: any) {
      console.error('Failed to fetch prices:', err);
      setError(err.message);
    } finally {
      if (mode === 'initial') {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [location, crop, matchesFilters, normalizeProfile]);

  // Initial fetch
  useEffect(() => {
    fetchPrices('initial');
  }, [fetchPrices]);

  // Keep hook aware of realtime transport status.
  useEffect(() => {
    const unsubscribe = realtimeConnection.onConnectionChange((connected) => {
      setIsRealtimeConnected(connected);
    });
    return unsubscribe;
  }, []);

  // Recompute stale status periodically without requiring any user interaction.
  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, STALE_CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // Fallback polling so prices continue updating even if realtime temporarily drops.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPrices('background');
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Refresh when app-wide soft-refresh events target market data.
  useEffect(() => {
    const unsubscribe = subscribeSoftRefresh(['market-prices', 'all'], () => {
      fetchPrices('background');
    });
    return unsubscribe;
  }, [fetchPrices]);

  // Real-time updates for price changes
  useEffect(() => {
    const unsubscribeSingle = realtimeConnection.subscribe('prices:broadcast', (data) => {
      console.log('Real-time price update:', data);

      if (!data?.price) return;
      mergeIncomingPrices([data.price as MarketPrice]);
      setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : new Date());
      setMarketProfile(normalizeProfile(data.profile));
    });

    const unsubscribeBatch = realtimeConnection.subscribe('prices:batch', (data) => {
      const incoming = Array.isArray(data?.prices) ? data.prices : [];
      if (incoming.length === 0) return;
      mergeIncomingPrices(incoming as MarketPrice[]);
      setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : new Date());
      setMarketProfile(normalizeProfile(data.profile));
    });

    return () => {
      unsubscribeSingle();
      unsubscribeBatch();
    };
  }, [mergeIncomingPrices, normalizeProfile]);

  // Subscribe to user-specific price alerts
  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const unsubscribe = realtimeConnection.subscribe(
      `prices:${state.user.id}`,
      (data) => {
        // This is handled by the notification system
        // But we can also update the prices list
        if (data.action === 'alert') {
          setLastUpdated(new Date());
          setPrices((prev) => {
            const index = prev.findIndex((p) =>
              p.crop === data.crop &&
              p.location === data.location
            );

            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...updated[index], price: data.price };
              return sortMarketPrices(updated);
            }

            if (!matchesFilters({ crop: data.crop, location: data.location })) {
              return prev;
            }

            return prev;
          });
        }
      }
    );

    return unsubscribe;
  }, [state.user.id, state.userMode, matchesFilters]);

  // Refresh data
  const refresh = useCallback(() => {
    fetchPrices('refresh');
  }, [fetchPrices]);

  const isStale = useMemo(() => {
    if (!lastUpdated) return false;
    return clockTick - lastUpdated.getTime() > STALE_AFTER_MS;
  }, [clockTick, lastUpdated]);

  return {
    prices,
    isLoading,
    isRefreshing,
    isRealtimeConnected,
    isStale,
    marketProfile,
    lastUpdated,
    error,
    refresh,
  };
};
