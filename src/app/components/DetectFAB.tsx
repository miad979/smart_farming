import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Camera } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const DetectFAB: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useApp();
  const lang = state.language;

  // Don't show on detect page
  if (location.pathname === '/detect') {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/detect')}
      className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-20 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center justify-center group"
      aria-label={lang === 'bn' ? 'রোগ শনাক্ত করুন' : 'Detect Disease'}
    >
      <Camera className="w-6 h-6" />
      <span className="absolute right-16 bg-gray-900 text-white text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {lang === 'bn' ? 'রোগ শনাক্ত' : 'Detect Disease'}
      </span>
    </button>
  );
};