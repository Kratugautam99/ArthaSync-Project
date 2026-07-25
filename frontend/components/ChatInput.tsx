'use client';
import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';

const PLACEHOLDERS: Record<string, Record<string, string>> = {
  invoice: {
    en: 'Ask about this invoice, or upload a PDF/image…',
    hi: 'इनवॉयस के बारे में पूछें या PDF/इमेज अपलोड करें…',
    mr: 'इनव्हॉइसबद्दल विचारा किंवा PDF/इमेज अपलोड करा…',
  },
  database: {
    en: 'Ask a business question — e.g. "Show revenue by month"…',
    hi: 'व्यवसाय का प्रश्न पूछें — जैसे "महीने के हिसाब से राजस्व दिखाएं"…',
    mr: 'व्यावसायिक प्रश्न विचारा — उदा. "महिन्यानुसार महसूल दाखवा"…',
  },
  operations: {
    en: 'Ask about workflows, SOPs, or business automation…',
    hi: 'वर्कफ्लो, SOP या बिज़नेस ऑटोमेशन के बारे में पूछें…',
    mr: 'वर्कफ्लो, SOP किंवा व्यवसाय ऑटोमेशनबद्दल विचारा…',
  },
  marketing: {
    en: 'Ask for content ideas, campaigns, or marketing strategy…',
    hi: 'कंटेंट आइडिया, कैंपेन या मार्केटिंग स्ट्रैटेजी के बारे में पूछें…',
    mr: 'कंटेंट आयडिया, कॅम्पेन किंवा मार्केटिंग स्ट्रॅटेजीबद्दल विचारा…',
  },
};

export default function ChatInput() {
  const [text, setText] = useState('');
  const { sendMessage, isLoading, language, currentMode, uploadFile, uploadedFile, isUploading, clearUploadedFile } = useChat();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const placeholder =
    PLACEHOLDERS[currentMode]?.[language] ??
    PLACEHOLDERS.marketing.en;

  // Language code mapping for Web Speech API
  const langCode = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';
  
  const baseTextRef = useRef('');

  const { isListening, supported: sttSupported, toggleListening } = useSpeechRecognition({
    language: langCode,
    onResult: (transcript, isFinal) => {
      setText(baseTextRef.current + (baseTextRef.current && !baseTextRef.current.endsWith(' ') ? ' ' : '') + transcript);
      if (textRef.current) {
        textRef.current.style.height = 'auto';
        textRef.current.style.height = Math.min(textRef.current.scrollHeight, 120) + 'px';
      }
    }
  });

  const submit = () => {
    if (!text.trim() || isLoading) return;
    sendMessage(text.trim());
    setText('');
    if (textRef.current) textRef.current.style.height = 'auto';
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    // Reset file input so same file can be re-uploaded
    e.target.value = '';
  };

  const isUploadAllowed = currentMode === 'invoice' || currentMode === 'camera_track';
  const canSend = !isLoading && !isUploading && text.trim().length > 0;

  return (
    <div style={{ padding: '10px 20px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-deep)', flexShrink: 0 }}>

      {/* Attached file chip */}
      {isUploadAllowed && uploadedFile && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 20, padding: '4px 10px', marginBottom: 8,
          fontSize: 11, color: 'var(--teal)',
        }}>
          <i className="ti ti-paperclip" style={{ fontSize: 12 }} />
          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {uploadedFile.filename}
          </span>
          <button
            onClick={clearUploadedFile}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <i className="ti ti-x" style={{ fontSize: 11 }} />
          </button>
        </div>
      )}

      <div className="chat-input-wrap" style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 13, padding: '10px 12px',
      }}>

        {/* Hidden file input */}
        {isUploadAllowed && (
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.bmp,.tiff"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}

        {/* File upload button */}
        {isUploadAllowed && (
          <button
            title={isUploading ? 'Uploading…' : 'Upload image or document'}
            disabled={isUploading || isLoading}
            onClick={() => fileRef.current?.click()}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${uploadedFile ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-bright)'}`,
              background: uploadedFile ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: isUploading ? 'wait' : 'pointer',
              color: uploadedFile ? 'var(--teal)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.4 : 1,
            }}
            onMouseEnter={e => {
              if (!uploadedFile) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--purple-dark)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(37,99,235,0.2)';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(37,99,235,0.1)';
              }
            }}
            onMouseLeave={e => {
              if (!uploadedFile) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {isUploading
              ? <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} />
              : <i className={`ti ${uploadedFile ? 'ti-check' : 'ti-paperclip'}`} />
            }
          </button>
        )}

        <textarea
          ref={textRef}
          value={text}
          onChange={e => { setText(e.target.value); autoResize(e); }}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', fontSize: 13,
            resize: 'none', lineHeight: 1.6, minHeight: 24, maxHeight: 120,
            opacity: isLoading ? 0.6 : 1,
          }}
        />

        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {sttSupported && (
            <button
              onClick={() => {
                if (!isListening) baseTextRef.current = text;
                toggleListening();
              }}
              title={isListening ? 'Stop listening' : 'Start voice typing'}
              style={{
                width: 32, height: 32, borderRadius: 8, 
                border: isListening ? '1px solid var(--red)' : '1px solid var(--border-bright)',
                background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'transparent', 
                cursor: 'pointer', 
                color: isListening ? 'var(--red)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { 
                if (!isListening) {
                  const b = e.currentTarget as HTMLButtonElement; 
                  b.style.color = 'var(--purple-dark)'; b.style.borderColor = 'rgba(37,99,235,0.2)'; b.style.background = 'rgba(37,99,235,0.1)'; 
                }
              }}
              onMouseLeave={e => { 
                if (!isListening) {
                  const b = e.currentTarget as HTMLButtonElement; 
                  b.style.color = 'var(--text-muted)'; b.style.borderColor = 'var(--border-bright)'; b.style.background = 'transparent'; 
                }
              }}
            >
              <i className={`ti ${isListening ? 'ti-player-stop' : 'ti-microphone'}`} style={isListening ? { animation: 'pulse 1.5s infinite' } : {}} />
            </button>
          )}

          <button
            className="send-btn btn-glow"
            onClick={submit}
            disabled={!canSend}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              cursor: canSend ? 'pointer' : 'default',
              background: canSend ? 'linear-gradient(135deg,var(--purple-light),var(--purple))' : 'var(--border-bright)',
              color: '#fff', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: canSend ? 1 : 0.4,
              transition: 'all 0.2s ease',
            }}
          >
            {isLoading
              ? <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} />
              : <i className="ti ti-arrow-up" />
            }
          </button>
        </div>
      </div>

      <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 7, letterSpacing: 0.3 }}>
        ArthaSync AI ·{' '}
        {language === 'hi' ? 'Enter दबाएं भेजने के लिए' : language === 'mr' ? 'Enter दाबा पाठवण्यासाठी' : 'Press Enter to send'}{' '}
        · Backend: FastAPI + Groq
      </p>
    </div>
  );
}
