import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, AlertCircle } from 'lucide-react';

export const OnboardingBanner: React.FC = () => {
  const { state } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const lang = state.language;

  if (dismissed || state.userMode === 'logged-in') {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">
            {lang === 'bn' ? 'স্বাগতম!' : 'Welcome!'}
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            {lang === 'bn'
              ? 'আপনি অতিথি মোডে আছেন। সমস্ত বৈশিষ্ট্য অফলাইনে কাজ করে। সিঙ্ক এবং রিয়েল-টাইম সতর্কতার জন্য লগইন করুন।'
              : "You're in guest mode. All features work offline. Login for sync and real-time alerts."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDismissed(true)}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors"
            >
              {lang === 'bn' ? 'পরে দেখাবেন না' : "Don't show again"}
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-600 hover:text-blue-800 p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
