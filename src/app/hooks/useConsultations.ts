import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { realtimeConnection } from '../context/RealtimeContext';
import * as api from '../utils/api';

interface Consultation {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  disease: string;
  disease_bn: string;
  cropType: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  doctorId?: string;
  doctorName?: string;
  response?: string;
  createdAt: Date;
  updatedAt: Date;
  images?: string[];
}

export const useConsultations = () => {
  const { state } = useApp();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch consultations
  const fetchConsultations = useCallback(async () => {
    if (!state.accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { consultations: data } = await api.getConsultations(state.accessToken);
      setConsultations(data || []);
    } catch (err: any) {
      console.error('Failed to fetch consultations:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [state.accessToken]);

  // Initial fetch
  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  // Real-time updates
  useEffect(() => {
    if (!state.user.id || state.userMode === 'guest') return;

    const channel = state.user.role === 'doctor' 
      ? 'consultations:all' 
      : `consultations:${state.user.id}`;

    const unsubscribe = realtimeConnection.subscribe(channel, (data) => {
      console.log('Real-time consultation update:', data);
      
      if (data.action === 'new') {
        // Add new consultation
        setConsultations(prev => [data.consultation, ...prev]);
      } else if (data.action === 'update') {
        // Update existing consultation
        setConsultations(prev => 
          prev.map(c => c.id === data.consultation.id ? data.consultation : c)
        );
      } else if (data.action === 'delete') {
        // Remove consultation
        setConsultations(prev => prev.filter(c => c.id !== data.consultationId));
      }
    });

    return unsubscribe;
  }, [state.user.id, state.user.role, state.userMode]);

  // Create consultation
  const createConsultation = async (data: Partial<Consultation>) => {
    if (!state.accessToken) {
      throw new Error('Authentication required');
    }

    try {
      const { consultation } = await api.createConsultation(state.accessToken, data);

      return consultation;
    } catch (err: any) {
      console.error('Failed to create consultation:', err);
      throw err;
    }
  };

  // Update consultation
  const updateConsultation = async (id: string, data: Partial<Consultation>) => {
    if (!state.accessToken) {
      throw new Error('Authentication required');
    }

    try {
      const { consultation } = await api.updateConsultation(state.accessToken, id, data);

      return consultation;
    } catch (err: any) {
      console.error('Failed to update consultation:', err);
      throw err;
    }
  };

  // Refresh data
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
    refresh,
  };
};
