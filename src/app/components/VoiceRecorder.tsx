import React, { useRef, useState } from 'react';
import { Mic, StopCircle, Play, Trash2, PauseCircle, Circle } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob | null, audioUrl: string | null, transcript: string | null) => void;
  disabled?: boolean;
}

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new window.MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunks.current = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    };
    mediaRecorder.start();
    setIsRecording(true);
    setIsPaused(false);
    // Start speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD'; // Bengali by default, can be changed
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          setTranscript(event.results[0][0].transcript);
        }
      };
      recognition.onerror = () => setIsRecognizing(false);
      recognition.onend = () => setIsRecognizing(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecognizing(true);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recognitionRef.current) recognitionRef.current.abort();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      if (recognitionRef.current) recognitionRef.current.start();
    }
  };

  const handleSend = () => {
    if ((audioBlob && audioUrl) || transcript) {
      onSend(audioBlob, audioUrl, transcript);
      setAudioBlob(null);
      setAudioUrl(null);
      setTranscript(null);
    }
  };

  const handleDelete = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscript(null);
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Start button */}
      {!audioUrl && !isRecording && (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-2xl text-lg font-bold shadow-lg hover:bg-green-700 transition-all"
        >
          <Mic className="w-7 h-7" /> Start Voice
        </button>
      )}
      {/* Recording controls */}
      {isRecording && (
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex gap-2 w-full">
            <button
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all animate-pulse"
            >
              <StopCircle className="w-6 h-6" /> Stop
            </button>
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-gray-900 rounded-xl font-bold hover:bg-yellow-500 transition-all"
              >
                <PauseCircle className="w-6 h-6" /> Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-400 text-gray-900 rounded-xl font-bold hover:bg-green-500 transition-all"
              >
                <Circle className="w-6 h-6" /> Resume
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {isRecognizing ? 'Listening for speech...' : 'Recording...'}
          </div>
        </div>
      )}
      {/* Audio preview and transcript */}
      {(audioUrl || transcript) && !isRecording && (
        <div className="flex flex-col items-center gap-2 w-full">
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          {transcript && (
            <div className="w-full bg-gray-100 rounded-lg p-2 text-gray-800 text-center text-base">
              <span className="font-semibold">Voice to Text:</span> {transcript}
            </div>
          )}
          <div className="flex gap-2 w-full">
            <button
              onClick={handleSend}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              <Play className="w-5 h-5" /> Send
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all"
            >
              <Trash2 className="w-5 h-5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
export { VoiceRecorder };
