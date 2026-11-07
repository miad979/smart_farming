import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MessageSquare, Phone, Star, Stethoscope, Clock, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useConsultations, type Consultation } from '../hooks/useConsultations';
import { ConsultationThread } from '../components/ConsultationThread';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';

const STATUS_STYLE: Record<Consultation['status'], string> = {
  pending: 'bg-orange-100 text-orange-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const statusLabel = (status: Consultation['status'], lang: 'bn' | 'en') => {
  if (status === 'pending') return lang === 'bn' ? 'অপেক্ষমাণ' : 'Waiting for expert';
  if (status === 'in-progress') return lang === 'bn' ? 'চলমান' : 'In progress';
  return lang === 'bn' ? 'সম্পন্ন' : 'Completed';
};

const RatingForm: React.FC<{ lang: 'bn' | 'en'; onSubmit: (rating: number, feedback: string) => Promise<unknown> }> = ({ lang, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!rating) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(rating, feedback);
    } catch (err: any) {
      setError(err?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{lang === 'bn' ? 'পরামর্শটি কেমন ছিল?' : 'How helpful was this advice?'}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={lang === 'bn' ? 'রেটিং' : 'Rating'}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}`}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star className={`w-6 h-6 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        maxLength={1000}
        placeholder={lang === 'bn' ? 'মতামত (ঐচ্ছিক)' : 'Feedback (optional)'}
        className="min-h-16"
      />
      <Button size="sm" onClick={submit} disabled={!rating || busy}>
        {lang === 'bn' ? 'জমা দিন' : 'Submit rating'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export const MyConsultations: React.FC = () => {
  const { state } = useApp();
  const lang = state.language;
  const [searchParams] = useSearchParams();
  const { consultations, isLoading, error, sendMessage, rate } = useConsultations();
  const [openId, setOpenId] = useState<string | null>(searchParams.get('id'));

  useEffect(() => {
    if (!openId && consultations.length > 0) setOpenId(consultations[0].id);
  }, [consultations, openId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lang === 'bn' ? 'আমার পরামর্শ' : 'My Consultations'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'bn' ? 'বিশেষজ্ঞদের উত্তর ও কথোপকথন' : 'Expert replies and conversations'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/detect">
            <Camera className="w-4 h-4 mr-2" />
            {lang === 'bn' ? 'নতুন সমস্যা শনাক্ত করুন' : 'Detect a new problem'}
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {consultations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Stethoscope className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {lang === 'bn'
                ? 'এখনো কোনো পরামর্শ নেই। রোগ শনাক্ত করে একজন বিশেষজ্ঞের সাথে যোগাযোগ করুন।'
                : 'No consultations yet. Detect a disease, then contact an expert from the results.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        consultations.map((c) => {
          const isOpen = openId === c.id;
          const expertName = c.doctorName || c.requestedDoctorName;
          return (
            <Card key={c.id} id={`consultation-${c.id}`}>
              <CardContent className="p-4 md:p-6 space-y-4">
                <button
                  type="button"
                  className="w-full text-left flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  aria-expanded={isOpen}
                >
                  <div>
                    <h2 className="font-semibold">
                      {(lang === 'bn' ? c.disease_bn : c.disease) || (lang === 'bn' ? 'সাধারণ প্রশ্ন' : 'General question')}
                      <span className="text-muted-foreground font-normal"> · {lang === 'bn' ? c.crop_bn : c.crop}</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.submittedAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                      </span>
                      <span className="flex items-center gap-1">
                        {c.mode === 'call' ? <Phone className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                        {c.mode === 'call' ? (lang === 'bn' ? 'কল অনুরোধ' : 'Call request') : (lang === 'bn' ? 'চ্যাট' : 'Chat')}
                      </span>
                      {expertName && (
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />
                          {expertName}
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge className={STATUS_STYLE[c.status] || ''}>{statusLabel(c.status, lang)}</Badge>
                </button>

                {isOpen && (
                  <div className="space-y-4">
                    {c.status === 'pending' && (
                      <p className="text-sm rounded-lg bg-orange-50 text-orange-900 p-3 dark:bg-orange-950/40 dark:text-orange-200">
                        {c.mode === 'call'
                          ? (lang === 'bn'
                            ? 'বিশেষজ্ঞ শীঘ্রই আপনার নিবন্ধিত নম্বরে কল করবেন। চাইলে নিচে বিস্তারিত লিখে রাখুন।'
                            : 'The expert will call you on your registered number. You can add details below meanwhile.')
                          : (lang === 'bn'
                            ? 'বিশেষজ্ঞ এখনো অনুরোধটি গ্রহণ করেননি। নিচে আরও তথ্য লিখে রাখতে পারেন।'
                            : 'An expert has not picked this up yet. You can add more details below.')}
                      </p>
                    )}

                    {c.doctorResponse && (
                      <div className="p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
                        <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {lang === 'bn' ? `${c.doctorName} এর পরামর্শ` : `Advice from ${c.doctorName}`}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{c.doctorResponse}</p>
                      </div>
                    )}

                    <ConsultationThread
                      messages={c.messages || []}
                      currentUserId={state.user.id}
                      lang={lang}
                      disabled={c.status === 'completed'}
                      disabledReason={lang === 'bn' ? 'এই পরামর্শটি সম্পন্ন হয়েছে।' : 'This consultation is closed.'}
                      onSend={(text) => sendMessage(c.id, text)}
                    />

                    {c.status === 'completed' && (
                      c.rating ? (
                        <p className="text-sm flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          {lang === 'bn' ? `আপনার রেটিং: ${c.rating}/5` : `Your rating: ${c.rating}/5`}
                        </p>
                      ) : (
                        <RatingForm lang={lang} onSubmit={(rating, feedback) => rate(c.id, rating, feedback)} />
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};
