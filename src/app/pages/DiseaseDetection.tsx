import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { realtimeConnection, useRealtime } from '../context/RealtimeContext';
import { t } from '../utils/translations';
import { VoicePlayer } from '../components/VoicePlayer';
import { createConsultation, detectCropDisease, getAssistantChatHistory, getAvailableExperts, getDiseaseHistory, saveDiseaseRecord, sendAssistantChatMessage, updateDiseaseRecord, type AssistantChatMessage, type AvailableExpert, type CropDiseaseDetectionResult } from '../utils/api';
import { useNavigate } from 'react-router';
import { jsPDF } from 'jspdf';
import {
  Camera,
  Upload,
  Share2,
  Save,
  MessageCircle,
  CheckCircle,
  Star,
  Phone,
  AlertCircle,
  Loader2,
  History,
  RefreshCw,
  UploadCloud,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  FileText,
} from 'lucide-react';

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
  time: string;
};

type LastConsultation = {
  id: string;
  expertName: string;
  mode: 'chat' | 'call';
};

type DiseaseHistoryItem = {
  id: string;
  disease: string;
  disease_bn?: string;
  confidence: number;
  chat_id?: string;
  crop?: string;
  crop_bn?: string;
  image_url?: string;
  advisory_en?: string;
  advisory_bn?: string;
  treatment_en?: string;
  treatment_bn?: string;
  prevention_en?: string;
  prevention_bn?: string;
  detectedAt: string;
  treatmentOutcome?: 'improved' | 'no-change' | 'worse' | 'unknown';
  treatmentNote?: string;
  updatedAt?: string;
};

type OutcomeDraft = {
  outcome: 'improved' | 'no-change' | 'worse' | 'unknown';
  note: string;
};

