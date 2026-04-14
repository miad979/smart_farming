import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import * as api from '../utils/api';
import { 
  MessageSquare, Clock, Star, TrendingUp, CheckCircle2,
  AlertCircle, User, MapPin, Leaf, Calendar, Send,
  Eye, ThumbsUp, ThumbsDown, FileText, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { DoctorVerificationPending } from './DoctorVerificationPending';

export const DoctorDashboard: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const [selectedTab, setSelectedTab] = useState('pending');
  const [responseText, setResponseText] = useState<{ [key: string]: string }>({});
  const [isLoadingConsultations, setIsLoadingConsultations] = useState(true);
  const [consultations, setConsultations] = useState<any[]>([]);

  // Check if doctor is verified
  if (state.user.verificationStatus === 'pending' || state.user.verificationStatus === 'rejected' || state.user.verificationStatus === 'suspended') {
    return <DoctorVerificationPending />;
  }

  const refreshConsultations = async () => {
    if (!state.accessToken) return;
    try {
      setIsLoadingConsultations(true);
      const { consultations: data } = await api.getConsultations(state.accessToken);
      setConsultations(data || []);
    } catch {
      setConsultations([]);
    } finally {
      setIsLoadingConsultations(false);
    }
  };

  useEffect(() => {
    refreshConsultations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accessToken]);

  const pendingConsultations = consultations.filter(c => c.status === 'pending');
  const inProgressConsultations = consultations.filter(c => c.status === 'in-progress');
  const completedConsultations = consultations.filter(c => c.status === 'completed');

  // Memoize chart data with language-specific labels
  const weeklyConsultationsData = useMemo(() => 
    [
      { day: 'Mon', day_bn: 'সোম', count: 0 },
      { day: 'Tue', day_bn: 'মঙ্গল', count: 0 },
      { day: 'Wed', day_bn: 'বুধ', count: 0 },
      { day: 'Thu', day_bn: 'বৃহস্পতি', count: 0 },
      { day: 'Fri', day_bn: 'শুক্র', count: 0 },
      { day: 'Sat', day_bn: 'শনি', count: 0 },
      { day: 'Sun', day_bn: 'রবি', count: 0 },
    ].map(item => ({
      ...item,
      dayLabel: lang === 'bn' ? item.day_bn : item.day
    })), [lang]
  );

  const handleRespond = async (consultationId: string) => {
    if (!state.accessToken) return;
    const text = responseText[consultationId];
    if (!text) return;
    try {
      await api.updateConsultation(state.accessToken, consultationId, {
        response: text,
        status: 'completed',
        respondedAt: new Date().toISOString(),
      });
      setResponseText(prev => ({ ...prev, [consultationId]: '' }));
      refreshConsultations();
    } catch (e) {
      console.error('Failed to respond:', e);
    }
  };

  const getPriorityColor = (priority: string) => {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return lang === 'bn' ? `${diffMins} মিনিট আগে` : `${diffMins} mins ago`;
    } else if (diffHours < 24) {
      return lang === 'bn' ? `${diffHours} ঘন্টা আগে` : `${diffHours} hours ago`;
    } else {
      return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US');
    }
  };

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
        <Button variant="outline">
          <Star className="w-4 h-4 mr-2" />
          {lang === 'bn' ? 'রেটিং' : 'Rating'}: 0
        </Button>
      </div>

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
                <Badge className="mt-2 text-xs" variant="destructive">
                  {lang === 'bn' ? 'জরুরি' : 'Urgent'}
                </Badge>
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
                <p className="text-2xl font-bold mt-1">0</p>
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
                  {lang === 'bn' ? 'স্থানীয়' : 'Local'}
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
              <YAxis key="yaxis" />
              <Tooltip key="tooltip" />
              <Bar dataKey="count" fill="#3b82f6" key="bar" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Consultations Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
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

        {/* Pending Consultations */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingConsultations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                {lang === 'bn' ? 'কোনো অপেক্ষমাণ পরামর্শ নেই' : 'No pending consultations'}
              </CardContent>
            </Card>
          ) : (
            pendingConsultations.map((consultation) => (
              <Card key={consultation.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {consultation.farmerName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{consultation.farmerName}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lang === 'bn' ? consultation.location_bn : consultation.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(consultation.submittedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getPriorityColor(consultation.priority)}>
                          {t(consultation.priority as any, lang)}
                        </Badge>
                        <Badge className={getStatusColor(consultation.status)}>
                          {t(consultation.status as any, lang)}
                        </Badge>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-600">{t('crop', lang)}</p>
                        <p className="font-medium text-sm">{lang === 'bn' ? consultation.crop_bn : consultation.crop}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">{t('disease', lang)}</p>
                        <p className="font-medium text-sm">{lang === 'bn' ? consultation.disease_bn : consultation.disease}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600">{lang === 'bn' ? 'ফোন' : 'Phone'}</p>
                        <p className="font-medium text-sm">{consultation.farmerPhone}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <p className="text-xs text-gray-600 mb-1">{lang === 'bn' ? 'বিবরণ' : 'Description'}</p>
                      <p className="text-sm">{lang === 'bn' ? consultation.description : consultation.description_en}</p>
                    </div>

                    {/* Images */}
                    {consultation.images && consultation.images.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-2">{lang === 'bn' ? 'সংযুক্ত ছবি' : 'Attached Images'}</p>
                        <div className="flex gap-2">
                          {consultation.images.map((img, idx) => (
                            <div key={idx} className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Leaf className="w-8 h-8 text-gray-400" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Response Form */}
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">{lang === 'bn' ? 'আপনার পরামর্শ' : 'Your Advice'}</p>
                      <Textarea
                        placeholder={lang === 'bn' ? 'কৃষককে পরামর্শ লিখুন...' : 'Write advice for the farmer...'}
                        value={responseText[consultation.id] || ''}
                        onChange={(e) => setResponseText({ ...responseText, [consultation.id]: e.target.value })}
                        className="min-h-24 mb-3"
                      />
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1"
                          onClick={() => handleRespond(consultation.id)}
                          disabled={!responseText[consultation.id]}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {t('respond', lang)}
                        </Button>
                        <Button variant="outline">
                          <Eye className="w-4 h-4 md:mr-2" />
                          <span className="hidden md:inline">{t('viewCase', lang)}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* In Progress Consultations */}
        <TabsContent value="in-progress" className="space-y-4 mt-4">
          {inProgressConsultations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                {lang === 'bn' ? 'কোনো চলমান পরামর্শ নেই' : 'No consultations in progress'}
              </CardContent>
            </Card>
          ) : (
            inProgressConsultations.map((consultation) => (
              <Card key={consultation.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{consultation.farmerName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{consultation.farmerName}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
                            <span>{lang === 'bn' ? consultation.crop_bn : consultation.crop} - {lang === 'bn' ? consultation.disease_bn : consultation.disease}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(consultation.status)}>
                        {t(consultation.status as any, lang)}
                      </Badge>
                    </div>

                    {/* Your Response */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-800 font-medium mb-1">
                        {lang === 'bn' ? 'আপনার পরামর্শ' : 'Your Advice'}
                      </p>
                      <p className="text-sm">{lang === 'bn' ? consultation.doctorResponse : consultation.doctorResponse_en}</p>
                      <p className="text-xs text-gray-600 mt-2">
                        {t('responseTime', lang)}: {lang === 'bn' ? consultation.responseTime_bn : consultation.responseTime}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <FileText className="w-4 h-4 mr-2" />
                        {t('addAdvice', lang)}
                      </Button>
                      <Button variant="outline">
                        {lang === 'bn' ? 'সম্পন্ন চিহ্নিত করুন' : 'Mark Complete'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Completed Consultations */}
        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedConsultations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                {lang === 'bn' ? 'কোনো সম্পন্ন পরামর্শ নেই' : 'No completed consultations'}
              </CardContent>
            </Card>
          ) : (
            completedConsultations.map((consultation) => (
              <Card key={consultation.id}>
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{consultation.farmerName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{consultation.farmerName}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
                            <span>{lang === 'bn' ? consultation.crop_bn : consultation.crop} - {lang === 'bn' ? consultation.disease_bn : consultation.disease}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {consultation.rating && (
                          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                            <Star className="w-3 h-3 fill-current" />
                            {consultation.rating}
                          </div>
                        )}
                        <Badge className={getStatusColor(consultation.status)}>
                          {t(consultation.status as any, lang)}
                        </Badge>
                      </div>
                    </div>

                    {/* Response */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 font-medium mb-1">
                        {lang === 'bn' ? 'আপনার পরামর্শ' : 'Your Advice'}
                      </p>
                      <p className="text-sm">{lang === 'bn' ? consultation.doctorResponse : consultation.doctorResponse_en}</p>
                    </div>

                    {/* Feedback */}
                    {consultation.feedback && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs text-green-800 font-medium mb-1">
                          {lang === 'bn' ? 'কৃষকের প্রতিক্রিয়া' : 'Farmer Feedback'}
                        </p>
                        <p className="text-sm">{lang === 'bn' ? consultation.feedback : consultation.feedback_en}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{formatDate(consultation.submittedAt)}</span>
                      <span>{t('responseTime', lang)}: {lang === 'bn' ? consultation.responseTime_bn : consultation.responseTime}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Disease Reviews Section (not implemented in local mode) */}
    </div>
  );
};