"""
ArthaSync — Chat Routes

Routing logic:
  DATABASE mode  → nl_to_sql_service.stream_nl_to_sql_response()
                   (NL→SQL→execute→narrate pipeline)
  INVOICE  mode  → llm_service.stream_response() + invoice_db_service.save_invoice_to_ledger()
  Other modes    → llm_service.stream_response() (pure LLM)
"""

import json
import uuid
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import AgentMode, ChatRequest, ChatResponse, ModeInfo
from app.services.llm_service import stream_response, complete_response
from app.services.file_service import get_file_context, get_file_metadata
from app.services.invoice_db_service import save_invoice_to_ledger
from app.services.nl_to_sql_service import stream_nl_to_sql_response

router = APIRouter()


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Main streaming chat endpoint.
    Returns text/event-stream SSE.
    """
    # ── DATABASE mode: dedicated NL→SQL pipeline ──────────────────────────────
    if request.mode == AgentMode.DATABASE:
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

    if request.mode == AgentMode.INVOICE and request.file_id:
        meta = get_file_metadata(request.file_id)
        if meta:
            file_context = meta.get("extracted_text", "")

    return StreamingResponse(
        _stream_with_post_processing(request, file_context),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_with_post_processing(request: ChatRequest, file_context: str | None):
    """
    Stream LLM response. After completion, for INVOICE mode:
      - Extract JSON from the response
      - Save extracted invoice to arthasync.purchase + arthasync.ledger
    """
    accumulated = ""
    session_id = str(uuid.uuid4())

    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    async for chunk in stream_response(
        mode=request.mode,
        message=request.message,
        history=request.history,
        file_context=file_context,
        language=request.language,   # ← ADD THIS LINE
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

    # ── Post-stream: Invoice mode — save extracted data to arthasync DB ───────
    if request.mode == AgentMode.INVOICE and request.file_id:
        extracted = _extract_json(accumulated)
        if extracted:
            try:
                save_result = await save_invoice_to_ledger(extracted)
                yield f"data: {json.dumps({'type': 'db_save', 'data': save_result})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'db_save', 'data': {'success': False, 'error': str(e)}})}\n\n"

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
            "Auto-save to arthasync.purchase + ledger",
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
]


@router.get("/modes", response_model=list[ModeInfo])
async def get_modes():
    """Return available agent modes with metadata."""
    return MODES_META
