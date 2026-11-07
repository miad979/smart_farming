import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { AlertCircle, ArrowLeft, FileCheck2, Lock, LockOpen } from 'lucide-react';
import { clearSignupDraft, getSignupDraft, updateSignupDraft, type SignupDraft } from '../utils/signupDraft';
import { isStrongPassword, isValidEmail, isValidPhone } from '../utils/signupValidation';
import {
  ALLOWED_DOCTOR_UPLOAD_MIME_TYPES,
  MAX_DOCTOR_UPLOAD_SIZE_BYTES,
  checkUploadedDoctorDocumentDuplicate,
  deleteUploadedDoctorDocument,
  uploadDoctorDocument,
} from '../utils/api';

type FieldErrors = Partial<Record<'specialty' | 'phone' | 'registrationNumber' | 'experienceYears' | 'certificate' | 'resume', string>>;

export const DoctorApplicationPage: React.FC = () => {
  const { state, signup } = useApp();
  const navigate = useNavigate();
  const lang = state.language;

  // Step 1 data comes from the shared sign-up draft (kept while moving between steps).
  const draft = useMemo(() => getSignupDraft(), []);
  const step1Complete = Boolean(
    draft.name.trim() && isValidEmail(draft.email) && isStrongPassword(draft.password)
    && draft.password === draft.confirmPassword && draft.termsAccepted && draft.privacyAccepted,
  );
  // After a page refresh the password is gone (never stored), everything else is still there.
  const passwordLostOnRefresh = Boolean(draft.name && draft.email && !draft.password);
  const base = step1Complete ? draft : null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState('');

  const [specialty, setSpecialtyState] = useState(draft.specialty);
  const [phone, setPhoneState] = useState(draft.doctorPhone || draft.phone || '');
  const [useSignupPhone, setUseSignupPhoneState] = useState(draft.useSignupPhone && Boolean(draft.phone));
  const [registrationNumber, setRegistrationNumberState] = useState(draft.registrationNumber);
  const [experienceYears, setExperienceYearsState] = useState(draft.experienceYears);
  const [certificateDocument, setCertificateDocumentState] = useState(draft.certificateDocument);
  const [resumeDocument, setResumeDocumentState] = useState(draft.resumeDocument);
  const [profileSummary, setProfileSummaryState] = useState(draft.profileSummary);

  // Every change is mirrored into the draft, so Back to step 1 and returning keeps it (uploads included).
  const persist = (patch: Partial<SignupDraft>) => updateSignupDraft(patch);
  const clearFieldError = (key: keyof FieldErrors) => setFieldErrors((prev) => {
    if (!prev[key]) return prev;
    const next = { ...prev };
    delete next[key];
    return next;
  });
  const setSpecialty = (v: string) => { setSpecialtyState(v); persist({ specialty: v }); clearFieldError('specialty'); };
  const setPhone = (v: string) => { setPhoneState(v); persist({ doctorPhone: v }); clearFieldError('phone'); };
  const setUseSignupPhone = (v: boolean) => { setUseSignupPhoneState(v); persist({ useSignupPhone: v }); };
  const setRegistrationNumber = (v: string) => { setRegistrationNumberState(v); persist({ registrationNumber: v }); clearFieldError('registrationNumber'); };
  const setExperienceYears = (v: string) => { setExperienceYearsState(v); persist({ experienceYears: v }); clearFieldError('experienceYears'); };
  const setProfileSummary = (v: string) => { setProfileSummaryState(v); persist({ profileSummary: v }); };
  const setCertificateDocument = (url: string, fileName = '') => {
    setCertificateDocumentState(url);
    persist({ certificateDocument: url, certificateFileName: url ? fileName : '' });
    if (url) clearFieldError('certificate');
  };
  const setResumeDocument = (url: string, fileName = '') => {
    setResumeDocumentState(url);
    persist({ resumeDocument: url, resumeFileName: url ? fileName : '' });
    if (url) clearFieldError('resume');
  };
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [certificateProgress, setCertificateProgress] = useState(0);
  const [resumeProgress, setResumeProgress] = useState(0);
  const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isRemovingCertificate, setIsRemovingCertificate] = useState(false);
  const [isRemovingResume, setIsRemovingResume] = useState(false);
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState('');
  const [resumePreviewUrl, setResumePreviewUrl] = useState('');
  const [certificateDuplicateWarning, setCertificateDuplicateWarning] = useState('');
  const [resumeDuplicateWarning, setResumeDuplicateWarning] = useState('');

  const maxFileSizeMb = Math.floor(MAX_DOCTOR_UPLOAD_SIZE_BYTES / (1024 * 1024));

  const validateSelectedFile = (file: File | null) => {
    if (!file) return { ok: true as const };

    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '' : '';
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const allowedMimes = [...ALLOWED_DOCTOR_UPLOAD_MIME_TYPES];

    if (!allowedMimes.includes(file.type as any) && !allowedExtensions.includes(extension)) {
      return {
        ok: false as const,
        message: lang === 'bn'
          ? 'শুধুমাত্র PDF, JPG, PNG ফাইল আপলোড করা যাবে'
          : 'Only PDF, JPG, and PNG files are allowed',
      };
    }

    if (file.size > MAX_DOCTOR_UPLOAD_SIZE_BYTES) {
      return {
        ok: false as const,
        message: lang === 'bn'
          ? `ফাইল সাইজ ${maxFileSizeMb}MB এর বেশি হতে পারবে না`
          : `File size must be ${maxFileSizeMb}MB or less`,
      };
    }

    return { ok: true as const };
  };

  const uploadCertificate = async (fileOverride?: File) => {
    const file = fileOverride || certificateFile;
    if (!file) return;
    if (certificateDuplicateWarning) {
      setError(certificateDuplicateWarning);
      return;
    }
    setError('');
    setIsUploadingCertificate(true);
    setCertificateProgress(0);

    try {
      const { file: uploadedFile } = await uploadDoctorDocument(file, setCertificateProgress);
      setCertificateDocument(uploadedFile.url, file.name);
    } catch (e: any) {
      setError(e?.message || (lang === 'bn' ? 'সার্টিফিকেট আপলোড ব্যর্থ হয়েছে' : 'Certificate upload failed'));
    } finally {
      setIsUploadingCertificate(false);
    }
  };

  const onCertificateChange = async (file: File | null) => {
    setError('');
    setCertificateDuplicateWarning('');
    const validation = validateSelectedFile(file);
    if (!validation.ok) {
      setCertificateFile(null);
      setCertificatePreviewUrl('');
      setError(validation.message);
      return;
    }

    setCertificateFile(file);
    if (!file || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) {
      setCertificatePreviewUrl('');
      return;
    }

    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to create preview'));
      reader.readAsDataURL(file);
    }).catch(() => '');

    setCertificatePreviewUrl(preview);

    try {
      const duplicate = await checkUploadedDoctorDocumentDuplicate(file);
      // Only a document already on ANOTHER registered account is blocked. The same file from an earlier,
      // unfinished attempt is fine: the server reuses the stored copy.
      if (duplicate.inUse) {
        setCertificateDuplicateWarning(
          lang === 'bn'
            ? 'এই সার্টিফিকেট ফাইলটি অন্য একটি নিবন্ধিত অ্যাকাউন্টে ব্যবহার করা হয়েছে। নিজের সার্টিফিকেট দিন বা অ্যাডমিনের সাথে যোগাযোগ করুন।'
            : 'This certificate is already used by another registered account. Upload your own certificate, or contact the administrator.',
        );
        return;
      }
    } catch {
      // Non-blocking: if duplicate check fails, upload flow can still proceed.
    }

    await uploadCertificate(file);
  };

  const onResumeChange = async (file: File | null) => {
    setError('');
    setResumeDuplicateWarning('');
    const validation = validateSelectedFile(file);
    if (!validation.ok) {
      setResumeFile(null);
      setResumePreviewUrl('');
      setError(validation.message);
      return;
    }

    setResumeFile(file);
    if (!file || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) {
      setResumePreviewUrl('');
      return;
    }

    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to create preview'));
      reader.readAsDataURL(file);
    }).catch(() => '');

    setResumePreviewUrl(preview);

    try {
      const duplicate = await checkUploadedDoctorDocumentDuplicate(file);
      if (duplicate.inUse) {
        setResumeDuplicateWarning(
          lang === 'bn'
            ? 'এই রিজিউম ফাইলটি অন্য একটি নিবন্ধিত অ্যাকাউন্টে ব্যবহার করা হয়েছে। নিজের রিজিউম দিন বা অ্যাডমিনের সাথে যোগাযোগ করুন।'
            : 'This resume is already used by another registered account. Upload your own resume, or contact the administrator.',
        );
        return;
      }
    } catch {
      // Non-blocking: if duplicate check fails, upload flow can still proceed.
    }

    await uploadResume(file);
  };

  const uploadResume = async (fileOverride?: File) => {
    const file = fileOverride || resumeFile;
    if (!file) return;
    if (resumeDuplicateWarning) {
      setError(resumeDuplicateWarning);
      return;
    }
    setError('');
    setIsUploadingResume(true);
    setResumeProgress(0);

    try {
      const { file: uploadedFile } = await uploadDoctorDocument(file, setResumeProgress);
      setResumeDocument(uploadedFile.url, file.name);
    } catch (e: any) {
      setError(e?.message || (lang === 'bn' ? 'রিজিউম আপলোড ব্যর্থ হয়েছে' : 'Resume upload failed'));
    } finally {
      setIsUploadingResume(false);
    }
  };

  const replaceCertificate = () => {
    setError('');
    setCertificateDocument('');
    setCertificateProgress(0);
    setCertificateFile(null);
    setCertificatePreviewUrl('');
    setCertificateDuplicateWarning('');
  };

  const removeCertificate = async () => {
    if (!certificateDocument) {
      replaceCertificate();
      return;
    }

    setError('');
    setIsRemovingCertificate(true);
    try {
      await deleteUploadedDoctorDocument(certificateDocument);
      replaceCertificate();
    } catch (e: any) {
      setError(e?.message || (lang === 'bn' ? 'সার্টিফিকেট মুছতে ব্যর্থ হয়েছে' : 'Failed to remove certificate'));
    } finally {
      setIsRemovingCertificate(false);
    }
  };

  const replaceResume = () => {
    setError('');
    setResumeDocument('');
    setResumeProgress(0);
    setResumeFile(null);
    setResumePreviewUrl('');
    setResumeDuplicateWarning('');
  };

  const removeResume = async () => {
    if (!resumeDocument) {
      replaceResume();
      return;
    }

    setError('');
    setIsRemovingResume(true);
    try {
      await deleteUploadedDoctorDocument(resumeDocument);
      replaceResume();
    } catch (e: any) {
      setError(e?.message || (lang === 'bn' ? 'রিজিউম মুছতে ব্যর্থ হয়েছে' : 'Failed to remove resume'));
    } finally {
      setIsRemovingResume(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    setAccountError(false);

    // Step 1 must be complete (normally guaranteed by step 1's own checks).
    if (!base) {
      setAccountError(true);
      setError(
        passwordLostOnRefresh
          ? (lang === 'bn' ? 'নিরাপত্তার জন্য পেজ রিফ্রেশের পরে পাসওয়ার্ড রাখা হয় না। ধাপ ১-এ পাসওয়ার্ড আবার লিখুন, বাকি তথ্য রাখা আছে।' : 'For security, your password is not kept after a page refresh. Re-enter it in step 1; everything else is kept.')
          : (lang === 'bn' ? 'প্রথমে ধাপ ১ (অ্যাকাউন্টের তথ্য) সম্পূর্ণ করুন' : 'Please complete step 1 (account details) first'),
      );
      return;
    }

    if (certificateFile && !certificateDocument && !isUploadingCertificate) {
      await uploadCertificate(certificateFile);
    }

    if (resumeFile && !resumeDocument && !isUploadingResume) {
      await uploadResume(resumeFile);
    }

    // Check every step-2 field and show what is missing next to each field.
    const effectivePhone = (useSignupPhone && base.phone ? base.phone : phone).trim();
    const errors: FieldErrors = {};
    if (!specialty.trim()) errors.specialty = lang === 'bn' ? 'বিশেষত্ব লিখুন' : 'Specialty is required';
    if (!effectivePhone) errors.phone = lang === 'bn' ? 'ফোন নম্বর লিখুন' : 'Phone number is required';
    else if (!isValidPhone(effectivePhone)) errors.phone = lang === 'bn' ? 'সঠিক ফোন নম্বর লিখুন' : 'Enter a valid phone number';
    if (!registrationNumber.trim()) errors.registrationNumber = lang === 'bn' ? 'লাইসেন্স নম্বর লিখুন' : 'License number is required';
    if (experienceYears && (!Number.isFinite(Number(experienceYears)) || Number(experienceYears) < 0 || Number(experienceYears) > 70)) {
      errors.experienceYears = lang === 'bn' ? '০ থেকে ৭০ এর মধ্যে লিখুন' : 'Enter a number from 0 to 70';
    }
    if (!certificateDocument) errors.certificate = lang === 'bn' ? 'সার্টিফিকেট আপলোড করুন' : 'Upload your certificate';
    if (!resumeDocument) errors.resume = lang === 'bn' ? 'রিজিউম আপলোড করুন' : 'Upload your resume';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(lang === 'bn' ? 'লাল চিহ্নিত ঘরগুলো পূরণ করুন' : 'Please complete the highlighted fields');
      return;
    }

    setIsSubmitting(true);
    const result = await signup({
      name: base.name.trim(),
      email: base.email.trim(),
      password: base.password,
      location: base.location.trim(),
      role: 'doctor',
      phone: effectivePhone,
      termsAccepted: base.termsAccepted,
      privacyAccepted: base.privacyAccepted,
      specialty: specialty.trim(),
      registrationNumber: registrationNumber.trim(),
      experienceYears: Number(experienceYears || 0),
      certificateDocument,
      resumeDocument,
      profileSummary: profileSummary.trim(),
    });
    setIsSubmitting(false);

    if (!result.success) {
      const message = result.error || (lang === 'bn' ? 'সাবমিট ব্যর্থ হয়েছে' : 'Submission failed');
      // Problems with the account itself (email taken, password rule) are fixed in step 1; nothing is lost.
      setAccountError(/email|password|already exists/i.test(message));
      setError(message);
      return;
    }

    clearSignupDraft();
    setSuccessMessage(
      result.message ||
        (lang === 'bn'
          ? 'আপনার ডাক্তার আবেদন জমা হয়েছে। অ্যাডমিন অনুমোদনের পর সাইন ইন করতে পারবেন।'
          : 'Your doctor application has been submitted. You can sign in after admin approval.'),
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-4 px-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-600 px-6 py-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 opacity-40" />
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative">
          <p className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            {lang === 'bn' ? 'ধাপ ২/২ · পেশাগত তথ্য ও ডকুমেন্ট' : 'Step 2 of 2 · Professional details and documents'}
          </p>
          <h1 className="text-2xl font-bold">
            {lang === 'bn' ? 'ডাক্তার যাচাইকরণ ডকুমেন্ট সাবমিশন' : 'Doctor Verification Document Submission'}
          </h1>
          <p className="text-cyan-50 mt-1 font-medium">
            {lang === 'bn' ? 'এডমিন যাচাইয়ের জন্য সব ডকুমেন্ট দিন' : 'Provide all required documents for admin verification'}
          </p>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-gradient-to-b from-slate-50 to-white">
          {!base && !successMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>
                {passwordLostOnRefresh
                  ? (lang === 'bn' ? 'নিরাপত্তার জন্য পেজ রিফ্রেশের পরে পাসওয়ার্ড রাখা হয় না। ধাপ ১-এ পাসওয়ার্ড আবার লিখুন — বাকি সব তথ্য ও ডকুমেন্ট রাখা আছে।' : 'For security, your password is not kept after a page refresh. Re-enter it in step 1 — everything else, including uploaded documents, is kept.')
                  : (lang === 'bn' ? 'প্রথমে ধাপ ১-এ আপনার অ্যাকাউন্টের তথ্য দিন।' : 'Please fill in your account details in step 1 first.')}
              </span>
              <button type="button" onClick={() => navigate('/signup')} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-white font-medium hover:bg-amber-700">
                {lang === 'bn' ? 'ধাপ ১-এ যান' : 'Go to step 1'}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </span>
              {accountError && (
                <button type="button" onClick={() => navigate('/signup')} className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-100">
                  {lang === 'bn' ? 'অ্যাকাউন্টের তথ্য সম্পাদনা (ধাপ ১)' : 'Edit account details (step 1)'}
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
              <div className="flex items-start gap-2">
                <FileCheck2 className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-semibold">{lang === 'bn' ? 'আবেদন জমা হয়েছে' : 'Application Submitted'}</p>
                  <p className="mt-1">{successMessage}</p>
                  <Link to="/profile?auth=signin" className="inline-block mt-2 text-blue-700 hover:underline font-medium">
                    {lang === 'bn' ? 'সাইন ইন পেজে যান' : 'Go to Sign In'}
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
              <label className="block text-sm font-semibold mb-1 text-emerald-950">{lang === 'bn' ? 'বিশেষজ্ঞতা' : 'Specialty'}</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: ফসল রোগ বিশেষজ্ঞ' : 'e.g. Crop Disease Specialist'}
                aria-invalid={Boolean(fieldErrors.specialty)}
                className={`w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:ring-2 ${fieldErrors.specialty ? 'border-red-400 focus:ring-red-400' : 'border-emerald-200 focus:ring-emerald-500'}`}
              />
              {fieldErrors.specialty && <p className="mt-1 text-xs text-red-600">{fieldErrors.specialty}</p>}
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-sm font-semibold text-violet-950">{lang === 'bn' ? 'ফোন নম্বর' : 'Phone Number'}</label>
                {base?.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !useSignupPhone;
                      setUseSignupPhone(next);
                      if (next) {
                        setPhone(base.phone || '');
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                  >
                    {useSignupPhone ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                    {useSignupPhone
                      ? (lang === 'bn' ? 'সাইনআপ ফোন লক' : 'Use same phone from signup')
                      : (lang === 'bn' ? 'ফোন পরিবর্তনযোগ্য' : 'Override phone')}
                  </button>
                )}
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: +8801XXXXXXXXX' : 'e.g. +8801XXXXXXXXX'}
                disabled={Boolean(base?.phone) && useSignupPhone}
                className="w-full px-4 py-3 border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {base?.phone && useSignupPhone && (
                <p className="mt-2 text-xs text-violet-700">
                  {lang === 'bn' ? 'সাইনআপে দেওয়া ফোন নম্বর ব্যবহার করা হবে। পরিবর্তন করতে লক বন্ধ করুন।' : 'Using phone from signup. Unlock to override.'}
                </p>
              )}
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm">
              <label className="block text-sm font-semibold mb-1 text-cyan-950">{lang === 'bn' ? 'লাইসেন্স নম্বর' : 'License Number'}</label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার রেজিস্ট্রেশন/লাইসেন্স নম্বর' : 'Your registration / license number'}
                aria-invalid={Boolean(fieldErrors.registrationNumber)}
                className={`w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:ring-2 ${fieldErrors.registrationNumber ? 'border-red-400 focus:ring-red-400' : 'border-cyan-200 focus:ring-cyan-500'}`}
              />
              {fieldErrors.registrationNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.registrationNumber}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm">
            <label className="block text-sm font-semibold mb-1 text-indigo-950">{lang === 'bn' ? 'অভিজ্ঞতা (বছর)' : 'Experience (Years)'}</label>
            <input
              type="number"
              min={0}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              aria-invalid={Boolean(fieldErrors.experienceYears)}
              className={`w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:ring-2 ${fieldErrors.experienceYears ? 'border-red-400 focus:ring-red-400' : 'border-indigo-200 focus:ring-indigo-500'}`}
            />
            {fieldErrors.experienceYears && <p className="mt-1 text-xs text-red-600">{fieldErrors.experienceYears}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-900">
                    {lang === 'bn' ? 'সার্টিফিকেট ডকুমেন্ট' : 'Certificate Document'}
                  </label>
                  <p className="text-xs text-slate-600 mt-1">
                    {lang === 'bn' ? `Allowed: PDF/JPG/PNG, Max ${maxFileSizeMb}MB` : `Allowed: PDF/JPG/PNG, Max ${maxFileSizeMb}MB`}
                  </p>
                </div>
                <div className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow">
                  01
                </div>
              </div>

              <input
                id="certificate-upload-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const picked = e.target.files?.[0] || null;
                  // Clear the picker so choosing the same file again (after a failure) still triggers an upload.
                  e.target.value = '';
                  void onCertificateChange(picked);
                }}
                className="sr-only"
                disabled={Boolean(certificateDocument)}
              />

              <label
                htmlFor="certificate-upload-input"
                className="mb-3 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-white/80 px-4 py-4 text-center font-semibold text-blue-700 transition hover:border-blue-500 hover:bg-blue-100"
              >
                {certificateFile
                  ? certificateFile.name
                  : certificateDocument && getSignupDraft().certificateFileName
                    ? getSignupDraft().certificateFileName
                    : (lang === 'bn' ? 'ফাইল নির্বাচন করুন' : 'Choose certificate file')}
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void uploadCertificate()}
                  disabled={!certificateFile || isUploadingCertificate || Boolean(certificateDocument) || Boolean(certificateDuplicateWarning)}
                  className="rounded-full bg-blue-600 px-4 py-2 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {isUploadingCertificate
                    ? (lang === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...')
                    : (lang === 'bn' ? 'সার্টিফিকেট আপলোড করুন' : 'Upload Certificate')}
                </button>
                {certificateDocument && (
                  <button
                    type="button"
                    onClick={replaceCertificate}
                    className="rounded-full border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    {lang === 'bn' ? 'Replace' : 'Replace'}
                  </button>
                )}
                {certificateDocument && (
                  <button
                    type="button"
                    onClick={removeCertificate}
                    disabled={isRemovingCertificate}
                    className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {isRemovingCertificate
                      ? (lang === 'bn' ? 'Removing...' : 'Removing...')
                      : (lang === 'bn' ? 'Remove' : 'Remove')}
                  </button>
                )}
              </div>

              {isUploadingCertificate && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${certificateProgress}%` }} />
                </div>
              )}

              {certificateDuplicateWarning && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {certificateDuplicateWarning}
                </div>
              )}

              {fieldErrors.certificate && !certificateDocument && (
                <p className="mt-3 text-xs font-medium text-red-600">{fieldErrors.certificate}</p>
              )}

              {certificateDocument && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <a href={certificateDocument} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 hover:underline">
                    {lang === 'bn' ? 'আপলোড সম্পন্ন, ডকুমেন্ট দেখুন' : 'Uploaded successfully, view document'}
                  </a>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-900">
                    {lang === 'bn' ? 'রিজিউম ডকুমেন্ট' : 'Resume Document'}
                  </label>
                  <p className="text-xs text-slate-600 mt-1">
                    {lang === 'bn' ? `Allowed: PDF/JPG/PNG, Max ${maxFileSizeMb}MB` : `Allowed: PDF/JPG/PNG, Max ${maxFileSizeMb}MB`}
                  </p>
                </div>
                <div className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow">
                  02
                </div>
              </div>

              <input
                id="resume-upload-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const picked = e.target.files?.[0] || null;
                  e.target.value = '';
                  void onResumeChange(picked);
                }}
                className="sr-only"
                disabled={Boolean(resumeDocument)}
              />

              <label
                htmlFor="resume-upload-input"
                className="mb-3 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-indigo-300 bg-white/80 px-4 py-4 text-center font-semibold text-indigo-700 transition hover:border-indigo-500 hover:bg-indigo-100"
              >
                {resumeFile
                  ? resumeFile.name
                  : resumeDocument && getSignupDraft().resumeFileName
                    ? getSignupDraft().resumeFileName
                    : (lang === 'bn' ? 'ফাইল নির্বাচন করুন' : 'Choose resume file')}
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void uploadResume()}
                  disabled={!resumeFile || isUploadingResume || Boolean(resumeDocument) || Boolean(resumeDuplicateWarning)}
                  className="rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isUploadingResume
                    ? (lang === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...')
                    : (lang === 'bn' ? 'রিজিউম আপলোড করুন' : 'Upload Resume')}
                </button>
                {resumeDocument && (
                  <button
                    type="button"
                    onClick={replaceResume}
                    className="rounded-full border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    {lang === 'bn' ? 'Replace' : 'Replace'}
                  </button>
                )}
                {resumeDocument && (
                  <button
                    type="button"
                    onClick={removeResume}
                    disabled={isRemovingResume}
                    className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {isRemovingResume
                      ? (lang === 'bn' ? 'Removing...' : 'Removing...')
                      : (lang === 'bn' ? 'Remove' : 'Remove')}
                  </button>
                )}
              </div>

              {isUploadingResume && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
                  <div className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 transition-all" style={{ width: `${resumeProgress}%` }} />
                </div>
              )}

              {resumeDuplicateWarning && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {resumeDuplicateWarning}
                </div>
              )}

              {fieldErrors.resume && !resumeDocument && (
                <p className="mt-3 text-xs font-medium text-red-600">{fieldErrors.resume}</p>
              )}

              {resumeDocument && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <a href={resumeDocument} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 hover:underline">
                    {lang === 'bn' ? 'আপলোড সম্পন্ন, ডকুমেন্ট দেখুন' : 'Uploaded successfully, view document'}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {lang === 'bn' ? 'প্রোফাইল সারাংশ (ঐচ্ছিক)' : 'Profile Summary (Optional)'}
            </label>
            <textarea
              value={profileSummary}
              onChange={(e) => setProfileSummary(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/signup')}
              disabled={isSubmitting || Boolean(successMessage)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              <ArrowLeft className="w-4 h-4" />
              {lang === 'bn' ? 'ধাপ ১-এ ফিরুন' : 'Back to step 1'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || Boolean(successMessage) || isUploadingCertificate || isUploadingResume}
              className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting
                ? (lang === 'bn' ? 'সাবমিট হচ্ছে...' : 'Submitting...')
                : (lang === 'bn' ? 'ডকুমেন্ট সাবমিট করুন' : 'Submit for Verification')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
