import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { AlertCircle, Mail, User, MapPin, Check, Lock, Eye, EyeOff, ArrowRight, CircleCheck, Circle } from 'lucide-react';
import { checkEmailAvailable } from '../utils/api';
import { isValidEmail, isValidPhone, passwordRules } from '../utils/signupValidation';
import { clearSignupDraft, getSignupDraft, updateSignupDraft, type SignupDraft } from '../utils/signupDraft';

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms', string>>;

export const SignupPage: React.FC = () => {
  const { state, signup } = useApp();
  const navigate = useNavigate();
  const lang = state.language;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Restored from the draft, so Back from step 2 (or a refresh) keeps what was typed.
  const [formData, setFormData] = useState<SignupDraft>(() => getSignupDraft());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isDoctor = formData.role === 'doctor';
  const rules = passwordRules(formData.password, lang);
  const passwordOk = rules.every((r) => r.ok);

  const update = (patch: Partial<SignupDraft>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    updateSignupDraft(patch);
    // Clear the error of the field being edited.
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key as keyof FieldErrors];
      if ('termsAccepted' in patch || 'privacyAccepted' in patch) delete next.terms;
      return next;
    });
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!formData.name.trim()) errors.name = lang === 'bn' ? 'নাম লিখুন' : 'Name is required';
    if (!formData.email.trim()) errors.email = lang === 'bn' ? 'ইমেল লিখুন' : 'Email is required';
    else if (!isValidEmail(formData.email)) errors.email = lang === 'bn' ? 'সঠিক ইমেল লিখুন (যেমন name@example.com)' : 'Enter a valid email (e.g. name@example.com)';
    if (!formData.phone.trim()) errors.phone = lang === 'bn' ? 'ফোন নম্বর লিখুন' : 'Phone number is required';
    else if (!isValidPhone(formData.phone)) errors.phone = lang === 'bn' ? 'সঠিক ফোন নম্বর লিখুন (যেমন +8801XXXXXXXXX)' : 'Enter a valid phone number (e.g. +8801XXXXXXXXX)';
    if (!formData.password) errors.password = lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Password is required';
    else if (!passwordOk) errors.password = lang === 'bn' ? 'পাসওয়ার্ড নিচের সব শর্ত পূরণ করেনি' : 'Password does not meet all the rules below';
    if (formData.password && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = lang === 'bn' ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match';
    }
    if (!formData.termsAccepted || !formData.privacyAccepted) {
      errors.terms = lang === 'bn' ? 'শর্তাবলী এবং প্রাইভেসি পলিসি গ্রহণ করতে হবে' : 'You must accept the Terms & Conditions and Privacy Policy';
    }
    return errors;
  };

  const handleContinueOrSignup = async () => {
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(lang === 'bn' ? 'লাল চিহ্নিত ঘরগুলো ঠিক করুন' : 'Please fix the highlighted fields');
      return;
    }

    setIsLoading(true);
    try {
      // Catch a taken email now, not after the doctor has uploaded documents.
      const check = await checkEmailAvailable(formData.email.trim());
      if (!check.available) {
        setFieldErrors({
          email: check.reason === 'taken'
            ? (lang === 'bn' ? 'এই ইমেল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে। সাইন ইন করুন বা অন্য ইমেল দিন।' : 'An account with this email already exists. Sign in or use another email.')
            : (lang === 'bn' ? 'সঠিক ইমেল লিখুন' : 'Enter a valid email'),
        });
        setError(lang === 'bn' ? 'লাল চিহ্নিত ঘরগুলো ঠিক করুন' : 'Please fix the highlighted fields');
        return;
      }
    } catch {
      // Network hiccup: do not block here, the final submit validates again.
    } finally {
      setIsLoading(false);
    }

    if (isDoctor) {
      updateSignupDraft(formData);
      navigate('/signup/doctor');
      return;
    }

    setIsLoading(true);
    const result = await signup({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
      location: formData.location.trim(),
      role: 'farmer',
      termsAccepted: formData.termsAccepted,
      privacyAccepted: formData.privacyAccepted,
    });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || (lang === 'bn' ? 'রেজিস্ট্রেশন ব্যর্থ হয়েছে' : 'Registration failed'));
      return;
    }

    clearSignupDraft();
    navigate('/');
  };

  const inputClass = (hasError?: string) =>
    `w-full rounded-lg border bg-muted py-2.5 focus:outline-none focus:ring-2 ${hasError ? 'border-red-400 focus:ring-red-400' : 'border-border focus:ring-green-500'}`;
  const FieldError: React.FC<{ msg?: string }> = ({ msg }) => (msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-900 px-8 py-8 text-white">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 translate-x-1/2 -translate-y-1/2" />
          <div className="relative">
            {isDoctor && (
              <p className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                {lang === 'bn' ? 'ধাপ ১/২ · অ্যাকাউন্টের তথ্য' : 'Step 1 of 2 · Account details'}
              </p>
            )}
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
            <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {lang === 'bn' ? 'আমি নিবন্ধন করছি *' : 'I am registering as *'}
              </label>
              <select
                value={formData.role}
                onChange={(e) => update({ role: e.target.value as 'farmer' | 'doctor' })}
                aria-label={lang === 'bn' ? 'ভূমিকা নির্বাচন' : 'Select role'}
                className="w-full rounded-lg border border-border bg-muted px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="farmer">{lang === 'bn' ? 'কৃষক' : 'Farmer'}</option>
                <option value="doctor">{lang === 'bn' ? 'কৃষি বিশেষজ্ঞ (ডাক্তার)' : 'Agricultural Expert (Doctor)'}</option>
              </select>
              {isDoctor && (
                <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                  {lang === 'bn'
                    ? 'ধাপ ২-এ আপনি বিশেষত্ব, লাইসেন্স নম্বর এবং সার্টিফিকেট/রিজিউম দেবেন। অ্যাডমিন যাচাইয়ের পরে পূর্ণ অ্যাক্সেস পাবেন।'
                    : 'In step 2 you add your specialty, license number and certificate/resume. You get full access after admin verification.'}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-name">
                {lang === 'bn' ? 'নাম *' : 'Name *'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার নাম' : 'Your name'}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`${inputClass(fieldErrors.name)} pl-10 pr-4`}
                />
              </div>
              <FieldError msg={fieldErrors.name} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-email">
                {lang === 'bn' ? 'ইমেল *' : 'Email *'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => update({ email: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার ইমেল' : 'your@email.com'}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`${inputClass(fieldErrors.email)} pl-10 pr-4`}
                />
              </div>
              <FieldError msg={fieldErrors.email} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-phone">
                {lang === 'bn' ? 'ফোন নম্বর *' : 'Phone Number *'}
              </label>
              <input
                id="signup-phone"
                type="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder={lang === 'bn' ? 'যেমন: +8801XXXXXXXXX' : 'e.g. +8801XXXXXXXXX'}
                aria-invalid={Boolean(fieldErrors.phone)}
                className={`${inputClass(fieldErrors.phone)} pl-4 pr-4`}
              />
              <FieldError msg={fieldErrors.phone} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-password">
                {lang === 'bn' ? 'পাসওয়ার্ড *' : 'Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => update({ password: e.target.value })}
                  placeholder={lang === 'bn' ? 'কমপক্ষে ১০ অক্ষর' : 'At least 10 characters'}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby="signup-password-rules"
                  className={`${inputClass(fieldErrors.password)} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide password') : (lang === 'bn' ? 'পাসওয়ার্ড দেখান' : 'Show password')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ul id="signup-password-rules" className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2" aria-live="polite">
                {rules.map((rule) => (
                  <li key={rule.id} className={`flex items-center gap-1.5 text-xs ${rule.ok ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                    {rule.ok ? <CircleCheck className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {rule.label}
                  </li>
                ))}
              </ul>
              <FieldError msg={fieldErrors.password} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-confirm-password">
                {lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'Confirm Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => update({ confirmPassword: e.target.value })}
                  placeholder={lang === 'bn' ? 'পাসওয়ার্ড পুনরায় লিখুন' : 'Re-enter password'}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  className={`${inputClass(fieldErrors.confirmPassword)} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? (lang === 'bn' ? 'নিশ্চিত পাসওয়ার্ড লুকান' : 'Hide confirm password') : (lang === 'bn' ? 'নিশ্চিত পাসওয়ার্ড দেখান' : 'Show confirm password')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.confirmPassword === formData.password && (
                <p className="mt-1 flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                  <CircleCheck className="h-3.5 w-3.5" /> {lang === 'bn' ? 'পাসওয়ার্ড মিলেছে' : 'Passwords match'}
                </p>
              )}
              <FieldError msg={fieldErrors.confirmPassword} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="signup-location">
                {lang === 'bn' ? 'অবস্থান' : 'Location'}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => update({ location: e.target.value })}
                  placeholder={lang === 'bn' ? 'আপনার এলাকা' : 'Your area'}
                  className={`${inputClass()} pl-10 pr-4`}
                />
              </div>
            </div>

            <div className={`space-y-3 rounded-lg border p-4 ${fieldErrors.terms ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 bg-slate-50 dark:border-border dark:bg-muted/40'}`}>
              <p className="text-sm font-medium">
                {lang === 'bn' ? 'শর্তাবলী ও প্রাইভেসি' : 'Terms and privacy'}
              </p>
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => update({ termsAccepted: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  {lang === 'bn' ? 'আমি প্ল্যাটফর্মের শর্তাবলী মেনে নিচ্ছি।' : 'I agree to the platform Terms and Conditions.'}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.privacyAccepted}
                  onChange={(e) => update({ privacyAccepted: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  {lang === 'bn' ? 'আমি প্রাইভেসি পলিসি মেনে আমার ডেটা ব্যবহারে সম্মত।' : 'I agree to the Privacy Policy and data usage terms.'}
                </span>
              </label>
              <FieldError msg={fieldErrors.terms} />
            </div>

            <button
              onClick={handleContinueOrSignup}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 font-medium text-white shadow-lg shadow-green-500/25 transition-all hover:from-green-700 hover:to-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>{lang === 'bn' ? 'যাচাই হচ্ছে...' : 'Checking...'}</span>
                </>
              ) : isDoctor ? (
                <>
                  <span>{lang === 'bn' ? 'পরবর্তী: ধাপ ২ (ডকুমেন্ট)' : 'Continue to step 2 (documents)'}</span>
                  <ArrowRight className="h-5 w-5" />
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
