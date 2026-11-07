import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { realtimeConnection } from '../context/RealtimeContext';
import * as api from '../utils/api';
import type { Consultation } from '../utils/api';

export type { Consultation, ConsultationMessage } from '../utils/api';

const sortByNewest = (list: Consultation[]) =>
  [...list].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

export const useConsultations = () => {
  const { state } = useApp();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const upsert = useCallback((consultation: Consultation) => {
    if (!consultation?.id) return;
    setConsultations((prev) => {
      const exists = prev.some((c) => c.id === consultation.id);
      return sortByNewest(exists ? prev.map((c) => (c.id === consultation.id ? consultation : c)) : [consultation, ...prev]);
    });
  }, []);

  const fetchConsultations = useCallback(async () => {
    if (!state.accessToken) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const { consultations: data } = await api.getConsultations(state.accessToken);
      setConsultations(sortByNewest(data || []));
    } catch (err: any) {
      console.error('Failed to fetch consultations:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [state.accessToken]);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  // Real-time updates: the server only sends events the current user is allowed to see.
  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const channel = state.user.role === 'farmer' ? `consultations:${state.user.id}` : 'consultations:all';

    return realtimeConnection.subscribe(channel, (data) => {
      if (data?.action === 'new' || data?.action === 'update') {
        upsert(data.consultation);
      } else if (data?.action === 'delete') {
        setConsultations((prev) => prev.filter((c) => c.id !== data.consultationId));
      }
    });
  }, [state.user.id, state.user.role, state.userMode, upsert]);

  const requireToken = () => {
    if (!state.accessToken) throw new Error('Authentication required');
    return state.accessToken;
  };

  const createConsultation = async (data: Record<string, unknown>) => {
    const { consultation } = await api.createConsultation(requireToken(), data);
    upsert(consultation);
    return consultation as Consultation;
  };

  const updateConsultation = async (id: string, data: Record<string, unknown>) => {
    const { consultation } = await api.updateConsultation(requireToken(), id, data);
    upsert(consultation);
    return consultation as Consultation;
  };

  const sendMessage = async (id: string, text: string) => {
    const { consultation } = await api.sendConsultationMessage(requireToken(), id, text);
    upsert(consultation);
    return consultation;
  };

  const rate = async (id: string, rating: number, feedback: string) => {
    const { consultation } = await api.rateConsultation(requireToken(), id, rating, feedback);
    upsert(consultation);
    return consultation;
  };

  const refresh = () => {
    setIsLoading(true);
    fetchConsultations();
  };

  return {
    consultations,
    isLoading,
    error,
    createConsultation,
    updateConsultation,
    sendMessage,
    rate,
    refresh,
  };
};
