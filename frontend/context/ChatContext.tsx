'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  streamChat,
  uploadInvoiceFile,
  fetchModes,
  DEFAULT_MODES,
  MODE_COLORS,
  type ModeInfo,
  type QueryResult,
  type UploadResult,
} from '@/lib/arthasyncApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface QueryResultAttachment {
  columns: string[];
  rows: (string | null)[][];
  row_count: number;
  message?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  queryResult?: QueryResultAttachment;
}

export interface Session {
  id: string;
  title: string;
  active: boolean;
  messages: Message[];
  mode: string; // each session remembers its mode
}

export type Lang = 'en' | 'hi' | 'mr';

interface ChatContextType {
  // Sessions
  sessions: Session[];
  messages: Message[];
  newChat: () => void;
  clearChat: () => void;
  switchSession: (id: string) => void;

  // Language
  language: Lang;
  setLanguage: (l: Lang) => void;

  // Mode
  currentMode: string;
  currentModeName: string;
  currentModeColor: string;
  modes: ModeInfo[];
  setMode: (id: string) => void;

  // Messaging
  sendMessage: (text: string) => Promise<void>;
  isLoading: boolean;

  // File upload (Invoice mode)
  uploadedFile: UploadResult | null;
  isUploading: boolean;
  uploadFile: (file: File) => Promise<void>;
  clearUploadedFile: () => void;

  // Legacy compat
  sandboxMode: boolean;
  setSandboxMode: (v: boolean | ((p: boolean) => boolean)) => void;
}

// ── Context setup ─────────────────────────────────────────────────────────────

const ChatContext = createContext<ChatContextType | null>(null);

