import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { WeatherWidget } from '../components/WeatherWidget';
import { OnboardingBanner } from '../components/OnboardingBanner';
import { RoleSwitcherBanner } from '../components/RoleSwitcherBanner';
import { Camera, Droplets, TrendingUp, DollarSign, AlertCircle, Power, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCurrentLocation, getLastKnownLocation, toBengaliNumber } from '../utils/helpers';
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

interface YieldAdvice {
  crop?: string;
  crop_bn?: string;
  expectedYieldTonsPerAcre: number;
  deltaPercent: number;
  trend: 'up' | 'down';
  advice_en: string[];
  advice_bn: string[];
}

type LatestDisease = { disease: string; disease_bn?: string; confidence: number; detectedAt?: string };

const FALLBACK_COORDS = { lat: 23.8103, lng: 90.4125 };
const AUTO_REFRESH_MS = 5 * 60 * 1000;
// Refresh when the farmer comes back to the tab after this long away.
const REFRESH_ON_RETURN_MS = 60 * 1000;

function toLatestDisease(record: any): LatestDisease | null {
  if (!record?.disease) return null;
  return {
    disease: String(record.disease),
    disease_bn: record.disease_bn,
    confidence: Math.round(Number(record.confidence || 0)),
    detectedAt: record.detectedAt,
  };
}

async function resolveCoords() {
  let coords = getLastKnownLocation() || FALLBACK_COORDS;
  try {
    if ('permissions' in navigator && navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (permission.state === 'granted') {
        coords = await getCurrentLocation({ timeoutMs: 10000, maximumAgeMs: 5 * 60 * 1000, enableHighAccuracy: false, fallbackToLastKnown: true });
      }
    }
  } catch {
    // Keep cached/fallback coordinates when permission checks fail.
  }
  return coords;
}

