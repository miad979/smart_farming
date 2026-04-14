import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { getCurrentWeatherData } from '../utils/api';
import { getLastKnownLocation } from '../utils/helpers';
import { Cloud, Droplets, Wind, AlertTriangle, Loader2, CloudRain, Zap } from 'lucide-react';

interface HourlyRain {
  hour: number;
  timeStr: string;
  precipProb: number;
  precipAmount: number;
  temp?: number;
  feelsLike?: number;
  windSpeed?: number;
  windGust?: number;
  dewPoint?: number;
  visibilityKm?: number;
}

interface RainForecast {
  nextDay: HourlyRain[];
  peakRainHour: string;
  peakRainTime: string;
  maxRainProb: number;
  averageRainProb: number;
}

interface WeatherData {
  source?: string;
  location?: {
    lat: number;
    lng: number;
    name?: string | null;
    admin1?: string | null;
    admin2?: string | null;
    country?: string | null;
    timezone?: string | null;
  };
  updatedAt?: string;
  current: {
    temp: number;
    feelsLike: number;
    condition: string;
    condition_bn: string;
    humidity: number;
    rainfall: number;
    rainProbability1h?: number;
    rainProbability: number;
    windSpeed: number;
    windGust: number;
    windDirection?: number;
    cloudCover: number;
    uvIndex: number;
    pressure?: number;
    visibilityKm?: number;
    dewPoint?: number;
    isDay?: boolean;
  };
  rainForecast?: RainForecast;
  alerts: Array<{ message: string; message_bn: string }>;
  forecast: Array<{ day: string; day_bn: string; temp: number; rainfall: number; precipitationSum?: number; uvIndex?: number }>;
}

const getRainRiskLevel = (probability: number) => {
  if (probability >= 70) return { level: 'high', color: 'text-red-600 bg-red-50', label_en: 'High Risk', label_bn: 'উচ্চ ঝুঁকি' };
  if (probability >= 50) return { level: 'moderate', color: 'text-orange-600 bg-orange-50', label_en: 'Moderate Risk', label_bn: 'মধ্যম ঝুঁকি' };
  if (probability >= 30) return { level: 'low', color: 'text-yellow-600 bg-yellow-50', label_en: 'Low Risk', label_bn: 'কম ঝুঁকি' };
  return { level: 'minimal', color: 'text-green-600 bg-green-50', label_en: 'Minimal Risk', label_bn: 'ন্যূনতম ঝুঁকি' };
};

const getWindRiskLevel = (windGust: number) => {
  if (windGust >= 45) return { tone: 'danger' as const, label_en: 'Very Strong Wind', label_bn: 'খুব শক্তিশালী বাতাস' };
  if (windGust >= 35) return { tone: 'warning' as const, label_en: 'Strong Wind', label_bn: 'শক্তিশালী বাতাস' };
  if (windGust >= 25) return { tone: 'info' as const, label_en: 'Moderate Wind', label_bn: 'মাঝারি বাতাস' };
  return { tone: 'good' as const, label_en: 'Light Wind', label_bn: 'হালকা বাতাস' };
};

