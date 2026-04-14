import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Play, Pause, Volume2, Square, RotateCcw, AlertCircle } from 'lucide-react';
import { apiPost } from '../utils/api';

interface VoicePlayerProps {
  text: string;
  textEn: string;
  textFull?: string;
  textEnFull?: string;
  autoPlayOnChange?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  text,
  textEn,
  textFull,
  textEnFull,
  autoPlayOnChange = false,
}) => {
  const { state } = useApp();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isSupported, setIsSupported] = useState(true);
  const [useRealTts, setUseRealTts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const lastSpokenKeyRef = useRef<string>('');

  const textToSpeak = useMemo(() => {
    if (state.language === 'bn') {
      return textFull || text;
    }
    return textEnFull || textEn;
  }, [state.language, text, textEn, textFull, textEnFull]);

  const buildSpeechChunks = (value: string) => {
    const normalized = value
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s+/g, '$1|')
      .replace(/\n+/g, '|')
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!normalized.length) return [];

    const chunks: string[] = [];
    for (const part of normalized) {
      if (part.length <= 180) {
        chunks.push(part);
        continue;
      }

      const words = part.split(' ');
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 180) {
          if (current) chunks.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) chunks.push(current);
    }

    return chunks;
  };

  const selectBestBrowserVoice = () => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const wantsBangla = state.language === 'bn';
    let bestVoice: SpeechSynthesisVoice | null = null;
    let bestScore = -1;

    for (const voice of voices) {
      const lang = String(voice.lang || '').toLowerCase();
      const name = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
      let score = 0;

      if (wantsBangla) {
        if (lang === 'bn-bd') score += 140;
        else if (lang === 'bn-in') score += 130;
        else if (lang.startsWith('bn')) score += 120;
        else continue;

        if (/nabanita|pradeep|bangla|bengali/.test(name)) score += 45;
        if (/neural|natural|online/.test(name)) score += 35;
        if (/google|microsoft/.test(name)) score += 15;
      } else {
        if (lang === 'en-us') score += 100;
        else if (lang.startsWith('en')) score += 80;
        else continue;

        if (/neural|natural|online/.test(name)) score += 20;
      }

      if (voice.default) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestVoice = voice;
      }
    }

    return bestVoice;
  };

  const stopAllSpeech = () => {
    speechQueueRef.current = [];
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const speakChunkQueue = (chunks: string[], chunkIndex = 0) => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      setError('Speech synthesis not supported');
      return;
    }

    if (chunkIndex >= chunks.length) {
      speechQueueRef.current = [];
      setIsPlaying(false);
      return;
    }

    const chunk = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    const selectedVoice = selectBestBrowserVoice();
    utterance.lang = selectedVoice?.lang || (state.language === 'bn' ? 'bn-BD' : 'en-US');
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = speed;
    utterance.pitch = state.language === 'bn' ? 0.95 : 1;
    utterance.onend = () => speakChunkQueue(chunks, chunkIndex + 1);
    utterance.onerror = () => {
      speechQueueRef.current = [];
      setIsPlaying(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Generate or fetch TTS audio
  const generateAudio = async (textContent: string) => {
    if (!textContent.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get real TTS audio from backend
      const response = await apiPost<any>('/tts/generate', {
        text: textContent,
        language: state.language === 'bn' ? 'bn' : 'en',
      });

      // If we got audio content, play it
      if (response.audioContent) {
        const audioUrl = `data:audio/mp3;base64,${response.audioContent}`;
        playAudioUrl(audioUrl);
        setUseRealTts(true);
      } else if (response.provider === 'web-speech') {
        // Fall back to Web Speech API
        setUseRealTts(false);
        speakWithBrowserAPI(response.text || textContent);
      }
    } catch (err) {
      console.warn('TTS error, falling back to Web Speech API:', err);
      // Fall back to browser Web Speech API
      setUseRealTts(false);
      speakWithBrowserAPI(textContent);
    } finally {
      setIsLoading(false);
    }
  };

  // Play audio from URL
  const playAudioUrl = (url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = url;
    audioRef.current.playbackRate = speed;
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.onerror = (e) => {
      console.error('Audio playback error:', e);
      setError('Failed to play audio');
      setIsPlaying(false);
    };
    audioRef.current.play().catch((e) => {
      console.error('Audio play error:', e);
      setError('Failed to play audio');
      setIsPlaying(false);
    });
    setIsPlaying(true);
  };

  // Speak using browser Web Speech API
  const speakWithBrowserAPI = (textContent: string) => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      setError('Speech synthesis not supported');
      return;
    }

    stopAllSpeech();
    const chunks = buildSpeechChunks(textContent);
    if (!chunks.length) {
      setError(state.language === 'bn' ? 'পড়ার মতো কোনো লেখা নেই' : 'No text available to read');
      return;
    }

    speechQueueRef.current = chunks;
    speakChunkQueue(chunks, 0);
    setIsPlaying(true);
  };

  const speak = async () => {
    if (!textToSpeak.trim()) {
      return;
    }

    await generateAudio(textToSpeak);
  };

  const handlePlay = async () => {
    if (isPlaying) {
      stopAllSpeech();
      return;
    }
    await speak();
  };

  const handleStop = () => {
    stopAllSpeech();
  };

  const handleReplay = async () => {
    await speak();
  };

  const changeSpeed = () => {
    const speeds = [1, 1.25, 1.5, 0.75];
    const currentIndex = speeds.indexOf(speed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(nextSpeed);

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.playbackRate = nextSpeed;
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          speak();
        }, 50);
      }
    }
  };

  useEffect(() => {
    if (!autoPlayOnChange) return;
    if (!textToSpeak.trim()) return;

    const key = `${state.language}:${textToSpeak}`;
    if (lastSpokenKeyRef.current === key) return;

    lastSpokenKeyRef.current = key;
    speak();
  }, [autoPlayOnChange, state.language, textToSpeak, speed]);

  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  if (!isSupported && !useRealTts) {
    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
        {state.language === 'bn' ? 'এই ডিভাইসে ভয়েস সাপোর্ট নেই' : 'Voice is not supported on this device'}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      {error && (
        <div className="flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      <button
        onClick={handlePlay}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <span className="w-4 h-4 animate-spin">⟳</span>
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {state.language === 'bn' ? 'ভয়েসে শুনুন' : 'Listen'}
      </button>

      <button
        onClick={changeSpeed}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors text-sm"
      >
        <Volume2 className="w-4 h-4" />
        {speed}x
      </button>

      <button
        onClick={handleReplay}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors text-sm"
      >
        <RotateCcw className="w-4 h-4" />
        {state.language === 'bn' ? 'আবার' : 'Replay'}
      </button>

      <button
        onClick={handleStop}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-sm"
      >
        <Square className="w-4 h-4" />
        {state.language === 'bn' ? 'বন্ধ' : 'Stop'}
      </button>

      <div className="ml-auto text-xs text-blue-600">
        {useRealTts ? '🎙️ Real TTS' : '🌐 Browser'}
      </div>
    </div>
  );
};
