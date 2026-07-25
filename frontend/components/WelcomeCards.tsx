'use client';
import { useChat } from '@/context/ChatContext';

const STATS = [
  { label: 'Web Inventory', labelHi: 'वेब इन्वेंटरी', labelMr: 'वेब इन्व्हेंटरी', val: '1,247 SKUs', delta: '↑ 12 added today', deltaHi: '↑ आज 12 जोड़े', deltaMr: '↑ आज 12 जोडले', color: 'var(--teal)', up: true },
  { label: 'App Inventory', labelHi: 'ऐप इन्वेंटरी', labelMr: 'ॲप इन्व्हेंटरी', val: '1,244 SKUs', delta: '↓ 3 out of sync', deltaHi: '↓ 3 सिंक से बाहर', deltaMr: '↓ 3 सिंक बाहेर', color: 'var(--purple-dark)', up: false },
  { label: 'Price Conflicts', labelHi: 'मूल्य विवाद', labelMr: 'किंमत विवाद', val: '3 alerts', delta: '₹150 max delta', deltaHi: '₹150 अधिकतम अंतर', deltaMr: '₹150 कमाल फरक', color: 'var(--orange)', up: false },
  { label: 'Revenue Today', labelHi: 'आज का राजस्व', labelMr: 'आजचा महसूल', val: '₹84,320', delta: '↑ 8.4% vs yesterday', deltaHi: '↑ कल से 8.4% अधिक', deltaMr: '↑ काल पेक्षा 8.4%', color: 'var(--teal)', up: true },
];

const CHIPS = {
  en: ['Show price conflicts', 'Daily manager brief', 'Top selling SKUs', 'Oversell risks', 'Budget analysis', 'Sync status report'],
  hi: ['मूल्य विवाद दिखाएं', 'दैनिक मैनेजर ब्रीफ', 'टॉप बिकने वाले SKU', 'ओवरसेल जोखिम', 'बजट विश्लेषण', 'सिंक स्थिति रिपोर्ट'],
  mr: ['किंमत विवाद दाखवा', 'दैनिक व्यवस्थापक सारांश', 'सर्वाधिक विकले गेलेले SKU', 'ओव्हरसेल धोका', 'बजेट विश्लेषण', 'सिंक स्थिती अहवाल'],
};

const GREET = {
  en: (<>Namaste! I&apos;m <strong style={{ color: 'var(--purple-dark)' }}>ArthaSync AI</strong> — your unified commerce intelligence assistant.<br />I sync inventory across Web, App &amp; POS, detect price conflicts, and give your managers plain-English action briefs. Ask me <em>anything!</em></>),
  hi: (<>नमस्ते! मैं <strong style={{ color: 'var(--purple-dark)' }}>ArthaSync AI</strong> हूं — आपका एकीकृत वाणिज्य सहायक।<br />मैं वेब, ऐप और POS में इन्वेंटरी सिंक करता हूं, मूल्य विवाद पहचानता हूं और मैनेजर को ब्रीफ देता हूं। कुछ भी पूछें!</>),
  mr: (<>नमस्कार! मी <strong style={{ color: 'var(--purple-dark)' }}>ArthaSync AI</strong> आहे — तुमचा एकत्रित व्यापार सहाय्यक.<br />मी वेब, ॲप आणि POS मध्ये इन्व्हेंटरी सिंक करतो, किंमत विवाद शोधतो आणि व्यवस्थापकांना सारांश देतो. काहीही विचारा!</>),
};

export default function WelcomeCards() {
  const { sendMessage, language, currentMode, modes } = useChat();
  const currentModeInfo = modes.find(m => m.id === currentMode) ?? modes[0];
  
  // Use dynamic mode-specific prompts if available, otherwise fallback to static ones
  const chips = currentModeInfo?.example_prompts && currentModeInfo.example_prompts.length > 0 
    ? currentModeInfo.example_prompts 
    : CHIPS[language] || CHIPS.en;

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800,
        background: 'linear-gradient(135deg,var(--purple-light),var(--purple))', color: '#fff',
        boxShadow: '0 4px 14px rgba(37,99,235,0.2)',
      }}>₳</div>

      <div style={{ flex: 1 }}>
        <div style={{
          padding: '12px 16px', borderRadius: '2px 12px 12px 12px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75, marginBottom: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
        }}>
          {GREET[language] || GREET.en}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
          {STATS.map((s, i) => (
            <div key={s.label} className={`stat-card fade-up delay-${i + 1}`} style={{
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px', cursor: 'default',
            }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {language === 'hi' ? s.labelHi : language === 'mr' ? s.labelMr : s.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono,monospace', color: s.color, margin: '3px 0' }}>{s.val}</div>
              <div style={{ fontSize: 9, color: s.up ? 'var(--teal)' : 'var(--red)', fontWeight: 500 }}>
                {language === 'hi' ? s.deltaHi : language === 'mr' ? s.deltaMr : s.delta}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {chips.map((c, i) => (
            <button key={c} className={`chip-btn fade-up delay-${Math.min(i + 1, 6)}`}
              onClick={() => sendMessage(CHIPS.en[i])}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
