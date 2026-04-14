import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import * as api from '../utils/api';
import { 
  CheckCircle2, XCircle, Eye, FileText, Award, 
  Calendar, Phone, Mail, MapPin, Briefcase, AlertCircle 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export const AdminDoctorVerification: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const [selectedTab, setSelectedTab] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [auditNotes, setAuditNotes] = useState<Record<string, string>>({});

  const pendingDoctors = useMemo(() => doctors.filter(d => d.verificationStatus === 'pending'), [doctors]);
  const verifiedDoctors = useMemo(() => doctors.filter(d => d.verificationStatus === 'verified'), [doctors]);
  const rejectedDoctors = useMemo(() => doctors.filter(d => d.verificationStatus === 'rejected'), [doctors]);
  const suspendedDoctors = useMemo(() => doctors.filter(d => d.verificationStatus === 'suspended'), [doctors]);

  const refresh = async () => {
    if (!state.accessToken) return;
    try {
      setError(null);
      setIsLoading(true);
      const { users } = await api.getAllUsers(state.accessToken);
      const allDoctors = (users || []).filter((u: any) => u.role === 'doctor');
      setDoctors(allDoctors);
    } catch (e: any) {
      setError(e?.message || 'Failed to load doctors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accessToken]);

  const handleVerify = async (doctorId: string) => {
    if (!state.accessToken) return;
    try {
      await api.verifyDoctor(state.accessToken, doctorId, 'verified');
      toast.success(lang === 'bn' ? 'ডাক্তার যাচাই করা হয়েছে' : 'Doctor verified successfully');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || (lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Failed'));
    }
  };

  const handleReject = async (doctorId: string) => {
    if (!state.accessToken) return;
    try {
      const reason = (auditNotes[doctorId] || '').trim();
      if (!reason) {
        toast.error(lang === 'bn' ? 'রিজেক্ট করার জন্য অডিট নোট বাধ্যতামূলক' : 'Audit note is required to reject');
        return;
      }
      await api.verifyDoctor(state.accessToken, doctorId, 'rejected', reason || undefined);
      toast.error(lang === 'bn' ? 'ডাক্তার প্রত্যাখ্যাত হয়েছে' : 'Doctor rejected');
      setAuditNotes((prev) => ({ ...prev, [doctorId]: '' }));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || (lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Failed'));
    }
  };

  const handleSuspend = async (doctorId: string) => {
    if (!state.accessToken) return;
    try {
      const reason = (auditNotes[doctorId] || '').trim();
      if (!reason) {
        toast.error(lang === 'bn' ? 'সাসপেন্ড করার জন্য অডিট নোট বাধ্যতামূলক' : 'Audit note is required to suspend');
        return;
      }
      await api.verifyDoctor(state.accessToken, doctorId, 'suspended', reason || undefined);
      toast.warning(lang === 'bn' ? 'ডাক্তার সাময়িকভাবে স্থগিত করা হয়েছে' : 'Doctor temporarily suspended');
      setAuditNotes((prev) => ({ ...prev, [doctorId]: '' }));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || (lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Failed'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'pending': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'suspended': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      default: return 'bg-muted text-muted-foreground border border-border/60';
    }
  };

  const renderDoctorCard = (doctor: any) => (
    <Card key={doctor.id}>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Doctor Info */}
          <div className="flex items-start gap-3 flex-1">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {doctor.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-3">
              {/* Name & Status */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg">{doctor.name}</h3>
                  <Badge className={getStatusColor(doctor.verificationStatus)}>
                    {t(doctor.verificationStatus, lang)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{doctor.specialty || '—'}</p>
              </div>

              {/* Details Grid (local backend fields) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'বিশেষত্ব' : 'Specialty'}: {doctor.specialty || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Award className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'রেজিস্ট্রেশন' : 'Registration'}: {doctor.registrationNumber || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{doctor.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{doctor.location || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {lang === 'bn' ? 'তৈরি:' : 'Created:'}{' '}
                    {doctor.createdAt ? new Date(doctor.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{doctor.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'অভিজ্ঞতা (বছর)' : 'Experience (Years)'}: {doctor.experienceYears ?? 0}</span>
                </div>
              </div>

              {/* Documents for verification */}
              <div className="space-y-2 text-sm border border-border/60 rounded-lg p-3 bg-background/70">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <FileText className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'জমা দেওয়া ডকুমেন্ট' : 'Submitted Documents'}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{lang === 'bn' ? 'সার্টিফিকেট' : 'Certificate'}:</span>
                  {doctor.certificateDocument ? (
                    <a
                      href={doctor.certificateDocument}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      {lang === 'bn' ? 'দেখুন' : 'Open'}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{lang === 'bn' ? 'রিজিউম' : 'Resume'}:</span>
                  {doctor.resumeDocument ? (
                    <a
                      href={doctor.resumeDocument}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      {lang === 'bn' ? 'দেখুন' : 'Open'}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                {doctor.profileSummary && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{lang === 'bn' ? 'প্রোফাইল' : 'Profile'}:</span> {doctor.profileSummary}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {lang === 'bn' ? 'অডিট নোট (সাসপেন্ড/রিজেক্টের কারণ)' : 'Audit note (reason for suspend/reject)'}
                </label>
                <Input
                  value={auditNotes[doctor.id] || ''}
                  onChange={(event) => setAuditNotes((prev) => ({ ...prev, [doctor.id]: event.target.value }))}
                  placeholder={lang === 'bn' ? 'সংক্ষিপ্ত কারণ লিখুন' : 'Write a short reason'}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex md:flex-col gap-2 md:w-36">
            {doctor.verificationStatus !== 'verified' && (
              <Button
                className="flex-1"
                variant="default"
                onClick={() => handleVerify(doctor.id)}
              >
                <CheckCircle2 className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t('approve', lang)}</span>
              </Button>
            )}
            {doctor.verificationStatus !== 'rejected' && (
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => handleReject(doctor.id)}
              >
                <XCircle className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t('reject', lang)}</span>
              </Button>
            )}
            {doctor.verificationStatus !== 'suspended' && (
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => handleSuspend(doctor.id)}
              >
                <AlertCircle className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{lang === 'bn' ? 'স্থগিত' : 'Suspend'}</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('doctorVerification', lang)}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'bn' 
            ? 'ডাক্তারদের যোগ্যতা এবং লাইসেন্স যাচাই করুন'
            : 'Verify doctor qualifications and licenses'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('pendingDoctors', lang)}</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">{pendingDoctors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('verifiedDoctors', lang)}</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{verifiedDoctors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('rejectedDoctors', lang)}</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{rejectedDoctors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{lang === 'bn' ? 'স্থগিত ডাক্তার' : 'Suspended Doctors'}</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{suspendedDoctors.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="pending" className="relative">
            {t('pending', lang)}
            {pendingDoctors.length > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0 h-5 min-w-5">
                {pendingDoctors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verified">
            {t('verified', lang)}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            {t('rejected', lang)}
          </TabsTrigger>
          <TabsTrigger value="suspended">
            {lang === 'bn' ? 'স্থগিত' : 'Suspended'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {error}
              </CardContent>
            </Card>
          ) : pendingDoctors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {lang === 'bn' ? 'কোন অপেক্ষমাণ ডাক্তার নেই' : 'No pending doctors'}
              </CardContent>
            </Card>
          ) : (
            pendingDoctors.map(renderDoctorCard)
          )}
        </TabsContent>

        <TabsContent value="verified" className="space-y-4 mt-4">
          {verifiedDoctors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {lang === 'bn' ? 'কোন যাচাইকৃত ডাক্তার নেই' : 'No verified doctors'}
              </CardContent>
            </Card>
          ) : (
            verifiedDoctors.map(renderDoctorCard)
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4 mt-4">
          {rejectedDoctors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {lang === 'bn' ? 'কোন প্রত্যাখ্যাত ডাক্তার নেই' : 'No rejected doctors'}
              </CardContent>
            </Card>
          ) : (
            rejectedDoctors.map(renderDoctorCard)
          )}
        </TabsContent>

        <TabsContent value="suspended" className="space-y-4 mt-4">
          {suspendedDoctors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {lang === 'bn' ? 'কোন স্থগিত ডাক্তার নেই' : 'No suspended doctors'}
              </CardContent>
            </Card>
          ) : (
            suspendedDoctors.map(renderDoctorCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
