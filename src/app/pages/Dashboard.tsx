import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { WeatherWidget } from '../components/WeatherWidget';
import { OnboardingBanner } from '../components/OnboardingBanner';
import { RoleSwitcherBanner } from '../components/RoleSwitcherBanner';
import { Camera, Droplets, TrendingUp, DollarSign, AlertCircle, Power } from 'lucide-react';
import { Link } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCurrentLocation, getLastKnownLocation } from '../utils/helpers';
import { getDiseaseHistory, getIrrigationSchedule, getYieldAdvice } from '../utils/api';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { realtimeConnection } from '../context/RealtimeContext';
import { subscribeSoftRefresh } from '../utils/softRefresh';

type IrrigationData = {
  autoMode: boolean;
  moisture: number;
  nextWatering: string;
  nextWatering_bn: string;
  amount: string;
  usage: Array<{ day: string; day_bn: string; amount: number }>;
  alerts: Array<{ message: string; message_bn: string }>;
  policy: {
    crop: string;
    crop_bn: string;
    threshold: number;
    window: string;
    maxVolume: number;
  };
};

const DEFAULT_IRRIGATION: IrrigationData = {
  autoMode: true,
  moisture: 68,
  nextWatering: 'Tomorrow 6 AM',
  nextWatering_bn: 'আগামীকাল সকাল ৬টা',
  amount: '45L',
  usage: [
    { day: 'Mon', day_bn: 'সোম', amount: 120 },
    { day: 'Tue', day_bn: 'মঙ্গল', amount: 140 },
    { day: 'Wed', day_bn: 'বুধ', amount: 100 },
    { day: 'Thu', day_bn: 'বৃহস্পতি', amount: 160 },
    { day: 'Fri', day_bn: 'শুক্র', amount: 130 },
    { day: 'Sat', day_bn: 'শনি', amount: 150 },
    { day: 'Sun', day_bn: 'রবি', amount: 110 },
  ],
  alerts: [],
  policy: {
    crop: 'Rice',
    crop_bn: 'ধান',
    threshold: 65,
    window: '6:00 AM - 8:00 AM',
    maxVolume: 150,
  },
};

interface YieldAdvice {
  expectedYieldTonsPerAcre: number;
  deltaPercent: number;
  trend: 'up' | 'down';
  advice_en: string[];
  advice_bn: string[];
}