const welcomeMsg = (lang: Lang, modeName: string): Message => ({
  id: 'welcome',
  role: 'assistant',
  content:
    lang === 'hi'
      ? `नमस्ते! मैं ArthaSync AI हूँ — **${modeName}** मोड में। आज मैं आपके व्यवसाय में कैसे सहायता कर सकता हूँ?`
      : lang === 'mr'
      ? `नमस्कार! मी ArthaSync AI आहे — **${modeName}** मोडमध्ये. आज मी तुमच्या व्यवसायात कशी मदत करू?`
      : `Namaste! I'm ArthaSync AI in **${modeName}** mode. How can I assist your business today?`,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [modes, setModes] = useState<ModeInfo[]>(DEFAULT_MODES);
  const [currentMode, setCurrentMode] = useState<string>('marketing');
  const [language, setLanguage] = useState<Lang>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);

  // Derive mode display name
  const currentModeInfo = modes.find(m => m.id === currentMode) ?? modes[0];
  const currentModeName = currentModeInfo?.name ?? 'Assistant';
  const currentModeColor = MODE_COLORS[currentMode] ?? '#7c5cfc';

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'session-1',
      title: 'New conversation',
      active: true,
      mode: currentMode,
      messages: [welcomeMsg('en', currentModeName)],
    },
  ]);

  // Fetch real modes from backend on mount (best-effort)
  React.useEffect(() => {
    fetchModes().then(setModes).catch(() => {/* defaults already set */});
  }, []);

  const activeSession = sessions.find(s => s.active) ?? sessions[0];

  // ── Session management ──────────────────────────────────────────────────────

  const switchSession = useCallback((id: string) => {
    setSessions(prev => prev.map(s => ({ ...s, active: s.id === id })));
  }, []);

  const newChat = useCallback(() => {
    const newId = `session-${Date.now()}`;
    const titleMap = { en: 'New conversation', hi: 'नई बातचीत', mr: 'नवीन संभाषण' };
    setSessions(prev => [
      ...prev.map(s => ({ ...s, active: false })),
      {
        id: newId,
        title: `${titleMap[language]} #${prev.length + 1}`,
        active: true,
        mode: currentMode,
        messages: [welcomeMsg(language, currentModeName)],
      },
    ]);
    setUploadedFile(null);
  }, [language, currentMode, currentModeName]);

  const clearChat = useCallback(() => {
    newChat();
  }, [newChat]);

  // ── Mode switching ──────────────────────────────────────────────────────────

  const setMode = useCallback((id: string) => {
    setCurrentMode(id);
    // Update the active session's mode too, and refresh the welcome message
    setSessions(prev =>
      prev.map(s => {
        if (!s.active) return s;
        const newModeName = modes.find(m => m.id === id)?.name ?? id;
        return {
          ...s,
          mode: id,
          messages: s.messages.map(msg =>
            msg.id === 'welcome' ? welcomeMsg(language, newModeName) : msg
          ),
        };
      })
    );
    // Clear uploaded file when switching away from invoice mode
    if (id !== 'invoice') setUploadedFile(null);
  }, [modes, language]);

  // ── File upload ─────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadInvoiceFile(file);
      setUploadedFile(result);
      // Append a system-style message showing the upload
      const sessionId = sessions.find(s => s.active)?.id;
      if (sessionId) {
        const notice: Message = {
          id: `upload-${Date.now()}`,
          role: 'assistant',
          content: `📎 **${result.filename}** uploaded successfully (${(result.size_bytes / 1024).toFixed(1)} KB). ${
            result.extracted_text
              ? 'Text extracted — ready to process.'
              : 'No text layer found — will use vision OCR on your next message.'
          }\n\nAsk me to extract invoice data, validate fields, or save to the database.`,
        };
        setSessions(prev =>
          prev.map(s =>
            s.id === sessionId ? { ...s, messages: [...s.messages, notice] } : s
          )
        );
      }
    } catch (err) {
      const errMsg: Message = {
        id: `upload-err-${Date.now()}`,
        role: 'assistant',
        content: `❌ Upload failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      setSessions(prev =>
        prev.map(s =>
          s.active ? { ...s, messages: [...s.messages, errMsg] } : s
        )
      );
    } finally {
      setIsUploading(false);
    }
  }, [sessions]);

  const clearUploadedFile = useCallback(() => setUploadedFile(null), []);

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    const sessionId = activeSession.id;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userInput };

    // Add user message
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s))
    );
    setIsLoading(true);

    // Build history for the API (exclude welcome message, keep last 20 turns)
    const history = activeSession.messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      .slice(-20);

    // Create a placeholder for the streaming assistant message
    const aiMsgId = `a-${Date.now()}`;
    const aiPlaceholder: Message = { id: aiMsgId, role: 'assistant', content: '' };
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, aiPlaceholder] } : s
      )
    );

    let accumulated = '';
    let pendingQueryResult: QueryResultAttachment | null = null;

    await streamChat(
      currentMode,
      language,
      userInput,
      history,
      uploadedFile?.file_id ?? null,
      {
        onChunk: (chunk) => {
          accumulated += chunk;
          setSessions(prev =>
            prev.map(s =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === aiMsgId ? { ...m, content: accumulated } : m
                    ),
                  }
                : s
            )
          );
        },

        onQueryResult: (result: QueryResult) => {
          if (!result.error) {
            pendingQueryResult = {
              columns: result.columns,
              rows: result.rows,
              row_count: result.row_count,
              message: result.message,
            };
            setSessions(prev =>
              prev.map(s =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map(m =>
                        m.id === aiMsgId
                          ? { ...m, queryResult: pendingQueryResult ?? undefined }
                          : m
                      ),
                    }
                  : s
              )
            );
          }
        },

        onDbSave: (data) => {
          // Add a brief confirmation note to the message
          const saveNote = `\n\n✅ **Saved to database** — Invoice #${data.invoice_number ?? ''} · Entry ID: ${data.entry_id ?? ''}`;
          setSessions(prev =>
            prev.map(s =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === aiMsgId ? { ...m, content: m.content + saveNote } : m
                    ),
                  }
                : s
            )
          );
        },

        onDone: () => {
          // Update session title from first user message
          setSessions(prev =>
            prev.map(s => {
              if (s.id !== sessionId) return s;
              const isGenericTitle =
                s.title.startsWith('New conversation') ||
                s.title.startsWith('नई') ||
                s.title.startsWith('नवीन') ||
                s.title.startsWith('Retail Analytics');
              return isGenericTitle
                ? { ...s, title: userInput.substring(0, 26) + (userInput.length > 26 ? '…' : '') }
                : s;
            })
          );
          setIsLoading(false);
          // Clear file attachment after it's been used
          setUploadedFile(null);
        },

        onError: (errorMsg) => {
          setSessions(prev =>
            prev.map(s =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === aiMsgId
                        ? {
                            ...m,
                            content: `❌ **Error:** ${errorMsg}\n\nMake sure the ArthaSync backend is running.`,
                          }
                        : m
                    ),
                  }
                : s
            )
          );
          setIsLoading(false);
        },
      }
    );
  }, [activeSession, currentMode, isLoading, uploadedFile]);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        messages: activeSession?.messages ?? [],
        newChat,
        clearChat,
        switchSession,
        language,
        setLanguage,
        currentMode,
        currentModeName,
        currentModeColor,
        modes,
        setMode,
        sendMessage,
        isLoading,
        uploadedFile,
        isUploading,
        uploadFile,
        clearUploadedFile,
        sandboxMode,
        setSandboxMode,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
