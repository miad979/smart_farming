import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { Droplets, Power, AlertCircle, Settings, Play, Loader2, Cpu, Activity, PhoneCall } from 'lucide-react';
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
    alarmTickThreshold: number;
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
    alarmTickThreshold: 3,
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

type PumpSimulationResult = {
  action: string;
  message: string;
  appliedLiters: number;
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
  const fallbackHelpLineNumber = String(import.meta.env.VITE_DEVICE_HELP_LINE || '+8801700000000').trim();
  const [deviceHelpLineNumber, setDeviceHelpLineNumber] = useState(fallbackHelpLineNumber);
  const normalizedHelpLine = String(deviceHelpLineNumber || fallbackHelpLineNumber).replace(/[^+\d]/g, '') || '+8801700000000';
  const deviceHelpLineHref = `tel:${normalizedHelpLine}`;
  const [data, setData] = useState<IrrigationData>(DEFAULT_IRRIGATION);
  const [autoMode, setAutoMode] = useState(DEFAULT_IRRIGATION.autoMode);
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [autoSimulation, setAutoSimulation] = useState(true);
  const [simulatedMoistureInput, setSimulatedMoistureInput] = useState(58);
  const [manualPumpLiters, setManualPumpLiters] = useState(45);
  const [lastPumpSimulation, setLastPumpSimulation] = useState<PumpSimulationResult | null>(null);
  const [yieldAdvice, setYieldAdvice] = useState<YieldAdvice | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [virtualDevice, setVirtualDevice] = useState<VirtualDevice | null>(null);
  const [softRefreshTick, setSoftRefreshTick] = useState(0);

  const normalizeAlarmTickThreshold = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 3;
    return Math.max(2, Math.min(4, Math.round(parsed)));
  };

  const parseLitersFromAmount = (value: string) => {
    const raw = String(value || '').replace(/[^\d.]/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const deriveManualLitersFromSchedule = (schedule: Partial<IrrigationData> | null | undefined) => {
    const cap = Math.max(1, Number(schedule?.policy?.maxVolume || 150));
    const amountLiters = parseLitersFromAmount(String(schedule?.amount || ''));
    const baseline = amountLiters > 0 ? amountLiters : 45;
    return Math.max(1, Math.min(cap, Math.round(baseline)));
  };

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
    if (typeof setup?.helpLineNumber === 'string' && setup.helpLineNumber.trim()) {
      setDeviceHelpLineNumber(setup.helpLineNumber.trim());
    }
    if (setup?.device) {
      setVirtualDevice(setup.device);
    }
    if (setup?.schedule) {
      setData(setup.schedule);
      setAutoMode(!!setup.schedule.autoMode);
      setSimulatedMoistureInput(Math.max(20, Math.min(95, Number(setup.schedule.moisture || 58))));
      setManualPumpLiters(deriveManualLitersFromSchedule(setup.schedule));
    }
    return setup?.device || null;
  };

  const simulateVirtualTick = async (
    cropName?: string,
    options?: { measuredMoisture?: number; forcePump?: 'on' | 'off'; manualLiters?: number },
  ) => {
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
        ...(typeof options?.measuredMoisture === 'number'
          ? { measuredMoisture: Math.max(20, Math.min(95, Math.round(options.measuredMoisture))) }
          : {}),
        ...(options?.forcePump ? { forcePump: options.forcePump } : {}),
        ...(typeof options?.manualLiters === 'number'
          ? { manualLiters: Math.max(1, Math.round(options.manualLiters)) }
          : {}),
      });
      if (typeof result?.helpLineNumber === 'string' && result.helpLineNumber.trim()) {
        setDeviceHelpLineNumber(result.helpLineNumber.trim());
      }
      if (result?.device) setVirtualDevice(result.device);
      if (result?.schedule) {
        setData(result.schedule);
        setAutoMode(!!result.schedule.autoMode);
      }
      setLastPumpSimulation({
        action: result?.action || 'idle',
        message: result?.message || '',
        appliedLiters: Number(result?.appliedLiters || 0),
      });
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

  const latestSensorTick = useMemo(() => {
    const history = data.sensorHistory || [];
    if (!history.length) return null;
    return history[history.length - 1];
  }, [data.sensorHistory]);

  const pumpIsActive = useMemo(() => {
    const actuatorState = String(virtualDevice?.actuatorState || '').toLowerCase();
    if (actuatorState === 'watering' || actuatorState === 'on') return true;
    return latestSensorTick?.action === 'watering';
  }, [virtualDevice?.actuatorState, latestSensorTick?.action]);

  const currentFlowLiters = useMemo(() => {
    if (!pumpIsActive) return 0;
    const fromSimulation = Number(lastPumpSimulation?.appliedLiters || 0);
    const fromSensorTick = Number(latestSensorTick?.appliedLiters || 0);
    const fromScheduleAmount = parseLitersFromAmount(data.amount);
    return Math.round(Math.max(18, fromSimulation, fromSensorTick, fromScheduleAmount));
  }, [pumpIsActive, lastPumpSimulation?.appliedLiters, latestSensorTick?.appliedLiters, data.amount]);

  const flowPulseDuration = useMemo(() => {
    if (!pumpIsActive) return 2.4;
    const cap = Number(data.policy?.maxVolume || 150);
    const normalized = Math.max(18, Math.min(cap, currentFlowLiters));
    return Math.max(0.65, 2.2 - normalized / 85);
  }, [pumpIsActive, currentFlowLiters, data.policy?.maxVolume]);

  const moistureThreshold = Number(data.policy?.threshold || 60);
  const alarmTickThreshold = normalizeAlarmTickThreshold(data.policy?.alarmTickThreshold);

  const pipeFillPercent = useMemo(() => {
    if (!pumpIsActive) return 0;
    const maxVolume = Math.max(1, Number(data.policy?.maxVolume || 150));
    const normalized = Math.round((Math.max(0, currentFlowLiters) / maxVolume) * 100);
    return Math.max(12, Math.min(100, normalized));
  }, [pumpIsActive, currentFlowLiters, data.policy?.maxVolume]);

  const lowMoistureStreak = useMemo(() => {
    const history = (data.sensorHistory || []).slice(-20).reverse();
    if (!history.length) {
      return Number(data.moisture || 0) < moistureThreshold ? 1 : 0;
    }

    let streak = 0;
    for (const tick of history) {
      const measured = Number(tick?.measuredMoisture ?? tick?.moisture ?? 0);
      if (measured < moistureThreshold) {
        streak += 1;
        continue;
      }
      break;
    }

    return streak;
  }, [data.sensorHistory, data.moisture, moistureThreshold]);

  const lowMoistureAlarmActive = lowMoistureStreak >= alarmTickThreshold;
  const lowMoistureDeficit = Math.max(0, Math.round(moistureThreshold - Number(data.moisture || 0)));

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
      const { schedule, helpLineNumber } = await getIrrigationSchedule(state.accessToken, state.user.id);
      setData(schedule);
      if (typeof helpLineNumber === 'string' && helpLineNumber.trim()) {
        setDeviceHelpLineNumber(helpLineNumber.trim());
      }
      setAutoMode(!!schedule.autoMode);
      setSimulatedMoistureInput(Math.max(20, Math.min(95, Number(schedule.moisture || 58))));
      setManualPumpLiters(deriveManualLitersFromSchedule(schedule));
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
    if (!state.user.id || state.userMode === 'guest') return;

    const unsubscribe = realtimeConnection.subscribe(`devices:${state.user.id}`, (event) => {
      const incomingDevice = event?.device;
      if (!incomingDevice) return;
      if (incomingDevice?.mode !== 'virtual' || incomingDevice?.type !== 'virtual_soil_sensor') return;

      setVirtualDevice((prev) => ({
        ...(prev || {}),
        ...incomingDevice,
        telemetry: {
          ...(prev?.telemetry || {}),
          ...(incomingDevice?.telemetry || {}),
        },
      }));
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
      const { schedule, helpLineNumber } = await updateIrrigationSchedule(state.accessToken, state.user.id, updates);
      setData(schedule);
      if (typeof helpLineNumber === 'string' && helpLineNumber.trim()) {
        setDeviceHelpLineNumber(helpLineNumber.trim());
      }
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
    const maxVolume = Math.max(1, Number(data.policy?.maxVolume || 150));
    const manualLiters = Math.max(1, Math.min(maxVolume, Math.round(Number(manualPumpLiters || 45))));

    // Show immediate intent in UI so manual action feels responsive.
    setData((prev) => ({
      ...prev,
      amount: `${manualLiters}L`,
    }));
    setVirtualDevice((prev) => (prev ? { ...prev, actuatorState: 'watering' } : prev));
    setLastPumpSimulation({
      action: 'watering',
      message: lang === 'bn' ? 'ম্যানুয়াল ওয়াটারিং শুরু হয়েছে' : 'Manual watering started',
      appliedLiters: manualLiters,
    });

    if (state.userMode === 'guest' || !state.accessToken || !state.user.id) {
      const nextMoisture = Math.min(95, Number(data.moisture || 68) + Math.max(4, Math.round(manualLiters * 0.35)));
      setData((prev) => ({
        ...prev,
        moisture: nextMoisture,
        amount: `${manualLiters}L`,
        nextWatering: 'Tomorrow 6 AM',
        nextWatering_bn: 'আগামীকাল সকাল ৬টা',
      }));
      setLastPumpSimulation({
        action: 'watering',
        message: lang === 'bn' ? 'ম্যানুয়াল ওয়াটারিং সফল' : 'Manual watering completed',
        appliedLiters: manualLiters,
      });
      setLastUpdated(new Date());
      return;
    }

    await simulateVirtualTick(data.policy?.crop || 'Rice', {
      measuredMoisture: Number(data.moisture || 68),
      forcePump: 'on',
      manualLiters,
    });
  };

  const stopWaterNow = async () => {
    setVirtualDevice((prev) => (prev ? { ...prev, actuatorState: 'idle' } : prev));
    setLastPumpSimulation({
      action: 'idle',
      message: lang === 'bn' ? 'ম্যানুয়াল ওয়াটারিং বন্ধ করা হয়েছে' : 'Manual watering stopped',
      appliedLiters: 0,
    });

    if (state.userMode === 'guest' || !state.accessToken || !state.user.id) {
      setLastUpdated(new Date());
      return;
    }

    await simulateVirtualTick(data.policy?.crop || 'Rice', {
      measuredMoisture: Number(data.moisture || 68),
      forcePump: 'off',
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
        alarmTickThreshold,
      },
    });
    await refreshOrSetupVirtualDevice(nextCrop);
    await simulateVirtualTick(nextCrop);
  };

  const handleAlarmTickThresholdChange = async (nextValue: number) => {
    await persistUpdates({
      policy: {
        ...data.policy,
        alarmTickThreshold: normalizeAlarmTickThreshold(nextValue),
      },
    });
  };

  const runAutoDecisionSimulation = async () => {
    await simulateVirtualTick(data.policy?.crop || 'Rice', {
      measuredMoisture: simulatedMoistureInput,
    });
  };

  const forcePumpOnSimulation = async () => {
    await simulateVirtualTick(data.policy?.crop || 'Rice', {
      measuredMoisture: simulatedMoistureInput,
      forcePump: 'on',
      manualLiters: manualPumpLiters,
    });
  };

  const forcePumpOffSimulation = async () => {
    await simulateVirtualTick(data.policy?.crop || 'Rice', {
      measuredMoisture: simulatedMoistureInput,
      forcePump: 'off',
    });
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
            {lang === 'bn' ? 'র‍্যান্ডম সেন্সর টিক' : 'Run Random Sensor Tick'}
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

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <p className="text-sm font-semibold text-emerald-900">
              {lang === 'bn' ? 'ভার্চুয়াল পাম্প সিমুলেটর' : 'Virtual Pump Simulator'}
            </p>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-full border ${
                virtualDevice?.actuatorState === 'watering'
                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}
            >
              <Power className="w-3 h-3" />
              {virtualDevice?.actuatorState === 'watering'
                ? (lang === 'bn' ? 'পাম্প চালু' : 'Pump ON')
                : (lang === 'bn' ? 'পাম্প বন্ধ' : 'Pump OFF')}
            </span>
          </div>

          <div
            className={`pump-visual-stage mb-4 ${lowMoistureAlarmActive ? 'is-alarm' : ''}`}
            data-testid="pump-visual-stage"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-700 mb-3">
              <span className="font-semibold text-slate-900">
                {lang === 'bn' ? 'লাইভ মোটর ও পানি প্রবাহ' : 'Live Motor and Water Flow'}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">
                  {lang === 'bn' ? 'সেন্সর স্টেট' : 'Sensor State'}: {latestSensorTick?.action || (lang === 'bn' ? 'আইডল' : 'idle')}
                </span>
                {lowMoistureAlarmActive && (
                  <span className="pump-alarm-pill is-active" data-testid="pump-alarm-status">
                    {lang === 'bn' ? 'লো মোয়েশ্চার অ্যালার্ম' : 'Low Moisture Alarm'}
                  </span>
                )}
                <span
                  data-testid="alarm-trigger-label"
                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${
                    lowMoistureAlarmActive
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-slate-300 bg-white/70 text-slate-600'
                  }`}
                >
                  {lang === 'bn'
                    ? `অ্যালার্ম সেট: ${alarmTickThreshold} টিক`
                    : `Alarm set: ${alarmTickThreshold} ticks`}
                </span>
              </div>
            </div>

            <div className="pump-visual-grid">
              <div className={`pump-motor-shell ${lowMoistureAlarmActive ? 'is-alarm' : ''}`}>
                <div
                  className={`pump-motor-rotor ${pumpIsActive ? 'is-active' : ''}`}
                  style={{ animationDuration: `${Math.max(0.5, flowPulseDuration * 0.8)}s` }}
                >
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <span
                      key={`motor-spoke-${idx}`}
                      className="pump-motor-spoke"
                      style={{ transform: `translate(-50%, -100%) rotate(${idx * 60}deg)` }}
                    />
                  ))}
                  <span className="pump-motor-hub" />
                </div>
              </div>

              <div>
                <div className="pump-pipe-track">
                  <div
                    className={`pump-pipe-fill ${pumpIsActive ? 'is-active' : ''} ${lowMoistureAlarmActive ? 'is-alarm' : ''}`}
                    style={{ width: `${pipeFillPercent}%` }}
                  />
                  <div
                    className={`pump-water-stream ${pumpIsActive ? 'is-active' : ''}`}
                    style={{ animationDuration: `${flowPulseDuration.toFixed(2)}s` }}
                  />
                  <div
                    className={`pump-water-stream secondary ${pumpIsActive ? 'is-active' : ''}`}
                    style={{ animationDuration: `${(flowPulseDuration * 1.35).toFixed(2)}s` }}
                  />
                  <span className="pump-pipe-overlay" data-testid="pump-pipe-fill-overlay">
                    {lang === 'bn' ? `পাইপ ফিল ${pipeFillPercent}%` : `Pipe Fill ${pipeFillPercent}%`}
                  </span>
                </div>

                <div className={`pump-droplet-cloud ${pumpIsActive ? 'is-active' : ''}`}>
                  {Array.from({ length: 7 }).map((_, idx) => (
                    <span
                      key={`pump-droplet-${idx}`}
                      className="pump-droplet"
                      style={{ animationDelay: `${(idx * 0.16).toFixed(2)}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="pump-soil-track" role="presentation">
                <div
                  className={`pump-soil-fill ${Number(data.moisture || 0) < Number(data.policy?.threshold || 60) ? 'is-low' : 'is-good'}`}
                  style={{ width: `${Math.max(8, Math.min(100, Number(data.moisture || 0)))}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                <span>
                  {lang === 'bn' ? 'মোটর স্ট্যাটাস' : 'Motor Status'}: {pumpIsActive ? (lang === 'bn' ? 'চালু' : 'Running') : (lang === 'bn' ? 'বন্ধ' : 'Idle')}
                </span>
                <span>
                  {lang === 'bn' ? 'রিয়েল-টাইম ফ্লো' : 'Real-time Flow'}: {pumpIsActive ? `${currentFlowLiters}L/cycle` : `0L/cycle`}
                </span>
                <span>
                  {lang === 'bn' ? 'ময়েশ্চার' : 'Moisture'}: {Math.round(Number(data.moisture || 0))}%
                </span>
                {lowMoistureAlarmActive && (
                  <span className="pump-alarm-copy" data-testid="pump-alarm-copy">
                    {lang === 'bn'
                      ? `${lowMoistureStreak}/${alarmTickThreshold} টিক ধরে থ্রেশহোল্ডের নিচে (${lowMoistureDeficit}% ঘাটতি)`
                      : `${lowMoistureStreak}/${alarmTickThreshold} ticks below threshold (${lowMoistureDeficit}% deficit)`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-gray-700">
              {lang === 'bn' ? 'সিমুলেটেড আর্দ্রতা (%)' : 'Simulated Moisture (%)'}
              <input
                data-testid="pump-sim-moisture-input"
                type="number"
                min={20}
                max={95}
                value={simulatedMoistureInput}
                onChange={(e) => setSimulatedMoistureInput(Math.max(20, Math.min(95, Number(e.target.value || 0))))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-gray-700">
              {lang === 'bn' ? 'পাম্পের পানি (লিটার)' : 'Pump Water (Liters)'}
              <input
                data-testid="pump-sim-liters-input"
                type="number"
                min={1}
                max={Number(data.policy?.maxVolume || 150)}
                value={manualPumpLiters}
                onChange={(e) => {
                  const cap = Number(data.policy?.maxVolume || 150);
                  const next = Math.round(Number(e.target.value || 0));
                  setManualPumpLiters(Math.max(1, Math.min(cap, next)));
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="pump-sim-auto-btn"
              onClick={() => void runAutoDecisionSimulation()}
              disabled={simulating || saving}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {lang === 'bn' ? 'অটো সিদ্ধান্ত চালান' : 'Run Auto Decision'}
            </button>
            <button
              type="button"
              data-testid="pump-sim-force-on-btn"
              onClick={() => void forcePumpOnSimulation()}
              disabled={simulating || saving}
              className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {lang === 'bn' ? 'পাম্প চালু (টেস্ট)' : 'Force Pump ON (Test)'}
            </button>
            <button
              type="button"
              data-testid="pump-sim-force-off-btn"
              onClick={() => void forcePumpOffSimulation()}
              disabled={simulating || saving}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {lang === 'bn' ? 'পাম্প বন্ধ (টেস্ট)' : 'Force Pump OFF (Test)'}
            </button>
          </div>

          {lastPumpSimulation?.message && (
            <p data-testid="manual-water-latest-result" className="mt-3 text-xs text-emerald-900">
              {lang === 'bn' ? 'সর্বশেষ ফলাফল' : 'Latest Result'}: {lastPumpSimulation.message}
              {lastPumpSimulation.appliedLiters > 0 ? ` (${lastPumpSimulation.appliedLiters}L)` : ''}
            </p>
          )}

          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-blue-900">
                {lang === 'bn'
                  ? 'সেন্সর সমস্যা, ডিভাইস বিকল, বা সংযোগ না হলে হেল্প লাইনে কল করুন'
                  : 'If sensor is broken, offline, or not working, call the device help line'}
              </p>
              <a
                data-testid="device-helpline-call-btn"
                href={deviceHelpLineHref}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'ডিভাইস হেল্প লাইনে কল' : 'Call Device Help Line'}
              </a>
            </div>
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <label className="text-sm text-gray-700">
            {lang === 'bn' ? 'পরিমাণ (লিটার)' : 'Amount (Liters)'}
            <input
              data-testid="manual-water-amount-input"
              type="number"
              min={1}
              max={Number(data.policy?.maxVolume || 150)}
              value={manualPumpLiters}
              onChange={(e) => {
                const cap = Number(data.policy?.maxVolume || 150);
                const next = Math.round(Number(e.target.value || 0));
                setManualPumpLiters(Math.max(1, Math.min(cap, next)));
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600">{lang === 'bn' ? 'সর্বশেষ প্রয়োগ করা পরিমাণ' : 'Last Applied Amount'}</p>
            <p data-testid="manual-water-last-amount" className="text-xl font-bold text-blue-600 mt-1">{data.amount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            data-testid="manual-water-now-btn"
            onClick={waterNow}
            disabled={saving || simulating}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-base font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-70"
          >
            {(saving || simulating) ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
            {t('waterNow', lang)}
          </button>

          <button
            data-testid="manual-water-stop-btn"
            onClick={stopWaterNow}
            disabled={saving || simulating}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 border border-rose-300 bg-rose-50 text-rose-700 text-base font-bold rounded-xl hover:bg-rose-100 transition-all disabled:opacity-70"
          >
            {(saving || simulating) ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className="w-6 h-6" />}
            {lang === 'bn' ? 'পানি বন্ধ করুন' : 'Stop Watering'}
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-600 text-center">
          {lang === 'bn'
            ? `ওয়াটার নাউ বোতাম চাপলে ${manualPumpLiters}L ম্যানুয়াল পানির পরিমাণ প্রয়োগ হবে`
            : `Pressing Water Now applies ${manualPumpLiters}L for manual watering`}
        </p>
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
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {lang === 'bn' ? 'অ্যালার্ম ট্রিগার (লো টিক)' : 'Alarm Trigger (Low Ticks)'}
              </label>
              <select
                data-testid="alarm-tick-threshold-select"
                value={alarmTickThreshold}
                onChange={(e) => void handleAlarmTickThresholdChange(Number(e.target.value))}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:opacity-70"
              >
                <option value={2}>{lang === 'bn' ? '২ টিক' : '2 ticks'}</option>
                <option value={3}>{lang === 'bn' ? '৩ টিক' : '3 ticks'}</option>
                <option value={4}>{lang === 'bn' ? '৪ টিক' : '4 ticks'}</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {lang === 'bn'
                  ? 'ক্রমাগত কতটি লো ময়েশ্চার টিক হলে অ্যালার্ম পালস চালু হবে'
                  : 'How many consecutive low-moisture ticks trigger alarm pulse mode'}
              </p>
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