const buildLiveInsights = (weather: WeatherData, lang: string) => {
  const notes: Array<{ title: string; detail: string; tone: 'good' | 'warning' | 'danger' | 'info' }> = [];

  if (weather.current.rainProbability >= 70) {
    notes.push({
      title: lang === 'bn' ? 'বৃষ্টির সম্ভাবনা বেশি' : 'Rain is likely',
      detail: lang === 'bn'
        ? `পরবর্তী ২৪ ঘন্টায় বৃষ্টি বেশি হতে পারে। ${weather.rainForecast?.peakRainTime || 'শীর্ষ সময়'}-এর আশেপাশে নজর রাখুন।`
        : `Rain is likely in the next 24 hours. Watch around ${weather.rainForecast?.peakRainTime || 'the peak window'}.`,
      tone: 'danger',
    });
  } else if (weather.current.rainProbability >= 40) {
    notes.push({
      title: lang === 'bn' ? 'মাঝারি বৃষ্টির সম্ভাবনা' : 'Moderate rain chance',
      detail: lang === 'bn'
        ? 'সেচ পরিকল্পনা সামঞ্জস্য করুন এবং পানি নিষ্কাশন ঠিক আছে কিনা দেখুন।'
        : 'Adjust irrigation plans and check drainage readiness.',
      tone: 'warning',
    });
  } else {
    notes.push({
      title: lang === 'bn' ? 'বৃষ্টির ঝুঁকি কম' : 'Low rain risk',
      detail: lang === 'bn'
        ? 'স্বাভাবিক সেচ চালিয়ে যেতে পারেন, তবে আবহাওয়া আপডেট অনুসরণ করুন।'
        : 'Normal irrigation is fine, but keep monitoring live updates.',
      tone: 'good',
    });
  }

  if (weather.current.feelsLike >= 35) {
    notes.push({
      title: lang === 'bn' ? 'তাপজনিত চাপ' : 'Heat stress risk',
      detail: lang === 'bn'
        ? 'ভোর বা সন্ধ্যায় সেচ দেওয়া ভালো। দুপুরের কাজ কমান।'
        : 'Prefer early-morning or evening irrigation and reduce midday field work.',
      tone: 'danger',
    });
  }

  if (weather.current.windGust >= 35) {
    notes.push({
      title: lang === 'bn' ? 'বাতাসের ঝাপটা শক্তিশালী' : 'Strong gusts detected',
      detail: lang === 'bn'
        ? 'স্প্রে, সার ছিটানো এবং নতুন চারা রক্ষা করার পরিকল্পনা করুন।'
        : 'Delay spraying and protect young seedlings if possible.',
      tone: 'warning',
    });
  }

  if (weather.current.uvIndex >= 7) {
    notes.push({
      title: lang === 'bn' ? 'UV বেশি' : 'High UV exposure',
      detail: lang === 'bn'
        ? 'কর্মীদের সুরক্ষা এবং ফসলের পানির চাহিদা পর্যবেক্ষণ করুন।'
        : 'Use sun protection and monitor crop water demand closely.',
      tone: 'info',
    });
  }

  return notes.slice(0, 3);
};

