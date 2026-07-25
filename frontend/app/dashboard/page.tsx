'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatProvider, useChat } from '@/context/ChatContext';
import Sidebar from '@/components/Sidebar';
import MessageBubble from '@/components/MessageBubble';
import TypingIndicator from '@/components/TypingIndicator';
import WelcomeCards from '@/components/WelcomeCards';
import ChatInput from '@/components/ChatInput';
import InvoiceConfirmCard from '@/components/InvoiceConfirmCard';
import CameraTracker from '@/components/CameraTracker';
import { MODE_COLORS, checkTallyStatus, checkZohoStatus } from '@/lib/arthasyncApi';

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
  tally_sync: 'ti-building-store',
  zoho_sync: 'ti-cloud-upload',
  camera_track: 'ti-camera',
  general: 'ti-robot',
};

const INTENT_MODE_LABELS: Record<string, string> = {
  invoice: 'Invoice Processor',
  database: 'Database Intelligence',
  operations: 'Operations AI',
  marketing: 'Marketing Intelligence',
  tally_sync: 'Tally Prime Sync',
  zoho_sync: 'Zoho Books Sync',
  camera_track: 'Camera Tracker',
  general: 'General Assistant',
};

function DashboardInner() {
  const {
    messages,
    isLoading,
    sandboxMode,
    language,
    currentMode,
    currentModeName,
    currentModeColor,
    pendingConfirmData,
    confirmInvoice,
    rejectInvoice,
    detectedIntent,
  } = useChat();

  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const L = TOPBAR_LABELS[language] ?? TOPBAR_LABELS.en;

  const [showCamera, setShowCamera] = useState(false);
  const [tallyConnected, setTallyConnected] = useState<boolean | null>(null);
  const [zohoConnected, setZohoConnected] = useState<boolean | null>(null);
  const [tallyCompany, setTallyCompany] = useState<string | undefined>();

  // Poll connection statuses on mount
  useEffect(() => {
    const fetchStatuses = () => {
      checkTallyStatus().then(s => {
        setTallyConnected(s.connected);
        if (s.company_name) setTallyCompany(s.company_name);
      });
      checkZohoStatus().then(s => setZohoConnected(s.connected));
    };

    fetchStatuses();

    window.addEventListener('integration-status-change', fetchStatuses);
    return () => window.removeEventListener('integration-status-change', fetchStatuses);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const dotStyle = (connected: boolean | null): React.CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: connected === null ? '#555380' : connected ? '#00d4aa' : '#e44d26',
    boxShadow: connected ? '0 0 6px #00d4aa88' : 'none',
    display: 'inline-block',
    marginRight: 4,
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-deep)', fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Background gradient orb */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,0.05),transparent)', pointerEvents: 'none' }} />

        {/* ── Topbar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
          position: 'relative', zIndex: 10, flexShrink: 0,
        }}>
          {/* Left: back button + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => router.push('/')}
              title="Back to home"
              style={{
                width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--purple-dark)'; b.style.borderColor = 'var(--purple-light)'; b.style.background = 'rgba(37,99,235,0.1)'; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--text-muted)'; b.style.borderColor = 'var(--border)'; b.style.background = 'transparent'; }}
            >
              <i className="ti ti-home" />
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple-dark)' }}>{L.title}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                Groq LLaMA · Tally Prime · Zoho Books · YOLOv26
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

          {/* Right: connection dots + camera btn + status chips */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Tally Prime status */}
            <div
              title={tallyConnected ? `Tally Prime: ${tallyCompany ?? 'Connected'}` : 'Tally Prime: Disconnected'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 100,
                padding: '3px 8px', cursor: 'default',
              }}
            >
              <span style={dotStyle(tallyConnected)} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.3 }}>Tally</span>
            </div>

            {/* Zoho Books status */}
            <div
              title={zohoConnected ? 'Zoho Books: Connected' : 'Zoho Books: Disconnected'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 100,
                padding: '3px 8px', cursor: 'default',
              }}
            >
              <span style={dotStyle(zohoConnected)} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.3 }}>Zoho</span>
            </div>

            {/* Camera toggle button */}
            <button
              id="camera-toggle-btn"
              onClick={() => setShowCamera(v => !v)}
              title={showCamera ? 'Hide Camera Tracker' : 'Show Camera Tracker'}
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: showCamera ? '1px solid #06b6d444' : '1px solid var(--border)',
                background: showCamera ? 'rgba(6,182,212,0.1)' : 'transparent',
                cursor: 'pointer', color: showCamera ? '#06b6d4' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; if (!showCamera) { b.style.color = '#06b6d4'; b.style.borderColor = '#06b6d444'; b.style.background = 'rgba(6,182,212,0.1)'; } }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; if (!showCamera) { b.style.color = 'var(--text-muted)'; b.style.borderColor = 'var(--border)'; b.style.background = 'transparent'; } }}
            >
              <i className="ti ti-camera" />
            </button>

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

        {/* ── Intent Detection Banner ── */}
        {detectedIntent && (
          <div
            id="intent-detection-banner"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 20px',
              background: `${MODE_COLORS[detectedIntent.mode] ?? '#7c5cfc'}12`,
              borderBottom: `1px solid ${MODE_COLORS[detectedIntent.mode] ?? '#7c5cfc'}33`,
              animation: 'intentSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both',
              flexShrink: 0,
            }}
          >
            <i
              className={`ti ${MODE_ICONS[detectedIntent.mode] ?? 'ti-robot'}`}
              style={{ fontSize: 12, color: MODE_COLORS[detectedIntent.mode] ?? '#7c5cfc' }}
            />
            <span style={{ fontSize: 10, color: '#888aaa' }}>Auto-detected:</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: MODE_COLORS[detectedIntent.mode] ?? '#7c5cfc',
              background: `${MODE_COLORS[detectedIntent.mode] ?? '#7c5cfc'}20`,
              border: `1px solid ${MODE_COLORS[detectedIntent.mode] ?? '#7c5cfc'}44`,
              borderRadius: 100, padding: '1px 8px',
            }}>
              {INTENT_MODE_LABELS[detectedIntent.mode] ?? detectedIntent.mode}
            </span>
            <span style={{ fontSize: 10, color: '#555380' }}>
              ({Math.round(detectedIntent.confidence * 100)}% confidence)
            </span>
          </div>
        )}

        {/* ── Main Content Row ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Messages */}
            <div
              id="messages-scroll-area"
              style={{
                flex: 1, overflowY: 'auto', padding: '18px 20px',
                display: 'flex', flexDirection: 'column', gap: 14, position: 'relative',
              }}
            >
              <WelcomeCards />
              {messages.filter(m => m.id !== 'welcome').map(msg => (
                <MessageBubble key={msg.id} role={msg.role} content={msg.content} queryResult={msg.queryResult} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} style={{ height: 1 }} />
            </div>

            {/* InvoiceConfirmCard — appears above ChatInput when pending */}
            {pendingConfirmData && (
              <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
                <InvoiceConfirmCard
                  data={pendingConfirmData as Parameters<typeof InvoiceConfirmCard>[0]['data']}
                  onConfirm={(edited) => confirmInvoice(edited as Record<string, unknown>)}
                  onCancel={rejectInvoice}
                />
              </div>
            )}

            <ChatInput />
          </div>

          {/* Camera Tracker panel (slide in from right) */}
          {showCamera && (
            <div
              id="camera-tracker-panel"
              style={{
                width: 420,
                flexShrink: 0,
                borderLeft: '1px solid var(--border)',
                background: 'rgba(248, 250, 252, 0.97)',
                overflowY: 'auto',
                animation: 'cameraPanelSlide 0.3s cubic-bezier(0.22,1,0.36,1) both',
              }}
            >
              <CameraTracker />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes intentSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cameraPanelSlide {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
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
