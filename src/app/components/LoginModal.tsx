import React, { useState } from 'react';
import { X, Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { state, login } = useApp();
  const lang = state.language;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Clear any previous errors
    setError('');
    
    // Validate inputs
    if (!email || !email.trim()) {
      setError(lang === 'bn' ? 'ইমেল লিখুন' : 'Email is required');
      return;
    }
    
    if (!password || !password.trim()) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Password is required');
      return;
    }

    setIsLoading(true);
    
    const result = await login(email, password);
    setIsLoading(false);
    
    if (result.success) {
      onClose();
      // Reset form
      setEmail('');
      setPassword('');
      setError('');
      setShowPassword(false);
    } else {
      setError(result.error || (lang === 'bn' ? 'লগইন ব্যর্থ হয়েছে' : 'Login failed'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 p-8 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <h2 className="text-2xl font-bold mb-2">
              {lang === 'bn' ? 'স্বাগতম' : 'Welcome Back'}
            </h2>
            <p className="text-blue-100">
              {lang === 'bn' ? 'আপনার অ্যাকাউন্টে লগইন করুন' : 'Sign in to your account'}
            </p>
          </div>
        </div>

        {/* Form content */}
        <div className="p-8">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Email input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'ইমেল' : 'Email'}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={lang === 'bn' ? 'আপনার ইমেল' : 'your@email.com'}
                  className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={lang === 'bn' ? 'আপনার পাসওয়ার্ড' : 'Your password'}
                  className="w-full pl-12 pr-12 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              onClick={handleLogin}
              disabled={!email || !password || isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{lang === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              {lang === 'bn' 
                ? 'লগইন করে আপনি আমাদের শর্তাবলী এবং গোপনীয়তা নীতি মেনে নিচ্ছেন'
                : 'By signing in, you agree to our Terms and Privacy Policy'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};