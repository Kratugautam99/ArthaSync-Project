'use client';
import { useState } from 'react';

interface Props {
  data: Record<string, any>;
  onConfirm: (data: Record<string, any>) => void;
  onCancel: () => void;
}

export default function InvoiceConfirmCard({ data, onConfirm, onCancel }: Props) {
  const [editedData, setEditedData] = useState(data);

  const handleChange = (key: string, value: any) => {
    setEditedData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
      marginTop: 12, color: 'var(--text-primary)', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <i className="ti ti-file-invoice" style={{ color: 'var(--teal)', fontSize: 18 }} />
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14 }}>Confirm Invoice Details</h3>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Vendor Name</label>
          <input 
            type="text" 
            value={editedData.vendor_name || ''} 
            onChange={e => handleChange('vendor_name', e.target.value)}
            style={{ width: '100%', padding: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-bright)', borderRadius: 6, color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Invoice Number</label>
          <input 
            type="text" 
            value={editedData.invoice_number || ''} 
            onChange={e => handleChange('invoice_number', e.target.value)}
            style={{ width: '100%', padding: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-bright)', borderRadius: 6, color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Total Amount (₹)</label>
          <input 
            type="number" 
            value={editedData.total_amount || ''} 
            onChange={e => handleChange('total_amount', parseFloat(e.target.value))}
            style={{ width: '100%', padding: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-bright)', borderRadius: 6, color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Total GST (₹)</label>
          <input 
            type="number" 
            value={editedData.total_gst || ''} 
            onChange={e => handleChange('total_gst', parseFloat(e.target.value))}
            style={{ width: '100%', padding: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-bright)', borderRadius: 6, color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button 
          onClick={onCancel}
          style={{ flex: 1, padding: 8, background: 'transparent', border: '1px solid var(--border-bright)', color: 'var(--text-muted)', borderRadius: 6, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button 
          onClick={() => onConfirm(editedData)}
          style={{ flex: 1, padding: 8, background: 'var(--teal)', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: 6, cursor: 'pointer' }}
        >
          Confirm & Save
        </button>
      </div>
    </div>
  );
}
