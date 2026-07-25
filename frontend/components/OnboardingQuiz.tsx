'use client';
import { useState } from 'react';
import { useChat } from '@/context/ChatContext';

export default function OnboardingQuiz() {
  const { language } = useChat();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    business_name: '',
    industry: 'Retail',
    tally_integration: false,
    zoho_integration: false,
    camera_tracking: false,
  });
  const [completed, setCompleted] = useState(false);

  const t = {
    en: { title: 'Welcome to ArthaSync', name: 'Business Name', next: 'Next', finish: 'Complete Setup' },
    hi: { title: 'ArthaSync में आपका स्वागत है', name: 'व्यवसाय का नाम', next: 'अगला', finish: 'सेटअप पूरा करें' },
    mr: { title: 'ArthaSync मध्ये आपले स्वागत आहे', name: 'व्यवसायाचे नाव', next: 'पुढे', finish: 'सेटअप पूर्ण करा' },
  }[language] || { title: 'Welcome to ArthaSync', name: 'Business Name', next: 'Next', finish: 'Complete Setup' };

  if (completed) return null; // Or redirect

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 16,
        padding: 30, width: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        color: 'var(--text-primary)',
      }}>
        <h2 style={{ marginBottom: 20, textAlign: 'center', color: 'var(--teal)' }}>{t.title}</h2>
        
        {step === 0 && (
          <div className="fade-in">
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>{t.name}</label>
            <input 
              type="text" 
              value={data.business_name}
              onChange={e => setData({...data, business_name: e.target.value})}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--bg-deep)',
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                marginBottom: 20, outline: 'none'
              }}
            />
            <button className="btn-glow" onClick={() => setStep(1)} style={{ width: '100%', padding: '10px', borderRadius: 8 }}>
              {t.next}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="fade-in">
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Integrations</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={data.tally_integration} onChange={e => setData({...data, tally_integration: e.target.checked})} />
              Tally Prime Integration
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={data.zoho_integration} onChange={e => setData({...data, zoho_integration: e.target.checked})} />
              Zoho Books Integration
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={data.camera_tracking} onChange={e => setData({...data, camera_tracking: e.target.checked})} />
              Camera Inventory Tracking
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={() => setStep(0)} style={{ flex: 1, padding: '10px', borderRadius: 8 }}>Back</button>
              <button className="btn-glow" onClick={() => {
                // Call API here
                fetch('http://localhost:8000/api/onboarding', {
                  method: 'POST', headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(data)
                }).then(() => setCompleted(true)).catch(e => console.error(e));
              }} style={{ flex: 1, padding: '10px', borderRadius: 8 }}>
                {t.finish}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
