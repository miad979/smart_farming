import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { Clock, FileCheck, AlertCircle, Upload } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  ALLOWED_DOCTOR_UPLOAD_MIME_TYPES,
  MAX_DOCTOR_UPLOAD_SIZE_BYTES,
  getCurrentUser,
  updateUser as apiUpdateUser,
  uploadDoctorDocument,
} from '../utils/api';
import { triggerSoftRefresh } from '../utils/softRefresh';

export const DoctorVerificationPending: React.FC = () => {
  const { state, updateUser } = useApp();
  const navigate = useNavigate();
  const lang = state.language;
  const isSuspended = state.user.verificationStatus === 'suspended';
  const isRejected = state.user.verificationStatus === 'rejected';
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [resubmitError, setResubmitError] = useState('');
  const [resubmitSuccess, setResubmitSuccess] = useState('');

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

  const handleResubmit = async () => {
    setResubmitError('');
    setResubmitSuccess('');

    if (!state.accessToken || !state.user.id) {
      setResubmitError(lang === 'bn' ? 'প্রথমে সাইন ইন করুন' : 'Please sign in first');
      return;
    }

    const certificateValidation = validateSelectedFile(certificateFile);
    if (!certificateValidation.ok) {
      setResubmitError(certificateValidation.message);
      return;
    }

    const resumeValidation = validateSelectedFile(resumeFile);
    if (!resumeValidation.ok) {
      setResubmitError(resumeValidation.message);
      return;
    }

    if (!certificateFile || !resumeFile) {
      setResubmitError(lang === 'bn' ? 'সার্টিফিকেট এবং রিজিউম দুটোই লাগবে' : 'Certificate and resume are required');
      return;
    }

    setIsResubmitting(true);

    try {
      const { file: certificate } = await uploadDoctorDocument(certificateFile);
      const { file: resume } = await uploadDoctorDocument(resumeFile);

      const response = await apiUpdateUser(state.accessToken, state.user.id, {
        certificateDocument: certificate.url,
        resumeDocument: resume.url,
        verificationDocuments: [certificate.url, resume.url],
        verificationStatus: 'pending',
      });

      if (response?.user) {
        updateUser(response.user);
        triggerSoftRefresh('doctor-verification', 'documents-resubmitted');
      }

      setResubmitSuccess(
        lang === 'bn'
          ? 'নতুন নথি জমা হয়েছে। অ্যাডমিন আবার পর্যালোচনা করবেন।'
          : 'Your new documents have been submitted. Admin will review them again.',
      );
      setCertificateFile(null);
      setResumeFile(null);
    } catch (e: any) {
      setResubmitError(e?.message || (lang === 'bn' ? 'পুনরায় জমা ব্যর্থ হয়েছে' : 'Resubmission failed'));
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleRefreshStatus = async () => {
    setResubmitError('');
    setResubmitSuccess('');

    if (!state.accessToken) {
      setResubmitError(lang === 'bn' ? 'প্রথমে সাইন ইন করুন' : 'Please sign in first');
      return;
    }

    setIsRefreshingStatus(true);
    try {
      const { user } = await getCurrentUser(state.accessToken);
      if (user) {
        updateUser(user);
        triggerSoftRefresh('doctor-verification', 'status-refreshed');
      }

      if (user?.verificationStatus === 'verified') {
        setResubmitSuccess(
          lang === 'bn'
            ? 'অভিনন্দন! আপনার ভেরিফিকেশন সম্পন্ন হয়েছে। ড্যাশবোর্ডে নেওয়া হচ্ছে...'
            : 'Great news! Your verification is complete. Redirecting to dashboard...',
        );
        setTimeout(() => {
          navigate('/doctor');
        }, 500);
        return;
      }

      setResubmitSuccess(
        lang === 'bn'
          ? 'স্ট্যাটাস আপডেট হয়েছে। এখনও যাচাইকরণ প্রক্রিয়াধীন।'
          : 'Status refreshed. Verification is still in progress.',
      );
    } catch (e: any) {
      setResubmitError(e?.message || (lang === 'bn' ? 'স্ট্যাটাস রিফ্রেশ করা যায়নি' : 'Could not refresh status'));
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Icon */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isRejected ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {isRejected ? (
                <AlertCircle className="w-8 h-8 text-red-600" />
              ) : (
                <Clock className="w-8 h-8 text-blue-600" />
              )}
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                {isSuspended
                  ? (lang === 'bn' ? 'আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত' : 'Your account is temporarily suspended')
                  : (isRejected ? t('verificationRejected', lang) : t('verificationPending', lang))}
              </h1>
              <p className="text-gray-600">
                {isSuspended
                  ? (lang === 'bn'
                    ? 'অ্যাডমিন সাময়িকভাবে আপনার ডাক্তার অ্যাকাউন্ট স্থগিত করেছেন। প্রয়োজনে সাপোর্টে যোগাযোগ করুন বা নথি পুনরায় জমা দিন।'
                    : 'Admin temporarily suspended your doctor account. Contact support or resubmit documents if required.')
                  : (isRejected ? t('verificationRejectedDesc', lang) : t('verificationPendingDesc', lang))}
              </p>
            </div>

            {/* Status Info */}
            {!isRejected && !isSuspended && (
              <div className="w-full bg-blue-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-blue-900">
                      {lang === 'bn' ? 'নথি জমা দেওয়া হয়েছে' : 'Documents Submitted'}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {lang === 'bn' 
                        ? 'আপনার লাইসেন্স এবং যোগ্যতার নথি পর্যালোচনাধীন'
                        : 'Your license and qualification documents are under review'}
                    </p>
                  </div>
                </div>

                {state.user.verificationDocuments && state.user.verificationDocuments.length > 0 && (
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-700">
                      {lang === 'bn' ? 'জমা দেওয়া নথি:' : 'Submitted Documents:'} {state.user.verificationDocuments.length}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full space-y-2 pt-2">
              {(isRejected || isSuspended) && (
                <div className="w-full space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
                  <p className="text-sm font-medium text-red-900">
                    {lang === 'bn' ? 'ডকুমেন্ট পুনরায় জমা দিন' : 'Resubmit documents'}
                  </p>
                  <p className="text-xs text-red-700">
                    {lang === 'bn'
                      ? 'নতুন সার্টিফিকেট এবং রিজিউম আপলোড করুন। জমার পরে স্ট্যাটাস আবার অপেক্ষমাণ হবে।'
                      : 'Upload a new certificate and resume. After submission, your status will be pending again.'}
                  </p>

                  <div className="space-y-3 rounded-lg bg-white p-3 border border-red-100">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        {lang === 'bn' ? 'সার্টিফিকেট ফাইল' : 'Certificate file'}
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      {certificateFile && <p className="mt-1 text-xs text-gray-500">{certificateFile.name}</p>}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        {lang === 'bn' ? 'রিজিউম ফাইল' : 'Resume file'}
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      {resumeFile && <p className="mt-1 text-xs text-gray-500">{resumeFile.name}</p>}
                    </div>

                    {resubmitError && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {resubmitError}
                      </div>
                    )}

                    {resubmitSuccess && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {resubmitSuccess}
                      </div>
                    )}

                    <Button className="w-full" variant="default" onClick={handleResubmit} disabled={isResubmitting}>
                      <Upload className="w-4 h-4 mr-2" />
                      {isResubmitting
                        ? (lang === 'bn' ? 'জমা হচ্ছে...' : 'Submitting...')
                        : t('resubmitDocuments', lang)}
                    </Button>
                  </div>
                </div>
              )}
              
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleRefreshStatus}
                disabled={isRefreshingStatus || isResubmitting}
              >
                {isRefreshingStatus
                  ? (lang === 'bn' ? 'রিফ্রেশ হচ্ছে...' : 'Refreshing...')
                  : (lang === 'bn' ? 'স্ট্যাটাস রিফ্রেশ করুন' : 'Refresh Status')}
              </Button>

            </div>

            {/* Support Info */}
            <div className="pt-4 border-t w-full">
              <p className="text-xs text-gray-500">
                {lang === 'bn' 
                  ? 'সাহায্যের জন্য, অ্যাডমিন সাপোর্টে যোগাযোগ করুন'
                  : 'For help, contact admin support'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
