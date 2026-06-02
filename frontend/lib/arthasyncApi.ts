/**
 * ArthaSync API Service
 * Connects the Next.js frontend to the FastAPI backend.
 * Replaces geminiService.ts — all AI calls now go through the FastAPI backend.
 *
 * Backend base URL: NEXT_PUBLIC_BACKEND_URL (default: http://localhost:8000)
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryResult {
  columns: string[];
  rows: (string | null)[][];
  row_count: number;
  message?: string;
  error?: string;
}

export interface ModeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  example_prompts: string[];
}

export interface UploadResult {
  file_id: string;
  filename: string;
  size_bytes: number;
  extracted_text?: string;
  message: string;
}

// ── Modes ─────────────────────────────────────────────────────────────────────

let _cachedModes: ModeInfo[] | null = null;

export async function fetchModes(): Promise<ModeInfo[]> {
  if (_cachedModes) return _cachedModes;
  try {
    const res = await fetch(`${BACKEND}/api/modes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _cachedModes = await res.json();
    return _cachedModes!;
  } catch (e) {
    console.warn('[arthasyncApi] fetchModes failed, using defaults:', e);
    return DEFAULT_MODES;
  }
}

// ── File Upload ───────────────────────────────────────────────────────────────

export async function uploadInvoiceFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BACKEND}/api/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

// ── Streaming Chat ─────────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onQueryResult: (result: QueryResult) => void;
  onDbSave: (data: Record<string, unknown>) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Stream a chat response from the backend using SSE (server-sent events over POST).
 * The caller provides callbacks for each event type.
 */

export async function streamChat(
  mode: string,
  message: string,
  language: string,
  history: HistoryMessage[],
  fileId: string | null,
  callbacks: StreamCallbacks,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        message,
        language,                        // ← ADD THIS
        history: history.slice(-20),
        file_id: fileId || undefined,
}),
    });
  } catch (networkErr) {
    callbacks.onError(
      `Cannot reach ArthaSync backend at ${BACKEND}. ` +
      'Make sure the backend server is running. ' +
      `(${networkErr instanceof Error ? networkErr.message : networkErr})`
    );
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    callbacks.onError(`Backend error ${res.status}: ${body}`);
    return;
  }

  if (!res.body) {
    callbacks.onError('Response body is null');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? ''; // keep any incomplete event

      for (const event of events) {
        const lines = event.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            handleSseEvent(json, callbacks);
          } catch {
            // Non-JSON line — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function handleSseEvent(
  event: Record<string, unknown>,
  cb: StreamCallbacks,
): void {
  switch (event.type) {
    case 'chunk':
      cb.onChunk(String(event.content ?? ''));
      break;
    case 'query_result':
      cb.onQueryResult(event.data as QueryResult);
      break;
    case 'db_save':
      cb.onDbSave(event.data as Record<string, unknown>);
      break;
    case 'done':
      cb.onDone();
      break;
    case 'error':
      cb.onError(String(event.message ?? 'Unknown error'));
      break;
    case 'session':
      // session_id returned — ignore for now
      break;
  }
}

// ── Default mode definitions (fallback when backend unreachable) ───────────────

export const DEFAULT_MODES: ModeInfo[] = [
  {
    id: 'invoice',
    name: 'Invoice Processor',
    description: 'Extract, analyse, and save invoice data with AI precision',
    icon: 'ti-file-invoice',
    capabilities: ['PDF & image OCR', 'Structured data extraction', 'GST/tax parsing', 'Save to ledger'],
    example_prompts: [
      'Extract all line items from this invoice',
      'What is the total amount due?',
      'Save this invoice to the database',
    ],
  },
  {
    id: 'database',
    name: 'Database Intelligence',
    description: 'Natural language to SQL — query your data without writing code',
    icon: 'ti-database',
    capabilities: ['SQL generation', 'Business analytics', 'Revenue reports', 'Query optimisation'],
    example_prompts: [
      'Show me total revenue by month for 2024',
      'Which vendors have unpaid invoices?',
      'What are my top 5 expenses this quarter?',
    ],
  },
  {
    id: 'operations',
    name: 'Operations AI',
    description: 'Automate workflows, optimise processes, and scale your business',
    icon: 'ti-settings',
    capabilities: ['Workflow design', 'SOP creation', 'Process optimisation', 'Automation planning'],
    example_prompts: [
      'Design an invoice approval workflow',
      'Create an SOP for customer complaints',
      'How can I automate my billing process?',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Intelligence',
    description: 'AI-powered content creation, strategy, and growth marketing',
    icon: 'ti-trending-up',
    capabilities: ['Copy generation', 'Social media content', 'SEO strategy', 'Campaign planning'],
    example_prompts: [
      'Write 5 LinkedIn posts for our SaaS launch',
      'Create a 30-day Instagram content calendar',
      'Write a B2B cold email sequence',
    ],
  },
];

export const MODE_COLORS: Record<string, string> = {
  invoice: '#00d4aa',
  database: '#7c5cfc',
  operations: '#f5a623',
  marketing: '#e86fa8',
};
