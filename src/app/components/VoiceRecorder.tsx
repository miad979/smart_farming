import React, { useEffect, useRef, useState } from 'react';
import { Mic, StopCircle, Send, Trash2 } from 'lucide-react';

interface VoiceRecorderProps {
  /** Called with the recognised text when the user confirms. */
  onSend: (transcript: string) => void;
  lang: 'bn' | 'en';
  disabled?: boolean;
}

type SpeechRecognitionCtor = new () => any;

const getRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

/**
 * Push-to-talk speech-to-text input. Uses the browser Web Speech API
 * (Chrome/Edge/Android). Shows a clear message where it is unavailable.
 */
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, lang, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const supported = getRecognitionCtor() !== null;

  // Always release the microphone when the component goes away.
  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    setTranscript('');

    const recognition = new Ctor();
    recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0]?.transcript || '';
      }
      setTranscript(text.trim());
    };
    recognition.onerror = (event: any) => {
      const code = event?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError(lang === 'bn' ? 'মাইক্রোফোনের অনুমতি দিন' : 'Microphone permission was denied');
      } else if (code === 'no-speech') {
        setError(lang === 'bn' ? 'কোনো কথা শোনা যায়নি, আবার চেষ্টা করুন' : 'No speech heard, please try again');
      } else if (code !== 'aborted') {
        setError(lang === 'bn' ? 'ভয়েস শনাক্ত করা যায়নি' : 'Voice recognition failed');
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError(lang === 'bn' ? 'ভয়েস শুরু করা যায়নি' : 'Could not start voice input');
    }
  };

  const stop = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  const send = () => {
    const text = transcript.trim();
    if (!text) return;
    onSend(text);
    setTranscript('');
  };

  if (!supported) {
    return (
      <p className="text-xs text-gray-500">
        {lang === 'bn'
          ? 'এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয় (Chrome বা Edge ব্যবহার করুন)।'
          : 'Voice input is not supported in this browser (use Chrome or Edge).'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {!isListening && !transcript && (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <Mic className="w-5 h-5" />
          {lang === 'bn' ? 'কথা বলে প্রশ্ন করুন' : 'Ask by voice'}
        </button>
      )}

      {isListening && (
        <button
          type="button"
          onClick={stop}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors animate-pulse"
        >
          <StopCircle className="w-5 h-5" />
          {lang === 'bn' ? 'শুনছি... থামাতে চাপুন' : 'Listening... tap to stop'}
        </button>
      )}

      {transcript && (
        <div className="w-full bg-gray-100 rounded-lg p-2 text-sm text-gray-800">
          <span className="font-semibold">{lang === 'bn' ? 'আপনি বলেছেন: ' : 'You said: '}</span>
          {transcript}
        </div>
      )}

      {transcript && !isListening && (
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={send}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {lang === 'bn' ? 'পাঠান' : 'Send'}
          </button>
          <button
            type="button"
            onClick={() => setTranscript('')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> {lang === 'bn' ? 'মুছুন' : 'Discard'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default VoiceRecorder;
export { VoiceRecorder };
