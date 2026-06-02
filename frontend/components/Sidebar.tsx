'use client';
import { useState } from 'react';
import { useChat, type Lang } from '@/context/ChatContext';
import { MODE_COLORS } from '@/lib/arthasyncApi';

const MODE_ICONS: Record<string, string> = {
  invoice: 'ti-file-invoice',
  database: 'ti-database',
  operations: 'ti-settings-2',
  marketing: 'ti-trending-up',
};

export default function Sidebar() {
  const {
    sessions, newChat, switchSession,
    language, setLanguage,
    currentMode, currentModeName, currentModeColor, modes, setMode,
    sandboxMode, setSandboxMode,
  } = useChat();

  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);

  const langs: { code: Lang; label: string; full: string }[] = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'hi', label: 'हि', full: 'हिंदी' },
    { code: 'mr', label: 'म', full: 'मराठी' },
  ];

  const sectionLabel = {
    en: { agent: 'AI Agent Mode', recent: 'Recent', lang: 'Language', testing: 'Testing' },
    hi: { agent: 'AI एजेंट मोड', recent: 'हाल की बातचीत', lang: 'भाषा', testing: 'परीक्षण' },
    mr: { agent: 'AI एजंट मोड', recent: 'अलीकडील', lang: 'भाषा', testing: 'चाचणी' },
  }[language] ?? { agent: 'AI Agent Mode', recent: 'Recent', lang: 'Language', testing: 'Testing' };

  return (
    <aside style={{
      width: 240, background: '#0c0b18', borderRight: '1px solid #1e1b3a',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      color: '#fff', height: '100vh', overflowY: 'auto',
    }}>

      {/* ── Logo ── */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1e1b3a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, fontSize: 18, fontWeight: 800,
            background: 'linear-gradient(135deg,#7c5cfc,#00d4aa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 4px 16px #7c5cfc44', flexShrink: 0,
          }}>₳</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>ArthaSync</div>
            <div style={{ fontSize: 9, color: '#555380', letterSpacing: 1.5, textTransform: 'uppercase' }}>Commerce AI</div>
          </div>
        </div>
      </div>

      {/* ── New Chat ── */}
      <div style={{ padding: '12px 12px 4px', flexShrink: 0 }}>
        <button
          onClick={newChat}
          style={{
            width: '100%', background: '#7c5cfc22', border: '1px solid #7c5cfc44',
            color: '#a08fff', padding: '9px 12px', borderRadius: 9,
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
        <div style={{
          fontSize: 9, color: '#444260', letterSpacing: 1.5,
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          {sectionLabel.agent}
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
          <div>
            <div style={{ fontSize: 9, color: '#444260', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {language === 'hi' ? 'वर्तमान मोड' : language === 'mr' ? 'सध्याचा मोड' : 'Current Mode'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: currentModeColor, lineHeight: 1.2 }}>
              {currentModeName}
            </div>
          </div>
        </div>

        {/* Mode list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {modes.map(mode => {
            const isActive = mode.id === currentMode;
            const color = MODE_COLORS[mode.id] ?? '#7c5cfc';
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
                  background: isActive ? `${color}22` : isHovered ? '#1a1735' : 'transparent',
                  border: `1px solid ${isActive ? color + '55' : 'transparent'}`,
                  borderRadius: 8, padding: '7px 9px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'Syne, sans-serif',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: isActive ? `${color}33` : '#13112a',
                  border: `1px solid ${isActive ? color + '55' : '#1e1b3a'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s ease',
                }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 12, color: isActive ? color : '#555380' }} />
                </div>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: isActive ? 600 : 400,
                    color: isActive ? color : '#8a88b0',
                    lineHeight: 1.2,
                  }}>
                    {mode.name}
                  </div>
                </div>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%',
                    background: color, flexShrink: 0,
                    boxShadow: `0 0 6px ${color}`,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Language Selector ── */}
      <div style={{ padding: '10px 12px 4px', flexShrink: 0 }}>
        <div style={{
          fontSize: 9, color: '#444260', letterSpacing: 1.5,
          textTransform: 'uppercase', marginBottom: 8,
        }}>
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
      <div style={{ padding: '12px 12px 4px', fontSize: 9, color: '#444260', letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 0 }}>
        {sectionLabel.recent}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 4, minHeight: 0 }}>
        {sessions.map(s => {
          const modeColor = MODE_COLORS[s.mode] ?? '#7c5cfc';
          return (
            <div
              key={s.id}
              onClick={() => switchSession(s.id)}
              onMouseEnter={() => setHoveredSession(s.id)}
              onMouseLeave={() => setHoveredSession(null)}
              style={{
                margin: '2px 8px', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                background: s.active ? '#1e1b3a' : hoveredSession === s.id ? '#13112a' : 'transparent',
                color: s.active ? '#c4b4ff' : '#6c6a8a',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'background 0.15s ease',
              }}
            >
              <i
                className={`ti ${MODE_ICONS[s.mode] ?? 'ti-message'}`}
                style={{ fontSize: 11, flexShrink: 0, color: s.active ? modeColor : '#555380' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
            </div>
          );
        })}
      </div>

      {/* ── Backend Status ── */}
      <div style={{ padding: '12px 16px 12px', borderTop: '1px solid #1e1b3a', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#444260', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
          {sectionLabel.testing}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => setSandboxMode((p: boolean) => !p)}>
          <div style={{
            width: 38, height: 22, borderRadius: 11, position: 'relative',
            background: sandboxMode ? '#7c5cfc' : '#1e1b3a',
            border: '1px solid #2e2b5a', cursor: 'pointer',
            boxShadow: sandboxMode ? '0 0 12px #7c5cfc44' : 'none',
            transition: 'background 0.2s ease',
          }}>
            <div style={{
              position: 'absolute', top: 3, left: sandboxMode ? 19 : 3,
              width: 14, height: 14, borderRadius: '50%',
              background: sandboxMode ? '#fff' : '#555380',
              transition: 'left 0.2s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: sandboxMode ? '#c4b4ff' : '#6c6a8a', fontWeight: sandboxMode ? 600 : 400 }}>
            {language === 'hi' ? 'सैंडबॉक्स मोड' : language === 'mr' ? 'सॅंडबॉक्स मोड' : 'Sandbox Mode'}
          </span>
        </label>
        <p style={{ fontSize: 10, color: '#444260', marginTop: 6, lineHeight: 1.5 }}>
          {sandboxMode
            ? (language === 'hi' ? '✓ मॉक रिस्पॉन्स' : language === 'mr' ? '✓ मॉक प्रतिसाद' : '✓ Mock responses')
            : (language === 'hi' ? 'FastAPI बैकएंड से जुड़ा' : language === 'mr' ? 'FastAPI बॅकएंडशी जोडलेले' : 'Connected to FastAPI backend')}
        </p>
      </div>
    </aside>
  );
}
