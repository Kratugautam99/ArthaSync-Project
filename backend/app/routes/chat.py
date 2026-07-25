"""
ArthaSync — Chat Routes (Phase 2)

Routing logic:
  DATABASE mode    → nl_to_sql_service.stream_nl_to_sql_response()
  INVOICE  mode    → llm_service.stream_response() + confirm_invoice SSE event
                     (auto-save REMOVED; user must POST /chat/confirm-invoice)
  Other modes      → llm_service.stream_response() (pure LLM)
  None (auto)      → intent_classifier.classify_intent() → route accordingly
"""

import json
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.schemas import AgentMode, ChatRequest, ChatResponse, ModeInfo
from app.services.llm_service import stream_response, complete_response
from app.services.file_service import get_file_context, get_file_metadata
from app.services.invoice_db_service import save_invoice_to_ledger
from app.services.nl_to_sql_service import stream_nl_to_sql_response
from app.services.onboarding_service import save_profile, get_profile, get_enabled_modes
from app.services.llm_service import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

router = APIRouter()


# ── Additional Pydantic schemas (Phase 2) ─────────────────────────────────────

class InvoiceConfirmRequest(BaseModel):
    """Request body for the /chat/confirm-invoice endpoint."""
    extracted_data: dict
    session_id: Optional[str] = None


class OnboardingRequest(BaseModel):
    """Request body for the /onboarding endpoint."""
    business_name: str
    industry: Optional[str] = None
    tally_integration: bool = False
    zoho_integration: bool = False
    camera_tracking: bool = False
    extra: Optional[dict] = None

class TranslateRequest(BaseModel):
    text: str


