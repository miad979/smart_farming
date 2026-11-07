// Client-side copies of the server's sign-up rules (server/local-api.cjs: validateEmail,
// validatePasswordStrength) so problems are shown while typing, not after documents are uploaded.

export type Lang = 'bn' | 'en';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}

export function isValidPhone(phone: string) {
  const digits = String(phone || '').replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{7,15}$/.test(digits);
}

export type PasswordRule = { id: string; ok: boolean; label: string };

export function passwordRules(password: string, lang: Lang): PasswordRule[] {
  const pw = String(password || '');
  return [
    { id: 'length', ok: pw.length >= 10 && pw.length <= 100, label: lang === 'bn' ? 'কমপক্ষে ১০ অক্ষর' : 'At least 10 characters' },
    { id: 'lower', ok: /[a-z]/.test(pw), label: lang === 'bn' ? 'একটি ছোট হাতের অক্ষর (a-z)' : 'A lowercase letter (a-z)' },
    { id: 'upper', ok: /[A-Z]/.test(pw), label: lang === 'bn' ? 'একটি বড় হাতের অক্ষর (A-Z)' : 'An uppercase letter (A-Z)' },
    { id: 'number', ok: /[0-9]/.test(pw), label: lang === 'bn' ? 'একটি সংখ্যা (0-9)' : 'A number (0-9)' },
    { id: 'symbol', ok: /[^A-Za-z0-9]/.test(pw), label: lang === 'bn' ? 'একটি চিহ্ন (যেমন ! @ # -)' : 'A symbol (e.g. ! @ # -)' },
  ];
}

export function isStrongPassword(password: string) {
  return passwordRules(password, 'en').every((r) => r.ok);
}
