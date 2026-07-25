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
  /** Called when the backend emits a 'confirm_invoice' SSE event */
  onConfirmInvoice?: (data: Record<string, unknown>) => void;
  /** Called when the backend emits an 'intent_detected' SSE event */
  onIntentDetected?: (intent: { mode: string; confidence: number }) => void;
}

/**
 * Stream a chat response from the backend using SSE (server-sent events over POST).
 * Signature: (mode, language, message, history, fileId, callbacks)
 * The language parameter is correctly positioned as the 2nd argument.
 */
export async function streamChat(
  mode: string,
  language: string,
  message: string,
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
        language,
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
    case 'confirm_invoice':
      if (cb.onConfirmInvoice) {
        cb.onConfirmInvoice(event.data as Record<string, unknown>);
      }
      break;
    case 'intent_detected': {
      if (cb.onIntentDetected) {
        const d = event.data as { mode: string; confidence: number };
        cb.onIntentDetected({ mode: d.mode, confidence: d.confidence });
      }
      break;
    }
  }
}

// ── Invoice Confirmation ───────────────────────────────────────────────────────

export async function confirmInvoice(
  invoiceData: Record<string, unknown>,
  sessionId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${BACKEND}/api/chat/confirm-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extracted_data: invoiceData,
        session_id: sessionId,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'Unknown error' }));
      let errStr = `HTTP ${res.status}`;
      if (body.detail) {
        errStr = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
      return { success: false, error: errStr };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Tally / Zoho Status ───────────────────────────────────────────────────────

export async function checkTallyStatus(): Promise<{
  connected: boolean;
  company_name?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`${BACKEND}/api/tally/status`);
    if (!res.ok) return { connected: false };
    return res.json();
  } catch {
    return { connected: false };
  }
}

export async function checkZohoStatus(): Promise<{ connected: boolean }> {
  try {
    const res = await fetch(`${BACKEND}/api/zoho/status`);
    if (!res.ok) return { connected: false };
    return res.json();
  } catch {
    return { connected: false };
  }
}

export async function getZohoAuthUrl(): Promise<string> {
  const res = await fetch(`${BACKEND}/api/zoho/auth-url`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.auth_url as string;
}

// ── Camera / YOLO ─────────────────────────────────────────────────────────────

export async function detectItems(file: File): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BACKEND}/api/camera/detect`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Detection failed' }));
    throw new Error(err.detail || 'Detection failed');
  }
  return res.json();
}

export async function syncToTally(file: File): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BACKEND}/api/camera/sync-to-tally`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Tally sync failed' }));
    throw new Error(err.detail || 'Tally sync failed');
  }
  return res.json();
}

export async function syncToZoho(file: File): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BACKEND}/api/camera/sync-to-zoho`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Zoho sync failed' }));
    throw new Error(err.detail || 'Zoho sync failed');
  }
  return res.json();
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export async function submitOnboarding(
  answers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BACKEND}/api/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answers),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Onboarding failed' }));
    throw new Error(err.detail || 'Onboarding failed');
  }
  return res.json();
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
  {
    id: 'tally_sync',
    name: 'Tally Prime Sync',
    description: 'Sync invoices, vouchers, and ledgers directly to Tally Prime',
    icon: 'ti-building-store',
    capabilities: ['Invoice push', 'Voucher creation', 'Ledger mapping', 'Real-time sync'],
    example_prompts: [
      'Sync this invoice to Tally Prime',
      'Create a sales voucher in Tally',
      'Check Tally connection status',
    ],
  },
  {
    id: 'zoho_sync',
    name: 'Zoho Books Sync',
    description: 'Automatically sync financial data with Zoho Books',
    icon: 'ti-cloud-upload',
    capabilities: ['Invoice creation', 'Contact sync', 'Payment tracking', 'GST filing'],
    example_prompts: [
      'Create an invoice in Zoho Books',
      'Sync contacts to Zoho',
      'Check Zoho connection',
    ],
  },
  {
    id: 'camera_track',
    name: 'Camera Tracker',
    description: 'YOLOv8-powered real-time inventory tracking from camera feed',
    icon: 'ti-camera',
    capabilities: ['Object detection', 'Item counting', 'Confidence scoring', 'Inventory sync'],
    example_prompts: [
      'Detect items in the camera feed',
      'Count stock from webcam',
      'Sync detected items to inventory',
    ],
  },
  {
    id: 'general',
    name: 'General Assistant',
    description: 'All-purpose AI assistant for business queries and advice',
    icon: 'ti-robot',
    capabilities: ['Business advice', 'Document drafting', 'Email writing', 'Q&A'],
    example_prompts: [
      'Draft a professional email to my vendor',
      'Summarise our Q3 performance',
      'Help me write a business proposal',
    ],
  },
];

export const MODE_COLORS: Record<string, string> = {
  invoice: '#00d4aa',
  database: '#7c5cfc',
  operations: '#f5a623',
  marketing: '#e86fa8',
  tally_sync: '#ff6b35',
  zoho_sync: '#e44d26',
  camera_track: '#06b6d4',
  general: '#64748b',
};
