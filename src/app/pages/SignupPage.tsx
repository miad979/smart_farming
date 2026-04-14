import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { AlertCircle, Mail, User, MapPin, Briefcase, FileText, Check, Lock, Eye, EyeOff } from 'lucide-react';

type BaseSignupData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  location: string;
  role: 'farmer' | 'doctor';
  specialty: string;
  registrationNumber: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export const SignupPage: React.FC = () => {
  const { state, signup } = useApp();
  const navigate = useNavigate();
  const lang = state.language;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<BaseSignupData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    location: '',
    role: 'farmer',
    specialty: '',
    registrationNumber: '',
    termsAccepted: false,
    privacyAccepted: false,
  });

  const validateBasic = () => {
    if (!formData.name.trim()) {
      setError(lang === 'bn' ? 'নাম লিখুন' : 'Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError(lang === 'bn' ? 'ইমেল লিখুন' : 'Email is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError(lang === 'bn' ? 'ফোন নম্বর লিখুন' : 'Phone number is required');
      return false;
    }
    if (!formData.password.trim()) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match');
      return false;
    }
    if (!formData.termsAccepted || !formData.privacyAccepted) {
      setError(lang === 'bn' ? 'শর্তাবলী এবং প্রাইভেসি পলিসি গ্রহণ করতে হবে' : 'You must accept Terms & Conditions and Privacy Policy');
      return false;
    }
    return true;
  };

  const handleContinueOrSignup = async () => {
    setError('');
    if (!validateBasic()) return;

    if (formData.role === 'doctor') {
      navigate('/signup/doctor', { state: formData });
      return;
    }

    setIsLoading(true);
    const { confirmPassword, ...payload } = formData;
    const result = await signup(payload);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || (lang === 'bn' ? 'রেজিস্ট্রেশন ব্যর্থ হয়েছে' : 'Registration failed'));
      return;
    }

    navigate('/');
  };

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-900 px-8 py-8 text-white">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 translate-x-1/2 -translate-y-1/2" />
          <div className="relative">
            <h1 className="text-2xl font-bold mb-2">
              {lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Create Account'}
            </h1>
            <p className="text-green-100">
              {lang === 'bn' ? 'আপনার তথ্য দিয়ে নিবন্ধন করুন' : 'Register with your information'}
            </p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'নাম *' : 'Name *'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার নাম' : 'Your name'}
                  className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'ইমেল *' : 'Email *'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার ইমেল' : 'your@email.com'}
                  className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'ফোন নম্বর *' : 'Phone Number *'}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={lang === 'bn' ? 'যেমন: +8801XXXXXXXXX' : 'e.g. +8801XXXXXXXXX'}
                  className="w-full rounded-lg border border-border bg-muted py-2.5 pl-4 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'পাসওয়ার্ড *' : 'Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={lang === 'bn' ? 'কমপক্ষে ৬ অক্ষর' : 'At least 6 characters'}
                  className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'Confirm Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder={lang === 'bn' ? 'পাসওয়ার্ড পুনরায় লিখুন' : 'Re-enter password'}
                  className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'ভূমিকা *' : 'Role *'}
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'farmer' | 'doctor' })}
                className="w-full rounded-lg border border-border bg-muted px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="farmer">{lang === 'bn' ? 'কৃষক' : 'Farmer'}</option>
                <option value="doctor">{lang === 'bn' ? 'কৃষি বিশেষজ্ঞ' : 'Agricultural Expert'}</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'অবস্থান' : 'Location'}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার এলাকা' : 'Your area'}
                  className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {formData.role === 'doctor' && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {lang === 'bn' ? 'বিশেষত্ব *' : 'Specialty *'}
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      placeholder={lang === 'bn' ? 'যেমন: ফসল রোগ বিশেষজ্ঞ' : 'e.g., Crop Disease Specialist'}
                      className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {lang === 'bn' ? 'নিবন্ধন নম্বর *' : 'Registration Number *'}
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      placeholder={lang === 'bn' ? 'আপনার নিবন্ধন নম্বর' : 'Your registration number'}
                      className="w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    {lang === 'bn'
                      ? 'ডাক্তাররা অ্যাডমিন দ্বারা যাচাইকরণের পরে সম্পূর্ণ অ্যাক্সেস পাবেন'
                      : 'Doctors will get full access after verification by admin'}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium">
                {lang === 'bn' ? 'শর্তাবলী ও প্রাইভেসি' : 'Terms and privacy'}
              </p>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  {lang === 'bn'
                    ? 'আমি প্ল্যাটফর্মের শর্তাবলী মেনে নিচ্ছি।'
                    : 'I agree to the platform Terms and Conditions.'}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.privacyAccepted}
                  onChange={(e) => setFormData({ ...formData, privacyAccepted: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  {lang === 'bn'
                    ? 'আমি প্রাইভেসি পলিসি মেনে আমার ডেটা ব্যবহারে সম্মত।'
                    : 'I agree to the Privacy Policy and data usage terms.'}
                </span>
              </label>
            </div>

            <button
              onClick={handleContinueOrSignup}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 font-medium text-white shadow-lg shadow-green-500/25 transition-all hover:from-green-700 hover:to-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>{lang === 'bn' ? 'নিবন্ধন হচ্ছে...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{lang === 'bn' ? 'নিবন্ধন করুন' : 'Create Account'}</span>
                  <Check className="h-5 w-5" />
                </>
              )}
            </button>

            <div className="pt-4 border-t text-center text-sm text-gray-600">
              <span>{lang === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already have an account?'}</span>{' '}
              <Link to="/profile?auth=signin" className="font-medium text-blue-600 hover:underline">
                {lang === 'bn' ? 'সাইন ইন' : 'Sign In'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
