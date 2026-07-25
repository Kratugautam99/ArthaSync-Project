# ArthaSync Phase 2 — Comprehensive Upgrade Plan

This plan covers **9 major features** requested for the ArthaSync commerce AI platform. The current stack is **Next.js (frontend)** + **FastAPI + Groq LLaMA (backend)** + **PostgreSQL**, with a chat-based AI dashboard supporting 4 modes (Invoice, Database, Operations, Marketing).

---

## User Review Required

> [!IMPORTANT]
> **Tally Prime requires desktop access** — Tally Prime's API works via XML-over-HTTP on `localhost:9000`. The user's machine must be running TallyPrime with HTTP Server enabled. This means the Tally integration can only work when both ArthaSync backend and TallyPrime are on the same machine or network. **Is this acceptable for your deployment?**

> [!IMPORTANT]
> **Zoho Books requires OAuth 2.0 credentials** — You need to register an app at [Zoho Developer Console](https://api-console.zoho.com) to get a `Client ID` and `Client Secret`. The integration will support the OAuth flow. **Do you have Zoho Books credentials, or should we build the integration with a placeholder flow for now?**

> [!WARNING]
> **YOLO custom model training is required** — For camera-based item tracking, YOLO needs to recognize YOUR specific retail products. The pre-trained COCO model only recognizes 80 generic objects (person, car, bottle, etc.). **You will need to photograph and annotate your actual inventory items** using a tool like Roboflow. For now, we will build the infrastructure with the pre-trained YOLOv8 model and make it easy to swap in your custom weights later.

> [!IMPORTANT]
> **Groq API efficiency** — Feature #8 asks for "dynamic mode switching" in an all-in-one chat. The current system uses separate modes. We will implement an **intent classifier** that runs a fast 8B model to route queries, while heavier queries go to the 70B model — all within a single unified chat experience. This reduces API calls significantly.

---

## Open Questions

1. **Tally Prime version**: Are you using TallyPrime 4.x or earlier? (The XML API structure differs slightly.)
2. **Zoho Books region**: Which Zoho data center do you use — `.com`, `.in`, `.eu`? (API base URL changes.)
3. **Camera setup**: Will you use a webcam attached to a desktop, a phone camera, or CCTV/IP camera for YOLO item tracking?
4. **Business type**: For the introductory quiz (Feature #5), what are the most common SME types you're targeting? (e.g., retail shop, wholesaler, restaurant, service provider)
5. **Hosting**: Will this run locally (Docker) or be deployed to a cloud server? This affects the YOLO and TTS/STT architecture.

---

## Proposed Changes

### Phase 2A: Brain Engine — Unified Dynamic Chat with Intent Routing (Features #5, #8)

This is the **core architectural change** that addresses both the "all-in-one chat" request and the "introductory quiz" request. Instead of manual mode switching, the LLM itself will classify intent and route to the appropriate handler.

---

#### [NEW] [intent_classifier.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/intent_classifier.py)

A lightweight intent classifier that uses the **8B fast model** (1 API call, ~50 tokens) to classify user intent before routing:

```python
# Classifies user message → one of: invoice, database, operations, marketing, 
#   tally_sync, zoho_sync, camera_track, general
# Uses Groq 8B model with a tiny system prompt (< 100 tokens)
# Returns intent + confidence score
# Falls back to "general" on any error
```

This **replaces manual mode switching** with automatic routing. The sidebar modes become optional shortcuts, not mandatory.

#### [NEW] [onboarding_service.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/onboarding_service.py)

Introductory quiz system that runs on first login:

```
- 5-question quiz: business type, size, existing software, pain points, priorities
- Generates a "business profile" stored in DB
- Profile determines which tools/modes are enabled
- Small businesses: Invoice + Database only (fewer API calls)
- Medium businesses: All modes + Tally/Zoho integrations
- Profile can be updated later via settings
```

#### [MODIFY] [schemas.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/models/schemas.py)

- Add `BusinessProfile` model (business_type, size, enabled_tools, integrations)
- Add `OnboardingRequest` / `OnboardingResponse` models
- Add `IntentResult` model
- Keep existing `AgentMode` enum but add new values: `TALLY_SYNC`, `ZOHO_SYNC`, `CAMERA_TRACK`, `GENERAL`

#### [MODIFY] [chat.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/routes/chat.py)

- Replace hardcoded mode-based routing with intent classifier
- Add unified `/chat/stream` that auto-detects mode from message content
- Keep explicit mode override as optional parameter (for power users)
- Add `/onboarding` endpoint for the setup quiz

#### [MODIFY] [system_prompts.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/prompts/system_prompts.py)

- Add prompts for new modes (Tally, Zoho, Camera, General)
- Add intent classification prompt (tiny, optimized for 8B model)
- Add onboarding quiz conversation prompt

#### [MODIFY] [llm_service.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/llm_service.py)

- Add `classify_intent()` function using fast model (saves API quota)
- Add programmatic routing logic that avoids unnecessary LLM calls
- Cache intent classification for follow-up messages in same conversation
- Use fast 8B model for simple queries, 70B only for complex analysis

---

### Phase 2B: Invoice Confirmation Before DB Save (Feature #6)

Currently, the invoice data is auto-saved after extraction. This changes it to a **two-step confirmation flow**.

---

#### [MODIFY] [chat.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/routes/chat.py)

- After invoice extraction, send extracted data back to frontend as a `confirm_invoice` SSE event
- Do NOT auto-save to database
- Wait for explicit user confirmation via a new `/chat/confirm-invoice` endpoint
- Only save when user approves

#### [MODIFY] [ChatContext.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/context/ChatContext.tsx)

- Handle new `confirm_invoice` SSE event
- Show extracted data in an editable card with "✅ Confirm & Save" / "❌ Cancel" buttons
- Allow user to edit extracted fields before saving
- Add `confirmInvoice()` and `rejectInvoice()` actions

#### [NEW] [InvoiceConfirmCard.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/InvoiceConfirmCard.tsx)

Beautiful card component showing extracted invoice data:
- Editable fields: vendor name, amounts, GST, line items
- "Confirm & Save" button (green glow)
- "Edit & Retry" button
- "Cancel" button
- Visual diff highlighting what the AI extracted

---

### Phase 2C: Tally Prime Integration (Features #1, #2, #7)

Tally Prime uses an **XML-over-HTTP** API on `localhost:9000`. We'll create a service that pushes purchase/sales vouchers.

---

#### [NEW] [tally_service.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/tally_service.py)

```
- connect_to_tally(host, port): Test connection to TallyPrime HTTP server
- push_purchase_voucher(invoice_data): Create XML envelope → POST to Tally
- push_sales_voucher(invoice_data): Create sales voucher XML → POST
- fetch_stock_items(): GET stock item list from Tally
- push_stock_item(item): Create/update stock item in Tally
- sync_yolo_items_to_tally(detected_items): Push YOLO-detected items as stock items
- XML templates for: Purchase, Sales, Stock Item, Ledger masters
```

#### [NEW] [tally.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/routes/tally.py)

- `POST /api/tally/connect` — Test Tally connection
- `POST /api/tally/push-voucher` — Push a voucher to Tally
- `GET /api/tally/stock-items` — Fetch stock items
- `POST /api/tally/sync-items` — Sync YOLO-tracked items to Tally

#### [MODIFY] [config.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/config.py)

Add Tally configuration:
```python
TALLY_HOST: str = "localhost"
TALLY_PORT: int = 9000
TALLY_COMPANY: str = ""
```

---

### Phase 2D: Zoho Books Integration (Features #2, #7)

Zoho Books uses a **REST API with OAuth 2.0**. We'll support invoice creation, purchase orders, and item management.

---

#### [NEW] [zoho_service.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/zoho_service.py)

```
- OAuth 2.0 flow: authorize, token exchange, refresh
- create_invoice(data): POST to Zoho Books /invoices
- create_purchase_order(data): POST to /purchaseorders
- list_items(): GET /items
- create_item(data): POST /items
- sync_yolo_items_to_zoho(detected_items): Push YOLO-detected items to Zoho
- Rate limit handling (100 req/min)
```

#### [NEW] [zoho.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/routes/zoho.py)

- `GET /api/zoho/auth-url` — Generate OAuth authorization URL
- `GET /api/zoho/callback` — OAuth callback handler
- `POST /api/zoho/push-invoice` — Create invoice in Zoho
- `GET /api/zoho/items` — List items
- `POST /api/zoho/sync-items` — Sync YOLO items to Zoho

#### [MODIFY] [config.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/config.py)

Add Zoho configuration:
```python
ZOHO_CLIENT_ID: str = ""
ZOHO_CLIENT_SECRET: str = ""
ZOHO_REDIRECT_URI: str = "http://localhost:8000/api/zoho/callback"
ZOHO_ORG_ID: str = ""
ZOHO_REGION: str = "in"  # .com, .in, .eu
```

---

### Phase 2E: YOLO Camera-Based Item Tracking (Features #1, #4, #7)

Use **Ultralytics YOLOv8** for real-time item detection from camera feeds. Detected items get pushed to Tally/Zoho.

---

#### [NEW] [yolo_service.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/yolo_service.py)

```
- Uses ultralytics YOLOv8 (pre-trained, swappable for custom weights)
- detect_items_from_image(image_bytes): Run YOLO on a single frame
- detect_items_from_video(video_path): Process video file
- track_items_from_stream(rtsp_url): Real-time tracking with ByteTrack
- Returns: list of {item_name, confidence, count, bounding_box}
- Supports custom model weights via config
```

#### [NEW] [camera.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/routes/camera.py)

- `POST /api/camera/detect` — Upload image/frame → detect items
- `POST /api/camera/detect-video` — Upload video → detect items
- `POST /api/camera/sync-to-tally` — Detect + push to Tally
- `POST /api/camera/sync-to-zoho` — Detect + push to Zoho
- `WebSocket /api/camera/live` — Real-time camera feed detection

#### [NEW] [CameraTracker.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/CameraTracker.tsx)

- Camera feed viewer using `getUserMedia` API
- Real-time bounding box overlay on detected items
- Item count display
- "Sync to Tally" / "Sync to Zoho" buttons
- Manual capture button for single-frame detection

#### [MODIFY] [pyproject.toml](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/pyproject.toml)

Add dependencies:
```toml
"ultralytics>=8.2.0",
"opencv-python-headless>=4.9.0",
```

---

### Phase 2F: TTS & STT — Voice Support (Feature #3)

Using **free, open-source, browser-native** solutions:
- **STT (Speech-to-Text)**: Web Speech API (built-in, zero-cost, works offline in Chrome)
- **TTS (Text-to-Speech)**: Web Speech API + optional **Piper TTS** (WASM) for higher quality

Both run **entirely in the browser** — zero API calls, zero cost, zero server load.

---

#### [NEW] [useSpeechRecognition.ts](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/lib/useSpeechRecognition.ts)

Custom React hook for Speech-to-Text:
```
- Uses Web Speech API (SpeechRecognition)
- Supports Hindi, Marathi, English
- Returns: { transcript, isListening, startListening, stopListening }
- Falls back gracefully if browser doesn't support it
- Continuous mode for longer dictation
```

#### [NEW] [useTextToSpeech.ts](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/lib/useTextToSpeech.ts)

Custom React hook for Text-to-Speech:
```
- Uses Web Speech API (SpeechSynthesis)
- Auto-selects voice based on current language (en/hi/mr)
- Returns: { speak, stop, isSpeaking }
- "Read aloud" button on assistant messages
- Strips markdown before speaking
```

#### [MODIFY] [ChatInput.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/ChatInput.tsx)

- Wire up the existing microphone button (currently shows "coming soon")
- Add recording state animation (pulsing red ring)
- Auto-submit transcribed text
- Add voice toggle in settings

#### [MODIFY] [MessageBubble.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/MessageBubble.tsx)

- Add "🔊 Read aloud" button on assistant messages
- Speaker animation while reading
- Stop button to cancel TTS

---

### Phase 2G: UI/UX Overhaul (Feature #9)

A major visual upgrade to make the dashboard feel **premium and state-of-the-art**.

---

#### [MODIFY] [globals.css](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/app/globals.css)

Major CSS overhaul:
- Add glassmorphism effects (`backdrop-filter: blur()` + semi-transparent backgrounds)
- Animated gradient borders on active elements
- Smoother, more refined animations
- Better typography hierarchy
- Responsive design for mobile
- Dark mode refinements with richer color palette
- Animated background mesh gradient
- Better scrollbar styling
- Message bubble entrance animations

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/Sidebar.tsx)

- Add glassmorphism panel effect
- Animated mode switching with slide transitions
- Integration status indicators (Tally ✅/❌, Zoho ✅/❌)
- Collapsible sidebar for mobile
- Onboarding progress indicator
- User profile section at bottom

#### [MODIFY] [dashboard/page.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/app/dashboard/page.tsx)

- Remove hardcoded mode display from topbar (now auto-detected)
- Add dynamic intent indicator (shows what the AI thinks you're asking about)
- Add integration status bar
- Improved topbar with glassmorphism
- Animated background effects

#### [MODIFY] [WelcomeCards.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/WelcomeCards.tsx)

- Redesigned welcome experience with animated cards
- Show onboarding prompt for new users
- Dynamic stats that update based on business profile
- Better card hover effects with gradient borders
- Quick action chips redesigned with icons

#### [NEW] [IntegrationPanel.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/IntegrationPanel.tsx)

Settings/integration panel component:
- Tally Prime connection settings (host, port, test button)
- Zoho Books OAuth flow (connect/disconnect)
- YOLO camera settings (model selection, confidence threshold)
- Business profile editor
- Voice settings (TTS/STT language, voice selection)

#### [NEW] [OnboardingQuiz.tsx](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/frontend/components/OnboardingQuiz.tsx)

Full-screen onboarding experience:
- Beautiful animated quiz with 5 questions
- Progress bar
- Business type selection with icons
- Software integration checkboxes
- Generates optimized profile on completion
- Can be revisited from settings

---

### Phase 2H: Image/Video Processing for Manual Tracking (Feature #4)

For pen-and-paper manual tracking, we'll use OCR + LLM to extract items from handwritten notes and register slips.

---

#### [MODIFY] [file_service.py](file:///c:/Users/kratu/Downloads/Github%20Repositories/ArthaSync-Project/backend/app/services/file_service.py)

- Add handwritten text recognition via Groq Vision (llama-4-scout)
- Add video frame extraction for processing recorded sales
- Parse handwritten ledger entries and register slips
- Extract item names, quantities, and prices from messy handwriting

---

## File Summary

### New Files (12)
| File | Purpose |
|------|---------|
| `backend/app/services/intent_classifier.py` | Auto-routes user messages to correct handler |
| `backend/app/services/onboarding_service.py` | Business quiz & profile management |
| `backend/app/services/tally_service.py` | Tally Prime XML API integration |
| `backend/app/services/zoho_service.py` | Zoho Books REST API + OAuth |
| `backend/app/services/yolo_service.py` | YOLOv8 item detection & tracking |
| `backend/app/routes/tally.py` | Tally API endpoints |
| `backend/app/routes/zoho.py` | Zoho API endpoints |
| `backend/app/routes/camera.py` | Camera/YOLO detection endpoints |
| `frontend/lib/useSpeechRecognition.ts` | Browser-native STT hook |
| `frontend/lib/useTextToSpeech.ts` | Browser-native TTS hook |
| `frontend/components/InvoiceConfirmCard.tsx` | Invoice confirmation UI |
| `frontend/components/CameraTracker.tsx` | Camera feed + YOLO overlay |
| `frontend/components/IntegrationPanel.tsx` | Settings & integrations UI |
| `frontend/components/OnboardingQuiz.tsx` | First-run setup wizard |

### Modified Files (13)
| File | Changes |
|------|---------|
| `backend/app/config.py` | +Tally, Zoho, YOLO config vars |
| `backend/app/models/schemas.py` | +BusinessProfile, +IntentResult, +new AgentModes |
| `backend/app/routes/chat.py` | Intent routing, invoice confirmation, unified chat |
| `backend/app/services/llm_service.py` | +classify_intent(), smart model selection |
| `backend/app/services/file_service.py` | +handwriting OCR, +video frame extraction |
| `backend/app/prompts/system_prompts.py` | +prompts for new modes & intent classifier |
| `backend/app/main.py` | Register new route modules |
| `backend/pyproject.toml` | +ultralytics, +opencv-python-headless |
| `frontend/context/ChatContext.tsx` | +invoice confirmation flow, +voice state |
| `frontend/components/ChatInput.tsx` | +working voice input, +recording animation |
| `frontend/components/MessageBubble.tsx` | +TTS read-aloud button |
| `frontend/components/Sidebar.tsx` | +glassmorphism, +integration status |
| `frontend/app/globals.css` | Major visual overhaul |
| `frontend/app/dashboard/page.tsx` | +dynamic intent display, +UI refresh |
| `frontend/components/WelcomeCards.tsx` | +animated redesign, +onboarding prompt |

---

## Verification Plan

### Automated Tests
```bash
# Backend: test intent classifier
cd backend && python -m pytest tests/test_intent_classifier.py -v

# Backend: test Tally XML generation
cd backend && python -m pytest tests/test_tally_service.py -v

# Backend: test YOLO detection
cd backend && python -m pytest tests/test_yolo_service.py -v

# Frontend: build check
cd frontend && npm run build
```

### Manual Verification
1. **Unified chat**: Send messages like "show my revenue", "extract this invoice", "write a LinkedIn post" — verify correct intent routing without manual mode switching
2. **Invoice confirmation**: Upload an invoice → verify extraction is shown as editable card → confirm to save → check database
3. **Voice**: Click mic button → speak → verify transcription appears in chat input → send
4. **TTS**: Click read-aloud on assistant message → verify speech output in correct language
5. **Onboarding**: Clear profile → refresh → verify quiz appears → complete quiz → verify modes are filtered
6. **YOLO**: Upload a product image → verify detected items with bounding boxes
7. **Tally** (requires Tally running): Test connection → push a voucher → verify in TallyPrime
8. **Zoho** (requires credentials): OAuth flow → create invoice → verify in Zoho Books
9. **UI**: Visual inspection of glassmorphism effects, animations, mobile responsiveness

---

## Implementation Order

| Priority | Phase | Features | Est. Effort |
|----------|-------|----------|-------------|
| 🔴 P0 | 2A | Brain engine + intent routing + onboarding | Large |
| 🔴 P0 | 2B | Invoice confirmation flow | Medium |
| 🔴 P0 | 2G | UI/UX overhaul | Large |
| 🟡 P1 | 2F | TTS & STT (browser-native, zero-cost) | Small |
| 🟡 P1 | 2C | Tally Prime integration | Medium |
| 🟡 P1 | 2D | Zoho Books integration | Medium |
| 🟢 P2 | 2E | YOLO camera tracking | Large |
| 🟢 P2 | 2H | Handwritten/video processing | Medium |

We will implement in priority order. P0 features first, then P1, then P2.
