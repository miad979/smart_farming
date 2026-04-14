import React, { useState } from 'react';
import { FlaskConical, X, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { sendRealtimeTestEvent } from '../utils/api';

export const RealtimeTestPanel: React.FC = () => {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState('');

  if (state.userMode === 'guest' || !state.accessToken) {
    return null;
  }

  const lang = state.language;
  const isAdmin = state.user.role === 'admin';

  const trigger = async (type: 'price' | 'consultation' | 'irrigation' | 'disease' | 'system') => {
    setLoadingType(type);
    try {
      await sendRealtimeTestEvent(state.accessToken as string, {
        type,
        targetUserId: isAdmin && targetUserId.trim() ? targetUserId.trim() : undefined,
      });
      toast.success(lang === 'bn' ? 'টেস্ট ইভেন্ট পাঠানো হয়েছে' : 'Test event sent', {
        description: lang === 'bn' ? 'লাইভ আপডেট প্যানেল দেখুন' : 'Check the live notifications panel',
      });
    } catch (error: any) {
      toast.error(lang === 'bn' ? 'ইভেন্ট পাঠানো যায়নি' : 'Failed to send event', {
        description: error?.message,
      });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="fixed bottom-36 lg:bottom-20 right-6 z-40">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
          title={lang === 'bn' ? 'রিয়েল-টাইম টেস্ট প্যানেল' : 'Realtime test panel'}
        >
          <FlaskConical className="w-4 h-4" />
          <span className="text-xs font-semibold">{lang === 'bn' ? 'RT টেস্ট' : 'RT Test'}</span>
        </button>
      ) : (
        <div className="w-64 rounded-2xl border border-border bg-card shadow-2xl p-3 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-semibold">{lang === 'bn' ? 'Realtime Demo' : 'Realtime Demo'}</h4>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isAdmin && (
            <div className="mb-3">
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder={lang === 'bn' ? 'টার্গেট User ID (ঐচ্ছিক)' : 'Target User ID (optional)'}
                className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {lang === 'bn'
                  ? 'খালি রাখলে নিজের ID-তে ইভেন্ট যাবে'
                  : 'Leave blank to target your own user ID'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => trigger('price')}
              disabled={!!loadingType}
              className="px-2 py-2 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loadingType === 'price' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (lang === 'bn' ? 'দাম' : 'Price')}
            </button>
            <button
              onClick={() => trigger('consultation')}
              disabled={!!loadingType}
              className="px-2 py-2 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingType === 'consultation' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (lang === 'bn' ? 'পরামর্শ' : 'Consult')}
            </button>
            <button
              onClick={() => trigger('irrigation')}
              disabled={!!loadingType}
              className="px-2 py-2 text-xs rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {loadingType === 'irrigation' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (lang === 'bn' ? 'সেচ' : 'Irrigate')}
            </button>
            <button
              onClick={() => trigger('disease')}
              disabled={!!loadingType}
              className="px-2 py-2 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {loadingType === 'disease' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (lang === 'bn' ? 'রোগ' : 'Disease')}
            </button>
            <button
              onClick={() => trigger('system')}
              disabled={!!loadingType}
              className="col-span-2 px-2 py-2 text-xs rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingType === 'system' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (lang === 'bn' ? 'সিস্টেম বার্তা' : 'System Notice')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
