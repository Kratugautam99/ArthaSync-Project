export default function TypingIndicator() {
  return (
    <div className="fade-in" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800,
        background: 'linear-gradient(135deg,#7c5cfc,#00d4aa)', color: '#fff',
        boxShadow: '0 3px 12px #7c5cfc33',
      }}>₳</div>
      <div style={{
        padding: '13px 18px', borderRadius: '2px 12px 12px 12px',
        background: '#13112a', border: '1px solid #1e1b3a',
        display: 'flex', alignItems: 'center', gap: 5,
        boxShadow: '0 3px 12px rgba(0,0,0,0.25)',
      }}>
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
