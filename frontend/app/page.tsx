'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const FEATURES = [
  { icon: 'ti-refresh', title: 'Real-time Sync', titleHi: 'रियल-टाइम सिंक', titleMr: 'रिअल-टाइम सिंक', desc: 'Inventory synced across Web, App & POS every 60 seconds automatically.', descHi: 'वेब, ऐप और POS में हर 60 सेकंड में इन्वेंटरी स्वचालित रूप से सिंक होती है।', descMr: 'वेब, अॅप आणि POS मध्ये दर 60 सेकंदांनी इन्व्हेंटरी आपोआप सिंक होते।', color: '#00d4aa' },
  { icon: 'ti-alert-triangle', title: 'Conflict Detection', titleHi: 'विवाद पहचान', titleMr: 'संघर्ष शोध', desc: 'Flags price deltas >₹20 instantly before customers spot the gap.', descHi: 'ग्राहकों से पहले ₹20 से अधिक मूल्य अंतर को तुरंत चिह्नित करता है।', descMr: 'ग्राहकांपूर्वी ₹20 पेक्षा जास्त किंमत फरक त्वरित चिन्हांकित करते.', color: '#f5a623' },
  { icon: 'ti-robot', title: 'AI Manager Briefs', titleHi: 'AI मैनेजर ब्रीफ', titleMr: 'AI व्यवस्थापक सारांश', desc: 'Plain-English daily summaries with specific numbers and clear actions.', descHi: 'विशिष्ट संख्याओं और स्पष्ट कार्यों के साथ दैनिक सारांश।', descMr: 'विशिष्ट संख्या आणि स्पष्ट कृतींसह दैनिक सारांश.', color: '#7c5cfc' },
  { icon: 'ti-chart-bar', title: 'Live Analytics', titleHi: 'लाइव एनालिटिक्स', titleMr: 'थेट विश्लेषण', desc: 'Revenue, margins, and oversell risks tracked across all channels.', descHi: 'सभी चैनलों में राजस्व, मार्जिन और ओवरसेल जोखिम ट्रैक किए जाते हैं।', descMr: 'सर्व चॅनेलमध्ये महसूल, मार्जिन आणि ओव्हरसेल जोखीम.', color: '#00d4aa' },
  { icon: 'ti-world', title: 'Multilingual', titleHi: 'बहुभाषी', titleMr: 'बहुभाषिक', desc: 'Works in English, Hindi & Marathi for Tier 2/3 city store owners.', descHi: 'टियर 2/3 शहर के दुकान मालिकों के लिए अंग्रेजी, हिंदी और मराठी में काम करता है।', descMr: 'टियर 2/3 शहरातील दुकानदारांसाठी इंग्रजी, हिंदी आणि मराठीत काम करते.', color: '#f5a623' },
  { icon: 'ti-currency-rupee', title: '470% ROI', titleHi: '470% ROI', titleMr: '470% ROI', desc: '₹2.4L annual loss eliminated at just ₹3,500/month cloud cost.', descHi: 'केवल ₹3,500/माह क्लाउड लागत पर ₹2.4L वार्षिक नुकसान समाप्त।', descMr: 'केवळ ₹3,500/महिना क्लाउड खर्चात ₹2.4L वार्षिक नुकसान दूर.', color: '#7c5cfc' },
];

const LABELS = {
  en: { badge: 'Arthasync : Business App', hero1: 'Unified Commerce', hero2: 'Intelligence', sub: 'AI-powered inventory sync, price conflict detection, and plain-English manager briefs for Indian retail SMEs.', open: 'Open AI Dashboard', demo: 'Try Sandbox Demo', features: 'Built for Indian Retail SMEs', featSub: '63M SMEs · ₹2.4L annual sync loss per store · 0.05% with unified infrastructure', launch: 'Launch Dashboard →' },
  hi: { badge: 'Arthasync : Business App', hero1: 'एकीकृत वाणिज्य', hero2: 'इंटेलिजेंस', sub: 'भारतीय खुदरा SME के लिए AI-संचालित इन्वेंटरी सिंक, मूल्य विवाद पहचान, और मैनेजर ब्रीफ।', open: 'AI डैशबोर्ड खोलें', demo: 'सैंडबॉक्स डेमो आज़माएं', features: 'भारतीय खुदरा SME के लिए बनाया गया', featSub: '6.3 करोड़ SME · प्रति स्टोर ₹2.4L वार्षिक नुकसान', launch: 'डैशबोर्ड लॉन्च करें →' },
  mr: { badge: 'Arthasync : Business App', hero1: 'एकत्रित व्यापार', hero2: 'इंटेलिजन्स', sub: 'भारतीय किरकोळ SME साठी AI-चालित इन्व्हेंटरी सिंक, किंमत संघर्ष शोध आणि व्यवस्थापक सारांश.', open: 'AI डॅशबोर्ड उघडा', demo: 'सॅंडबॉक्स डेमो वापरा', features: 'भारतीय किरकोळ SME साठी तयार', featSub: '6.3 कोटी SME · प्रति स्टोअर ₹2.4L वार्षिक नुकसान', launch: 'डॅशबोर्ड सुरू करा →' },
};

