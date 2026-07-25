'use client';
import { useState, useEffect } from 'react';
import { useChat, type Lang } from '@/context/ChatContext';
import { MODE_COLORS } from '@/lib/arthasyncApi';

const MODE_ICONS: Record<string, string> = {
  invoice: 'ti-file-invoice',
  database: 'ti-database',
  operations: 'ti-settings-2',
  marketing: 'ti-trending-up',
  camera_track: 'ti-camera',
};

interface TallyStatus {
  connected: boolean;
  company?: string;
}

interface ZohoStatus {
  connected: boolean;
}

// ── Inline OnboardingQuiz Modal ────────────────────────────────────────────────
function OnboardingModal({ onClose, onComplete }: { onClose: () => void; onComplete: (answers: Record<string, any>) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const questions = [
    {
      id: 'business_type',
      label: 'What type of business do you run?',
      options: ['Retail / Trading', 'Manufacturing', 'Services / Consulting', 'E-commerce', 'Other'],
    },
    {
      id: 'team_size',
      label: 'How large is your team?',
      options: ['Just me', '2–10 people', '11–50 people', '50+ people'],
    },
    {
      id: 'primary_use',
      label: 'What will you primarily use ArthaSync for? (Select multiple)',
      options: ['Invoice Processing', 'Business Analytics', 'Operations & Workflows', 'Marketing Content'],
      isMulti: true,
    },
    {
      id: 'accounting',
      label: 'Do you currently use accounting software? (Select multiple)',
      options: ['Tally Prime', 'Zoho Books', 'QuickBooks', 'Excel / Manual', 'None'],
      isMulti: true,
    },
  ];

  const current = questions[step];
  const isLast = step === questions.length - 1;

  const select = (val: string) => {
    if (current.isMulti) {
      const currentSelections = (answers[current.id] as string[]) || [];
      const newSelections = currentSelections.includes(val)
        ? currentSelections.filter(v => v !== val)
        : [...currentSelections, val];
      setAnswers({ ...answers, [current.id]: newSelections });
    } else {
      const newAnswers = { ...answers, [current.id]: val };
      setAnswers(newAnswers);
      if (!isLast) {
        setTimeout(() => setStep(s => s + 1), 260);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Quick Setup
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Help us personalise ArthaSync for you
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--purple-dark)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
          >
            <i className="ti ti-x" style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? 'var(--purple)' : 'var(--border)',
              transition: 'background 0.3s ease',
            }} />
          ))}
        </div>

        {/* Question */}
        <div className="fade-up" key={step}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Question {step + 1} of {questions.length}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            {current.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.options.map(opt => {
              const selected = current.isMulti
                ? ((answers[current.id] as string[]) || []).includes(opt)
                : answers[current.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => select(opt)}
                  style={{
                    textAlign: 'left', padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${selected ? 'var(--purple)' : 'var(--border)'}`,
                    background: selected ? 'rgba(37,99,235,0.05)' : 'var(--bg-card)',
                    color: selected ? 'var(--purple-dark)' : 'var(--text-secondary)',
                    fontFamily: 'Syne, sans-serif', fontSize: 12,
                    transition: 'all 0.18s ease',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; } }}
                  onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'; } }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? 'var(--purple)' : 'var(--border-bright)'}`,
                    background: selected ? 'var(--purple)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.18s ease',
                  }}>
                    {selected && <i className="ti ti-check" style={{ fontSize: 9, color: '#fff' }} />}
                  </div>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
              padding: '7px 14px', borderRadius: 8, cursor: step === 0 ? 'default' : 'pointer',
              fontFamily: 'Syne, sans-serif', fontSize: 12, opacity: step === 0 ? 0.4 : 1,
              transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Back
          </button>

          {isLast ? (
            <button
              onClick={() => onComplete(answers)}
              disabled={!answers[current.id] || answers[current.id].length === 0}
              className="btn-glow"
              style={{ padding: '8px 20px', borderRadius: 9, fontSize: 12, fontWeight: 600, opacity: (!answers[current.id] || answers[current.id].length === 0) ? 0.4 : 1 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-check" style={{ fontSize: 13 }} />
                Complete Setup
              </span>
            </button>
          ) : current.isMulti ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!answers[current.id] || answers[current.id].length === 0}
              style={{
                background: 'var(--purple)', color: '#fff', border: 'none',
                padding: '7px 14px', borderRadius: 8, cursor: (!answers[current.id] || answers[current.id].length === 0) ? 'default' : 'pointer',
                fontFamily: 'Syne, sans-serif', fontSize: 12, opacity: (!answers[current.id] || answers[current.id].length === 0) ? 0.4 : 1,
              }}
            >
              Next <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
            </button>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select an option to continue</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Sidebar Component ─────────────────────────────────────────────────────
export default function Sidebar() {
  const {
    sessions, newChat, switchSession,
    language, setLanguage,
    currentMode, currentModeName, currentModeColor, modes, setMode,
    sandboxMode, setSandboxMode, sendMessage,
  } = useChat();

  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tallyStatus, setTallyStatus] = useState<TallyStatus>({ connected: false });
  const [zohoStatus, setZohoStatus] = useState<ZohoStatus>({ connected: false });
  const [integrationsExpanded, setIntegrationsExpanded] = useState(true);

  // ── Fetch integration statuses on mount ────────────────────────────
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const BACKEND = 'http://127.0.0.1:8000';
        const [tallyRes, zohoRes] = await Promise.allSettled([
          fetch(`${BACKEND}/api/tally/status`),
          fetch(`${BACKEND}/api/zoho/status`),
        ]);

        if (tallyRes.status === 'fulfilled' && tallyRes.value.ok) {
          const data = await tallyRes.value.json();
          setTallyStatus({ connected: data.connected ?? false, company: data.company_name });
        }
        if (zohoRes.status === 'fulfilled' && zohoRes.value.ok) {
          const data = await zohoRes.value.json();
          setZohoStatus({ connected: data.connected ?? false });
        }
      } catch {
        // Integration API not available — keep defaults
      }
    };
    fetchStatuses();
  }, []);

  const langs: { code: Lang; label: string; full: string }[] = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'hi', label: 'हि', full: 'हिंदी' },
    { code: 'mr', label: 'म', full: 'मराठी' },
  ];

  const sectionLabel = {
    en: { agent: 'AI Agent Mode', recent: 'Recent', lang: 'Language', testing: 'Testing', integrations: 'Integrations', setup: 'Setup' },
    hi: { agent: 'AI एजेंट मोड', recent: 'हाल की बातचीत', lang: 'भाषा', testing: 'परीक्षण', integrations: 'एकीकरण', setup: 'सेटअप' },
    mr: { agent: 'AI एजंट मोड', recent: 'अलीकडील', lang: 'भाषा', testing: 'चाचणी', integrations: 'एकत्रीकरण', setup: 'सेटअप' },
  }[language] ?? { agent: 'AI Agent Mode', recent: 'Recent', lang: 'Language', testing: 'Testing', integrations: 'Integrations', setup: 'Setup' };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  const handleSetupComplete = (answers: Record<string, any>) => {
    setShowOnboarding(false);
    if (currentMode !== 'operations') {
      setMode('operations');
    }
    const primaryUse = Array.isArray(answers.primary_use) ? answers.primary_use.join(', ') : answers.primary_use;
    const accounting = Array.isArray(answers.accounting) ? answers.accounting.join(', ') : answers.accounting;

    const profile = `I have completed the quick setup. Here is my business profile:
- Business Type: ${answers.business_type || 'N/A'}
- Team Size: ${answers.team_size || 'N/A'}
- Primary Use: ${primaryUse || 'N/A'}
- Accounting Software: ${accounting || 'N/A'}

Please acknowledge this profile and suggest the best next steps.`;
    
    // Slight delay to allow mode switch to flush if needed
    setTimeout(() => {
      sendMessage(profile);
    }, 100);
  };

  return (
    <>
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} onComplete={handleSetupComplete} />}

      <aside style={{
        width: 240, background: 'var(--bg-deep)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        color: 'var(--text-primary)', height: '100vh', overflowY: 'auto',
      }}>

        {/* ── Logo + Setup ── */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, fontSize: 18, fontWeight: 800,
              background: 'linear-gradient(135deg,var(--purple-light),var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 4px 16px rgba(37,99,235,0.2)', flexShrink: 0,
            }}>₳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--purple-dark)' }}>ArthaSync</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Commerce AI</div>
            </div>
            {/* Setup button */}
            <button
              title="Quick Setup"
              onClick={() => setShowOnboarding(true)}
              style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'transparent', border: '1px solid var(--border)',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.color = 'var(--purple-dark)';
                b.style.borderColor = 'var(--purple-light)';
                b.style.background = 'rgba(37,99,235,0.1)';
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.color = 'var(--text-muted)';
                b.style.borderColor = 'var(--border)';
                b.style.background = 'transparent';
              }}
            >
              <i className="ti ti-adjustments-horizontal" />
            </button>
          </div>

          {/* Connected integration badges */}
          {(tallyStatus.connected || zohoStatus.connected) && (
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              {tallyStatus.connected && (
                <span className="badge-tally">
                  <i className="ti ti-building-store" style={{ fontSize: 9 }} />
                  Tally
                </span>
              )}
              {zohoStatus.connected && (
                <span className="badge-zoho">
                  <i className="ti ti-cloud" style={{ fontSize: 9 }} />
                  Zoho
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── New Chat ── */}
        <div style={{ padding: '12px 12px 4px', flexShrink: 0 }}>
          <button
            className="new-chat-btn"
            onClick={newChat}
            style={{
              width: '100%', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
              color: 'var(--purple)', padding: '9px 12px', borderRadius: 9,
              fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} />
            {language === 'hi' ? 'नई बातचीत' : language === 'mr' ? 'नवीन संभाषण' : 'New conversation'}
          </button>
        </div>

        {/* ── Mode Selector ── */}
        <div style={{ padding: '12px 12px 4px', flexShrink: 0 }}>
          <div style={sectionHeaderStyle}>
            <span>{sectionLabel.agent}</span>
          </div>

          {/* Current Mode indicator */}
          <div style={{
            background: `${currentModeColor}15`,
            border: `1px solid ${currentModeColor}44`,
            borderRadius: 8, padding: '6px 10px',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <i
              className={`ti ${MODE_ICONS[currentMode] ?? 'ti-robot'}`}
              style={{ fontSize: 13, color: currentModeColor }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {language === 'hi' ? 'वर्तमान मोड' : language === 'mr' ? 'सध्याचा मोड' : 'Current Mode'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: currentModeColor, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentModeName}
              </div>
            </div>
          </div>

          {/* Mode list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {modes.map(mode => {
              const isActive = mode.id === currentMode;
              const color = MODE_COLORS[mode.id] ?? 'var(--purple)';
              const icon = MODE_ICONS[mode.id] ?? 'ti-robot';
              const isHovered = hoveredMode === mode.id;

              return (
                <button
                  key={mode.id}
                  onClick={() => setMode(mode.id)}
                  onMouseEnter={() => setHoveredMode(mode.id)}
                  onMouseLeave={() => setHoveredMode(null)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: isActive ? `${color}15` : isHovered ? 'var(--bg-hover)' : 'transparent',
                    border: `1px solid ${isActive ? color + '44' : 'transparent'}`,
                    borderRadius: 8, padding: '7px 9px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'Syne, sans-serif',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: isActive ? `${color}22` : 'var(--bg-card)',
                    border: `1px solid ${isActive ? color + '44' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s ease',
                  }}>
                    <i className={`ti ${icon}`} style={{ fontSize: 12, color: isActive ? color : 'var(--text-muted)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: isActive ? 600 : 400,
                      color: isActive ? color : 'var(--text-secondary)',
                      lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {mode.name}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: color, flexShrink: 0,
                      boxShadow: `0 0 6px ${color}`,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Integrations ── */}
        <div style={{ padding: '10px 12px 4px', flexShrink: 0 }}>
          <div style={sectionHeaderStyle}>
            <span>{sectionLabel.integrations}</span>
            <button
              onClick={() => setIntegrationsExpanded(p => !p)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#444260', fontSize: 10, padding: 0,
                transition: 'transform 0.2s ease',
                transform: integrationsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            >
              <i className="ti ti-chevron-down" />
            </button>
          </div>

          {integrationsExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Tally Prime */}
              <div className="integration-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: tallyStatus.connected ? 'rgba(255,107,53,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${tallyStatus.connected ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <i className="ti ti-building-store" style={{ fontSize: 11, color: tallyStatus.connected ? '#ff6b35' : 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: tallyStatus.connected ? '#ff6b35' : 'var(--text-secondary)', lineHeight: 1.2 }}>
                      Tally Prime
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.2 }}>
                      {tallyStatus.connected
                        ? (tallyStatus.company ?? 'Connected')
                        : 'Not connected'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className={`status-dot ${tallyStatus.connected ? 'status-dot-online' : 'status-dot-offline'}`} />
                  <button
                    className="btn-tally"
                    onClick={async () => { 
                      try {
                        const res = await fetch('http://127.0.0.1:8000/api/tally/status');
                        const data = await res.json();
                        setTallyStatus({ connected: data.connected ?? false, company: data.company_name });
                        window.dispatchEvent(new CustomEvent('integration-status-change'));
                        if (!data.connected) alert("Please ensure Tally Prime is running on port 9000 and accessible.");
                      } catch (e) {
                        alert("Could not connect to backend to verify Tally status.");
                      }
                    }}
                    style={{ fontSize: 9, padding: '3px 7px' }}
                  >
                    {tallyStatus.connected ? 'Sync' : 'Connect'}
                  </button>
                </div>
              </div>

              {/* Zoho Books */}
              <div className="integration-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: zohoStatus.connected ? 'rgba(228,77,38,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${zohoStatus.connected ? 'rgba(228,77,38,0.3)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <i className="ti ti-cloud" style={{ fontSize: 11, color: zohoStatus.connected ? '#e44d26' : 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: zohoStatus.connected ? '#e44d26' : 'var(--text-secondary)', lineHeight: 1.2 }}>
                      Zoho Books
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.2 }}>
                      {zohoStatus.connected ? 'Connected' : 'Not connected'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className={`status-dot ${zohoStatus.connected ? 'status-dot-online' : 'status-dot-offline'}`} />
                  <button
                    className="btn-zoho"
                    onClick={() => { window.location.href = 'http://localhost:8000/api/zoho/auth-url'; }}
                    style={{ fontSize: 9, padding: '3px 7px' }}
                  >
                    {zohoStatus.connected ? 'View' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Language Selector ── */}
        <div style={{ padding: '10px 12px 4px', flexShrink: 0 }}>
          <div style={{ ...sectionHeaderStyle, marginBottom: 8 }}>
            {sectionLabel.lang}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {langs.map(l => (
              <button
                key={l.code}
                className={`lang-btn ${language === l.code ? 'active' : ''}`}
                onClick={() => setLanguage(l.code)}
                title={l.full}
                style={{ fontWeight: language === l.code ? 700 : 400, flex: 1, textAlign: 'center', cursor: 'pointer' }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat History ── */}
        <div style={{ padding: '12px 12px 4px', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 0 }}>
          {sectionLabel.recent}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 4, minHeight: 0 }}>
          {sessions.map(s => {
            const modeColor = MODE_COLORS[s.mode] ?? 'var(--purple)';
            return (
              <div
                key={s.id}
                onClick={() => switchSession(s.id)}
                onMouseEnter={() => setHoveredSession(s.id)}
                onMouseLeave={() => setHoveredSession(null)}
                style={{
                  margin: '2px 8px', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                  fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: s.active ? 'var(--bg-card)' : hoveredSession === s.id ? 'var(--bg-hover)' : 'transparent',
                  color: s.active ? 'var(--purple-dark)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'background 0.15s ease',
                  border: `1px solid ${s.active ? 'var(--border-bright)' : 'transparent'}`,
                }}
              >
                <i
                  className={`ti ${MODE_ICONS[s.mode] ?? 'ti-message'}`}
                  style={{ fontSize: 11, flexShrink: 0, color: s.active ? modeColor : 'var(--text-muted)' }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* ── Backend Status ── */}
        <div style={{ padding: '12px 16px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            {sectionLabel.testing}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => setSandboxMode((p: boolean) => !p)}>
            <div style={{
              width: 38, height: 22, borderRadius: 11, position: 'relative',
              background: sandboxMode ? 'var(--purple)' : 'var(--bg-hover)',
              border: '1px solid var(--border)', cursor: 'pointer',
              boxShadow: sandboxMode ? '0 0 12px rgba(37,99,235,0.3)' : 'none',
              transition: 'background 0.2s ease',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: sandboxMode ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: sandboxMode ? '#fff' : 'var(--text-muted)',
                transition: 'left 0.2s ease',
              }} />
            </div>
            <span style={{ fontSize: 11, color: sandboxMode ? 'var(--purple-dark)' : 'var(--text-secondary)', fontWeight: sandboxMode ? 600 : 400 }}>
              {language === 'hi' ? 'सैंडबॉक्स मोड' : language === 'mr' ? 'सॅंडबॉक्स मोड' : 'Sandbox Mode'}
            </span>
          </label>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            {sandboxMode
              ? (language === 'hi' ? '✓ मॉक रिस्पॉन्स' : language === 'mr' ? '✓ मॉक प्रतिसाद' : '✓ Mock responses')
              : (language === 'hi' ? 'FastAPI बैकएंड से जुड़ा' : language === 'mr' ? 'FastAPI बॅकएंडशी जोडलेले' : 'Connected to FastAPI backend')}
          </p>
        </div>
      </aside>
    </>
  );
}
