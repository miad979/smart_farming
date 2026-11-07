import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { ConsultationMessage } from '../utils/api';

interface ConsultationThreadProps {
  messages: ConsultationMessage[];
  currentUserId?: string;
  lang: 'bn' | 'en';
  disabled?: boolean;
  disabledReason?: string;
  onSend: (text: string) => Promise<unknown>;
}

export const ConsultationThread: React.FC<ConsultationThreadProps> = ({
  messages,
  currentUserId,
  lang,
  disabled,
  disabledReason,
  onSend,
}) => {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      await onSend(text);
      setDraft('');
    } catch (err: any) {
      setError(err?.message || (lang === 'bn' ? 'বার্তা পাঠানো যায়নি' : 'Could not send message'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div ref={listRef} className="max-h-72 overflow-y-auto space-y-2 rounded-lg border bg-muted/30 p-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            {lang === 'bn' ? 'এখনো কোনো বার্তা নেই' : 'No messages yet'}
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? 'bg-primary text-primary-foreground' : 'bg-card border'
                  }`}
                >
                  {!mine && (
                    <p className="text-[11px] font-semibold opacity-80 mb-0.5">
                      {msg.senderName}
                      {msg.senderRole === 'doctor' ? (lang === 'bn' ? ' · বিশেষজ্ঞ' : ' · Expert') : ''}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className="text-[10px] opacity-70 mt-1 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {disabled ? (
        disabledReason ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={lang === 'bn' ? 'বার্তা লিখুন...' : 'Type a message...'}
            maxLength={2000}
            aria-label={lang === 'bn' ? 'বার্তা' : 'Message'}
          />
          <Button type="submit" disabled={!draft.trim() || isSending} aria-label={lang === 'bn' ? 'পাঠান' : 'Send'}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
