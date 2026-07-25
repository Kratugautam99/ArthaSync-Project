'use client';
import { useState, useEffect } from 'react';
import { checkTallyStatus, checkZohoStatus } from '@/lib/arthasyncApi';

export default function IntegrationPanel() {
  const [tallyStatus, setTallyStatus] = useState<any>(null);
  const [zohoStatus, setZohoStatus] = useState<any>(null);

  useEffect(() => {
    checkTallyStatus().then(setTallyStatus).catch(() => setTallyStatus({connected: false}));
    checkZohoStatus().then(setZohoStatus).catch(() => setZohoStatus({connected: false}));
  }, []);

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, color: 'var(--text-primary)', border: '1px solid var(--border-bright)' }}>
      <h3 style={{ marginBottom: 16 }}>Integrations</h3>
      
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        {/* Tally Prime */}
        <div style={{ flex: 1, background: 'var(--bg-deep)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
          <h4 style={{ color: 'var(--teal)', marginBottom: 8 }}>Tally Prime</h4>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Status: {tallyStatus === null ? 'Checking...' : tallyStatus.connected ? 'Connected' : 'Disconnected'}
          </p>
          {tallyStatus?.connected && (
            <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>Company: {tallyStatus.company_name}</p>
          )}
          <button className="btn-glow" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>
            Configure Tally
          </button>
        </div>

        {/* Zoho Books */}
        <div style={{ flex: 1, background: 'var(--bg-deep)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
          <h4 style={{ color: 'var(--purple)', marginBottom: 8 }}>Zoho Books</h4>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Status: {zohoStatus === null ? 'Checking...' : zohoStatus.connected ? 'Connected' : 'Disconnected'}
          </p>
          <button className="btn-glow" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>
            Connect with Zoho
          </button>
        </div>
      </div>
    </div>
  );
}
