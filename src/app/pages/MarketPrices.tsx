import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { getLiveMarketPrices } from '../utils/api';
import { TrendingUp, TrendingDown, Minus, Bell, Filter, Star, Activity, Loader2 } from 'lucide-react';
import { subscribeSoftRefresh } from '../utils/softRefresh';

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

export const MarketPrices: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [livePrices, setLivePrices] = useState<PriceItem[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [softRefreshTick, setSoftRefreshTick] = useState(0);

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
  const { prices, isLoading, error } = useMarketPrices(locationFilter, cropFilter);

  const fetchLivePrices = async () => {
    setIsLiveLoading(true);
    try {
      const result = await getLiveMarketPrices(locationFilter, cropFilter);
      const nextPrices: PriceItem[] = result.prices || [];
      setLivePrices(nextPrices);
      setPriceHistory((prev) => {
        const next = { ...prev };
        for (const item of nextPrices) {
          const key = item.id || `${item.crop}-${item.location}`;
          const existing = next[key] || [];
          next[key] = [...existing, Number(item.price)].slice(-20);
        }
        return next;
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch live Dhaka prices:', err);
    } finally {
      setIsLiveLoading(false);
    }
  };

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, [selectedMarket, selectedCrop, softRefreshTick]);

  useEffect(() => {
    const unsubscribe = subscribeSoftRefresh(['market-prices', 'all'], () => {
      setSoftRefreshTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (prices.length > 0) {
      setLastUpdated(new Date());
    }
  }, [prices]);

  const displayPrices = useMemo(() => {
    const source = livePrices.length > 0 ? livePrices : prices;
    return source.filter((item: PriceItem) => {
      if (selectedCrop === 'all') return true;
      return item.crop.toLowerCase() === selectedCrop;
    });
  }, [livePrices, prices, selectedCrop]);

  const cropOptions = useMemo(() => {
    const source = [...livePrices, ...prices];
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
  }, [livePrices, prices]);

  const toggleFavorite = (crop: string) => {
    if (favorites.includes(crop)) {
      setFavorites(favorites.filter((c) => c !== crop));
    } else {
      setFavorites([...favorites, crop]);
    }
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...';
    return lastUpdated.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const topLive = (livePrices.length > 0 ? livePrices : prices)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <h1 className="text-2xl font-bold">{t('prices', lang)}</h1>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
            {lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Last updated'}: {formatLastUpdated()}
          </span>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
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
            <p className="text-xs text-muted-foreground mt-1">{lang === 'bn' ? 'প্রতি ১ মিনিটে আপডেট' : 'Updates every 1 minute'}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
            {isLiveLoading ? <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /> : <Activity className="w-5 h-5 text-emerald-500" />}
          </div>
        </div>
      </div>

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
              onClick={fetchLivePrices}
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
                      className={`p-1 ${favorites.includes(item.crop) ? 'text-yellow-500' : 'text-gray-400'}`}
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(item.crop) ? 'fill-current' : ''}`} />
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
    </div>
  );
};