# ── Main streaming endpoint ───────────────────────────────────────────────────

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Main streaming chat endpoint.
    Returns text/event-stream SSE.

    If request.mode is None the intent classifier auto-detects the mode.
    """
    mode = request.mode
    file_id = request.file_id

    # ── Default to GENERAL when caller sends mode=None ──────────────────────────
    if mode is None:
        mode = AgentMode.GENERAL

    # ── DATABASE mode: dedicated NL→SQL pipeline ──────────────────────────────
    if mode == AgentMode.DATABASE:
        return StreamingResponse(
            stream_nl_to_sql_response(
                user_question=request.message,
                history=request.history,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ── All other modes: standard LLM streaming ───────────────────────────────
    file_context: str | None = None

    if mode == AgentMode.INVOICE and file_id:
        meta = get_file_metadata(file_id)
        if meta:
            file_context = meta.get("extracted_text", "")

    # Clone request with the resolved mode (needed by _stream_with_post_processing)
    resolved_request = request.model_copy(update={"mode": mode})

    return StreamingResponse(
        _stream_with_post_processing(resolved_request, file_context, detected_mode=mode),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_with_post_processing(
    request: ChatRequest,
    file_context: str | None,
    detected_mode: AgentMode | None = None,
):
    """
    Stream LLM response with post-stream handling.

    INVOICE mode changes (Phase 2):
      - After full response is accumulated, extract JSON invoice data.
      - Emit a 'confirm_invoice' SSE event — do NOT auto-save.
      - User must call POST /chat/confirm-invoice to persist the invoice.

    Auto-mode:
      - Emit 'intent_detected' SSE event early in the stream.
    """
    accumulated = ""
    session_id = str(uuid.uuid4())

    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    # Emit intent_detected when mode was auto-classified
    if detected_mode is not None:
        yield f"data: {json.dumps({'type': 'intent_detected', 'mode': detected_mode.value, 'confidence': 0.9})}\n\n"

    async for chunk in stream_response(
        mode=request.mode,
        message=request.message,
        history=request.history,
        file_context=file_context,
        language=request.language,
    ):
        # stream_response already yields formatted SSE — pass through
        raw = chunk.replace("data: ", "", 1)
        yield chunk

        try:
            ev = json.loads(raw.strip())
            if ev.get("type") == "chunk":
                accumulated += ev["content"]
        except Exception:
            pass

    # ── Post-stream: INVOICE mode — emit confirm_invoice instead of auto-saving ──
    if request.mode == AgentMode.INVOICE:
        extracted = _extract_json(accumulated)
        if extracted:
            yield f"data: {json.dumps({'type': 'confirm_invoice', 'data': extracted, 'session_id': session_id})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


def _extract_json(text: str) -> dict | None:
    """Extract the first JSON object from markdown-fenced or raw LLM output."""
    import re
    # Try fenced block first
    m = re.search(r"```(?:json)?\s*(\{[\s\S]+?\})\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # Try bare JSON object
    m = re.search(r"(\{[\s\S]+\})", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    return None


# ── Confirm-invoice endpoint (Phase 2) ────────────────────────────────────────

@router.post("/chat/confirm-invoice")
async def confirm_invoice(request: InvoiceConfirmRequest):
    """
    Persist a previously extracted invoice after user explicit confirmation.

    The frontend should call this after the user clicks 'Confirm & Save'
    in response to the 'confirm_invoice' SSE event.
    """
    if not request.extracted_data:
        raise HTTPException(status_code=400, detail="extracted_data is required and must be non-empty.")

    try:
        result = await save_invoice_to_ledger(request.extracted_data)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Database save failed"))
        return {"success": True, "result": result, "session_id": request.session_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Onboarding endpoint ────────────────────────────────────────────────────────

@router.post("/onboarding")
async def onboarding(request: OnboardingRequest):
    """
    Save / update the business profile and return enabled modes.

    This powers the onboarding wizard: after the user fills in their
    business details and integration flags, the frontend calls this endpoint
    to persist the profile and discover which agent modes are unlocked.
    """
    profile_data = {
        "business_name": request.business_name,
        "industry": request.industry,
        "tally_integration": request.tally_integration,
        "zoho_integration": request.zoho_integration,
        "camera_tracking": request.camera_tracking,
        **(request.extra or {}),
    }

    result = save_profile(profile_data)
    enabled_modes = get_enabled_modes(result["profile"])

    return {
        "status": "onboarding_complete",
        "profile": result["profile"],
        "enabled_modes": enabled_modes,
    }


# ── Translation endpoint (Phase 2 TTS) ────────────────────────────────────────

@router.post("/chat/translate")
async def translate_text(request: TranslateRequest):
    """
    Translates local language text (Hindi/Marathi) to English 
    for frontend Text-To-Speech playback.
    """
    try:
        llm = get_llm(fast=True)
        response = await llm.ainvoke([
            SystemMessage(content="You are a professional translator. Translate the given text to English. Output ONLY the translated English text, without any quotes or conversational filler."),
            HumanMessage(content=request.text)
        ])
        return {"english_text": response.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Transcription endpoint (Phase 2 STT via Whisper) ───────────────────────────

@router.post("/chat/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("en-IN")
):
    """
    Transcribes audio using Groq's whisper-large-v3-turbo model.
    Replaces flaky browser native Web Speech API.
    """
    try:
        from app.services.llm_service import _get_groq_client
        client = _get_groq_client()
        
        base_lang = language.split("-")[0]
        
        file_bytes = await file.read()
        
        prompt_map = {
            "hi": "यह एक हिंदी ऑडियो है। इसे देवनागरी लिपि में ही लिखें।",
            "mr": "हे एक मराठी ऑडिओ आहे. हे देवनागरी लिपीतच लिहा.",
            "en": "This is an English audio."
        }
        
        transcription = client.audio.transcriptions.create(
            file=("audio.webm", file_bytes),
            model="whisper-large-v3-turbo",
            language=base_lang,
            prompt=prompt_map.get(base_lang, "")
        )
        return {"text": transcription.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Modes metadata ─────────────────────────────────────────────────────────────

MODES_META: list[ModeInfo] = [
    ModeInfo(
        id=AgentMode.INVOICE,
        name="Invoice Intelligence",
        description="Extract, validate, and save invoice data from uploaded documents",
        icon="📄",
        capabilities=[
            "OCR & text extraction from invoice images/PDFs",
            "GST (CGST/SGST) breakdown parsing",
            "Confirm-to-save flow — no accidental writes",
            "Anomaly detection and field validation",
        ],
        example_prompts=[
            "Extract all details from this invoice",
            "What is the total GST amount on this bill?",
            "Save this invoice to the database",
        ],
    ),
    ModeInfo(
        id=AgentMode.DATABASE,
        name="Database Intelligence",
        description="Ask questions about your financial data in plain English",
        icon="🗄️",
        capabilities=[
            "Natural language → SQL conversion",
            "Sales, purchase, expense analytics",
            "Overdue payment tracking",
            "Cash flow and ledger summaries",
        ],
        example_prompts=[
            "Show me all unpaid invoices this month",
            "Who are my top 5 customers by revenue?",
            "What is total GST collected in FY 2024-25?",
            "List all overdue vendor bills",
        ],
    ),
    ModeInfo(
        id=AgentMode.OPERATIONS,
        name="Operations AI",
        description="Workflow design, SOPs, and business process optimization",
        icon="⚙️",
        capabilities=[
            "SOP and workflow documentation",
            "Automation planning (Zapier, Make, n8n)",
            "Bottleneck analysis",
            "Project timeline generation",
        ],
        example_prompts=[
            "Create an SOP for our invoice approval process",
            "Design a workflow for onboarding new vendors",
        ],
    ),
    ModeInfo(
        id=AgentMode.MARKETING,
        name="Marketing Intelligence",
        description="Content creation, campaigns, and growth strategy",
        icon="📈",
        capabilities=[
            "Ad copy and landing page content",
            "Social media content (LinkedIn, Instagram, X)",
            "Email campaigns",
            "SEO briefs and keyword strategy",
        ],
        example_prompts=[
            "Write a LinkedIn post about our new invoicing feature",
            "Create an email campaign for overdue payment reminders",
        ],
    ),
    ModeInfo(
        id=AgentMode.TALLY_SYNC,
        name="Tally Prime Sync",
        description="Push vouchers, ledgers, and stock items to Tally Prime",
        icon="🔄",
        capabilities=[
            "Push sales/purchase vouchers to Tally Prime",
            "Create and update stock items",
            "Sync ledger entries",
            "Validate Tally company connection",
        ],
        example_prompts=[
            "Push this invoice to Tally Prime",
            "Create a stock item for 50 units of Dell laptop",
            "Sync today's sales vouchers to Tally",
        ],
    ),
    ModeInfo(
        id=AgentMode.ZOHO_SYNC,
        name="Zoho Books Sync",
        description="Sync invoices, contacts, and items to Zoho Books",
        icon="☁️",
        capabilities=[
            "Push invoices to Zoho Books",
            "Create contacts and items",
            "Fetch Zoho organisation details",
            "OAuth token refresh handling",
        ],
        example_prompts=[
            "Push this invoice to Zoho Books",
            "Create a new customer contact in Zoho",
            "Sync inventory items to Zoho",
        ],
    ),
    ModeInfo(
        id=AgentMode.CAMERA_TRACK,
        name="Camera Track",
        description="Detect and count inventory items from camera images or video",
        icon="📷",
        capabilities=[
            "YOLOv8 COCO object detection",
            "Image and video frame sampling",
            "Auto-sync detected items to Tally or Zoho",
            "Annotated image output with bounding boxes",
        ],
        example_prompts=[
            "Detect items in this warehouse photo",
            "Count products from this camera feed",
            "Sync detected stock to Tally Prime",
        ],
    ),
    ModeInfo(
        id=AgentMode.GENERAL,
        name="General Assistant",
        description="General business assistant — ask anything about ArthaSync or your business",
        icon="💬",
        capabilities=[
            "Business advice for Indian SMEs",
            "ArthaSync feature guidance",
            "Financial terminology explained",
            "Mode selection help",
        ],
        example_prompts=[
            "What can ArthaSync do for my business?",
            "How do I set up Tally integration?",
            "Explain GST filing deadlines",
        ],
    ),
]


@router.get("/modes", response_model=list[ModeInfo])
async def get_modes():
    """Return available agent modes with metadata."""
    return MODES_META
