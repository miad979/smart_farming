import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { Droplets, Power, AlertCircle, Settings, Play, Loader2, Cpu, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { getCurrentLocation, getLastKnownLocation } from '../utils/helpers';
import {
  getIrrigationSchedule,
  getYieldAdvice,
  updateIrrigationSchedule,
  getDevices,
  setupVirtualIrrigationDevice,
  simulateVirtualIrrigationTick,
} from '../utils/api';
import { realtimeConnection } from '../context/RealtimeContext';
import { subscribeSoftRefresh } from '../utils/softRefresh';

type IrrigationData = {
  autoMode: boolean;
  moisture: number;
  nextWatering: string;
  nextWatering_bn: string;
  amount: string;
  usage: Array<{ day: string; day_bn: string; amount: number }>;
  sensorHistory?: Array<{
    id?: string;
    timestamp: string;
    moisture: number;
    measuredMoisture?: number;
    action?: string;
    appliedLiters?: number;
  }>;
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
  sensorHistory: [
    {
      id: 'seed-tick',
      timestamp: new Date().toISOString(),
      moisture: 68,
      measuredMoisture: 68,
      action: 'seed',
      appliedLiters: 0,
    },
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
  advice_en: string[];
  advice_bn: string[];
}

type VirtualDevice = {
  id: string;
  name?: string;
  type?: string;
  mode?: string;
  status?: string;
  actuatorState?: string;
  telemetry?: {
    soilMoisture?: number;
    battery?: number;
    temperature?: number;
    humidity?: number;
  };
  lastSync?: string;
};

const CROP_PROFILES: Record<string, { crop_bn: string; threshold: number; maxVolume: number }> = {
  Rice: { crop_bn: 'ধান', threshold: 65, maxVolume: 150 },
  Wheat: { crop_bn: 'গম', threshold: 55, maxVolume: 110 },
  Maize: { crop_bn: 'ভুট্টা', threshold: 58, maxVolume: 120 },
  Vegetables: { crop_bn: 'সবজি', threshold: 62, maxVolume: 95 },
  Potato: { crop_bn: 'আলু', threshold: 60, maxVolume: 105 },
};

export const Irrigation: React.FC = () => {
  const FALLBACK_COORDS = { lat: 23.8103, lng: 90.4125 };
  const { state } = useApp();
  const lang = state.language;
  const [data, setData] = useState<IrrigationData>(DEFAULT_IRRIGATION);
  const [autoMode, setAutoMode] = useState(DEFAULT_IRRIGATION.autoMode);
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [autoSimulation, setAutoSimulation] = useState(true);
  const [yieldAdvice, setYieldAdvice] = useState<YieldAdvice | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [virtualDevice, setVirtualDevice] = useState<VirtualDevice | null>(null);
  const [softRefreshTick, setSoftRefreshTick] = useState(0);

  const refreshOrSetupVirtualDevice = async (cropName: string) => {
    if (state.userMode === 'guest' || !state.accessToken) return null;

    const { devices } = await getDevices(state.accessToken);
    const virtual = (devices || []).find(
      (d: any) => d?.mode === 'virtual' && d?.type === 'virtual_soil_sensor',
    );

    if (virtual) {
      setVirtualDevice(virtual);
      return virtual;
    }

    const setup = await setupVirtualIrrigationDevice(state.accessToken, { crop: cropName });
    if (setup?.device) {
      setVirtualDevice(setup.device);
    }
    if (setup?.schedule) {
      setData(setup.schedule);
      setAutoMode(!!setup.schedule.autoMode);
    }
    return setup?.device || null;
  };

  const simulateVirtualTick = async (cropName?: string) => {
    if (state.userMode === 'guest' || !state.accessToken) return;
    let device = virtualDevice;
    if (!device?.id) {
      device = await refreshOrSetupVirtualDevice(cropName || data.policy.crop);
    }
    if (!device?.id) return;

    setSimulating(true);
    try {
      const result = await simulateVirtualIrrigationTick(state.accessToken, device.id, {
        crop: cropName || data.policy.crop,
      });
      if (result?.device) setVirtualDevice(result.device);
      if (result?.schedule) {
        setData(result.schedule);
        setAutoMode(!!result.schedule.autoMode);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to simulate virtual device tick:', error);
    } finally {
      setSimulating(false);
    }
  };

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

  const chartData = useMemo(
    () =>
      (data.usage || []).map((item: any) => ({
        ...item,
        dayLabel: lang === 'bn' ? item.day_bn : item.day,
      })),
    [data.usage, lang],
  );

  const sensorHistoryChartData = useMemo(
    () =>
      (data.sensorHistory || []).slice(-20).map((item, idx) => {
        const date = new Date(item.timestamp);
        const label = Number.isNaN(date.getTime())
          ? String(idx + 1)
          : date.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

        return {
          ...item,
          label,
          moisture: Number(item.moisture || 0),
          measuredMoisture: Number(item.measuredMoisture ?? item.moisture ?? 0),
          wateringMoisture: item.action === 'watering' ? Number(item.measuredMoisture ?? item.moisture ?? 0) : null,
          idleMoisture: item.action === 'idle' || item.action === 'seed' ? Number(item.measuredMoisture ?? item.moisture ?? 0) : null,
        };
      }),
    [data.sensorHistory, lang],
  );

  const getActionDotColor = (action?: string) => (action === 'watering' ? '#f97316' : '#16a34a');

  const renderActionDot = (props: any) => {
    const { cx, cy, payload } = props || {};
    if (typeof cx !== 'number' || typeof cy !== 'number') {
      return <circle cx={0} cy={0} r={0} fill="transparent" stroke="none" />;
    }
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={getActionDotColor(payload?.action)}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  };

  const loadIrrigation = async () => {
    if (state.userMode === 'guest' || !state.accessToken || !state.user.id) {
      setLoading(false);
      return;
    }

    if (!lastUpdated) {
      setLoading(true);
    }
    try {
      const { schedule } = await getIrrigationSchedule(state.accessToken, state.user.id);
      setData(schedule);
      setAutoMode(!!schedule.autoMode);
      await refreshOrSetupVirtualDevice(schedule?.policy?.crop || 'Rice');
      setLastUpdated(new Date());

      // Do not block irrigation UI on location permission prompt or geolocation delays.
      void (async () => {
        try {
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

          const { advice } = await getYieldAdvice({
            lat: coords.lat,
            lng: coords.lng,
            moisture: Number(schedule.moisture || 68),
            crop: schedule?.policy?.crop || 'Rice',
          });
          setYieldAdvice(advice);
        } catch (error) {
          console.error('Failed to load irrigation yield advice:', error);
        }
      })();
    } catch (error) {
      console.error('Failed to load irrigation data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIrrigation();
  }, [state.userMode, state.accessToken, state.user.id, softRefreshTick]);

  useEffect(() => {
    const unsubscribe = subscribeSoftRefresh(['irrigation', 'all'], () => {
      setSoftRefreshTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const unsubscribe = realtimeConnection.subscribe(`irrigation:${state.user.id}`, (event) => {
      const schedule = event?.schedule;
      if (!schedule) return;
      setData((prev) => ({ ...prev, ...schedule }));
      if (typeof schedule.autoMode === 'boolean') {
        setAutoMode(schedule.autoMode);
      }
      setLastUpdated(new Date());
    });

    return unsubscribe;
  }, [state.user.id, state.userMode]);

  useEffect(() => {
    if (!autoMode || !autoSimulation || state.userMode === 'guest' || !state.accessToken) return;
    const timer = setInterval(() => {
      void simulateVirtualTick(data.policy?.crop || 'Rice');
    }, 20000);
    return () => clearInterval(timer);
  }, [autoMode, autoSimulation, state.userMode, state.accessToken, data.policy?.crop, virtualDevice?.id]);

  const persistUpdates = async (updates: any) => {
    if (state.userMode === 'guest' || !state.accessToken || !state.user.id) return;

    setSaving(true);
    try {
      const { schedule } = await updateIrrigationSchedule(state.accessToken, state.user.id, updates);
      setData(schedule);
      if (typeof schedule.autoMode === 'boolean') {
        setAutoMode(schedule.autoMode);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to save irrigation update:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoMode = async () => {
    await persistUpdates({ autoMode: !autoMode });
  };

  const waterNow = async () => {
    const nextMoisture = Math.min(95, Number(data.moisture || 68) + 12);
    await persistUpdates({
      moisture: nextMoisture,
      amount: data.amount || '45L',
      nextWatering: 'Tomorrow 6 AM',
      nextWatering_bn: 'আগামীকাল সকাল ৬টা',
    });
  };

  const handleCropChange = async (nextCrop: string) => {
    const profile = CROP_PROFILES[nextCrop] || CROP_PROFILES.Rice;
    await persistUpdates({
      policy: {
        ...data.policy,
        crop: nextCrop,
        crop_bn: profile.crop_bn,
        threshold: profile.threshold,
        maxVolume: profile.maxVolume,
      },
    });
    await refreshOrSetupVirtualDevice(nextCrop);
    await simulateVirtualTick(nextCrop);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('irrigation', lang)}</h1>
        <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-gray-100 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm text-gray-700">{lang === 'bn' ? 'লাইভ সেচ তথ্য লোড হচ্ছে...' : 'Loading live irrigation data...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('irrigation', lang)}</h1>
        <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          {lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Last updated'}: {formatLastUpdated(lastUpdated)}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${
              data.moisture >= 70 ? 'bg-green-50' :
              data.moisture >= 50 ? 'bg-blue-50' :
              'bg-orange-50'
            }`}>
              <Droplets className={`w-7 h-7 ${
                data.moisture >= 70 ? 'text-green-600' :
                data.moisture >= 50 ? 'text-blue-600' :
                'text-orange-600'
              }`} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{t('moisture', lang)}</h3>
              <p className="text-xs text-gray-600">{lang === 'bn' ? 'লাইভ সেন্সর ডেটা' : 'Live sensor data'}</p>
            </div>
          </div>
          {autoMode && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-semibold rounded-full border border-green-200">
              <Power className="w-4 h-4" />
              {lang === 'bn' ? 'স্বয়ংক্রিয় চালু' : 'Auto ON'}
            </span>
          )}
        </div>

        <div className="relative pt-1">
          <div className="flex mb-4 items-center justify-between">
            <div>
              <span className={`text-4xl font-bold ${
                data.moisture >= 70 ? 'text-green-600' :
                data.moisture >= 50 ? 'text-blue-600' :
                'text-orange-600'
              }`}>{data.moisture}%</span>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600 block">{t('nextWatering', lang)}</span>
              <p className="font-bold text-base">{lang === 'bn' ? data.nextWatering_bn : data.nextWatering}</p>
            </div>
          </div>
          <div className="overflow-hidden h-5 mb-6 text-xs flex rounded-full bg-gray-200">
            <div
              style={{ width: `${data.moisture}%` }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                data.moisture >= 70 ? 'bg-green-500' :
                data.moisture >= 50 ? 'bg-blue-500' :
                'bg-orange-500'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <div>
            <p className="text-base font-bold text-gray-900">{t('autoMode', lang)}</p>
            <p className="text-sm text-gray-600">{lang === 'bn' ? 'লাইভ সেচ নিয়ন্ত্রণ' : 'Live automatic irrigation control'}</p>
          </div>
          <button
            onClick={toggleAutoMode}
            disabled={saving}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              autoMode ? 'bg-green-600' : 'bg-gray-300'
            } ${saving ? 'opacity-70' : ''}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                autoMode ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-indigo-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-lg">
              {lang === 'bn' ? 'ভার্চুয়াল IoT সেচ ডিভাইস' : 'Virtual IoT Irrigation Device'}
            </h3>
          </div>
          <span className="text-xs px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
            {virtualDevice?.status || 'active'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-slate-600">{lang === 'bn' ? 'ডিভাইস মোড' : 'Mode'}</p>
            <p className="font-semibold text-sm">{virtualDevice?.mode || 'virtual'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-slate-600">{lang === 'bn' ? 'অ্যাকচুয়েটর' : 'Actuator'}</p>
            <p className="font-semibold text-sm">{virtualDevice?.actuatorState || 'idle'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-slate-600">{lang === 'bn' ? 'ব্যাটারি' : 'Battery'}</p>
            <p className="font-semibold text-sm">{Math.round(Number(virtualDevice?.telemetry?.battery || 100))}%</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-slate-600">{lang === 'bn' ? 'তাপমাত্রা' : 'Temperature'}</p>
            <p className="font-semibold text-sm">{Math.round(Number(virtualDevice?.telemetry?.temperature || 29))}°C</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void simulateVirtualTick(data.policy?.crop || 'Rice')}
            disabled={simulating || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {lang === 'bn' ? 'সেন্সর টিক চালান' : 'Run Sensor Tick'}
          </button>
          <button
            type="button"
            onClick={() => setAutoSimulation((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold border ${
              autoSimulation
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Power className="w-4 h-4" />
            {autoSimulation
              ? (lang === 'bn' ? 'অটো সিমুলেশন চালু' : 'Auto Simulation ON')
              : (lang === 'bn' ? 'অটো সিমুলেশন বন্ধ' : 'Auto Simulation OFF')}
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-indigo-900">
              {lang === 'bn' ? 'ডিভাইস হিস্টরি (শেষ ২০ রিডিং)' : 'Device History (Last 20 Ticks)'}
            </p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-indigo-700">
                {sensorHistoryChartData.length} {lang === 'bn' ? 'পয়েন্ট' : 'points'}
              </span>
              <span className="inline-flex items-center gap-1 text-orange-700">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                {lang === 'bn' ? 'পানি চালু' : 'watering'}
              </span>
              <span className="inline-flex items-center gap-1 text-green-700">
                <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                {lang === 'bn' ? 'আইডল' : 'idle'}
              </span>
            </div>
          </div>

          {sensorHistoryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sensorHistoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[20, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="wateringMoisture"
                  name={lang === 'bn' ? 'পানি চালু' : 'Watering'}
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={renderActionDot}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="idleMoisture"
                  name={lang === 'bn' ? 'আইডল' : 'Idle'}
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={renderActionDot}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-600">{lang === 'bn' ? 'এখনও কোনো সেন্সর হিস্টরি নেই' : 'No sensor history yet'}</p>
          )}
        </div>
      </div>

      {(data.alerts || []).map((alert: any, idx: number) => (
        <div key={idx} className="flex gap-3 p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-xl shadow-sm">
          <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900 font-medium">{lang === 'bn' ? alert.message_bn : alert.message}</p>
        </div>
      ))}

      {yieldAdvice && (
        <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-emerald-100">
          <h3 className="font-bold text-lg mb-3">{lang === 'bn' ? 'ফলন পরামর্শ (রিয়েল-টাইম)' : 'Yield Advice (Real-time)'}</h3>
          <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
            {(lang === 'bn' ? yieldAdvice.advice_bn : yieldAdvice.advice_en).map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-gray-100">
        <h3 className="font-bold text-lg mb-6">{lang === 'bn' ? 'ম্যানুয়াল নিয়ন্ত্রণ' : 'Manual Control'}</h3>

        <button
          onClick={waterNow}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-base font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-70"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
          {t('waterNow', lang)}
        </button>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{data.amount}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <button
          onClick={() => setShowPolicy(!showPolicy)}
          className="flex items-center justify-between w-full mb-4"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {lang === 'bn' ? 'সেচ নীতি' : 'Irrigation Policy'}
          </h3>
          <span className="text-sm text-blue-600">{showPolicy ? (lang === 'bn' ? 'লুকান' : 'Hide') : (lang === 'bn' ? 'দেখান' : 'Show')}</span>
        </button>

        {showPolicy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{lang === 'bn' ? 'ফসল' : 'Crop'}</label>
              <select
                value={data.policy.crop}
                onChange={(e) => void handleCropChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Object.keys(CROP_PROFILES).map((crop) => (
                  <option key={crop} value={crop}>
                    {lang === 'bn' ? CROP_PROFILES[crop].crop_bn : crop}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{lang === 'bn' ? 'থ্রেশহোল্ড (%)' : 'Threshold (%)'}</label>
              <input
                type="number"
                value={data.policy.threshold}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{lang === 'bn' ? 'সর্বোচ্চ পরিমাণ (L)' : 'Max Volume (L)'}</label>
              <input
                type="number"
                value={data.policy.maxVolume}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{lang === 'bn' ? 'সেচ সময়' : 'Irrigation Window'}</label>
              <input
                type="text"
                value={data.policy.window}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
          </div>
        )}
      </div>

      <div key={`usage-section-${lang}`} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="font-semibold mb-4">{lang === 'bn' ? 'সাপ্তাহিক ব্যবহার' : 'Weekly Usage'}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" key="grid" />
            <XAxis dataKey="dayLabel" key="xaxis" />
            <YAxis key="yaxis" />
            <Tooltip key="tooltip" />
            <Bar dataKey="amount" fill="#3b82f6" key="bar" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