export const Dashboard: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const isGuest = state.userMode === 'guest' || !state.user.id || !state.accessToken;
  const { prices, isLoading: pricesLoading } = useMarketPrices();
  const [irrigation, setIrrigation] = useState<IrrigationData | null>(null);
  const [yieldAdvice, setYieldAdvice] = useState<YieldAdvice | null>(null);
  const [latestDisease, setLatestDisease] = useState<LatestDisease | null>(null);
  const [diseaseLoaded, setDiseaseLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [failedParts, setFailedParts] = useState<string[]>([]);
  const [softRefreshTick, setSoftRefreshTick] = useState(0);
  const loadSeqRef = useRef(0);
  const lastLoadAtRef = useRef(0);

  const num = useCallback((value: number | string) => (lang === 'bn' ? toBengaliNumber(value) : String(value)), [lang]);

  const formatTime = (value: Date) =>
    value.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  const formatAgo = (iso?: string) => {
    const ms = Date.parse(iso || '');
    if (!Number.isFinite(ms)) return '';
    const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (mins < 1) return lang === 'bn' ? 'এইমাত্র' : 'just now';
    if (mins < 60) return lang === 'bn' ? `${num(mins)} মিনিট আগে` : `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return lang === 'bn' ? `${num(hours)} ঘন্টা আগে` : `${hours} h ago`;
    const days = Math.round(hours / 24);
    return lang === 'bn' ? `${num(days)} দিন আগে` : `${days} day${days === 1 ? '' : 's'} ago`;
  };

  // Each card loads on its own: one failing request no longer blanks the rest of the dashboard.
  const loadLiveData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const isLatest = () => seq === loadSeqRef.current;
    lastLoadAtRef.current = Date.now();
    setLoading(true);
    const failed: string[] = [];
    let moisture: number | undefined;
    let crop: string | undefined;

    if (!isGuest) {
      const [scheduleResult, diseaseResult] = await Promise.allSettled([
        getIrrigationSchedule(state.accessToken!, state.user.id!),
        getDiseaseHistory(state.accessToken!),
      ]);
      if (!isLatest()) return;
      if (scheduleResult.status === 'fulfilled' && scheduleResult.value?.schedule) {
        const schedule = scheduleResult.value.schedule as IrrigationData;
        setIrrigation(schedule);
        moisture = Number.isFinite(Number(schedule.moisture)) ? Number(schedule.moisture) : undefined;
        crop = schedule.policy?.crop;
      } else {
        failed.push('irrigation');
      }
      if (diseaseResult.status === 'fulfilled') {
        setLatestDisease(toLatestDisease((diseaseResult.value?.records || [])[0]));
        setDiseaseLoaded(true);
      } else {
        failed.push('disease');
      }
    }

    try {
      const { lat, lng } = await resolveCoords();
      const { advice } = await getYieldAdvice({ lat, lng, moisture, crop });
      if (!isLatest()) return;
      setYieldAdvice(advice);
    } catch (error) {
      console.error('Failed to load yield estimate:', error);
      failed.push('yield');
    }

    if (!isLatest()) return;
    setFailedParts(failed);
    setLoading(false);
    if (failed.length < (isGuest ? 1 : 3)) setLastUpdated(new Date());
  }, [isGuest, state.accessToken, state.user.id]);

  useEffect(() => {
    if (isGuest) {
      setIrrigation(null);
      setLatestDisease(null);
      setDiseaseLoaded(false);
    }
    loadLiveData();
    const interval = setInterval(loadLiveData, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadAtRef.current > REFRESH_ON_RETURN_MS) loadLiveData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      loadSeqRef.current += 1; // ignore replies that arrive after unmount / user change
    };
  }, [loadLiveData, softRefreshTick, isGuest]);

  useEffect(() => subscribeSoftRefresh(['dashboard', 'all'], () => setSoftRefreshTick((prev) => prev + 1)), []);

  useEffect(() => {
    if (isGuest) return;
    const offIrrigation = realtimeConnection.subscribe(`irrigation:${state.user.id}`, (event) => {
      const schedule = event?.schedule;
      if (!schedule) return;
      setIrrigation((prev) => (prev ? { ...prev, ...schedule } : schedule));
      setLastUpdated(new Date());
    });
    // A new scan on the Detect page shows up here immediately.
    const offDiseases = realtimeConnection.subscribe(`diseases:${state.user.id}`, (event) => {
      if (event?.action !== 'new') return;
      const latest = toLatestDisease(event.record);
      if (latest) {
        setLatestDisease(latest);
        setDiseaseLoaded(true);
      }
    });
    return () => {
      offIrrigation();
      offDiseases();
    };
  }, [isGuest, state.user.id]);

  const chartData = useMemo(
    () =>
      (irrigation?.usage || []).map((item) => ({
        ...item,
        amount: Number(item.amount || 0),
        dayLabel: lang === 'bn' ? item.day_bn : item.day,
      })),
    [irrigation?.usage, lang],
  );
  const weeklyTotal = chartData.reduce((sum, d) => sum + d.amount, 0);

  // Show the farmer's own market first (profile location), then Dhaka, then the rest.
  const sortedPrices = useMemo(() => {
    const home = String(state.user.location || '').trim().toLowerCase();
    const rank = (loc: string) => {
      const l = String(loc || '').toLowerCase();
      if (home && (l.includes(home) || home.includes(l))) return 0;
      if (l.includes('dhaka')) return 1;
      return 2;
    };
    return [...prices].sort((a, b) => rank(a.location) - rank(b.location));
  }, [prices, state.user.location]);
  const topPrice = sortedPrices[0];
  const unitLabel = (unit?: string) => {
    const u = String(unit || 'kg').toLowerCase();
    if (lang !== 'bn') return u;
    return u === 'kg' ? 'কেজি' : u === 'maund' ? 'মণ' : u;
  };

  const diseaseIsHealthy = latestDisease ? /healthy|সুস্থ/i.test(`${latestDisease.disease} ${latestDisease.disease_bn || ''}`) : false;
  const dash = '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <h1 className="text-2xl font-bold">{t('dashboard', lang)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {failedParts.length > 0 && !loading && (
            <span className="px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              {lang === 'bn' ? 'কিছু তথ্য লোড হয়নি' : 'Some data could not load'}
            </span>
          )}
          <span className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
            {lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Last updated'}:{' '}
            {lastUpdated ? formatTime(lastUpdated) : loading ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...') : dash}
          </span>
          <button
            type="button"
            onClick={() => loadLiveData()}
            disabled={loading}
            aria-label={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
            title={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground hover:text-primary disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {state.userMode === 'guest' && (
            <Link to="/profile" className="text-sm text-primary hover:underline">
              {t('enableSync', lang)}
            </Link>
          )}
        </div>
      </div>

      <RoleSwitcherBanner />
      <OnboardingBanner />

      {(irrigation?.alerts || []).length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-transparent p-5 shadow-sm backdrop-blur-md">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            {lang === 'bn' ? 'জরুরি সতর্কতা' : 'Urgent Alerts'}
          </h3>
          <div className="space-y-3">
            {irrigation!.alerts.map((alert, idx) => (
              <div key={`${alert.message}-${idx}`} className="flex gap-3 p-4 rounded-xl border border-border/70 bg-background/80 shadow-sm backdrop-blur-sm">
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
            {latestDisease && (diseaseIsHealthy ? (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'সুস্থ' : 'Healthy'}
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full border border-orange-200">
                {t('possibleDisease', lang)}
              </span>
            ))}
          </div>
          <h3 className="font-bold text-base mb-2 group-hover:text-purple-600 transition-colors">{t('detectDisease', lang)}</h3>
          {latestDisease ? (
            <div>
              <p className="text-sm text-foreground font-medium line-clamp-2">
                {lang === 'bn' ? latestDisease.disease_bn || latestDisease.disease : latestDisease.disease}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('confidence', lang)}: {num(latestDisease.confidence)}%
                {latestDisease.detectedAt ? ` · ${formatAgo(latestDisease.detectedAt)}` : ''}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-foreground font-medium">
                {isGuest || diseaseLoaded
                  ? (lang === 'bn' ? 'এখনও কোনো স্ক্যান নেই' : 'No scans yet')
                  : (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...')}
              </p>
              <p className="text-xs text-primary mt-1">
                {lang === 'bn' ? 'পাতার ছবি তুলে রোগ পরীক্ষা করুন →' : 'Take a leaf photo to check for disease →'}
              </p>
            </div>
          )}
        </Link>

        <Link to="/irrigation" className="group rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-300/60 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Droplets className="w-7 h-7 text-blue-600" />
            </div>
            {irrigation && (
              <span className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${irrigation.autoMode ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                <Power className="w-3.5 h-3.5" />
                {irrigation.autoMode ? (lang === 'bn' ? 'অটো' : 'Auto') : (lang === 'bn' ? 'ম্যানুয়াল' : 'Manual')}
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mb-2 group-hover:text-blue-600 transition-colors">{t('irrigation', lang)}</h3>
          {irrigation ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('moisture', lang)} · {lang === 'bn' ? irrigation.policy?.crop_bn : irrigation.policy?.crop}
                </span>
                <span className={`text-base font-bold ${irrigation.moisture < Number(irrigation.policy?.threshold || 0) ? 'text-orange-600' : 'text-blue-600'}`}>
                  {num(Math.round(irrigation.moisture))}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('nextWatering', lang)}: {lang === 'bn' ? irrigation.nextWatering_bn : irrigation.nextWatering}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isGuest
                ? (lang === 'bn' ? 'সেন্সর যুক্ত করতে লগইন করুন' : 'Sign in to connect your soil sensor')
                : failedParts.includes('irrigation')
                  ? (lang === 'bn' ? 'সেচের তথ্য লোড হয়নি' : 'Could not load irrigation data')
                  : (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...')}
            </p>
          )}
        </Link>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-7 h-7 text-green-600" />
            </div>
            {yieldAdvice?.crop && (
              <span className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground border border-border">
                {lang === 'bn' ? yieldAdvice.crop_bn || yieldAdvice.crop : yieldAdvice.crop}
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mb-2">{lang === 'bn' ? 'ফলন পূর্বাভাস' : 'Yield Forecast'}</h3>
          <p className="text-sm text-foreground font-medium">
            {lang === 'bn' ? 'আনুমানিক ফলন' : 'Estimated'}:{' '}
            <span className="text-green-600 font-bold">
              {yieldAdvice
                ? `${num(yieldAdvice.expectedYieldTonsPerAcre)} ${lang === 'bn' ? 'টন/একর' : 't/acre'}`
                : failedParts.includes('yield') ? dash : '...'}
            </span>
          </p>
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`flex items-center gap-1 font-semibold ${yieldAdvice?.trend === 'down' ? 'text-red-600' : 'text-green-600'}`}>
                <TrendingUp className={`w-3.5 h-3.5 ${yieldAdvice?.trend === 'down' ? 'rotate-180' : ''}`} />
                {yieldAdvice ? `${yieldAdvice.deltaPercent > 0 ? '+' : ''}${num(yieldAdvice.deltaPercent)}%` : '--'}
              </div>
              <span className="text-muted-foreground">{lang === 'bn' ? 'স্বাভাবিক ফলনের তুলনায়' : 'vs typical yield'}</span>
            </div>
            {yieldAdvice && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                {lang === 'bn' ? yieldAdvice.advice_bn?.[0] : yieldAdvice.advice_en?.[0]}
              </p>
            )}
            {failedParts.includes('yield') && !yieldAdvice && (
              <p className="text-xs text-muted-foreground mt-2">{lang === 'bn' ? 'অনুমান লোড হয়নি, রিফ্রেশ করুন' : 'Could not load the estimate. Tap refresh.'}</p>
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
          {topPrice ? (
            <div>
              <p className="text-sm text-muted-foreground">
                {lang === 'bn' ? topPrice.crop_bn : topPrice.crop} · {lang === 'bn' ? topPrice.location_bn || topPrice.location : topPrice.location}
              </p>
              <p className="text-lg font-bold text-foreground mt-1">
                ৳{num(topPrice.price)}<span className="text-sm text-muted-foreground">/{unitLabel(topPrice.unit)}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {pricesLoading ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...') : (lang === 'bn' ? 'মূল্য তথ্য নেই' : 'No price data')}
            </p>
          )}
        </Link>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{lang === 'bn' ? 'সাপ্তাহিক সেচ ব্যবহার' : 'Weekly Irrigation Usage'}</h3>
          {irrigation && (
            <span className="text-xs text-muted-foreground">
              {lang === 'bn' ? `গত ৭ দিনে মোট ${num(weeklyTotal)} লিটার` : `${weeklyTotal} L in the last 7 days`}
            </span>
          )}
        </div>
        {irrigation && weeklyTotal > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ left: -12, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="dayLabel" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} interval={0} />
              <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [`${lang === 'bn' ? num(value) : value} ${lang === 'bn' ? 'লিটার' : 'L'}`, lang === 'bn' ? 'পানি' : 'Water']}
                contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 12, color: '#f8fafc' }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/70 text-center">
            <Droplets className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isGuest
                ? (lang === 'bn' ? 'লগইন করলে আপনার সেচের হিসাব এখানে দেখাবে' : 'Sign in to see your irrigation history here')
                : irrigation
                  ? (lang === 'bn' ? 'গত ৭ দিনে কোনো সেচ দেওয়া হয়নি' : 'No water used in the last 7 days')
                  : (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...')}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{lang === 'bn' ? 'মূল্য প্রবণতা' : 'Price Trends'}</h3>
          <Link to="/prices" className="text-xs text-primary hover:underline">{lang === 'bn' ? 'সব দেখুন →' : 'See all →'}</Link>
        </div>
        <div className="space-y-3">
          {sortedPrices.slice(0, 4).map((item) => {
            const change = Number(item.changePercent ?? item.change ?? 0);
            return (
              <div key={`${item.id || item.crop}-${item.location}-${item.market}`} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-background/70">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{lang === 'bn' ? item.crop_bn : item.crop}</p>
                  <p className="text-xs text-muted-foreground truncate">{lang === 'bn' ? item.location_bn || item.location : item.location}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">৳{num(item.price)}/{unitLabel(item.unit)}</p>
                  <div className={`flex items-center justify-end gap-1 text-xs ${
                    item.trend === 'up' ? 'text-green-600' : item.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    <TrendingUp className={`w-3 h-3 ${item.trend === 'down' ? 'rotate-180' : ''}`} />
                    {change > 0 ? '+' : ''}{num(change)}%
                  </div>
                </div>
              </div>
            );
          })}
          {sortedPrices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {pricesLoading ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...') : (lang === 'bn' ? 'লাইভ মূল্য তথ্য পাওয়া যায়নি' : 'No live price data available')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
