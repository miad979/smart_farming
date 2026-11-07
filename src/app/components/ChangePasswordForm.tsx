import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { changePassword } from '../utils/api';
import { isStrongPassword } from '../utils/signupValidation';

interface ChangePasswordFormProps {
  token: string;
  lang: 'bn' | 'en';
}

// Same rules as the server (shared with sign-up via utils/signupValidation).
const passwordProblem = (pw: string, lang: 'bn' | 'en'): string | null => {
  if (isStrongPassword(pw)) return null;
  return lang === 'bn'
    ? 'কমপক্ষে ১০ অক্ষর, বড় ও ছোট হাতের অক্ষর, সংখ্যা এবং বিশেষ চিহ্ন দিন'
    : 'Use 10+ characters with upper and lower case letters, a number and a symbol';
};

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ token, lang }) => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    const problem = passwordProblem(next, lang);
    if (problem) return setError(problem);
    if (next !== confirm) return setError(lang === 'bn' ? 'নতুন পাসওয়ার্ড মিলছে না' : 'New passwords do not match');
    setBusy(true);
    setError(null);
    try {
      await changePassword(token, current, next);
      reset();
      setSuccess(true);
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন হয়নি' : 'Could not change password'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSuccess(false); reset(); }}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-all"
      >
        <span className="text-sm font-medium">{lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change password'}</span>
        <Lock className="w-4 h-4 text-muted-foreground" />
      </button>

      {success && (
        <p className="text-sm text-green-700 dark:text-green-400 px-1">
          {lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' : 'Password updated successfully'}
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-2 p-3 rounded-xl border border-border">
          <input
            type="password" autoComplete="current-password" required value={current}
            onChange={(e) => setCurrent(e.target.value)} className={inputClass}
            placeholder={lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current password'}
            aria-label={lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current password'}
          />
          <input
            type="password" autoComplete="new-password" required value={next}
            onChange={(e) => setNext(e.target.value)} className={inputClass}
            placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New password'}
            aria-label={lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New password'}
          />
          <input
            type="password" autoComplete="new-password" required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={inputClass}
            placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড আবার লিখুন' : 'Confirm new password'}
            aria-label={lang === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm new password'}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? (lang === 'bn' ? 'অপেক্ষা করুন...' : 'Saving...') : (lang === 'bn' ? 'পাসওয়ার্ড সংরক্ষণ করুন' : 'Save new password')}
          </button>
        </form>
      )}
    </div>
  );
};
