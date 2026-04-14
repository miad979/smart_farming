import React, { useState } from 'react';
import { X, Mail, User, MapPin, Briefcase, FileText, ArrowRight, Check, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignupModal: React.FC<SignupModalProps> = ({ isOpen, onClose }) => {
  const { state, signup } = useApp();
  const lang = state.language;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'farmer' as 'farmer' | 'doctor' | 'admin',
    location: '',
    specialty: '',
    registrationNumber: '',
  });

  const handleSignup = async () => {
    // Clear previous errors
    setError('');
    
    // Validate inputs
    if (!formData.name || !formData.name.trim()) {
      setError(lang === 'bn' ? 'নাম লিখুন' : 'Name is required');
      return;
    }
    
    if (!formData.email || !formData.email.trim()) {
      setError(lang === 'bn' ? 'ইমেল লিখুন' : 'Email is required');
      return;
    }
    
    if (!formData.password || !formData.password.trim()) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Password is required');
      return;
    }

    if (formData.password.length < 6) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
      return;
    }
    
    if (!formData.confirmPassword || !formData.confirmPassword.trim()) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm password is required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match');
      return;
    }

    if (formData.role === 'doctor' && (!formData.specialty || !formData.registrationNumber)) {
      setError(lang === 'bn' ? 'ডাক্তারের তথ্য পূরণ করুন' : 'Fill doctor information');
      return;
    }

    setIsLoading(true);
    
    // Remove confirmPassword before sending to backend
    const { confirmPassword, ...signupData } = formData;
    const result = await signup(signupData);
    setIsLoading(false);
    
    if (result.success) {
      onClose();
      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        role: 'farmer',
        location: '',
        specialty: '',
        registrationNumber: '',
      });
      setError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    } else {
      setError(result.error || (lang === 'bn' ? 'রেজিস্ট্রেশন ব্যর্থ হয়েছে' : 'Registration failed'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-900 p-8 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <h2 className="text-2xl font-bold mb-2">
              {lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Create Account'}
            </h2>
            <p className="text-green-100">
              {lang === 'bn' ? 'আপনার তথ্য দিয়ে নিবন্ধন করুন' : 'Register with your information'}
            </p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'নাম *' : 'Name *'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার নাম' : 'Your name'}
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'ইমেল *' : 'Email *'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার ইমেল' : 'your@email.com'}
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'পাসওয়ার্ড *' : 'Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={lang === 'bn' ? 'কমপক্ষে ৬ অক্ষর' : 'At least 6 characters'}
                  className="w-full pl-10 pr-10 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'Confirm Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder={lang === 'bn' ? 'পাসওয়ার্ড পুনরায় লিখুন' : 'Re-enter password'}
                  className="w-full pl-10 pr-10 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'ভূমিকা *' : 'Role *'}
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="farmer">{lang === 'bn' ? 'কৃষক' : 'Farmer'}</option>
                <option value="doctor">{lang === 'bn' ? 'কৃষি বিশেষজ্ঞ' : 'Agricultural Expert'}</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'bn' ? 'অবস্থান' : 'Location'}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার এলাকা' : 'Your area'}
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Doctor-specific fields */}
            {formData.role === 'doctor' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {lang === 'bn' ? 'বিশেষত্ব *' : 'Specialty *'}
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      placeholder={lang === 'bn' ? 'যেমন: ফসল রোগ বিশেষজ্ঞ' : 'e.g., Crop Disease Specialist'}
                      className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {lang === 'bn' ? 'নিবন্ধন নম্বর *' : 'Registration Number *'}
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      placeholder={lang === 'bn' ? 'আপনার নিবন্ধন নম্বর' : 'Your registration number'}
                      className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    {lang === 'bn' 
                      ? 'ডাক্তাররা অ্যাডমিন দ্বারা যাচাইকরণের পরে সম্পূর্ণ অ্যাক্সেস পাবেন'
                      : 'Doctors will get full access after verification by admin'
                    }
                  </p>
                </div>
              </>
            )}

            {/* Submit button */}
            <button
              onClick={handleSignup}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{lang === 'bn' ? 'নিবন্ধন হচ্ছে...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{lang === 'bn' ? 'নিবন্ধন করুন' : 'Create Account'}</span>
                  <Check className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};