export const Dashboard: React.FC = () => {
  const FALLBACK_COORDS = { lat: 23.8103, lng: 90.4125 };
  const { state } = useApp();
  const lang = state.language;
  const { prices } = useMarketPrices();
  const [irrigation, setIrrigation] = useState<IrrigationData>(DEFAULT_IRRIGATION);
  const [yieldAdvice, setYieldAdvice] = useState<YieldAdvice | null>(null);
  const [latestDisease, setLatestDisease] = useState<{ disease: string; disease_bn?: string; confidence: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [softRefreshTick, setSoftRefreshTick] = useState(0);

  const formatLastUpdated = (value: Date | null) => {
    if (!value) {
      return lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...';
    }
    return value.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  useEffect(() => {
    let mounted = true;

    const loadLiveData = async () => {
      try {
        let moisture = DEFAULT_IRRIGATION.moisture;
        let crop = DEFAULT_IRRIGATION.policy.crop;

        if (state.userMode !== 'guest' && state.user.id && state.accessToken) {
          const { schedule } = await getIrrigationSchedule(state.accessToken, state.user.id);
          if (mounted && schedule) {
            setIrrigation(schedule);
            moisture = schedule.moisture ?? moisture;
            crop = schedule.policy?.crop || crop;
          }

          const { records } = await getDiseaseHistory(state.accessToken);
          if (mounted) {
            const latest = (records || [])[0];
            if (latest) {
              setLatestDisease({
                disease: latest.disease,
                disease_bn: latest.disease_bn,
                confidence: Number(latest.confidence || 0),
              });
            }
          }
        }

        let coords = getLastKnownLocation() || FALLBACK_COORDS;
        try {
          if ('permissions' in navigator && navigator.permissions?.query) {
            const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            if (permission.state === 'granted') {
              coords = await getCurrentLocation({
                timeoutMs: 10000,
                maximumAgeMs: 5 * 60 * 1000,
                enableHighAccuracy: false,
                fallbackToLastKnown: true,
              });
            }
          }
        } catch {
          // Keep cached/fallback coordinates when permission checks fail.
        }

        const { lat, lng } = coords;
        const { advice } = await getYieldAdvice({ lat, lng, moisture, crop });
        if (mounted) {
          setYieldAdvice(advice);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error('Failed to load live dashboard data:', error);
      }
    };

    loadLiveData();
    const interval = setInterval(loadLiveData, 300000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [state.userMode, state.user.id, state.accessToken, softRefreshTick]);

  useEffect(() => {
    const unsubscribe = subscribeSoftRefresh(['dashboard', 'all'], () => {
      setSoftRefreshTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const unsubscribe = realtimeConnection.subscribe(`irrigation:${state.user.id}`, (event) => {
      const schedule = event?.schedule;
      if (!schedule) return;
      setIrrigation((prev) => ({ ...prev, ...schedule }));
      setLastUpdated(new Date());
    });

    return unsubscribe;
  }, [state.user.id, state.userMode]);

  const chartData = useMemo(
    () =>
      (irrigation.usage || []).map((item: any) => ({
        ...item,
        dayLabel: lang === 'bn' ? item.day_bn : item.day,
      })),
    [irrigation.usage, lang],
  );

  const topPrice = prices[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <h1 className="text-2xl font-bold">{t('dashboard', lang)}</h1>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
            {lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Last updated'}: {formatLastUpdated(lastUpdated)}
          </span>
          <div className="text-sm text-muted-foreground">
            {state.userMode === 'guest' && (
              <Link to="/profile" className="text-primary hover:underline">
                {t('enableSync', lang)}
              </Link>
            )}
          </div>
        </div>
      </div>

      <RoleSwitcherBanner />
      <OnboardingBanner />

      {(irrigation.alerts || []).length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-transparent p-5 shadow-sm backdrop-blur-md">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            {lang === 'bn' ? 'জরুরি সতর্কতা' : 'Urgent Alerts'}
          </h3>
          <div className="space-y-3">
            {irrigation.alerts.map((alert: any, idx: number) => (
              <div key={idx} className="flex gap-3 p-4 rounded-xl border border-border/70 bg-background/80 shadow-sm backdrop-blur-sm">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium">{lang === 'bn' ? alert.message_bn : alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <WeatherWidget />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/detect" className="group rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-300/60 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Camera className="w-7 h-7 text-purple-600" />
            </div>
            <span className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full border border-orange-200">
              {t('possibleDisease', lang)}
            </span>
          </div>
          <h3 className="font-bold text-base mb-2 group-hover:text-purple-600 transition-colors">{t('detectDisease', lang)}</h3>
          <div>
            <p className="text-sm text-foreground font-medium">{latestDisease ? (lang === 'bn' ? latestDisease.disease_bn || latestDisease.disease : latestDisease.disease) : (lang === 'bn' ? 'সাম্প্রতিক রিপোর্ট নেই' : 'No recent report')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('confidence', lang)}: {latestDisease ? `${latestDisease.confidence}%` : '--'}</p>
          </div>
        </Link>

        <Link to="/irrigation" className="group rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-300/60 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Droplets className="w-7 h-7 text-blue-600" />
            </div>
            {irrigation.autoMode && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
                <Power className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'চালু' : 'Auto'}
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mb-2 group-hover:text-blue-600 transition-colors">{t('irrigation', lang)}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('moisture', lang)}</span>
              <span className="text-base font-bold text-blue-600">{irrigation.moisture}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('nextWatering', lang)}: {lang === 'bn' ? irrigation.nextWatering_bn : irrigation.nextWatering}
            </p>
          </div>
        </Link>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h3 className="font-bold text-base mb-2">{lang === 'bn' ? 'ফলন পূর্বাভাস' : 'Yield Forecast'}</h3>
          <p className="text-sm text-foreground font-medium">
            {lang === 'bn' ? 'আশানুরূপ ফলন' : 'Expected'}:{' '}
            <span className="text-green-600 font-bold">
              {yieldAdvice ? `${yieldAdvice.expectedYieldTonsPerAcre} tons/acre` : '...'}
            </span>
          </p>
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`flex items-center gap-1 font-semibold ${yieldAdvice?.trend === 'down' ? 'text-red-600' : 'text-green-600'}`}>
                <TrendingUp className={`w-3.5 h-3.5 ${yieldAdvice?.trend === 'down' ? 'rotate-180' : ''}`} />
                {yieldAdvice ? `${yieldAdvice.deltaPercent > 0 ? '+' : ''}${yieldAdvice.deltaPercent}%` : '--'}
              </div>
              <span className="text-muted-foreground">{lang === 'bn' ? 'বেসলাইনের তুলনায়' : 'vs baseline'}</span>
            </div>
            {yieldAdvice && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {lang === 'bn' ? yieldAdvice.advice_bn[0] : yieldAdvice.advice_en[0]}
              </p>
            )}
          </div>
        </div>

        <Link to="/prices" className="group rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-yellow-300/60 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl">
              <DollarSign className="w-7 h-7 text-yellow-600" />
            </div>
          </div>
          <h3 className="font-bold text-base mb-2 group-hover:text-yellow-600 transition-colors">{t('cropPrice', lang)}</h3>
          <div>
            <p className="text-sm text-muted-foreground">{topPrice ? (lang === 'bn' ? topPrice.crop_bn : topPrice.crop) : '--'}</p>
            <p className="text-lg font-bold text-foreground mt-1">
              {topPrice ? `৳${topPrice.price}` : '--'}<span className="text-sm text-muted-foreground">/{lang === 'bn' ? 'কেজি' : 'kg'}</span>
            </p>
          </div>
        </Link>
      </div>

      <div key={`irrigation-section-${lang}`} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <h3 className="font-semibold mb-4">{lang === 'bn' ? 'সাপ্তাহিক সেচ ব্যবহার' : 'Weekly Irrigation Usage'}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" key="grid" />
            <XAxis dataKey="dayLabel" key="xaxis" stroke="currentColor" tick={{ fill: 'currentColor' }} />
            <YAxis key="yaxis" stroke="currentColor" tick={{ fill: 'currentColor' }} />
            <Tooltip key="tooltip" contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 12, color: '#f8fafc' }} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} key="bar" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <h3 className="font-semibold mb-4">{lang === 'bn' ? 'মূল্য প্রবণতা' : 'Price Trends'}</h3>
        <div className="space-y-3">
          {prices.slice(0, 4).map((item: any) => (
            
            <div key={`${item.crop}-${item.location}`} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/70">
              <div>
                <p className="font-semibold">{lang === 'bn' ? item.crop_bn : item.crop}</p>
                <p className="text-xs text-muted-foreground">{lang === 'bn' ? item.location_bn : item.location}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">৳{item.price}/{lang === 'bn' ? 'কেজি' : 'kg'}</p>
                <div className={`flex items-center gap-1 text-xs ${
                  item.trend === 'up' ? 'text-green-600' : item.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                  {(Number(item.changePercent ?? item.change ?? 0) > 0) ? '+' : ''}{Number(item.changePercent ?? item.change ?? 0)}%
                </div>
              </div>
            </div>
          ))}
          {prices.length === 0 && (
            <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'লাইভ মূল্য তথ্য পাওয়া যায়নি' : 'No live price data available'}</p>
          )}
        </div>
      </div>
    </div>
  );
};
