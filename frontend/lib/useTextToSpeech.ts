'use client';
import { useState, useCallback, useEffect } from 'react';

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.speechSynthesis) {
        setSupported(false);
      }
    }
  }, []);

  const speak = useCallback(async (text: string, lang: string = 'en-IN') => {
    if (!supported || typeof window === 'undefined') return;

    window.speechSynthesis.cancel(); // Stop any ongoing speech
    setIsSpeaking(true); // Start loading state

    // Clean up markdown
    let cleanText = text.replace(/[*#_`~]/g, '');

    // Translate if local language as per user request
    if (!lang.startsWith('en')) {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/chat/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.english_text) {
            cleanText = data.english_text;
          }
        }
      } catch(e) {
        console.error('Translation failed', e);
      }
      lang = 'en-IN'; // Force English voice for the translated text
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 1.0;
    
    // Attempt to find a suitable voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(lang.split('-')[0])) || voices[0];
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (supported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [supported]);

  return {
    isSpeaking,
    supported,
    speak,
    stop
  };
}
