'use client';
import { useChat } from '@/context/ChatContext';

const STATS = [
  { label: 'Web Inventory', labelHi: 'वेब इन्वेंटरी', labelMr: 'वेब इन्व्हेंटरी', val: '1,247 SKUs', delta: '↑ 12 added today', deltaHi: '↑ आज 12 जोड़े', deltaMr: '↑ आज 12 जोडले', color: '#00d4aa', up: true },
  { label: 'App Inventory', labelHi: 'ऐप इन्वेंटरी', labelMr: 'अॅप इन्व्हेंटरी', val: '1,244 SKUs', delta: '↓ 3 out of sync', deltaHi: '↓ 3 सिंक से बाहर', deltaMr: '↓ 3 सिंक बाहेर', color: '#a08fff', up: false },
  { label: 'Price Conflicts', labelHi: 'मूल्य विवाद', labelMr: 'किंमत विवाद', val: '3 alerts', delta: '₹150 max delta', deltaHi: '₹150 अधिकतम अंतर', deltaMr: '₹150 कमाल फरक', color: '#f5a623', up: false },
  { label: 'Revenue Today', labelHi: 'आज का राजस्व', labelMr: 'आजचा महसूल', val: '₹84,320', delta: '↑ 8.4% vs yesterday', deltaHi: '↑ कल से 8.4% अधिक', deltaMr: '↑ काल पेक्षा 8.4%', color: '#00d4aa', up: true },
];

const CHIPS = {
  en: ['Show price conflicts', 'Daily manager brief', 'Top selling SKUs', 'Oversell risks', 'Budget analysis', 'Sync status report'],
  hi: ['मूल्य विवाद दिखाएं', 'दैनिक मैनेजर ब्रीफ', 'टॉप बिकने वाले SKU', 'ओवरसेल जोखिम', 'बजट विश्लेषण', 'सिंक स्थिति रिपोर्ट'],
  mr: ['किंमत विवाद दाखवा', 'दैनिक व्यवस्थापक सारांश', 'सर्वाधिक विकले गेलेले SKU', 'ओव्हरसेल धोका', 'बजेट विश्लेषण', 'सिंक स्थिती अहवाल'],
};

const GREET = {
  en: (<>Namaste! I&apos;m <strong style={{ color: '#c4b4ff' }}>ArthaSync AI</strong> — your unified commerce intelligence assistant.<br />I sync inventory across Web, App &amp; POS, detect price conflicts, and give your managers plain-English action briefs. Ask me <em>anything!</em></>),
  hi: (<>नमस्ते! मैं <strong style={{ color: '#c4b4ff' }}>ArthaSync AI</strong> हूं — आपका एकीकृत वाणिज्य सहायक।<br />मैं वेब, ऐप और POS में इन्वेंटरी सिंक करता हूं, मूल्य विवाद पहचानता हूं और मैनेजर को ब्रीफ देता हूं। कुछ भी पूछें!</>),
  mr: (<>नमस्कार! मी <strong style={{ color: '#c4b4ff' }}>ArthaSync AI</strong> आहे — तुमचा एकत्रित व्यापार सहाय्यक.<br />मी वेब, अॅप आणि POS मध्ये इन्व्हेंटरी सिंक करतो, किंमत विवाद शोधतो आणि व्यवस्थापकांना सारांश देतो. काहीही विचारा!</>),
};

export default function WelcomeCards() {
  const { sendMessage, language } = useChat();
  const chips = CHIPS[language] || CHIPS.en;

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800,
        background: 'linear-gradient(135deg,#7c5cfc,#00d4aa)', color: '#fff',
        boxShadow: '0 4px 14px #7c5cfc44',
      }}>₳</div>

      <div style={{ flex: 1 }}>
        <div style={{
          padding: '12px 16px', borderRadius: '2px 12px 12px 12px',
          background: '#13112a', border: '1px solid #1e1b3a',
          fontSize: 13, color: '#c8c6e8', lineHeight: 1.75, marginBottom: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {GREET[language] || GREET.en}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
          {STATS.map((s, i) => (
            <div key={s.label} className={`stat-card fade-up delay-${i + 1}`} style={{
              background: '#0c0b18', border: '1px solid #1e1b3a',
              borderRadius: 10, padding: '10px 12px', cursor: 'default',
            }}>
              <div style={{ fontSize: 9, color: '#444260', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {language === 'hi' ? s.labelHi : language === 'mr' ? s.labelMr : s.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono,monospace', color: s.color, margin: '3px 0' }}>{s.val}</div>
              <div style={{ fontSize: 9, color: s.up ? '#00d4aa' : '#ff6b6b', fontWeight: 500 }}>
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