export const WeatherWidget: React.FC = () => {
  const FALLBACK_COORDS = { lat: 23.8103, lng: 90.4125 };
  const { state } = useApp();
  const lang = state.language;
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHourlyDetail, setShowHourlyDetail] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const fallbackModeRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let watchId: number | null = null;
    const refreshIntervalMs = 120000;

    const fallbackMessage =
      lang === 'bn'
        ? 'লাইভ লোকেশন পাওয়া যায়নি, ঢাকা এলাকার আবহাওয়া দেখানো হচ্ছে'
        : 'Live location unavailable, showing Dhaka area weather';

    const loadWeather = async (coords?: { lat: number; lng: number }) => {
      try {
        const lastKnownCoords = getLastKnownLocation();
        const resolvedCoords = coords || coordsRef.current || lastKnownCoords || FALLBACK_COORDS;

        coordsRef.current = resolvedCoords;
        const { lat, lng } = resolvedCoords;
        const data = await getCurrentWeatherData(lat, lng);
        if (mounted) {
          setWeather(data);
          setWeatherError(fallbackModeRef.current ? fallbackMessage : null);
        }
      } catch (error) {
        console.error('Failed to load live weather:', error);
        if (mounted) {
          setWeatherError(
            lang === 'bn'
              ? 'আবহাওয়ার তথ্য লোড করা যায়নি, কিছুক্ষণ পরে আবার চেষ্টা করুন'
              : 'Could not load weather data, please retry shortly',
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    coordsRef.current = getLastKnownLocation();
    fallbackModeRef.current = !coordsRef.current;
    loadWeather(coordsRef.current || undefined);
    const interval = setInterval(() => loadWeather(coordsRef.current || undefined), refreshIntervalMs);

    const startLocationWatchIfGranted = async () => {
      if (!('geolocation' in navigator)) return;

      let permissionState: PermissionState | 'unsupported' = 'unsupported';
      try {
        if ('permissions' in navigator && navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          permissionState = permission.state;
        }
      } catch {
        permissionState = 'unsupported';
      }

      if (permissionState !== 'granted') {
        fallbackModeRef.current = !coordsRef.current;
        if (mounted && fallbackModeRef.current) {
          setWeatherError(fallbackMessage);
        }
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!mounted) return;
          fallbackModeRef.current = false;
          coordsRef.current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          loadWeather({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Keep interval refresh using cached/fallback coordinates.
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000,
        },
      );
    };

    void startLocationWatchIfGranted();

    return () => {
      mounted = false;
      clearInterval(interval);
      if (watchId !== null) {
        navigator.geolocation?.clearWatch(watchId);
      }
    };
  }, [lang]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !weather) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-md flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{lang === 'bn' ? 'লাইভ আবহাওয়া লোড হচ্ছে...' : 'Loading live weather...'}</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-md">
        <p className="text-sm text-destructive">
          {weatherError || (lang === 'bn' ? 'লাইভ আবহাওয়া পাওয়া যায়নি' : 'Could not load live weather')}
        </p>
      </div>
    );
  }

  const rainForecast = weather.rainForecast || { nextDay: [], peakRainHour: 'N/A', peakRainTime: 'N/A', maxRainProb: 0, averageRainProb: 0 };
  const riskLevel = getRainRiskLevel(rainForecast.averageRainProb);
  const windGustValue = Number.isFinite(weather.current.windGust) ? weather.current.windGust : 0;
  const windSpeedValue = Number.isFinite(weather.current.windSpeed) ? weather.current.windSpeed : 0;
  const uvValue = Number.isFinite(weather.current.uvIndex) ? weather.current.uvIndex : 0;
  const cloudCoverValue = Number.isFinite(weather.current.cloudCover) ? weather.current.cloudCover : 0;
  const oneHourRainChance = Number.isFinite(weather.current.rainProbability1h as number)
    ? Number(weather.current.rainProbability1h)
    : (rainForecast.nextDay[0]?.precipProb ?? 0);
  const windRisk = getWindRiskLevel(windGustValue);
  const liveInsights = buildLiveInsights(weather, lang);
  const feelsLikeValue = Number.isFinite(weather.current.feelsLike) ? weather.current.feelsLike : weather.current.temp;
  const rainChanceValue = Number.isFinite(weather.current.rainProbability)
    ? weather.current.rainProbability
    : Math.max(rainForecast.averageRainProb || 0, rainForecast.maxRainProb || 0);

  const updatedAtMs = weather.updatedAt ? new Date(weather.updatedAt).getTime() : 0;
  const ageSeconds = updatedAtMs > 0 ? Math.max(0, Math.floor((nowTick - updatedAtMs) / 1000)) : 0;
  const updatedAgoLabel = ageSeconds < 60
    ? `${ageSeconds}s`
    : `${Math.floor(ageSeconds / 60)}m ${ageSeconds % 60}s`;

  const locationLabel = weather.location?.name
    ? [weather.location.name, weather.location.admin1, weather.location.country].filter(Boolean).join(', ')
    : (weather.location ? `${weather.location.lat.toFixed(4)}, ${weather.location.lng.toFixed(4)}` : '—');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">{t('weather', lang)}</h3>
          <div className="text-right">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/15 inline-flex">
              <Cloud className="w-6 h-6 text-primary" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {lang === 'bn' ? 'আপডেট হয়েছে' : 'Updated'} {updatedAgoLabel} {lang === 'bn' ? 'আগে' : 'ago'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/70 p-3 mb-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">{lang === 'bn' ? 'রিয়েল লোকেশন' : 'Real location'}</p>
          <p className="text-sm font-semibold text-foreground">{locationLabel}</p>
        </div>

        {weatherError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-xs leading-5">{weatherError}</p>
          </div>
        )}

        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 mb-5 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 bg-background/80 p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{lang === 'bn' ? 'এখন' : 'Now'}</p>
              <p className="text-2xl font-extrabold text-foreground leading-tight">{weather.current.temp}°</p>
              <p className="text-[11px] text-muted-foreground truncate">{lang === 'bn' ? weather.current.condition_bn : weather.current.condition}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/80 p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{lang === 'bn' ? '১ ঘন্টা' : '1h'}</p>
              <p className="text-2xl font-extrabold text-foreground leading-tight">{oneHourRainChance}%</p>
              <p className="text-[11px] text-muted-foreground">{lang === 'bn' ? 'বৃষ্টি' : 'Rain'}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/80 p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{lang === 'bn' ? '২৪ ঘন্টা' : '24h'}</p>
              <p className="text-2xl font-extrabold text-foreground leading-tight">{rainForecast.averageRainProb}%</p>
              <p className="text-[11px] text-muted-foreground">{lang === 'bn' ? 'গড় বৃষ্টি' : 'Avg rain'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
            <p className="text-3xl font-bold text-foreground mb-1">{feelsLikeValue}°C</p>
            <p className="text-xs text-muted-foreground mb-2">{lang === 'bn' ? 'অনুভূত তাপমাত্রা' : 'Feels Like'}</p>
            <p className="text-xs text-muted-foreground font-medium">
              {lang === 'bn' ? 'রিয়েল ফিলিং' : 'Real comfort'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
            <p className="text-3xl font-bold text-foreground mb-1">{weather.current.humidity}%</p>
            <p className="text-xs text-muted-foreground mb-2">{lang === 'bn' ? 'আর্দ্রতা' : 'Humidity'}</p>
            <p className="text-xs text-muted-foreground font-medium">{lang === 'bn' ? 'বাতাসের আর্দ্রতা' : 'Air moisture'}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CloudRain className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{rainChanceValue}%</p>
              <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'বৃষ্টি সম্ভাবনা' : 'Rain Chance'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <Wind className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{windGustValue} km/h</p>
              <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'বাতাসের ঝাপটা' : 'Wind Gust'}</p>
            </div>
          </div>
        </div>

        {/* Rain Probability Alert */}
        <div className={`flex gap-3 p-4 rounded-xl border mb-5 shadow-sm backdrop-blur-sm ${riskLevel.color}`}>
          <CloudRain className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm mb-1">{lang === 'bn' ? 'লাইভ বৃষ্টি পূর্বাভাস' : 'Live Rain Prediction'}</p>
            <p className="text-sm">
              {lang === 'bn' ? 'আগামী ১ ঘন্টা' : 'Next 1 hour'}: <strong>{oneHourRainChance}%</strong> | {lang === 'bn' ? 'পরবর্তী ২৪ ঘন্টা' : 'Next 24 hours'}: <strong>{rainForecast.averageRainProb}%</strong>
            </p>
            <p className="text-xs mt-1 opacity-80">
              {lang === 'bn'
                ? `বাতাস ${windSpeedValue}/${windGustValue} কিমি/ঘন্টা (${windRisk.label_bn}), UV ${uvValue}, মেঘ ${cloudCoverValue}%`
                : `Wind speed/gust ${windSpeedValue}/${windGustValue} km/h (${windRisk.label_en}), UV ${uvValue}, cloud cover ${cloudCoverValue}%`}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/70 p-4 mb-5 shadow-sm">
          <p className="font-bold text-sm mb-3">{lang === 'bn' ? 'রিয়েল লোকেশন আবহাওয়ার বিস্তারিত' : 'Real location weather details'}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-muted-foreground">{lang === 'bn' ? 'বাতাসের দিক' : 'Wind direction'}</p>
              <p className="font-semibold">{weather.current.windDirection ?? 0}°</p>
            </div>
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-muted-foreground">{lang === 'bn' ? 'চাপ' : 'Pressure'}</p>
              <p className="font-semibold">{weather.current.pressure ?? 0} hPa</p>
            </div>
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-muted-foreground">{lang === 'bn' ? 'দৃশ্যমানতা' : 'Visibility'}</p>
              <p className="font-semibold">{weather.current.visibilityKm ?? 0} km</p>
            </div>
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-muted-foreground">{lang === 'bn' ? 'ডিউ পয়েন্ট' : 'Dew point'}</p>
              <p className="font-semibold">{weather.current.dewPoint ?? 0}°C</p>
            </div>
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-muted-foreground">{lang === 'bn' ? 'উৎস' : 'Source'}</p>
              <p className="font-semibold">{weather.source || 'open-meteo'}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-2">
              <p className="text-muted-foreground">{lang === 'bn' ? 'অবস্থান' : 'Location'}</p>
              <p className="font-semibold">{locationLabel}</p>
            </div>
          </div>
        </div>

        {liveInsights.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background/70 p-4 mb-5 shadow-sm">
            <p className="font-bold text-sm mb-3">{lang === 'bn' ? 'লাইভ পূর্বাভাস পরামর্শ' : 'Live prediction tips'}</p>
            <div className="space-y-3">
              {liveInsights.map((insight, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      insight.tone === 'danger' ? 'bg-red-500' : insight.tone === 'warning' ? 'bg-orange-500' : insight.tone === 'info' ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground leading-5">{insight.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weather Alerts */}
        {weather.alerts.length > 0 && (
          <div className="flex gap-3 p-4 rounded-xl border border-orange-500/20 bg-orange-500/10 mb-5 shadow-sm backdrop-blur-sm">
            <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground font-medium">
              {lang === 'bn' ? weather.alerts[0].message_bn : weather.alerts[0].message}
            </p>
          </div>
        )}

        {/* Toggle Hourly Detail */}
        <button
          onClick={() => setShowHourlyDetail(!showHourlyDetail)}
          className="text-sm font-semibold text-primary hover:text-primary/80 mb-4 flex items-center gap-2 transition-colors"
        >
          <Zap className="w-4 h-4" />
          {showHourlyDetail 
            ? (lang === 'bn' ? 'সংক্ষিপ্ত বিবরণ লুকান' : 'Hide Hourly Details')
            : (lang === 'bn' ? '২৪ ঘন্টার বিস্তারিত বৃষ্টি পূর্বাভাস' : 'Show 24-Hour Rain Forecast')
          }
        </button>

        {/* Hourly Rain Forecast */}
        {showHourlyDetail && rainForecast.nextDay.length > 0 && (
          <div className="bg-background/50 rounded-xl p-4 mb-5 border border-border/30 overflow-x-auto">
            <p className="font-semibold text-sm mb-3">
              {lang === 'bn' ? '২৪ ঘন্টার বৃষ্টি সম্ভাবনা' : '24-Hour Rain Probability'}
            </p>
            <div className="grid grid-cols-12 gap-2">
              {rainForecast.nextDay.map((hour, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center p-2 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors"
                >
                  <p className="text-xs font-bold text-muted-foreground">{String(hour.hour).padStart(2, '0')}:00</p>
                  <div className="h-12 flex items-end justify-center mt-1">
                    <div
                      className={`w-2 rounded-t transition-all ${
                        hour.precipProb >= 70 ? 'bg-red-500' :
                        hour.precipProb >= 50 ? 'bg-orange-500' :
                        hour.precipProb >= 30 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ height: `${Math.max(4, (hour.precipProb / 100) * 12)}px` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-foreground mt-1">{hour.precipProb}%</p>
                  {hour.precipAmount > 0 && (
                    <p className="text-xs text-cyan-600 font-semibold">{hour.precipAmount}mm</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Forecast */}
        <div className="grid grid-cols-3 gap-3">
          {weather.forecast.map((day, idx) => (
            <div key={idx} className="text-center p-3 rounded-xl border border-border/60 bg-background/70 shadow-sm">
              <p className="text-xs text-muted-foreground mb-1">{lang === 'bn' ? day.day_bn : day.day}</p>
              <p className="font-bold text-base text-foreground mb-1">{day.temp}°C</p>
              <div className="flex items-center justify-center gap-1">
                <CloudRain className="w-3 h-3 text-primary" />
                <p className="text-xs text-primary font-medium">{day.rainfall}%</p>
              </div>
              {typeof day.uvIndex === 'number' && (
                <p className="text-xs text-amber-600 mt-1 font-semibold">UV {day.uvIndex}</p>
              )}
              {day.precipitationSum && day.precipitationSum > 0 && (
                <p className="text-xs text-cyan-600 mt-1 font-semibold">{day.precipitationSum}mm</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agricultural Recommendations based on rain */}
      {rainForecast.averageRainProb !== undefined && (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold">{lang === 'bn' ? 'চাষাবাদ পরামর্শ' : 'Farm Recommendations'}</h4>
          </div>
          <div className="space-y-2 text-sm">
            {rainForecast.averageRainProb >= 70 ? (
              <>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• সেচ বন্ধ করুন - ভারী বৃষ্টির সম্ভাবনা'
                    : '• Avoid irrigation - Heavy rain expected'
                  }
                </p>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• নিকাশ ব্যবস্থা পরীক্ষা করুন'
                    : '• Check drainage systems'
                  }
                </p>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• ফসল ক্ষতি থেকে রক্ষা করার ব্যবস্থা নিন'
                    : '• Protect crops from water logging'
                  }
                </p>
              </>
            ) : rainForecast.averageRainProb >= 50 ? (
              <>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• সেচ হ্রাস করুন - মধ্যম বৃষ্টির সম্ভাবনা'
                    : '• Reduce irrigation - Moderate rain expected'
                  }
                </p>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• আবহাওয়া পর্যবেক্ষণ চালিয়ে যান'
                    : '• Continue weather monitoring'
                  }
                </p>
              </>
            ) : rainForecast.averageRainProb >= 30 ? (
              <>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• নিয়মিত সেচ দিন - কম বৃষ্টির সম্ভাবনা'
                    : '• Regular irrigation needed - Low rain expected'
                  }
                </p>
              </>
            ) : (
              <>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• নিয়মিত সেচ চালিয়ে যান'
                    : '• Continue regular irrigation schedule'
                  }
                </p>
                <p className="text-foreground">
                  {lang === 'bn' 
                    ? '• আর্দ্রতা পরীক্ষা করুন'
                    : '• Monitor soil moisture'
                  }
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};