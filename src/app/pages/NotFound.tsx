import React from 'react';
import { Link } from 'react-router';
import { useApp } from '../context/AppContext';
import { Home, AlertCircle } from 'lucide-react';

export const NotFound: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <AlertCircle className="w-20 h-20 text-gray-400 mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          {lang === 'bn' ? 'পৃষ্ঠা পাওয়া যায়নি' : 'Page Not Found'}
        </h2>
        <p className="text-gray-600 mb-8">
          {lang === 'bn'
            ? 'দুঃখিত, আপনি যে পৃষ্ঠাটি খুঁজছেন তা পাওয়া যায়নি।'
            : "Sorry, the page you're looking for doesn't exist."}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Home className="w-5 h-5" />
          {lang === 'bn' ? 'হোমে ফিরে যান' : 'Go to Home'}
        </Link>
      </div>
    </div>
  );
};
