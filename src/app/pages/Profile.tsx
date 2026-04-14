import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { User, Phone, MapPin, LogOut, LogIn, Globe, Smartphone, Cloud, Shield, Bell, Lock, Palette, UserPlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { LoginModal } from '../components/LoginModal';
import { ThemeToggle } from '../components/ThemeToggle';

export const Profile: React.FC = () => {
  const { state, logout, setLanguage, syncData } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const lang = state.language;
  const [showLogin, setShowLogin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthStatus, setShowAuthStatus] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'signin') {
      setShowLogin(true);
    }
  }, [location.search]);

  const handleSync = async () => {
    if (!state.isOnline || !state.accessToken) return;
    
    setIsSyncing(true);
    await syncData();
    setIsSyncing(false);
  };

  const isGuest = state.userMode === 'guest';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero Card with Profile Info */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 rounded-2xl p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">{state.user.name}</h1>
              <div className="flex items-center gap-2 text-blue-100 flex-wrap">
                {state.user.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">{state.user.phone}</span>
                  </div>
                )}
                <span className="text-blue-200">•</span>
                <span className="text-sm capitalize">{state.user.role}</span>
              </div>
              {state.user.location && (
                <div className="flex items-center gap-1 text-blue-100 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{lang === 'bn' ? state.user.location_bn : state.user.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Login/Logout/Signup Buttons */}
          <div className="flex gap-2">
            {isGuest ? (
              <>
                <button
                  onClick={() => setShowLogin(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-all duration-200 shadow-lg hover:scale-105 active:scale-95"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{lang === 'bn' ? 'লগইন' : 'Login'}</span>
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-all duration-200 shadow-lg hover:scale-105 active:scale-95"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>{lang === 'bn' ? 'নিবন্ধন' : 'Sign Up'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={logout}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/30 text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <LogOut className="w-5 h-5" />
                <span>{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="relative mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-full text-sm">
          <div className={`w-2 h-2 rounded-full ${state.isOnline ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
          <span>{state.isOnline ? (lang === 'bn' ? 'অনলাইন' : 'Online') : (lang === 'bn' ? 'অফলাইন' : 'Offline')}</span>
        </div>
      </div>

      {/* Settings Panels */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Appearance Settings */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Palette className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{lang === 'bn' ? 'থিম' : 'Theme'}</h3>
              <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'রঙের মোড নির্বাচন করুন' : 'Choose your color mode'}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Language Settings */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{lang === 'bn' ? 'ভাষা' : 'Language'}</h3>
              <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'আপনার ভাষা পছন্দ' : 'Your language preference'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('bn')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                lang === 'bn'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              বাংলা
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                lang === 'en'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{lang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'}</h3>
              <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'আপডেট এবং সতর্কতা' : 'Updates and alerts'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">{lang === 'bn' ? 'পুশ বিজ্ঞপ্তি' : 'Push notifications'}</span>
              <div className="relative inline-block w-12 h-6 bg-muted rounded-full">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6 peer-checked:bg-blue-600" />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">{lang === 'bn' ? 'আবহাওয়া সতর্কতা' : 'Weather alerts'}</span>
              <div className="relative inline-block w-12 h-6 bg-muted rounded-full">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6 peer-checked:bg-blue-600" />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">{lang === 'bn' ? 'দাম আপডেট' : 'Price updates'}</span>
              <div className="relative inline-block w-12 h-6 bg-muted rounded-full">
                <input type="checkbox" className="sr-only peer" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6 peer-checked:bg-blue-600" />
              </div>
            </label>
          </div>
        </div>

        {/* Security */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{lang === 'bn' ? 'নিরাপত্তা' : 'Security'}</h3>
              <p className="text-sm text-muted-foreground">{lang === 'bn' ? 'আপনার অ্যাকাউন্ট সুরক্ষা' : 'Your account protection'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-all">
              <span className="text-sm font-medium">{lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change password'}</span>
              <Lock className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-all">
              <span className="text-sm font-medium">{lang === 'bn' ? 'দুই-ফ্যাক্টর প্রমাণীকরণ' : 'Two-factor auth'}</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      {!isGuest && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-semibold">{lang === 'bn' ? 'ক্লাউড সিঙ্ক' : 'Cloud Sync'}</h3>
                <p className="text-sm text-muted-foreground">
                  {state.lastSync 
                    ? `${lang === 'bn' ? 'শেষ সিঙ্ক: ' : 'Last synced: '}${new Date(state.lastSync).toLocaleString()}`
                    : (lang === 'bn' ? 'কখনো সিঙ্ক করা হয়নি' : 'Never synced')
                  }
                </p>
              </div>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (lang === 'bn' ? 'সিঙ্ক করা হচ্ছে...' : 'Syncing...') : (lang === 'bn' ? 'এখন সিঙ্ক করুন' : 'Sync Now')}
            </button>
          </div>
        </div>
      )}

      {/* Auth Status Debug */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-semibold">{lang === 'bn' ? 'Auth Status' : 'Auth Status'}</h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'bn' ? 'ডিবাগের জন্য বর্তমান লগইন তথ্য দেখুন' : 'View current login details for debugging'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAuthStatus((prev) => !prev)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            {showAuthStatus ? (lang === 'bn' ? 'Hide Auth Status' : 'Hide Auth Status') : (lang === 'bn' ? 'View Auth Status' : 'View Auth Status')}
          </button>
        </div>

        {showAuthStatus && (
          <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-900">
                <span className="text-muted-foreground">{lang === 'bn' ? 'Current User' : 'Current User'}</span>
                <span className="font-medium">{state.user.name || '-'}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-900">
                <span className="text-muted-foreground">{lang === 'bn' ? 'Token' : 'Token'}</span>
                <span className={`font-medium ${state.accessToken ? 'text-green-600' : 'text-red-600'}`}>
                  {state.accessToken ? (lang === 'bn' ? 'Present' : 'Present') : (lang === 'bn' ? 'Absent' : 'Absent')}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-900">
                <span className="text-muted-foreground">{lang === 'bn' ? 'Role' : 'Role'}</span>
                <span className="font-medium capitalize">{state.user.role || '-'}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-900">
                <span className="text-muted-foreground">{lang === 'bn' ? 'Verification' : 'Verification'}</span>
                <span className="font-medium capitalize">{state.user.verificationStatus || 'n/a'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
};