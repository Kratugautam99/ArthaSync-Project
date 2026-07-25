'use client';
import { useRef, useEffect, useState } from 'react';
import { detectItems, syncToTally, syncToZoho } from '@/lib/arthasyncApi';

import { useChat } from '@/context/ChatContext';

export default function CameraTracker() {
  const { setCameraCounts } = useChat();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Start camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(err => console.error("Camera access denied:", err));

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDetecting && stream) {
      interval = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (videoSize.width !== video.videoWidth || videoSize.height !== video.videoHeight) {
          setVideoSize({ width: video.videoWidth, height: video.videoHeight });
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
          try {
            const res = await detectItems(file);
            if (res.success && res.data) {
              const newCounts = (res.data as any).counts || {};
              setDetections((res.data as any).detections || []);
              setCounts(newCounts);
              setCameraCounts(newCounts);
            }
          } catch (e) {
            console.error(e);
          }
        }, 'image/jpeg', 0.8);
      }, 2000); // Poll every 2 seconds to avoid overloading backend
    }
    return () => clearInterval(interval);
  }, [isDetecting, stream]);

  const handleSyncTally = async () => {
    if (!canvasRef.current) return;
    setSyncStatus('Syncing to Tally...');
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
        await syncToTally(file);
        setSyncStatus('✅ Synced to Tally Prime');
        setTimeout(() => setSyncStatus(''), 3000);
      } catch (e) {
        setSyncStatus('❌ Tally sync failed');
      }
    }, 'image/jpeg');
  };

  const handleSyncZoho = async () => {
    if (!canvasRef.current) return;
    setSyncStatus('Syncing to Zoho...');
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
        await syncToZoho(file);
        setSyncStatus('✅ Synced to Zoho Books');
        setTimeout(() => setSyncStatus(''), 3000);
      } catch (e) {
        setSyncStatus('❌ Zoho sync failed');
      }
    }, 'image/jpeg');
  };

  return (
    <div style={{ padding: 20, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h3 style={{ marginBottom: 16, color: 'var(--teal)' }}>Camera Inventory Tracker</h3>
      
      <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ width: '100%', display: 'block' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Draw bounding boxes here */}
        {videoSize.width > 0 && detections.map((d, i) => {
          const [x1, y1, x2, y2] = d.box;
          const left = (x1 / videoSize.width) * 100;
          const top = (y1 / videoSize.height) * 100;
          const width = ((x2 - x1) / videoSize.width) * 100;
          const height = ((y2 - y1) / videoSize.height) * 100;
          
          return (
            <div 
              key={i} 
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                border: '2px solid var(--gold)',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }}
            >
              <span style={{
                position: 'absolute',
                top: -20,
                left: -2,
                backgroundColor: 'var(--gold)',
                color: '#fff',
                fontSize: 10,
                padding: '2px 6px',
                fontWeight: 'bold',
                borderRadius: '4px 4px 4px 0',
                whiteSpace: 'nowrap'
              }}>
                {d.label} ({(d.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button 
          className="btn-glow"
          onClick={() => setIsDetecting(!isDetecting)}
          style={{ flex: 1, padding: '10px', borderRadius: 8, background: isDetecting ? 'var(--red)' : 'var(--teal)', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          <span>{isDetecting ? 'Stop Tracking' : 'Start Tracking'}</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h4 style={{ marginBottom: 10, color: 'var(--text-secondary)' }}>Detected Items</h4>
        {Object.entries(counts).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No items detected yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(counts).map(([name, count]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{name}</span>
                <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--teal)' }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn-outline" 
            onClick={handleSyncTally}
            disabled={Object.keys(counts).length === 0}
            style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, borderColor: 'var(--orange)', color: 'var(--orange)', opacity: Object.keys(counts).length === 0 ? 0.5 : 1 }}
          >
            Sync Tally
          </button>
          <button 
            className="btn-outline" 
            onClick={handleSyncZoho}
            disabled={Object.keys(counts).length === 0}
            style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, borderColor: 'var(--red)', color: 'var(--red)', opacity: Object.keys(counts).length === 0 ? 0.5 : 1 }}
          >
            Sync Zoho
          </button>
        </div>
        {syncStatus && <p style={{ fontSize: 12, color: 'var(--teal)', marginTop: 10, textAlign: 'center' }}>{syncStatus}</p>}
      </div>
    </div>
  );
}