export default function Landing() {
  const router = useRouter();
  const [lang, setLang] = useState<'en'|'hi'|'mr'>('en');
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<number|null>(null);
  const L = LABELS[lang];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#070710', fontFamily: 'Syne,sans-serif', color: '#e8e6ff', position: 'relative', overflow: 'hidden' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 48px', position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(7,7,16,0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid #1e1b3a' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg,#7c5cfc,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 16px #7c5cfc44', flexShrink: 0 }}>₳</div>
          <div>
            <div style={{ fontWeight: 700, letterSpacing: '-0.3px', fontSize: 16 }}>ArthaSync</div>
            <div style={{ fontSize: 9, color: '#444260', letterSpacing: 1.5, textTransform: 'uppercase' }}>Commerce AI</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['en','hi','mr'] as const).map(l => (
            <button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)} style={{ fontWeight: lang === l ? 600 : 400 }}>
              {l === 'en' ? 'EN' : l === 'hi' ? 'हि' : 'म'}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: '#1e1b3a', margin: '0 4px' }} />
          <button className="btn-glow" onClick={() => router.push('/dashboard')} style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13 }}>
            <span>{L.launch}</span>
          </button>
        </div>
      </nav>

      <div style={{ textAlign: 'center', padding: '90px 24px 64px', maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="fade-up" style={{ display: 'inline-block', background: '#7c5cfc18', border: '1px solid #7c5cfc44', color: '#a08fff', fontSize: 10, padding: '5px 16px', borderRadius: 100, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 28 }}>
          ✦ {L.badge}
        </div>
        <h1 className="fade-up delay-1" style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, marginBottom: 22 }}>
          <span className="gradient-text">{L.hero1}<br />{L.hero2}</span>
        </h1>
        <p className="fade-up delay-2" style={{ fontSize: 16, color: '#6c6a8a', lineHeight: 1.75, maxWidth: 560, margin: '0 auto 38px' }}>{L.sub}</p>
        <div className="fade-up delay-3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-glow" onClick={() => router.push('/dashboard')} style={{ padding: '14px 30px', borderRadius: 11, fontSize: 14 }}><span>🚀 {L.open}</span></button>
          <button className="btn-outline" onClick={() => router.push('/dashboard')} style={{ padding: '14px 30px', borderRadius: 11, fontSize: 14 }}>⚡ {L.demo}</button>
        </div>
        <div className="fade-up delay-4" style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 48, flexWrap: 'wrap' }}>
          {[['63M', 'Indian SMEs'], ['₹2.4L', 'Annual loss/store'], ['470%', 'Avg ROI'], ['3', 'AI agents']].map(([val, lbl]) => (
            <div key={lbl} style={{ background: 'rgba(19,17,42,0.7)', border: '1px solid #1e1b3a', borderRadius: 12, padding: '12px 20px', backdropFilter: 'blur(12px)', transition: 'all 0.25s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#7c5cfc44'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#1e1b3a'; e.currentTarget.style.transform='translateY(0)'; }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono,monospace', background: 'linear-gradient(135deg,#e8e6ff,#7c5cfc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{val}</div>
              <div style={{ fontSize: 10, color: '#555380', letterSpacing: 0.5, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="fade-up delay-5" style={{ maxWidth: 660, margin: '0 auto 72px', padding: '22px 32px', position: 'relative', zIndex: 1, background: 'rgba(19,17,42,0.6)', border: '1px solid #1e1b3a', borderRadius: 16, backdropFilter: 'blur(12px)', textAlign: 'center' }}>
        <div style={{ fontSize: 24, color: '#7c5cfc', marginBottom: 10 }}>❝</div>
        <div style={{ fontSize: 14, color: '#8a88b0', fontStyle: 'italic', lineHeight: 1.8 }}>A king should ensure that all trade routes report accurate prices and stocks — so no merchant profits from false information while another suffers from ignorance.</div>
        <div style={{ fontSize: 10, color: '#444260', letterSpacing: 1, marginTop: 12 }}>— Chanakya, Arthashastra, 321 BC</div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto 80px', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>{L.features}</h2>
          <p style={{ color: '#6c6a8a', marginTop: 10, fontSize: 14 }}>{L.featSub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`feature-card fade-up delay-${i + 1}`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div style={{ width: 44, height: 44, borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${f.color}18`, border: `1px solid ${f.color}33`, transition: 'all 0.3s ease', transform: hovered === i ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)' }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 22, color: f.color }} />
              </div>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>{lang === 'hi' ? f.titleHi : lang === 'mr' ? f.titleMr : f.title}</div>
              <div style={{ fontSize: 12, color: '#6c6a8a', lineHeight: 1.7 }}>{lang === 'hi' ? f.descHi : lang === 'mr' ? f.descMr : f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto 80px', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'linear-gradient(135deg, #13112a, #1a1735)', border: '1px solid #7c5cfc44', borderRadius: 20, padding: '44px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Ready to sync your commerce?</h2>
          <p style={{ color: '#6c6a8a', marginBottom: 28, fontSize: 14 }}>Join 63M+ Indian SMEs eliminating inventory chaos with AI</p>
          <button className="btn-glow" onClick={() => router.push('/dashboard')} style={{ padding: '14px 36px', borderRadius: 12, fontSize: 15 }}><span>✦ Open Dashboard — It's Free</span></button>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid #1e1b3a', fontSize: 11, color: '#333260', position: 'relative', zIndex: 1 }}>
        Team ArthaSync · GHRCEM Pune · Cognizant Technoverse Hackathon 2026 · Retail — Unified Commerce Theme
      </div>
    </div>
  );
}
