'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionProps {
  language?: string; // e.g. 'en-IN', 'hi-IN', 'mr-IN'
  onResult: (transcript: string, isFinal: boolean) => void;
}

export function useSpeechRecognition({ language = 'en-IN', onResult }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setSupported(false);
      }
    }
  }, []);

  const toggleListening = useCallback(async () => {
    if (!supported) return;
    
    if (isListening && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if ((mediaRecorderRef.current as any)._recognition) {
        try { (mediaRecorderRef.current as any)._recognition.stop(); } catch(e) {}
      }
      setIsListening(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        chunksRef.current = [];
        
        let hasWebSpeechResult = false;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        // Spin up Web Speech API purely for visual interim feedback
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = language;
          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interimTranscript += event.results[i][0].transcript;
            }
            if (interimTranscript) {
              hasWebSpeechResult = true;
              onResult(interimTranscript, false);
            }
          };
          recognition.onerror = () => {}; // Silently ignore all errors (e.g. 'network') since Groq is the primary engine
          try {
            recognition.start();
            (mediaRecorder as any)._recognition = recognition;
          } catch(e) {}
        }
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop()); // Clean up mic
          
          // If native Web Speech API worked (which is highly accurate for Hindi/Marathi),
          // skip the Whisper backend call to avoid overwriting with hallucinated translations.
          if (hasWebSpeechResult) return;
          
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('language', language);
            
            const res = await fetch('http://127.0.0.1:8000/api/chat/transcribe', {
              method: 'POST',
              body: formData,
            });
            
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                // Groq's Whisper result overrides the interim text perfectly
                onResult(data.text, true);
              }
            } else {
              console.error('Transcription failed:', await res.text());
            }
          } catch (e) {
            console.error('Error sending audio to backend:', e);
          }
        };
        
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsListening(true);
      } catch (e) {
        console.error('Microphone access denied or failed', e);
      }
    }
  }, [isListening, supported, language, onResult]);

  return {
    isListening,
    supported,
    toggleListening
  };
}
