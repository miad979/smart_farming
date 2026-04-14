import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { createPriceAlert } from '../utils/api';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, Bell, Filter, Star, Activity, Loader2, WifiOff, AlertTriangle } from 'lucide-react';

type PriceItem = {
  id: string;
  crop: string;
  crop_bn: string;
  price: number;
  unit?: string;
  location: string;
  location_bn?: string;
  market?: string;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  change?: number;
  lastUpdated?: string;
  lastUpdated_bn?: string;
};

type AlertCondition = 'above' | 'below';

const MARKET_FAVORITES_KEY = `${STORAGE_KEYS.FAVORITES}-market-prices`;

export const MarketPrices: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = storage.get<string[]>(MARKET_FAVORITES_KEY, []);
    if (!Array.isArray(saved)) return [];
    return saved
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean);
  });
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({});
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertCrop, setAlertCrop] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<AlertCondition>('above');
  const [isAlertSubmitting, setIsAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  const buildSparklineGeometry = (values: number[], width = 120, height = 28, padding = 3) => {
    if (values.length === 0) {
      return {
        linePoints: '',
        areaPath: '',
        minPoint: null as { x: number; y: number; value: number } | null,
        maxPoint: null as { x: number; y: number; value: number } | null,
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

    const coords = values.map((value, idx) => {
        const x = padding + idx * step;
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return { x, y, value };
      });

    const linePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');
    const first = coords[0];
    const last = coords[coords.length - 1];
    const areaPath = `M ${first.x} ${height - padding} L ${linePoints} L ${last.x} ${height - padding} Z`;

    const minPoint = coords.reduce((a, b) => (b.value < a.value ? b : a));
    const maxPoint = coords.reduce((a, b) => (b.value > a.value ? b : a));

    return { linePoints, areaPath, minPoint, maxPoint };
  };

  const locationFilter = selectedMarket === 'all' ? undefined : selectedMarket === 'dhaka' ? 'Dhaka' : 'Chittagong';
  const cropFilter = selectedCrop === 'all' ? undefined : `${selectedCrop.charAt(0).toUpperCase()}${selectedCrop.slice(1)}`;
  const {
    prices,
    isLoading,
    isRefreshing,
    isRealtimeConnected,
    isStale,
    marketProfile,
    lastUpdated,
    error,
    refresh,
  } = useMarketPrices(locationFilter, cropFilter);

  useEffect(() => {
    const nextPrices: PriceItem[] = prices || [];
    if (nextPrices.length === 0) return;

    setPriceHistory((prev) => {
      const next = { ...prev };
      for (const item of nextPrices) {
        const key = item.id || `${item.crop}-${item.location}`;
        const existing = next[key] || [];
        const nextPricePoint = Number(item.price);
        if (existing.length === 0 || existing[existing.length - 1] !== nextPricePoint) {
          next[key] = [...existing, nextPricePoint].slice(-20);
        }
      }
      return next;
    });
  }, [prices]);

  useEffect(() => {
    storage.set(MARKET_FAVORITES_KEY, favorites);
  }, [favorites]);

  const displayPrices = useMemo(() => {
    const source = [...(prices || [])];
    const filtered = source.filter((item: PriceItem) => {
      if (selectedCrop === 'all') return true;
      return item.crop.toLowerCase() === selectedCrop;
    });

    return filtered.sort((a, b) => {
      const aFav = favorites.includes(String(a.crop || '').toLowerCase()) ? 1 : 0;
      const bFav = favorites.includes(String(b.crop || '').toLowerCase()) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      const locationDelta = String(a.location || '').localeCompare(String(b.location || ''));
      if (locationDelta !== 0) return locationDelta;

      return String(a.crop || '').localeCompare(String(b.crop || ''));
    });
  }, [prices, selectedCrop, favorites]);

  const cropOptions = useMemo(() => {
    const source = [...prices];
    const byKey = new Map<string, { en: string; bn?: string }>();
    for (const item of source) {
      const key = String(item.crop || '').toLowerCase();
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, { en: item.crop, bn: item.crop_bn });
      }
    }
    return Array.from(byKey.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.en.localeCompare(b.en));
  }, [prices]);

  const locationOptions = useMemo(() => {
    const byKey = new Map<string, { en: string; bn?: string }>();
    for (const item of prices) {
      const key = String(item.location || '').toLowerCase();
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, { en: item.location, bn: item.location_bn });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.en.localeCompare(b.en));
  }, [prices]);

  const toggleFavorite = (crop: string) => {
    const key = String(crop || '').toLowerCase();
    setFavorites((prev) => {
      if (prev.includes(key)) {
        return prev.filter((entry) => entry !== key);
      }
      return [...prev, key];
    });
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...';
    return lastUpdated.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const openAlertDialog = () => {
    if (state.userMode === 'guest' || !state.accessToken) {
      toast.error(lang === 'bn' ? 'সতর্কতা সেট করতে লগইন করুন' : 'Please sign in to set alerts');
      return;
    }

    const seed = displayPrices[0] || prices[0];
    if (seed) {
      setAlertCrop(seed.crop);
      setAlertLocation(seed.location);
      setAlertTargetPrice(String(Math.max(1, Math.round(Number(seed.price || 0)))));
      setAlertCondition('above');
    }
    setAlertError(null);
    setIsAlertOpen(true);
  };

  const closeAlertDialog = () => {
    setIsAlertOpen(false);
    setAlertError(null);
  };

  const submitAlert = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!state.accessToken) {
      setAlertError(lang === 'bn' ? 'অনুমতি নেই। আবার লগইন করুন।' : 'Session expired. Please sign in again.');
      return;
    }

    const targetPrice = Number(alertTargetPrice);
    if (!alertCrop || !alertLocation || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      setAlertError(lang === 'bn' ? 'সঠিক ফসল, বাজার এবং দাম দিন' : 'Please enter valid crop, market, and target price');
      return;
    }

    const matched = prices.find(
      (item) =>
        String(item.crop || '').toLowerCase() === String(alertCrop || '').toLowerCase() &&
        String(item.location || '').toLowerCase() === String(alertLocation || '').toLowerCase(),
    );

    try {
      setIsAlertSubmitting(true);
      setAlertError(null);

      await createPriceAlert(state.accessToken, {
        crop: alertCrop,
        crop_bn: matched?.crop_bn || alertCrop,
        targetPrice,
        condition: alertCondition,
        location: alertLocation,
      });

      toast.success(lang === 'bn' ? 'মূল্য সতর্কতা যুক্ত হয়েছে' : 'Price alert created');
      setIsAlertOpen(false);
    } catch (err: any) {
      setAlertError(err?.message || (lang === 'bn' ? 'সতর্কতা তৈরি করা যায়নি' : 'Failed to create alert'));
    } finally {
      setIsAlertSubmitting(false);
    }
  };

  const topLive = displayPrices[0] || prices[0];
  const liveStatusLabel = !isRealtimeConnected
    ? (lang === 'bn' ? 'পুনঃসংযোগ চলছে' : 'Reconnecting')
    : isStale
      ? (lang === 'bn' ? 'আপডেট দেরি হচ্ছে' : 'Delayed')
      : (lang === 'bn' ? 'লাইভ' : 'Live');
  const marketProfileLabel = marketProfile === 'stable'
    ? (lang === 'bn' ? 'স্থিতিশীল মোড' : 'Stable Mode')
    : marketProfile === 'aggressive'
      ? (lang === 'bn' ? 'উচ্চ পরিবর্তন মোড' : 'High-Volatility Mode')
      : (lang === 'bn' ? 'ব্যালেন্সড মোড' : 'Balanced Mode');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <h1 className="text-2xl font-bold">{t('prices', lang)}</h1>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
            {lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Last updated'}: {formatLastUpdated()}
          </span>
          <button
            data-testid="market-set-alert-btn"
            onClick={openAlertDialog}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Bell className="w-4 h-4" />
            {t('setAlert', lang)}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'রিয়েল টাইম লাইভ ফিড' : 'Real-time Live Feed'}
            </p>
            <h3 className="text-lg font-bold text-foreground mt-1">
              {topLive ? `${lang === 'bn' ? topLive.crop_bn : topLive.crop} - ৳${topLive.price}` : '--'}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span
                data-testid="market-live-status"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold ${
                  !isRealtimeConnected
                    ? 'border-orange-500/30 bg-orange-500/10 text-orange-600'
                    : isStale
                      ? 'border-red-500/30 bg-red-500/10 text-red-600'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                }`}
              >
                {!isRealtimeConnected ? <WifiOff className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {liveStatusLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {lang === 'bn' ? 'অটো রিফ্রেশ সক্রিয়' : 'Auto refresh active'}
              </span>
              <span
                data-testid="market-profile-badge"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 text-[11px] font-semibold"
              >
                {marketProfileLabel}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
            {isRefreshing ? <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /> : <Activity className="w-5 h-5 text-emerald-500" />}
          </div>
        </div>
      </div>

      {(isStale || !isRealtimeConnected) && (
        <div data-testid="market-stale-warning" className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>
            {!isRealtimeConnected
              ? (lang === 'bn' ? 'লাইভ সংযোগ বিচ্ছিন্ন। ব্যাকআপ পোলিং চলছে।' : 'Live connection dropped. Fallback polling is active.')
              : (lang === 'bn' ? 'ডেটা আপডেট দেরিতে আসছে।' : 'Data updates are delayed.')}
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold">{lang === 'bn' ? 'ফিল্টার' : 'Filters'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">{lang === 'bn' ? 'ফসল' : 'Crop'}</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">{lang === 'bn' ? 'সব' : 'All'}</option>
              {cropOptions.map((crop) => (
                <option key={crop.key} value={crop.key}>
                  {lang === 'bn' ? (crop.bn || crop.en) : crop.en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">{t('market', lang)}</label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="dhaka">{lang === 'bn' ? 'ঢাকা (লাইভ)' : 'Dhaka (Live)'}</option>
              <option value="chittagong">{lang === 'bn' ? 'চট্টগ্রাম' : 'Chittagong'}</option>
              <option value="all">{lang === 'bn' ? 'সব' : 'All'}</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              data-testid="market-refresh-now-btn"
              onClick={refresh}
              className="w-full rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-500 hover:bg-emerald-500/15 transition-colors"
            >
              {lang === 'bn' ? 'এখনই রিফ্রেশ' : 'Refresh now'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {(isLoading && displayPrices.length === 0) && (
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm text-muted-foreground">{lang === 'bn' ? 'মূল্য লোড হচ্ছে...' : 'Loading prices...'}</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {displayPrices.map((item) => {
          const change = Number(item.changePercent ?? item.change ?? 0);
          const trend = item.trend || (change > 0 ? 'up' : change < 0 ? 'down' : 'stable');
          const isDhakaItem = item.location === 'Dhaka';
          const historyKey = item.id || `${item.crop}-${item.location}`;
          const history = priceHistory[historyKey] || [Number(item.price)];
          const sparkline = buildSparklineGeometry(history);
          const gradientId = `spark-grad-${historyKey.replace(/[^a-zA-Z0-9_-]/g, '')}`;
          const lineColor = trend === 'down' ? '#dc2626' : '#059669';

          return (
            <div key={item.id || `${item.crop}-${item.location}`} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm transition-shadow hover:shadow-md backdrop-blur-md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{lang === 'bn' ? item.crop_bn : item.crop}</h3>
                    <button
                      onClick={() => toggleFavorite(item.crop)}
                      className={`p-1 ${favorites.includes(String(item.crop || '').toLowerCase()) ? 'text-yellow-500' : 'text-gray-400'}`}
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(String(item.crop || '').toLowerCase()) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">{lang === 'bn' ? (item.location_bn || item.location) : item.location} • {item.market || 'Market'}</p>
                  <p className="text-xs text-muted-foreground">{lang === 'bn' ? item.lastUpdated_bn : item.lastUpdated}</p>

                  {isDhakaItem && history.length > 1 && (
                    <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-md border border-emerald-500/15 bg-emerald-500/10">
                      <svg width="120" height="28" viewBox="0 0 120 28" className="overflow-visible">
                        <defs>
                          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                            <stop offset="100%" stopColor={lineColor} stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <path d={sparkline.areaPath} fill={`url(#${gradientId})`} />
                        <polyline
                          fill="none"
                          stroke={lineColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={sparkline.linePoints}
                        />
                        {sparkline.minPoint && (
                          <circle cx={sparkline.minPoint.x} cy={sparkline.minPoint.y} r="1.8" fill="#ffffff" stroke={lineColor} strokeWidth="1.3">
                            <title>{`Min: ${sparkline.minPoint.value}`}</title>
                          </circle>
                        )}
                        {sparkline.maxPoint && (
                          <circle cx={sparkline.maxPoint.x} cy={sparkline.maxPoint.y} r="1.8" fill="#ffffff" stroke={lineColor} strokeWidth="1.3">
                            <title>{`Max: ${sparkline.maxPoint.value}`}</title>
                          </circle>
                        )}
                      </svg>
                      <span className="text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                        {lang === 'bn' ? 'স্বল্পমেয়াদী ট্রেন্ড' : 'Short trend'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-green-700">৳{item.price}</p>
                  <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'প্রতি কেজি' : `per ${item.unit || 'kg'}`}</p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-border/60">
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full border ${
                  trend === 'up'
                    ? 'border-green-500/20 bg-green-500/10 text-green-500'
                    : trend === 'down'
                      ? 'border-red-500/20 bg-red-500/10 text-red-500'
                      : 'border-border/60 bg-background/70 text-muted-foreground'
                }`}>
                  {trend === 'up' && <TrendingUp className="w-4 h-4" />}
                  {trend === 'down' && <TrendingDown className="w-4 h-4" />}
                  {trend === 'stable' && <Minus className="w-4 h-4" />}
                  <span className="text-sm font-semibold">{change > 0 ? '+' : ''}{change.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}

        {!isLoading && displayPrices.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
            {lang === 'bn' ? 'এই ফিল্টারে কোনো মূল্য ডাটা নেই' : 'No market prices found for this filter'}
          </div>
        )}
      </div>

      {isAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeAlertDialog} />
          <div data-testid="market-alert-dialog" className="relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 shadow-xl">
            <h3 className="text-lg font-bold mb-1">{lang === 'bn' ? 'মূল্য সতর্কতা সেট করুন' : 'Set Price Alert'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {lang === 'bn'
                ? 'দাম নির্দিষ্ট সীমা অতিক্রম করলে নোটিফিকেশন পাবেন'
                : 'You will be notified when the target threshold is crossed'}
            </p>

            <form onSubmit={submitAlert} className="space-y-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">{lang === 'bn' ? 'ফসল' : 'Crop'}</label>
                <select
                  data-testid="market-alert-crop-input"
                  value={alertCrop}
                  onChange={(e) => setAlertCrop(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2"
                  required
                >
                  {cropOptions.map((entry) => (
                    <option key={entry.key} value={entry.en}>
                      {lang === 'bn' ? (entry.bn || entry.en) : entry.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1">{lang === 'bn' ? 'বাজার' : 'Market'}</label>
                <select
                  data-testid="market-alert-location-input"
                  value={alertLocation}
                  onChange={(e) => setAlertLocation(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2"
                  required
                >
                  {locationOptions.map((entry) => (
                    <option key={entry.en} value={entry.en}>
                      {lang === 'bn' ? (entry.bn || entry.en) : entry.en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">{lang === 'bn' ? 'শর্ত' : 'Condition'}</label>
                  <select
                    data-testid="market-alert-condition-input"
                    value={alertCondition}
                    onChange={(e) => setAlertCondition(e.target.value as AlertCondition)}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-2"
                  >
                    <option value="above">{lang === 'bn' ? 'বেশি হলে' : 'Above'}</option>
                    <option value="below">{lang === 'bn' ? 'কম হলে' : 'Below'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">{lang === 'bn' ? 'টার্গেট দাম' : 'Target Price'}</label>
                  <input
                    data-testid="market-alert-target-input"
                    type="number"
                    min="1"
                    step="0.01"
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(e.target.value)}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-2"
                    required
                  />
                </div>
              </div>

              {alertError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {alertError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  data-testid="market-alert-close-btn"
                  onClick={closeAlertDialog}
                  className="px-3 py-2 rounded-lg border border-border/70 bg-background hover:bg-muted"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  data-testid="market-alert-submit-btn"
                  disabled={isAlertSubmitting}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {isAlertSubmitting
                    ? (lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...')
                    : (lang === 'bn' ? 'সেভ করুন' : 'Save Alert')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
