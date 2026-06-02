'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChatProvider, useChat } from '@/context/ChatContext';
import Sidebar from '@/components/Sidebar';
import MessageBubble from '@/components/MessageBubble';
import TypingIndicator from '@/components/TypingIndicator';
import WelcomeCards from '@/components/WelcomeCards';
import ChatInput from '@/components/ChatInput';
import { MODE_COLORS } from '@/lib/arthasyncApi';

const TOPBAR_LABELS = {
  en: { title: 'ArthaSync AI Dashboard', modePrefix: 'Current Mode', sandbox: 'SANDBOX', live: '● LIVE' },
  hi: { title: 'ArthaSync AI डैशबोर्ड', modePrefix: 'वर्तमान मोड', sandbox: 'सैंडबॉक्स', live: '● लाइव' },
  mr: { title: 'ArthaSync AI डॅशबोर्ड', modePrefix: 'सध्याचा मोड', sandbox: 'सॅंडबॉक्स', live: '● थेट' },
};

const MODE_ICONS: Record<string, string> = {
  invoice: 'ti-file-invoice',
  database: 'ti-database',
  operations: 'ti-settings-2',
  marketing: 'ti-trending-up',
};

function DashboardInner() {
  const { messages, isLoading, sandboxMode, language, currentMode, currentModeName, currentModeColor } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const L = TOPBAR_LABELS[language] ?? TOPBAR_LABELS.en;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#070710', fontFamily: 'Syne, sans-serif', color: '#e8e6ff', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Background gradient orb */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,#7c5cfc08,transparent)', pointerEvents: 'none' }} />

        {/* ── Topbar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', borderBottom: '1px solid #1e1b3a',
          background: 'rgba(7,7,16,0.92)', backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 10, flexShrink: 0,
        }}>
          {/* Left: back button + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => router.push('/')}
              title="Back to home"
              style={{
                width: 28, height: 28, borderRadius: 7, border: '1px solid #1e1b3a',
                background: 'transparent', cursor: 'pointer', color: '#555380',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#9d7fff'; b.style.borderColor = '#7c5cfc44'; b.style.background = '#7c5cfc15'; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#555380'; b.style.borderColor = '#1e1b3a'; b.style.background = 'transparent'; }}
            >
              <i className="ti ti-home" />
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b4ff' }}>{L.title}</div>
              <div style={{ fontSize: 9, color: '#444260', letterSpacing: 0.5 }}>
                Groq LLaMA · FastAPI · PostgreSQL arthasync
              </div>
            </div>
          </div>

          {/* Centre: Current Mode badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${currentModeColor}18`,
            border: `1px solid ${currentModeColor}44`,
            borderRadius: 20, padding: '5px 12px',
          }}>
            <i
              className={`ti ${MODE_ICONS[currentMode] ?? 'ti-robot'}`}
              style={{ fontSize: 12, color: currentModeColor }}
            />
            <span style={{ fontSize: 10, color: '#666480' }}>
              {L.modePrefix}:
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: currentModeColor, letterSpacing: 0.2 }}>
              {currentModeName}
            </span>
          </div>

          {/* Right: status chips */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {sandboxMode && (
              <span style={{ background: '#f5a62318', border: '1px solid #f5a62333', color: '#f5a623', fontSize: 9, padding: '3px 8px', borderRadius: 100, letterSpacing: 0.5, fontWeight: 600 }}>
                {L.sandbox}
              </span>
            )}
            <span style={{ background: '#00d4aa18', border: '1px solid #00d4aa33', color: '#00d4aa', fontSize: 9, padding: '3px 8px', borderRadius: 100, letterSpacing: 0.5, fontWeight: 600 }}>
              {L.live}
            </span>
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '18px 20px',
          display: 'flex', flexDirection: 'column', gap: 14, position: 'relative',
        }}>
          <WelcomeCards />
          {messages.filter(m => m.id !== 'welcome').map(msg => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} queryResult={msg.queryResult} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} style={{ height: 1 }} />
        </div>

        <ChatInput />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ChatProvider>
      <DashboardInner />
    </ChatProvider>
  );
}
