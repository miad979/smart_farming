import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import {
  MessageSquare, Clock, Star, CheckCircle2,
  AlertCircle, User, MapPin, Calendar, Send, Phone, Hand,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { DoctorVerificationPending } from './DoctorVerificationPending';
import { ConsultationThread } from '../components/ConsultationThread';
import { useConsultations, type Consultation } from '../hooks/useConsultations';

const WEEKDAYS = [
  { day: 'Sun', day_bn: 'রবি' },
  { day: 'Mon', day_bn: 'সোম' },
  { day: 'Tue', day_bn: 'মঙ্গল' },
  { day: 'Wed', day_bn: 'বুধ' },
  { day: 'Thu', day_bn: 'বৃহস্পতি' },
  { day: 'Fri', day_bn: 'শুক্র' },
  { day: 'Sat', day_bn: 'শনি' },
];

const isSameDay = (iso: string | undefined, ref: Date) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
};

export const DoctorDashboard: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const [selectedTab, setSelectedTab] = useState('pending');
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { consultations, isLoading, updateConsultation, sendMessage } = useConsultations();

  const pendingConsultations = consultations.filter((c) => c.status === 'pending');
  const inProgressConsultations = consultations.filter((c) => c.status === 'in-progress');
  const completedConsultations = consultations.filter((c) => c.status === 'completed');

  const stats = useMemo(() => {
    const today = new Date();
    const respondedToday = consultations.filter((c) => c.doctorId === state.user.id && isSameDay(c.respondedAt, today)).length;
    const rated = consultations.filter((c) => typeof c.rating === 'number');
    const avgRating = rated.length ? rated.reduce((sum, c) => sum + (c.rating || 0), 0) / rated.length : 0;
    const responded = consultations.filter((c) => c.respondedAt);
    const avgResponseMins = responded.length
      ? Math.round(
        responded.reduce((sum, c) => sum + (new Date(c.respondedAt!).getTime() - new Date(c.submittedAt).getTime()), 0)
        / responded.length / 60000,
      )
      : null;
    return { respondedToday, avgRating, avgResponseMins };
  }, [consultations, state.user.id]);

  // Consultations received over the last 7 days, oldest first.
  const weeklyConsultationsData = useMemo(() => {
    const days: { key: string; dayLabel: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const label = WEEKDAYS[d.getDay()];
      days.push({
        key: d.toDateString(),
        dayLabel: lang === 'bn' ? label.day_bn : label.day,
        count: consultations.filter((c) => isSameDay(c.submittedAt, d)).length,
      });
    }
    return days;
  }, [consultations, lang]);

  // Must come after all hooks so hook order stays stable when verification status changes.
  if (state.user.verificationStatus === 'pending' || state.user.verificationStatus === 'rejected' || state.user.verificationStatus === 'suspended') {
    return <DoctorVerificationPending />;
  }

  const runAction = async (consultationId: string, action: () => Promise<unknown>) => {
    setBusyId(consultationId);
    setActionError(null);
    try {
      await action();
    } catch (e: any) {
      setActionError(e?.message || (lang === 'bn' ? 'কাজটি সম্পন্ন হয়নি' : 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = (c: Consultation) =>
    runAction(c.id, async () => {
      await updateConsultation(c.id, { status: 'in-progress' });
      setSelectedTab('in-progress');
    });

  const handleRespond = (c: Consultation, complete: boolean) => {
    const text = (responseText[c.id] || '').trim();
    if (!text && !(complete && c.doctorResponse)) return;
    return runAction(c.id, async () => {
      await updateConsultation(c.id, {
        ...(text ? { response: text } : {}),
        status: complete ? 'completed' : 'in-progress',
      });
      setResponseText((prev) => ({ ...prev, [c.id]: '' }));
      setSelectedTab(complete ? 'completed' : 'in-progress');
    });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const statusText = (status: string) => {
    if (status === 'pending') return t('pending', lang);
    if (status === 'in-progress') return t('inProgress', lang);
    return t('completed', lang);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    if (diffMins < 60) return lang === 'bn' ? `${diffMins} মিনিট আগে` : `${diffMins} mins ago`;
    if (diffHours < 24) return lang === 'bn' ? `${diffHours} ঘন্টা আগে` : `${diffHours} hours ago`;
    return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US');
  };

  const renderHeader = (c: Consultation) => (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="flex items-start gap-3">
        <Avatar>
          <AvatarFallback>{(c.farmerName || '?').charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">{c.farmerName}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {lang === 'bn' ? c.location_bn : c.location}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(c.submittedAt)}
            </span>
            <span className="flex items-center gap-1">
              {c.mode === 'call' ? <Phone className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
              {c.mode === 'call' ? (lang === 'bn' ? 'কলব্যাক চান' : 'Wants a call') : (lang === 'bn' ? 'চ্যাট' : 'Chat')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.requestedDoctorId === state.user.id && c.status === 'pending' && (
          <Badge variant="outline">{lang === 'bn' ? 'আপনাকে অনুরোধ' : 'Requested you'}</Badge>
        )}
        <Badge className={getPriorityColor(c.priority)}>{t((c.priority || 'medium') as any, lang)}</Badge>
        <Badge className={getStatusColor(c.status)}>{statusText(c.status)}</Badge>
      </div>
    </div>
  );

  const renderCaseDetails = (c: Consultation) => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-muted/40 rounded-lg">
        <div>
          <p className="text-xs text-gray-600">{t('crop', lang)}</p>
          <p className="font-medium text-sm">{lang === 'bn' ? c.crop_bn : c.crop}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">{t('disease', lang)}</p>
          <p className="font-medium text-sm">{lang === 'bn' ? c.disease_bn : c.disease}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-600">{lang === 'bn' ? 'ফোন' : 'Phone'}</p>
          <p className="font-medium text-sm">{c.farmerPhone || '—'}</p>
        </div>
      </div>

      {(c.description || c.description_en) && (
        <div>
          <p className="text-xs text-gray-600 mb-1">{lang === 'bn' ? 'বিবরণ' : 'Description'}</p>
          <p className="text-sm">{lang === 'bn' ? c.description : c.description_en}</p>
        </div>
      )}

      {c.images && c.images.length > 0 && (
        <div>
          <p className="text-xs text-gray-600 mb-2">{lang === 'bn' ? 'সংযুক্ত ছবি' : 'Attached Images'}</p>
          <div className="flex flex-wrap gap-2">
            {c.images.map((img, idx) => (
              <a key={idx} href={img} target="_blank" rel="noreferrer">
                <img
                  src={img}
                  alt={lang === 'bn' ? `ফসলের ছবি ${idx + 1}` : `Crop photo ${idx + 1}`}
                  className="w-24 h-24 object-cover rounded-lg border"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderCallButton = (c: Consultation) => (
    <Button
      variant="secondary"
      className="flex-1 min-w-[120px]"
      disabled={!c.farmerPhone || c.farmerPhone.includes('@')}
      onClick={() => window.open(`tel:${c.farmerPhone}`)}
    >
      <User className="w-4 h-4 mr-2" />
      {lang === 'bn' ? 'কল করুন' : 'Call User'}
    </Button>
  );

  const renderEmpty = (text: string) => (
    <Card>
      <CardContent className="p-8 text-center text-gray-500">{isLoading ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...') : text}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('doctorPanel', lang)}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {lang === 'bn' ? 'কৃষকদের পরামর্শ এবং সহায়তা' : 'Farmer consultations and support'}
          </p>
        </div>
        <Button variant="outline" tabIndex={-1}>
          <Star className="w-4 h-4 mr-2" />
          {lang === 'bn' ? 'রেটিং' : 'Rating'}: {stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
        </Button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{actionError}</div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-600">{t('totalConsultations', lang)}</p>
                <p className="text-2xl font-bold mt-1">{consultations.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-600">{t('pendingQueries', lang)}</p>
                <p className="text-2xl font-bold mt-1">{pendingConsultations.length}</p>
                {pendingConsultations.length > 0 && (
                  <Badge className="mt-2 text-xs" variant="destructive">
                    {lang === 'bn' ? 'জরুরি' : 'Urgent'}
                  </Badge>
                )}
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-600">{lang === 'bn' ? 'আজ উত্তর দেওয়া হয়েছে' : 'Responded Today'}</p>
                <p className="text-2xl font-bold mt-1">{stats.respondedToday}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-600">{t('responseTime', lang)}</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.avgResponseMins === null ? '—' : `${stats.avgResponseMins}${lang === 'bn' ? ' মি.' : 'm'}`}
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Consultations Chart */}
      <Card key={`weekly-consultations-card-${lang}`}>
        <CardHeader>
          <CardTitle className="text-base">
            {lang === 'bn' ? 'সাপ্তাহিক পরামর্শ' : 'Weekly Consultations'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyConsultationsData}>
              <CartesianGrid strokeDasharray="3 3" key="grid" />
              <XAxis dataKey="dayLabel" key="xaxis" />
              <YAxis key="yaxis" allowDecimals={false} />
              <Tooltip key="tooltip" />
              <Bar dataKey="count" fill="#3b82f6" key="bar" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Consultations Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:grid-cols-3">
          <TabsTrigger value="pending" className="relative">
            {t('pending', lang)}
            {pendingConsultations.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center" variant="destructive">
                {pendingConsultations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            {t('inProgress', lang)}
            {inProgressConsultations.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                {inProgressConsultations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t('completed', lang)}
          </TabsTrigger>
        </TabsList>

        {/* Pending Consultations: accept, or answer directly */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingConsultations.length === 0
            ? renderEmpty(lang === 'bn' ? 'কোনো অপেক্ষমাণ পরামর্শ নেই' : 'No pending consultations')
            : pendingConsultations.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    {renderHeader(c)}
                    {renderCaseDetails(c)}

                    {c.messages && c.messages.length > 0 && (
                      <ConsultationThread
                        messages={c.messages}
                        currentUserId={state.user.id}
                        lang={lang}
                        disabled
                        onSend={async () => undefined}
                      />
                    )}

                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">{lang === 'bn' ? 'আপনার পরামর্শ' : 'Your Advice'}</p>
                      <Textarea
                        placeholder={lang === 'bn' ? 'কৃষককে পরামর্শ লিখুন...' : 'Write advice for the farmer...'}
                        value={responseText[c.id] || ''}
                        onChange={(e) => setResponseText({ ...responseText, [c.id]: e.target.value })}
                        maxLength={2000}
                        className="min-h-24 mb-3"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="flex-1 min-w-[120px]"
                          onClick={() => handleRespond(c, true)}
                          disabled={!responseText[c.id]?.trim() || busyId === c.id}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {lang === 'bn' ? 'উত্তর দিন ও সম্পন্ন করুন' : 'Respond & complete'}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 min-w-[120px]"
                          onClick={() => handleAccept(c)}
                          disabled={busyId === c.id}
                        >
                          <Hand className="w-4 h-4 mr-2" />
                          {lang === 'bn' ? 'গ্রহণ করে চ্যাট করুন' : 'Accept & chat'}
                        </Button>
                        {renderCallButton(c)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        {/* In Progress: live chat with the farmer, then complete */}
        <TabsContent value="in-progress" className="space-y-4 mt-4">
          {inProgressConsultations.length === 0
            ? renderEmpty(lang === 'bn' ? 'কোনো চলমান পরামর্শ নেই' : 'No consultations in progress')
            : inProgressConsultations.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    {renderHeader(c)}
                    {renderCaseDetails(c)}

                    {c.doctorResponse && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">
                          {lang === 'bn' ? 'আপনার পরামর্শ' : 'Your Advice'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{c.doctorResponse}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium mb-2">{lang === 'bn' ? 'কৃষকের সাথে চ্যাট' : 'Chat with farmer'}</p>
                      <ConsultationThread
                        messages={c.messages || []}
                        currentUserId={state.user.id}
                        lang={lang}
                        onSend={(text) => sendMessage(c.id, text)}
                      />
                    </div>

                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">{t('addAdvice', lang)}</p>
                      <Textarea
                        placeholder={lang === 'bn' ? 'চূড়ান্ত পরামর্শ / চিকিৎসা...' : 'Final advice / treatment plan...'}
                        value={responseText[c.id] || ''}
                        onChange={(e) => setResponseText({ ...responseText, [c.id]: e.target.value })}
                        maxLength={2000}
                        className="min-h-20 mb-3"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 min-w-[120px]"
                          onClick={() => handleRespond(c, false)}
                          disabled={!responseText[c.id]?.trim() || busyId === c.id}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {lang === 'bn' ? 'পরামর্শ পাঠান' : 'Send advice'}
                        </Button>
                        <Button
                          className="flex-1 min-w-[120px]"
                          onClick={() => handleRespond(c, true)}
                          disabled={busyId === c.id || (!responseText[c.id]?.trim() && !c.doctorResponse)}
                          title={!c.doctorResponse ? (lang === 'bn' ? 'আগে পরামর্শ লিখুন' : 'Write advice first') : undefined}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {lang === 'bn' ? 'সম্পন্ন চিহ্নিত করুন' : 'Mark Complete'}
                        </Button>
                        {renderCallButton(c)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        {/* Completed Consultations */}
        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedConsultations.length === 0
            ? renderEmpty(lang === 'bn' ? 'কোনো সম্পন্ন পরামর্শ নেই' : 'No completed consultations')
            : completedConsultations.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{(c.farmerName || '?').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{c.farmerName}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
                            <span>{lang === 'bn' ? c.crop_bn : c.crop} - {lang === 'bn' ? c.disease_bn : c.disease}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.rating ? (
                          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                            <Star className="w-3 h-3 fill-current" />
                            {c.rating}
                          </div>
                        ) : null}
                        <Badge className={getStatusColor(c.status)}>{statusText(c.status)}</Badge>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-muted/40 rounded-lg">
                      <p className="text-xs text-gray-600 font-medium mb-1">
                        {lang === 'bn' ? 'আপনার পরামর্শ' : 'Your Advice'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{c.doctorResponse}</p>
                    </div>

                    {c.feedback && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200">
                        <p className="text-xs text-green-800 dark:text-green-300 font-medium mb-1">
                          {lang === 'bn' ? 'কৃষকের প্রতিক্রিয়া' : 'Farmer Feedback'}
                        </p>
                        <p className="text-sm">{c.feedback}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{formatDate(c.submittedAt)}</span>
                      {c.responseTime && (
                        <span>{t('responseTime', lang)}: {lang === 'bn' ? c.responseTime_bn : c.responseTime}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
