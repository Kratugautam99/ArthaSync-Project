'use client';
import { useState, useRef } from 'react';
import { useChat } from '@/context/ChatContext';

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

  const isInvoiceMode = currentMode === 'invoice';
  const canSend = !isLoading && !isUploading && text.trim().length > 0;

  return (
    <div style={{ padding: '10px 20px 14px', borderTop: '1px solid #1e1b3a', background: '#0c0b18', flexShrink: 0 }}>

      {/* Attached file chip */}
      {isInvoiceMode && uploadedFile && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#00d4aa18', border: '1px solid #00d4aa44',
          borderRadius: 20, padding: '4px 10px', marginBottom: 8,
          fontSize: 11, color: '#00d4aa',
        }}>
          <i className="ti ti-paperclip" style={{ fontSize: 12 }} />
          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {uploadedFile.filename}
          </span>
          <button
            onClick={clearUploadedFile}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00d4aa', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <i className="ti ti-x" style={{ fontSize: 11 }} />
          </button>
        </div>
      )}

      <div className="chat-input-wrap" style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: '#13112a', border: '1px solid #1e1b3a',
        borderRadius: 13, padding: '10px 12px',
      }}>

        {/* Hidden file input */}
        {isInvoiceMode && (
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.bmp,.tiff"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}

        {/* File upload button (Invoice mode only) */}
        {isInvoiceMode && (
          <button
            title={isUploading ? 'Uploading…' : 'Upload invoice PDF or image'}
            disabled={isUploading || isLoading}
            onClick={() => fileRef.current?.click()}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${uploadedFile ? '#00d4aa55' : '#2e2b5a'}`,
              background: uploadedFile ? '#00d4aa18' : 'transparent',
              cursor: isUploading ? 'wait' : 'pointer',
              color: uploadedFile ? '#00d4aa' : '#555380',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.4 : 1,
            }}
            onMouseEnter={e => {
              if (!uploadedFile) {
                (e.currentTarget as HTMLButtonElement).style.color = '#9d7fff';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c5cfc44';
                (e.currentTarget as HTMLButtonElement).style.background = '#7c5cfc15';
              }
            }}
            onMouseLeave={e => {
              if (!uploadedFile) {
                (e.currentTarget as HTMLButtonElement).style.color = '#555380';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2b5a';
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
            color: '#c8c6e8', fontFamily: 'Syne, sans-serif', fontSize: 13,
            resize: 'none', lineHeight: 1.6, minHeight: 24, maxHeight: 120,
            opacity: isLoading ? 0.6 : 1,
          }}
        />

        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button
            title="Voice input (coming soon)"
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid #2e2b5a',
              background: 'transparent', cursor: 'pointer', color: '#555380',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#9d7fff'; b.style.borderColor = '#7c5cfc44'; b.style.background = '#7c5cfc15'; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#555380'; b.style.borderColor = '#2e2b5a'; b.style.background = 'transparent'; }}
          >
            <i className="ti ti-microphone" />
          </button>

          <button
            className="send-btn btn-glow"
            onClick={submit}
            disabled={!canSend}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              cursor: canSend ? 'pointer' : 'default',
              background: canSend ? 'linear-gradient(135deg,#7c5cfc,#5a3ee8)' : '#2a2550',
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

      <p style={{ fontSize: 9, color: '#2e2c50', textAlign: 'center', marginTop: 7, letterSpacing: 0.3 }}>
        ArthaSync AI ·{' '}
        {language === 'hi' ? 'Enter दबाएं भेजने के लिए' : language === 'mr' ? 'Enter दाबा पाठवण्यासाठी' : 'Press Enter to send'}{' '}
        · Backend: FastAPI + Groq
      </p>
    </div>
  );
}