export const DiseaseDetection: React.FC = () => {
  const { state } = useApp();
  const { isConnected } = useRealtime();
  const navigate = useNavigate();
  const lang = state.language;
  const [voiceAutoRead, setVoiceAutoRead] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showExperts, setShowExperts] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [detectionProvider, setDetectionProvider] = useState<string | null>(null);
  const [detectionWarning, setDetectionWarning] = useState<string | null>(null);
  const [consultingExpertId, setConsultingExpertId] = useState<string | null>(null);
  const [lastConsultation, setLastConsultation] = useState<LastConsultation | null>(null);
  const [cropName, setCropName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [result, setResult] = useState<CropDiseaseDetectionResult | null>(null);
  const [historyItems, setHistoryItems] = useState<DiseaseHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [compareBaseline, setCompareBaseline] = useState<DiseaseHistoryItem | null>(null);
  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, OutcomeDraft>>({});
  const [savingOutcomeId, setSavingOutcomeId] = useState<string | null>(null);
  const [experts, setExperts] = useState<AvailableExpert[]>([]);
  const [isExpertsLoading, setIsExpertsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: lang === 'bn' ? 'আপনি কীভাবে সাহায্য করতে পারি?' : 'How can I help you?', time: '10:30 AM' },
  ]);
  const [chatProvider, setChatProvider] = useState<string | null>(null);
  const [activeDetectionChatId, setActiveDetectionChatId] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const resultSectionRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const maxImageSizeMb = 10;

  const chatSessionId = useMemo(() => {
    if (!activeDetectionChatId) return '';
    return `disease-scan-chat:${activeDetectionChatId}`;
  }, [activeDetectionChatId]);

  const isChatLive = Boolean(chatSessionId && isConnected);

  const analytics = useMemo(() => {
    if (!historyItems.length) {
      return {
        total: 0,
        averageConfidence: 0,
        topDiseases: [] as Array<{ name: string; count: number }>,
        recentConfidence: [] as number[],
        improvedCount: 0,
        noteCount: 0,
      };
    }

    const countMap = new Map<string, number>();
    for (const item of historyItems) {
      const key = lang === 'bn' ? item.disease_bn || item.disease : item.disease;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const sortedTop = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const recent = [...historyItems]
      .slice(0, 8)
      .reverse()
      .map((h) => Number(h.confidence || 0));

    const avg = historyItems.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / historyItems.length;
    const improvedCount = historyItems.filter((h) => h.treatmentOutcome === 'improved').length;
    const noteCount = historyItems.filter((h) => (h.treatmentNote || '').trim().length > 0).length;

    return {
      total: historyItems.length,
      averageConfidence: Number(avg.toFixed(1)),
      topDiseases: sortedTop,
      recentConfidence: recent,
      improvedCount,
      noteCount,
    };
  }, [historyItems, lang]);

  const confidenceTrend = useMemo(() => {
    const points = analytics.recentConfidence;
    if (!points.length) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 140;
    const height = 40;
    const step = points.length > 1 ? width / (points.length - 1) : 0;

    return points
      .map((value, idx) => {
        const x = idx * step;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [analytics.recentConfidence]);

  const buildCsv = () => {
    const header = [
      'id',
      'disease',
      'confidence',
      'crop',
      'detectedAt',
      'treatmentOutcome',
      'treatmentNote',
    ];

    const rows = historyItems.map((item) => [
      item.id,
      item.disease,
      String(item.confidence ?? ''),
      item.crop || '',
      item.detectedAt,
      item.treatmentOutcome || 'unknown',
      (item.treatmentNote || '').replace(/\r?\n/g, ' '),
    ]);

    const escaped = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? '');
            const safe = value.replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(','),
      )
      .join('\n');

    return escaped;
  };

  const exportHistoryCsv = () => {
    if (!historyItems.length) {
      setDetectionError(lang === 'bn' ? 'এক্সপোর্ট করার জন্য কোনো হিস্ট্রি নেই' : 'No history available to export');
      return;
    }

    const csv = buildCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `disease-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatusMessage(lang === 'bn' ? 'CSV এক্সপোর্ট সম্পন্ন হয়েছে' : 'CSV export completed');
  };

  const exportAnalyticsPdf = () => {
    if (!historyItems.length) {
      setDetectionError(lang === 'bn' ? 'এক্সপোর্ট করার জন্য কোনো হিস্ট্রি নেই' : 'No history available to export');
      return;
    }

    const doc = new jsPDF();
    let y = 12;

    doc.setFontSize(16);
    doc.text('Disease Analytics & History Report', 10, y);
    y += 8;

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 10, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Total scans: ${analytics.total}`, 10, y);
    y += 6;
    doc.text(`Average confidence: ${analytics.averageConfidence}%`, 10, y);
    y += 6;
    doc.text(`Improved cases: ${analytics.improvedCount}`, 10, y);
    y += 6;
    doc.text(`Success notes count: ${analytics.noteCount}`, 10, y);
    y += 8;

    if (analytics.topDiseases.length) {
      doc.text('Top diseases:', 10, y);
      y += 6;
      for (const top of analytics.topDiseases) {
        doc.text(`- ${top.name}: ${top.count}`, 14, y);
        y += 5;
      }
      y += 2;
    }

    doc.text('History entries:', 10, y);
    y += 6;

    for (const item of historyItems.slice(0, 25)) {
      if (y > 276) {
        doc.addPage();
        y = 12;
      }

      const line = `${item.disease} | ${item.confidence}% | ${new Date(item.detectedAt).toLocaleDateString()} | ${item.treatmentOutcome || 'unknown'}`;
      doc.text(line, 10, y);
      y += 5;

      const note = (item.treatmentNote || '').trim();
      if (note) {
        const wrapped = doc.splitTextToSize(`Note: ${note}`, 180);
        for (const part of wrapped.slice(0, 2)) {
          if (y > 276) {
            doc.addPage();
            y = 12;
          }
          doc.text(part, 14, y);
          y += 5;
        }
      }
      y += 1;
    }

    doc.save(`disease-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
    setStatusMessage(lang === 'bn' ? 'PDF এক্সপোর্ট সম্পন্ন হয়েছে' : 'PDF export completed');
  };

  const loadHistory = async () => {
    if (!state.accessToken || state.userMode === 'guest') return;

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const { records } = await getDiseaseHistory(state.accessToken);
      setHistoryItems((records || []) as DiseaseHistoryItem[]);
    } catch (error: any) {
      setHistoryError(error?.message || (lang === 'bn' ? 'ইতিহাস লোড করা যায়নি' : 'Could not load history'));
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accessToken, state.userMode]);

  useEffect(() => {
    const nextDrafts: Record<string, OutcomeDraft> = {};
    for (const item of historyItems) {
      nextDrafts[item.id] = {
        outcome: item.treatmentOutcome || 'unknown',
        note: item.treatmentNote || '',
      };
    }
    setOutcomeDrafts(nextDrafts);
  }, [historyItems]);

  useEffect(() => {
    let mounted = true;
    const loadExperts = async () => {
      setIsExpertsLoading(true);
      try {
        const { experts: data } = await getAvailableExperts();
        if (!mounted) return;
        setExperts(data || []);
      } catch {
        if (!mounted) return;
        setExperts([]);
      } finally {
        if (mounted) setIsExpertsLoading(false);
      }
    };

    loadExperts();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!chatSessionId) return;

    let mounted = true;
    const loadChatHistory = async () => {
      setIsChatLoading(true);
      try {
        const { chat } = await getAssistantChatHistory(chatSessionId);
        if (!mounted) return;

        const assistantMessages = (chat?.messages || []).filter((message) => message.role === 'assistant');
        const lastAssistantMessage = assistantMessages[assistantMessages.length - 1] as (AssistantChatMessage & { provider?: string }) | undefined;
        setChatProvider(lastAssistantMessage?.provider || null);

        if (chat?.messages?.length) {
          setChatMessages(chat.messages.map((message) => ({
            role: message.role,
            text: message.text,
            time: message.time,
          })));
        } else {
          setChatProvider(null);
          setChatMessages([
            {
              role: 'assistant',
              text: lang === 'bn' ? 'আপনি কীভাবে সাহায্য করতে পারি?' : 'How can I help you?',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setIsChatLoading(false);
      }
    };

    loadChatHistory();
    return () => {
      mounted = false;
    };
  }, [chatSessionId, lang]);

  useEffect(() => {
    if (!chatSessionId) return;

    const unsubscribe = realtimeConnection.subscribe(`assistant-chat:${chatSessionId}`, (payload) => {
      if (payload?.action !== 'update' || !payload.chat?.messages) return;

      if (typeof payload.provider === 'string') {
        setChatProvider(payload.provider);
      }

      setChatMessages(
        payload.chat.messages.map((message: AssistantChatMessage) => ({
          role: message.role,
          text: message.text,
          time: message.time,
        })),
      );
    });

    return unsubscribe;
  }, [chatSessionId]);

  useEffect(() => {
    if (chatSessionId) return;
    setChatProvider(null);
    setChatMessages([
      {
        role: 'assistant',
        text: lang === 'bn' ? 'আপনি কীভাবে সাহায্য করতে পারি?' : 'How can I help you?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [chatSessionId, lang]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => {
      resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [result]);

  const quickReplies = [
    { bn: 'আজ কি করতে হবে?', en: 'What to do today?' },
    { bn: 'প্রতিরোধের উপায়', en: 'Prevention' },
    { bn: 'কীটনাশক ডোজ', en: 'Pesticide dosage' },
    { bn: 'বিশেষজ্ঞের প্রয়োজন', en: 'Need expert' },
  ];

  const getChatProviderLabel = (provider: string | null) => {
    if (!provider) return '';
    if (provider === 'fallback') return lang === 'bn' ? 'লোকাল' : 'Local';
    return provider.toUpperCase();
  };

  const buildLocalAssistantFallback = (inputText: string) => {
    const text = String(inputText || '').toLowerCase();

    if (text.includes('dose') || text.includes('ডোজ')) {
      return lang === 'bn'
        ? 'ডোজের ক্ষেত্রে পণ্যের লেবেল অনুসরণ করুন এবং মাঠ বিশেষজ্ঞের সাথে মিলিয়ে নিন।'
        : 'For dosage, follow the product label and confirm with a field expert.';
    }

    if (text.includes('prevent') || text.includes('প্রতিরোধ')) {
      return lang === 'bn'
        ? `প্রতিরোধের পরামর্শ: ${result?.prevention_bn || 'নিয়মিত পর্যবেক্ষণ করুন এবং আক্রান্ত অংশ সরান।'}`
        : `Prevention advice: ${result?.prevention_en || 'Monitor regularly and remove infected parts early.'}`;
    }

    if (text.includes('fertilizer') || text.includes('সার') || text.includes('fertiliser')) {
      return lang === 'bn'
        ? 'রোগের সময় ভারসাম্যপূর্ণ NPK ও জৈব সার দিন, অতিরিক্ত নাইট্রোজেন এড়িয়ে চলুন। মাটির অবস্থান অনুযায়ী ডোজ ঠিক করুন।'
        : 'During disease stress, apply balanced NPK and organic inputs while avoiding excess nitrogen. Adjust dosage by soil condition.';
    }

    return lang === 'bn'
      ? `প্রাথমিক পরামর্শ: ${result?.advisory_bn || 'প্রথমে রোগ শনাক্ত করুন, তারপর নির্দিষ্ট পরামর্শ পাবেন।'}`
      : `Initial guidance: ${result?.advisory_en || 'Please detect disease first for specific advice.'}`;
  };

  const sendChatText = (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    if (!chatSessionId) {
      setDetectionError(lang === 'bn' ? 'চ্যাট শুরু করতে আগে স্ক্যান করুন' : 'Please detect first to start chat');
      return;
    }

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      {
        role: 'assistant',
        text: lang === 'bn' ? 'লিখছি...' : 'Typing...',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    sendAssistantChatMessage({
      chatId: chatSessionId,
      message: trimmed,
      language: lang,
      imageBase64: previewImage || result?.image_ref,
      disease: result?.disease,
      disease_bn: result?.disease,
      advisory_en: result?.advisory_en,
      advisory_bn: result?.advisory_bn,
      treatment_en: result?.treatment_en,
      treatment_bn: result?.treatment_bn,
      prevention_en: result?.prevention_en,
      prevention_bn: result?.prevention_bn,
    })
      .then(({ chat, provider, reason }) => {
        setChatProvider(provider || null);
        setChatMessages(
          chat.messages.map((message) => ({
            role: message.role,
            text: message.text,
            time: message.time,
          })),
        );

        if (provider === 'fallback') {
          setStatusMessage(
            lang === 'bn'
              ? `Fallback উত্তর ব্যবহার হয়েছে${reason ? `: ${reason}` : ''}`
              : `Fallback reply used${reason ? `: ${reason}` : ''}`,
          );
        } else {
          setStatusMessage(null);
        }
      })
      .catch((error) => {
        setDetectionError(error?.message || (lang === 'bn' ? 'চ্যাট পাঠানো যায়নি' : 'Could not send chat message'));
        setStatusMessage(lang === 'bn' ? 'AI সেবা সাময়িকভাবে পাওয়া যাচ্ছে না, আবার চেষ্টা করুন' : 'AI service is temporarily unavailable, please retry');
        setChatProvider(null);
        setChatMessages((prev) => {
          const withoutTyping = prev.filter((message) => message.text !== (lang === 'bn' ? 'লিখছি...' : 'Typing...'));
          return [
            ...withoutTyping,
            {
              role: 'assistant',
              text: lang === 'bn' ? 'দুঃখিত, এই মুহূর্তে AI থেকে উত্তর আনতে পারিনি। একটু পরে আবার চেষ্টা করুন।' : 'Sorry, I could not fetch a live AI reply right now. Please try again shortly.',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
        });
      });
  };

  const handleQuickReply = (reply: string) => {
    sendChatText(reply);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const runDetection = async (file: File) => {
    setIsDetecting(true);
    setDetectionError(null);
    setStatusMessage(null);
    setDetectionWarning(null);

    try {
      const base64Image = await fileToBase64(file);
      const { result: detected, provider, warning } = await detectCropDisease(
        {
          imageBase64: base64Image,
          crop: cropName || undefined,
          language: lang,
        },
        state.accessToken || undefined,
      );

      setPreviewImage(base64Image);
      setResult(detected);
      setDetectionProvider(provider || null);
      setDetectionWarning(warning || null);
      setChatProvider(null);
      setActiveDetectionChatId(`scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    } catch (error: any) {
      const message = error?.message || (lang === 'bn' ? 'রোগ শনাক্ত করা যায়নি' : 'Failed to detect disease');
      setDetectionError(message);
    } finally {
      setIsDetecting(false);
    }
  };

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '' : '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      setDetectionError(lang === 'bn' ? 'শুধুমাত্র JPG, PNG, WEBP, HEIC ছবি আপলোড করুন' : 'Please upload JPG, PNG, WEBP, or HEIC image only');
      event.target.value = '';
      return;
    }

    if (file.size > maxImageSizeMb * 1024 * 1024) {
      setDetectionError(lang === 'bn' ? `ছবির সাইজ ${maxImageSizeMb}MB এর বেশি হতে পারবে না` : `Image size must be less than ${maxImageSizeMb}MB`);
      event.target.value = '';
      return;
    }

    await runDetection(file);
    event.target.value = '';
  };

  const handleFileDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const fakeEvent = {
      target: { files: [file], value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await onFileChosen(fakeEvent);
  };

  const setOutcomeDraft = (id: string, patch: Partial<OutcomeDraft>) => {
    setOutcomeDrafts((prev) => ({
      ...prev,
      [id]: {
        outcome: prev[id]?.outcome || 'unknown',
        note: prev[id]?.note || '',
        ...patch,
      },
    }));
  };

  const saveOutcomeNote = async (id: string) => {
    if (!state.accessToken) {
      setDetectionError(lang === 'bn' ? 'ফলাফল আপডেট করতে লগইন করুন' : 'Please log in to update treatment notes');
      return;
    }

    const draft = outcomeDrafts[id];
    if (!draft) return;

    setSavingOutcomeId(id);
    setDetectionError(null);
    setStatusMessage(null);

    try {
      await updateDiseaseRecord(state.accessToken, id, {
        treatmentOutcome: draft.outcome,
        treatmentNote: draft.note,
      });
      setStatusMessage(lang === 'bn' ? 'ট্রিটমেন্ট নোট সংরক্ষণ হয়েছে' : 'Treatment note saved');
      await loadHistory();
    } catch (error: any) {
      setDetectionError(error?.message || (lang === 'bn' ? 'ট্রিটমেন্ট নোট সংরক্ষণ ব্যর্থ' : 'Failed to save treatment note'));
    } finally {
      setSavingOutcomeId(null);
    }
  };

  const resetScan = () => {
    setResult(null);
    setPreviewImage(null);
    setDetectionError(null);
    setStatusMessage(null);
    setDetectionProvider(null);
    setDetectionWarning(null);
    setChatProvider(null);
    setActiveDetectionChatId('');
  };

  const renderMlSetupCard = () => (
    <div className="mt-6 p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 space-y-2">
      <p className="font-semibold text-sm">
        {lang === 'bn' ? 'রিয়েল এমএল ডিটেকশন সেটআপ' : 'Real ML Detection Setup'}
      </p>
      <p className="text-xs">
        {detectionProvider === 'plant.id'
          ? (lang === 'bn' ? 'বর্তমানে রিয়েল Plant.id API ব্যবহার হচ্ছে।' : 'Real Plant.id API is currently active.')
          : (lang === 'bn' ? 'বর্তমানে ফallback ফলাফল আসছে। রিয়েল এমএল চালু করতে নিচের ধাপগুলো করুন।' : 'Fallback results are currently used. Follow these steps to enable real ML inference.')}
      </p>
      {detectionWarning && (
        <p className="text-xs text-amber-800">{detectionWarning}</p>
      )}
      <ol className="list-decimal list-inside text-xs space-y-1">
        <li>{lang === 'bn' ? 'Plant.id থেকে API key সংগ্রহ করুন।' : 'Get an API key from Plant.id.'}</li>
        <li>{lang === 'bn' ? 'টার্মিনালে environment variable সেট করুন: setx PLANT_ID_API_KEY "YOUR_KEY"' : 'Set environment variable in terminal: setx PLANT_ID_API_KEY "YOUR_KEY"'}</li>
        <li>{lang === 'bn' ? 'VS Code/terminal পুনরায় চালু করুন যাতে নতুন env লোড হয়।' : 'Restart VS Code/terminal so the new env is loaded.'}</li>
        <li>{lang === 'bn' ? 'অ্যাপ আবার চালান এবং নতুন স্ক্যান দিন।' : 'Run the app again and perform a new scan.'}</li>
      </ol>
      <p className="text-[11px] text-amber-800">
        {lang === 'bn'
          ? 'নোট: backend ইতিমধ্যেই /diseases/detect এ Plant.id কল করে। key না থাকলে local fallback দেয়।'
          : 'Note: backend already calls Plant.id at /diseases/detect. It uses local fallback only when key is missing/unavailable.'}
      </p>
    </div>
  );

  const handleSaveResult = async () => {
    if (!result) return;
    setIsSaving(true);
    setDetectionError(null);

    try {
      const { record } = await saveDiseaseRecord(
        {
          disease: result.disease,
          disease_bn: result.disease,
          confidence: result.confidence,
          image_url: previewImage,
          advisory_en: result.advisory_en,
          advisory_bn: result.advisory_bn,
          treatment_en: result.treatment_en,
          treatment_bn: result.treatment_bn,
          prevention_en: result.prevention_en,
          prevention_bn: result.prevention_bn,
          crop: cropName || undefined,
          crop_bn: cropName || undefined,
          chat_id: activeDetectionChatId || undefined,
        },
        state.accessToken || undefined,
      );
      if (record?.chat_id) {
        setActiveDetectionChatId(record.chat_id);
      }
      setStatusMessage(lang === 'bn' ? 'ফলাফল সফলভাবে সংরক্ষণ করা হয়েছে' : 'Result saved successfully');
      loadHistory();
    } catch (error: any) {
      setDetectionError(error?.message || (lang === 'bn' ? 'ফলাফল সংরক্ষণ করা যায়নি' : 'Could not save result'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareResult = async () => {
    if (!result) return;
    const shareText = `${result.disease} (${result.confidence}% confidence)`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: lang === 'bn' ? 'ফসলের রোগ শনাক্তকরণ' : 'Crop Disease Detection',
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setStatusMessage(lang === 'bn' ? 'ফলাফল কপি করা হয়েছে' : 'Result copied to clipboard');
    } catch {
      setDetectionError(lang === 'bn' ? 'শেয়ার করা যায়নি' : 'Sharing failed');
    }
  };

  const handleSendChat = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');
    sendChatText(trimmed);
  };

  const requestExpertConsultation = async (expert: any, mode: 'chat' | 'call') => {
    if (!result) {
      setDetectionError(lang === 'bn' ? 'আগে রোগ শনাক্ত করুন' : 'Please detect disease first');
      return;
    }

    if (!state.accessToken || state.userMode === 'guest') {
      setDetectionError(lang === 'bn' ? 'বিশেষজ্ঞের সাথে যোগাযোগ করতে লগইন করুন' : 'Please log in to contact experts');
      return;
    }

    setConsultingExpertId(expert.id);
    setDetectionError(null);
    setStatusMessage(null);
    setLastConsultation(null);

    try {
      const { consultation } = await createConsultation(state.accessToken, {
        crop: cropName || 'General Crop',
        crop_bn: cropName || 'সাধারণ ফসল',
        disease: result.disease,
        disease_bn: result.disease,
        description: mode === 'chat'
          ? `Need chat consultation with ${expert.name} for ${result.disease}.`
          : `Need call consultation with ${expert.name} for ${result.disease}.`,
        description_en: mode === 'chat'
          ? `Need chat consultation with ${expert.name} for ${result.disease}.`
          : `Need call consultation with ${expert.name} for ${result.disease}.`,
        priority: 'medium',
        images: previewImage ? [previewImage] : [],
      });

      if (consultation?.id) {
        setLastConsultation({
          id: consultation.id,
          expertName: lang === 'bn' ? expert.name_bn : expert.name,
          mode,
        });
      }

      setStatusMessage(
        mode === 'chat'
          ? (lang === 'bn' ? `${expert.name_bn} এর জন্য চ্যাট পরামর্শ অনুরোধ পাঠানো হয়েছে` : `Chat consultation request sent for ${expert.name}`)
          : (lang === 'bn' ? `${expert.name_bn} এর জন্য কল পরামর্শ অনুরোধ পাঠানো হয়েছে` : `Call consultation request sent for ${expert.name}`),
      );

      setShowChat(true);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: mode === 'chat'
            ? (lang === 'bn' ? `${expert.name_bn} এর সাথে চ্যাট অনুরোধ সফল হয়েছে।` : `Chat request with ${expert.name} submitted successfully.`)
            : (lang === 'bn' ? `${expert.name_bn} এর সাথে কল অনুরোধ সফল হয়েছে।` : `Call request with ${expert.name} submitted successfully.`),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (mode === 'call') {
        window.location.href = 'tel:+8801700000000';
      }
    } catch (error: any) {
      setDetectionError(error?.message || (lang === 'bn' ? 'পরামর্শ অনুরোধ পাঠানো যায়নি' : 'Could not send consultation request'));
    } finally {
      setConsultingExpertId(null);
    }
  };

  const applyHistoryRecord = (item: DiseaseHistoryItem) => {
    setPreviewImage(item.image_url || null);
    setResult({
      disease: item.disease,
      confidence: item.confidence,
      advisory_en: item.advisory_en || '',
      advisory_bn: item.advisory_bn || '',
      treatment_en: item.treatment_en || '',
      treatment_bn: item.treatment_bn || '',
      prevention_en: item.prevention_en || '',
      prevention_bn: item.prevention_bn || '',
      image_ref: item.image_url,
    });
    setActiveDetectionChatId(item.chat_id || `history-${item.id}`);
    setShowHistory(false);
    setStatusMessage(lang === 'bn' ? 'পূর্বের রিপোর্ট লোড করা হয়েছে' : 'Previous report loaded');
  };

  const fullReportTextBn = result
    ? `সম্ভাব্য রোগ: ${result.disease}. নিশ্চিততা ${result.confidence} শতাংশ. পরামর্শ: ${result.advisory_bn || ''}. চিকিৎসা: ${result.treatment_bn || ''}. প্রতিরোধ: ${result.prevention_bn || ''}.`
    : '';

  const fullReportTextEn = result
    ? `Possible disease: ${result.disease}. Confidence ${result.confidence} percent. Advisory: ${result.advisory_en || ''}. Treatment: ${result.treatment_en || ''}. Prevention: ${result.prevention_en || ''}.`
    : '';

  const useDemoReport = () => {
    setResult({
      disease: lang === 'bn' ? 'পাতার দাগ (ডেমো)' : 'Leaf Spot (Demo)',
      confidence: 84,
      advisory_en: 'Early-stage leaf spot symptoms observed. Keep canopy dry and improve airflow.',
      advisory_bn: 'প্রাথমিক পাতার দাগের লক্ষণ দেখা যাচ্ছে। খেত শুকনো রাখুন ও বাতাস চলাচল বাড়ান।',
      treatment_en: 'Apply a suitable fungicide according to label dose; repeat in 7-10 days if needed.',
      treatment_bn: 'লেবেল অনুযায়ী উপযুক্ত ফাঙ্গিসাইড দিন; প্রয়োজন হলে ৭-১০ দিন পর পুনরায় স্প্রে করুন।',
      prevention_en: 'Avoid water splash, remove infected leaves, and monitor the field every 2-3 days.',
      prevention_bn: 'পাতায় পানি ছিটে পড়া কমান, আক্রান্ত পাতা সরান, এবং ২-৩ দিন পরপর মাঠ পর্যবেক্ষণ করুন।',
    });
    setPreviewImage(null);
    setDetectionProvider('local-fallback');
    setDetectionWarning(lang === 'bn' ? 'এটি ডেমো রিপোর্ট। বাস্তব রোগ বিশ্লেষণের জন্য ছবি আপলোড করুন।' : 'This is a demo report. Upload a real photo for actual disease analysis.');
    setStatusMessage(lang === 'bn' ? 'ডেমো রিপোর্ট খোলা হয়েছে' : 'Demo report opened');
    setChatProvider(null);
    setActiveDetectionChatId(`demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  };

  const loadLatestHistoryReport = () => {
    if (!historyItems.length) {
      setDetectionError(lang === 'bn' ? 'লোড করার মতো সংরক্ষিত রিপোর্ট পাওয়া যায়নি' : 'No saved report found to load');
      return;
    }

    const latest = [...historyItems].sort((left, right) => {
      return new Date(right.detectedAt || 0).getTime() - new Date(left.detectedAt || 0).getTime();
    })[0];

    if (latest) {
      applyHistoryRecord(latest);
    }
  };

  if (!result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('detectDisease', lang)}</h1>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleFileDrop}
          className={`bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-md p-10 border-2 text-center text-slate-900 dark:text-slate-100 transition-colors ${
            isDragActive
              ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-300/60'
              : 'border-purple-100 dark:border-slate-700'
          }`}
        >
          <div className="p-6 bg-white rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Camera className="w-16 h-16 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100">{t('takePhoto', lang)}</h3>
          <p className="text-base text-gray-700 mb-6 max-w-md mx-auto">
            {lang === 'bn' ? 'পাতার একটি পরিষ্কার ছবি তুলুন বা আপলোড করুন' : 'Take or upload a clear photo of the leaf'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
            {lang === 'bn' ? 'Supported: JPG, PNG, WEBP, HEIC (Max 10MB)' : 'Supported: JPG, PNG, WEBP, HEIC (Max 10MB)'}
          </p>
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 bg-white/70 dark:bg-slate-700/60 rounded-full border border-slate-200 dark:border-slate-600 text-xs">
            <UploadCloud className="w-4 h-4 text-blue-600" />
            {lang === 'bn' ? 'অথবা এখানে ছবি Drag & Drop করুন' : 'Or drag and drop image here'}
          </div>

          <div className="max-w-md mx-auto mb-6">
            <input
              type="text"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              placeholder={lang === 'bn' ? 'ফসলের নাম (ঐচ্ছিক)' : 'Crop name (optional)'}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChosen}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChosen}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isDetecting}
              className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-green-600 text-white text-base font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isDetecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
              {isDetecting ? (lang === 'bn' ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing...') : t('takePhoto', lang)}
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={isDetecting}
              className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isDetecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              {isDetecting ? (lang === 'bn' ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing...') : t('uploadPhoto', lang)}
            </button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            {state.userMode !== 'guest' && historyItems.length > 0 && (
              <button
                onClick={loadLatestHistoryReport}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {lang === 'bn' ? 'সর্বশেষ রিপোর্ট খুলুন' : 'Open Latest Report'}
              </button>
            )}
            <button
              onClick={useDemoReport}
              className="px-4 py-2 text-sm bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-lg hover:bg-indigo-200 transition-colors"
            >
              {lang === 'bn' ? 'ডেমো রিপোর্টে চালিয়ে যান' : 'Continue With Demo Report'}
            </button>
          </div>

          {detectionError && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {detectionError}
            </div>
          )}

          {renderMlSetupCard()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('detectDisease', lang)}</h1>
        <div className="flex items-center gap-2">
          {state.userMode !== 'guest' && (
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className="px-3 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors inline-flex items-center gap-1"
            >
              <History className="w-4 h-4" />
              {lang === 'bn' ? 'ইতিহাস' : 'History'}
            </button>
          )}
          <button
            onClick={resetScan}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {lang === 'bn' ? 'নতুন স্ক্যান' : 'New Scan'}
          </button>
        </div>
      </div>

      {renderMlSetupCard()}

      {showHistory && state.userMode !== 'guest' && (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn' ? 'সংরক্ষিত রোগ রিপোর্ট' : 'Saved Disease Reports'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={exportHistoryCsv}
                disabled={!historyItems.length}
                className="text-xs px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-700 inline-flex items-center gap-1 hover:bg-emerald-50 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={exportAnalyticsPdf}
                disabled={!historyItems.length}
                className="text-xs px-2.5 py-1.5 rounded border border-indigo-300 text-indigo-700 inline-flex items-center gap-1 hover:bg-indigo-50 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                onClick={loadHistory}
                disabled={isHistoryLoading}
                className="text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 inline-flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500">{lang === 'bn' ? 'মোট স্ক্যান' : 'Total Scans'}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{analytics.total}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500">{lang === 'bn' ? 'গড় কনফিডেন্স' : 'Avg Confidence'}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{analytics.averageConfidence}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500">{lang === 'bn' ? 'ইমপ্রুভড কেস' : 'Improved Cases'}</p>
              <p className="text-lg font-semibold text-emerald-700">{analytics.improvedCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500">{lang === 'bn' ? 'সাফল্য নোট' : 'Success Notes'}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{analytics.noteCount}</p>
            </div>
          </div>

          {analytics.recentConfidence.length > 1 && (
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500 mb-1 inline-flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'সাম্প্রতিক কনফিডেন্স ট্রেন্ড' : 'Recent Confidence Trend'}
              </p>
              <svg width="140" height="40" viewBox="0 0 140 40">
                <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={confidenceTrend} />
              </svg>
            </div>
          )}

          {analytics.topDiseases.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-500 mb-2">{lang === 'bn' ? 'শীর্ষ রোগ' : 'Top Diseases'}</p>
              <div className="flex flex-wrap gap-2">
                {analytics.topDiseases.map((entry) => (
                  <span key={entry.name} className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {entry.name} ({entry.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {historyError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{historyError}</div>
          )}

          {!historyError && historyItems.length === 0 && !isHistoryLoading && (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'এখনও কোনো রিপোর্ট নেই' : 'No saved reports yet'}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {historyItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="text-left p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors space-y-2"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">{lang === 'bn' ? item.disease_bn || item.disease : item.disease}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {lang === 'bn' ? 'নিশ্চয়তা' : 'Confidence'}: {item.confidence}%
                </p>
                <p className="text-xs text-slate-500 mt-1">{new Date(item.detectedAt).toLocaleString()}</p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyHistoryRecord(item)}
                    className="px-2.5 py-1 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {lang === 'bn' ? 'লোড' : 'Load'}
                  </button>
                  <button
                    onClick={() => setCompareBaseline(item)}
                    className="px-2.5 py-1 text-xs rounded border border-purple-300 text-purple-700 hover:bg-purple-50 inline-flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'বেইসলাইন' : 'Set Baseline'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                  <select
                    value={outcomeDrafts[item.id]?.outcome || 'unknown'}
                    onChange={(e) => setOutcomeDraft(item.id, { outcome: e.target.value as OutcomeDraft['outcome'] })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded"
                  >
                    <option value="unknown">{lang === 'bn' ? 'ফলাফল অজানা' : 'Outcome unknown'}</option>
                    <option value="improved">{lang === 'bn' ? 'উন্নতি হয়েছে' : 'Improved'}</option>
                    <option value="no-change">{lang === 'bn' ? 'পরিবর্তন নেই' : 'No change'}</option>
                    <option value="worse">{lang === 'bn' ? 'খারাপ হয়েছে' : 'Worse'}</option>
                  </select>
                  <textarea
                    rows={2}
                    value={outcomeDrafts[item.id]?.note || ''}
                    onChange={(e) => setOutcomeDraft(item.id, { note: e.target.value })}
                    placeholder={lang === 'bn' ? 'ট্রিটমেন্ট সাফল্যের নোট লিখুন' : 'Write treatment success note'}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded"
                  />
                  <button
                    onClick={() => saveOutcomeNote(item.id)}
                    disabled={savingOutcomeId === item.id}
                    className="px-2.5 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {savingOutcomeId === item.id
                      ? (lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...')
                      : (lang === 'bn' ? 'নোট সেভ' : 'Save Note')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && compareBaseline && (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              {lang === 'bn' ? 'পুরনো বনাম নতুন স্ক্যান তুলনা' : 'Old vs New Scan Comparison'}
            </h3>
            <button
              onClick={() => setCompareBaseline(null)}
              className="text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600"
            >
              {lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500">{lang === 'bn' ? 'পুরনো' : 'Baseline'}</p>
              <p className="font-medium">{lang === 'bn' ? compareBaseline.disease_bn || compareBaseline.disease : compareBaseline.disease}</p>
              <p className="text-xs text-slate-600">{lang === 'bn' ? 'নিশ্চয়তা' : 'Confidence'}: {compareBaseline.confidence}%</p>
            </div>
            <div className="p-3 rounded border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500">{lang === 'bn' ? 'নতুন' : 'Current'}</p>
              <p className="font-medium">{result.disease}</p>
              <p className="text-xs text-slate-600">{lang === 'bn' ? 'নিশ্চয়তা' : 'Confidence'}: {result.confidence}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded border border-gray-200 dark:border-slate-700">
              <p className="text-slate-500">{lang === 'bn' ? 'রোগ পরিবর্তন' : 'Disease Change'}</p>
              <p className={`font-semibold ${compareBaseline.disease === result.disease ? 'text-emerald-700' : 'text-orange-700'}`}>
                {compareBaseline.disease === result.disease
                  ? (lang === 'bn' ? 'একই' : 'Same')
                  : (lang === 'bn' ? 'পরিবর্তিত' : 'Changed')}
              </p>
            </div>
            <div className="p-2 rounded border border-gray-200 dark:border-slate-700">
              <p className="text-slate-500">{lang === 'bn' ? 'কনফিডেন্স ডেল্টা' : 'Confidence Delta'}</p>
              <p className="font-semibold inline-flex items-center gap-1">
                {result.confidence > compareBaseline.confidence ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : result.confidence < compareBaseline.confidence ? <TrendingDown className="w-3.5 h-3.5 text-red-600" /> : <Minus className="w-3.5 h-3.5 text-slate-500" />}
                {(result.confidence - compareBaseline.confidence > 0 ? '+' : '') + (result.confidence - compareBaseline.confidence).toFixed(1)}%
              </p>
            </div>
            <div className="p-2 rounded border border-gray-200 dark:border-slate-700">
              <p className="text-slate-500">{lang === 'bn' ? 'পরামর্শ পরিবর্তন' : 'Advice Change'}</p>
              <p className="font-semibold text-purple-700">
                {(compareBaseline.treatment_en || '') !== (result.treatment_en || '')
                  ? (lang === 'bn' ? 'নতুন চিকিৎসা পরামর্শ' : 'Updated treatment advice')
                  : (lang === 'bn' ? 'একই পরামর্শ' : 'Same advice')}
              </p>
            </div>
          </div>
        </div>
      )}

      {detectionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {detectionError}
        </div>
      )}

      {statusMessage && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {statusMessage}
        </div>
      )}

      {lastConsultation && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          <p className="text-sm font-semibold">
            {lang === 'bn' ? 'পরামর্শ অনুরোধ সফল' : 'Consultation request submitted'}
          </p>
          <p className="text-sm mt-1">
            {lang === 'bn'
              ? `রেফারেন্স আইডি: ${lastConsultation.id}`
              : `Reference ID: ${lastConsultation.id}`}
          </p>
          <p className="text-xs mt-1 text-emerald-700/90">
            {lang === 'bn'
              ? `${lastConsultation.expertName} এর সাথে ${lastConsultation.mode === 'chat' ? 'চ্যাট' : 'কল'} অনুরোধ গ্রহণ করা হয়েছে।`
              : `${lastConsultation.mode === 'chat' ? 'Chat' : 'Call'} request with ${lastConsultation.expertName} has been queued.`}
          </p>
          <button
            type="button"
            onClick={() => navigate(state.user.role === 'doctor' ? '/doctor' : '/profile')}
            className="mt-3 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
          >
            {state.user.role === 'doctor'
              ? (lang === 'bn' ? 'ডক্টর ড্যাশবোর্ডে দেখুন' : 'View in Doctor Dashboard')
              : (lang === 'bn' ? 'প্রোফাইলে দেখুন' : 'View in Profile')}
          </button>
        </div>
      )}

      <div ref={resultSectionRef} className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {lang === 'bn' ? 'রোগ শনাক্তকরণ ফলাফল' : 'Detection Result'}
              </p>
              <h2 className="text-xl font-bold text-emerald-950">
                {result.disease}
              </h2>
              <p className="text-sm text-emerald-900/80">
                {lang === 'bn'
                  ? `নিশ্চয়তা ${result.confidence}%`
                  : `Confidence ${result.confidence}%`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {detectionProvider && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {detectionProvider}
                </span>
              )}
              {detectionWarning && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  {detectionWarning}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-emerald-200 bg-white/90 p-3 text-sm text-emerald-950">
            {lang === 'bn' ? result.advisory_bn : result.advisory_en}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Detected leaf"
              className="w-full h-64 object-cover rounded-lg mb-4"
            />
          ) : (
            <div className="w-full h-64 rounded-lg mb-4 bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
              {lang === 'bn' ? 'ছবি পাওয়া যায়নি' : 'No image preview'}
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">{t('possibleDisease', lang)}</p>
              <p className="font-semibold text-lg">{result.disease}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{t('confidence', lang)}</p>
              <p className="font-bold text-2xl text-orange-600">{result.confidence}%</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSaveResult}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : t('save', lang)}
            </button>
            <button
              onClick={handleShareResult}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {t('share', lang)}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-semibold mb-1">{lang === 'bn' ? 'সম্পূর্ণ রিপোর্ট' : 'Full Report'}</p>
            <p>{lang === 'bn' ? result.disease : result.disease}</p>
            <p className="mt-1">{lang === 'bn' ? result.advisory_bn : result.advisory_en}</p>
            <p className="mt-1">{lang === 'bn' ? result.treatment_bn : result.treatment_en}</p>
            <p className="mt-1">{lang === 'bn' ? result.prevention_bn : result.prevention_en}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{t('treatment', lang)}</h3>
            <p className="text-sm text-gray-700">
              {lang === 'bn' ? result.advisory_bn : result.advisory_en}
            </p>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-1">{lang === 'bn' ? 'প্রস্তাবিত ওষুধ' : 'Recommended Treatment'}</h4>
            <p className="text-sm text-gray-700">
              {lang === 'bn' ? result.treatment_bn : result.treatment_en}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{t('prevention', lang)}</h3>
            <p className="text-sm text-gray-700">
              {lang === 'bn' ? result.prevention_bn : result.prevention_en}
            </p>
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-xs font-medium text-gray-700">
              {lang === 'bn' ? 'ভয়েস মোড' : 'Voice Mode'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={voiceAutoRead}
              onClick={() => setVoiceAutoRead((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                voiceAutoRead
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${voiceAutoRead ? 'bg-green-600' : 'bg-gray-500'}`}
              />
              {voiceAutoRead
                ? (lang === 'bn' ? 'অটো-রিড (পূর্ণ)' : 'Auto-read (Full)')
                : (lang === 'bn' ? 'ম্যানুয়াল মাত্র' : 'Manual only')}
            </button>
          </div>

          <VoicePlayer
            text={result.advisory_bn}
            textEn={result.advisory_en}
            textFull={fullReportTextBn}
            textEnFull={fullReportTextEn}
            autoPlayOnChange={voiceAutoRead}
          />
        </div>
      </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <button
          onClick={() => setShowChat(!showChat)}
          className="flex items-center gap-2 font-semibold mb-4 text-blue-600"
        >
          <MessageCircle className="w-5 h-5" />
          {lang === 'bn' ? 'সহায়ক চ্যাট' : 'Assistant Chat'}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${isChatLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isChatLive ? (lang === 'bn' ? 'লাইভ' : 'Live') : (lang === 'bn' ? 'সংযোগ হচ্ছে' : 'Connecting')}
          </span>
          {chatProvider && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chatProvider === 'fallback' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
              AI: {getChatProviderLabel(chatProvider)}
            </span>
          )}
        </button>

        {showChat && (
          <div className="space-y-4">
            <div ref={chatScrollRef} className="h-64 overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg">
              {isChatLoading && (
                <div className="text-xs text-gray-500">
                  {lang === 'bn' ? 'চ্যাট ইতিহাস লোড হচ্ছে...' : 'Loading chat history...'}
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs p-3 rounded-lg ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickReply(lang === 'bn' ? reply.bn : reply.en)}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {lang === 'bn' ? reply.bn : reply.en}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder={lang === 'bn' ? 'বার্তা লিখুন...' : 'Type a message...'}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatSessionId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {lang === 'bn' ? 'পাঠান' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <button
          onClick={() => setShowExperts(!showExperts)}
          className="w-full flex items-center justify-between font-semibold mb-4"
        >
          <span className="text-blue-600">{t('askExpert', lang)}</span>
          <span className="text-sm text-gray-600">
            {isExpertsLoading
              ? (lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...')
              : `${experts.length} ${lang === 'bn' ? 'বিশেষজ্ঞ উপলব্ধ' : 'experts available'}`}
          </span>
        </button>

        {showExperts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {experts.map((expert) => (
              <div key={expert.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{lang === 'bn' ? expert.name_bn : expert.name}</h4>
                      {expert.available && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{lang === 'bn' ? expert.specialty_bn : expert.specialty}</p>
                    {!!expert.registrationNumber && (
                      <p className="text-xs text-gray-500">
                        {lang === 'bn'
                          ? `লাইসেন্স: ${expert.registrationNumber}`
                          : `License: ${expert.registrationNumber}`}
                      </p>
                    )}
                    {typeof expert.experienceYears === 'number' && expert.experienceYears > 0 && (
                      <p className="text-xs text-gray-500">
                        {lang === 'bn'
                          ? `অভিজ্ঞতা: ${expert.experienceYears} বছর`
                          : `Experience: ${expert.experienceYears} years`}
                      </p>
                    )}
                    {!!expert.profileSummary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{expert.profileSummary}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {lang === 'bn'
                        ? `সাড়া দিতে সময়: ${expert.responseTime_bn}`
                        : `Response time: ${expert.responseTime}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">{expert.rating}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    expert.available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {expert.available
                      ? (lang === 'bn' ? 'উপলব্ধ' : 'Available')
                      : (lang === 'bn' ? 'অফলাইন' : 'Offline')}
                  </span>
                  <span className="text-sm font-semibold">৳{Math.round(350 + expert.rating * 100)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => requestExpertConsultation(expert, 'chat')}
                    disabled={consultingExpertId === expert.id}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {consultingExpertId === expert.id ? (lang === 'bn' ? 'অপেক্ষা করুন...' : 'Please wait...') : (lang === 'bn' ? 'চ্যাট' : 'Chat')}
                  </button>
                  <button
                    onClick={() => requestExpertConsultation(expert, 'call')}
                    disabled={consultingExpertId === expert.id}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {consultingExpertId === expert.id ? (lang === 'bn' ? 'অপেক্ষা করুন...' : 'Please wait...') : (lang === 'bn' ? 'কল' : 'Call')}
                  </button>
                </div>
              </div>
            ))}

            {!isExpertsLoading && experts.length === 0 && (
              <div className="md:col-span-2 p-4 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-800">
                {lang === 'bn'
                  ? 'এখনো কোনো যাচাইকৃত বিশেষজ্ঞ পাওয়া যায়নি।'
                  : 'No verified experts are available right now.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};