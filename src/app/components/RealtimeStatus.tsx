import React, { useEffect, useState } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import { useRealtime } from '../context/RealtimeContext';
import { useApp } from '../context/AppContext';

export const RealtimeStatus: React.FC = () => {
  const { isConnected } = useRealtime();
  const { state } = useApp();
  const [showPulse, setShowPulse] = useState(false);
  const lang = state.language;

  useEffect(() => {
    if (isConnected) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  if (state.userMode === 'guest') {
    return null; // Don't show for guests
  }

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-6 z-30">
      <div className={`
        flex items-center gap-2 px-4 py-2 rounded-full
        backdrop-blur-md shadow-lg border
        transition-all duration-300
        ${isConnected 
          ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' 
          : 'bg-gray-500/10 border-gray-500/20 text-gray-700 dark:text-gray-400'
        }
        ${showPulse ? 'scale-110' : 'scale-100'}
      `}>
        {isConnected ? (
          <>
            <div className="relative">
              <Zap className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            </div>
            <span className="text-xs font-medium">
              {lang === 'bn' ? 'লাইভ' : 'Live'}
            </span>
          </>
        ) : (
          <>
            <ZapOff className="w-4 h-4" />
            <span className="text-xs font-medium">
              {lang === 'bn' ? 'অফলাইন' : 'Offline'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
