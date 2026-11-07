import React, { useMemo, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useConsultations, type Consultation } from '../hooks/useConsultations';

const STATUS_LABEL: Record<Consultation['status'], { en: string; bn: string; cls: string }> = {
  pending: { en: 'Pending', bn: 'অপেক্ষমাণ', cls: 'bg-orange-100 text-orange-800' },
  'in-progress': { en: 'In progress', bn: 'চলমান', cls: 'bg-blue-100 text-blue-800' },
  completed: { en: 'Completed', bn: 'সম্পন্ন', cls: 'bg-green-100 text-green-800' },
};

/** Live consultation oversight for admins and super users (status, priority, admin note). */
export const AdminConsultationsPanel: React.FC<{ lang: 'bn' | 'en' }> = ({ lang }) => {
  const { consultations, isLoading, error, updateConsultation } = useConsultations();
  const [filter, setFilter] = useState<'all' | Consultation['status'] | 'unassigned'>('all');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => ({
    pending: consultations.filter((c) => c.status === 'pending').length,
    inProgress: consultations.filter((c) => c.status === 'in-progress').length,
    completed: consultations.filter((c) => c.status === 'completed').length,
    unassigned: consultations.filter((c) => c.status === 'pending' && !c.doctorId).length,
  }), [consultations]);

  const visible = consultations.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'unassigned') return c.status === 'pending' && !c.doctorId;
    return c.status === filter;
  });

  const apply = async (c: Consultation, updates: Record<string, unknown>) => {
    setBusyId(c.id);
    setActionError(null);
    try {
      await updateConsultation(c.id, updates);
    } catch (e: any) {
      setActionError(e?.message || (lang === 'bn' ? 'আপডেট ব্যর্থ' : 'Update failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {lang === 'bn' ? 'পরামর্শ তদারকি' : 'Consultation oversight'}
        </CardTitle>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-full sm:w-52" aria-label={lang === 'bn' ? 'ফিল্টার' : 'Filter'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === 'bn' ? 'সব' : 'All'} ({consultations.length})</SelectItem>
            <SelectItem value="unassigned">{lang === 'bn' ? 'কেউ নেননি' : 'Unassigned'} ({counts.unassigned})</SelectItem>
            <SelectItem value="pending">{STATUS_LABEL.pending[lang]} ({counts.pending})</SelectItem>
            <SelectItem value="in-progress">{STATUS_LABEL['in-progress'][lang]} ({counts.inProgress})</SelectItem>
            <SelectItem value="completed">{STATUS_LABEL.completed[lang]} ({counts.completed})</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        {(error || actionError) && <p className="text-sm text-red-600">{actionError || error}</p>}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{lang === 'bn' ? 'কোনো পরামর্শ নেই' : 'No consultations'}</p>
        ) : (
          visible.slice(0, 25).map((c) => {
            const status = STATUS_LABEL[c.status] || STATUS_LABEL.pending;
            const note = notes[c.id] ?? (c.adminNote || '');
            return (
              <div key={c.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {c.farmerName} · {(lang === 'bn' ? c.disease_bn : c.disease) || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.submittedAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                      {' · '}
                      {c.doctorName
                        ? `${lang === 'bn' ? 'বিশেষজ্ঞ' : 'Expert'}: ${c.doctorName}`
                        : c.requestedDoctorName
                          ? `${lang === 'bn' ? 'অনুরোধ' : 'Requested'}: ${c.requestedDoctorName}`
                          : (lang === 'bn' ? 'কেউ নেননি' : 'Unassigned')}
                      {' · '}
                      {(c.messages || []).length} {lang === 'bn' ? 'বার্তা' : 'messages'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.rating ? (
                      <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-current" /> {c.rating}
                      </span>
                    ) : null}
                    <Badge className={status.cls}>{status[lang]}</Badge>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={c.priority || 'medium'}
                    onValueChange={(v) => apply(c, { priority: v })}
                    disabled={busyId === c.id}
                  >
                    <SelectTrigger className="sm:w-36" aria-label={lang === 'bn' ? 'অগ্রাধিকার' : 'Priority'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">{lang === 'bn' ? 'উচ্চ' : 'High'}</SelectItem>
                      <SelectItem value="medium">{lang === 'bn' ? 'মাঝারি' : 'Medium'}</SelectItem>
                      <SelectItem value="low">{lang === 'bn' ? 'নিম্ন' : 'Low'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder={lang === 'bn' ? 'অ্যাডমিন নোট' : 'Admin note'}
                    aria-label={lang === 'bn' ? 'অ্যাডমিন নোট' : 'Admin note'}
                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === c.id || note === (c.adminNote || '')}
                    onClick={() => apply(c, { adminNote: note })}
                  >
                    {lang === 'bn' ? 'নোট সংরক্ষণ' : 'Save note'}
                  </Button>
                  {c.status === 'in-progress' && !c.doctorResponse && (
                    <Button size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => apply(c, { status: 'pending' })}>
                      {lang === 'bn' ? 'আবার খুলুন' : 'Return to queue'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
