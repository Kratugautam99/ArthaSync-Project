"""
ArthaSync — LLM Service
Groq API integration with streaming support.
Uses langchain-groq under the hood for easy provider swapping later.
"""

import json
import uuid
from typing import AsyncGenerator, List

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.config import settings
from app.models.schemas import AgentMode, ChatMessage, MessageRole
from app.prompts.system_prompts import get_system_prompt


def _build_lc_messages(
    mode: AgentMode,
    history: List[ChatMessage],
    user_message: str,
    file_context: str | None = None,
    language: str = "en",                                      # ← NEW
) -> list:
    messages = [SystemMessage(content=get_system_prompt(mode, language))] 
    for msg in history:
        if msg.role == MessageRole.USER:
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == MessageRole.ASSISTANT:
            messages.append(AIMessage(content=msg.content))

    if file_context:
        full_message = f"[DOCUMENT CONTENT]\n{file_context}\n\n[USER QUESTION]\n{user_message}"
    else:
        full_message = user_message

    messages.append(HumanMessage(content=full_message))
    return messages


def get_llm(streaming: bool = False, fast: bool = False) -> ChatGroq:
    """Return a configured ChatGroq instance."""
    model = settings.GROQ_FAST_MODEL if fast else settings.GROQ_MODEL
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=model,
        temperature=0.7,
        streaming=streaming,
        max_tokens=2048,
    )


async def stream_response(
    mode: AgentMode,
    message: str,
    history: List[ChatMessage],
    file_context: str | None = None,
    language: str = "en",           # ← NEW
) -> AsyncGenerator[str, None]:
    """
    Stream SSE-formatted chunks from Groq.
    Yields JSON strings: {"type": "chunk", "content": "..."}
    """
    session_id = str(uuid.uuid4())
    llm = get_llm(streaming=True)
    messages = _build_lc_messages(mode, history, message, file_context, language)  # ← passes language

    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    try:
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.content})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

    except Exception as e:
        error_msg = str(e)
        if settings.GROQ_API_KEY:
            error_msg = error_msg.replace(settings.GROQ_API_KEY, "[REDACTED]")
        yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"


async def complete_response(
    mode: AgentMode,
    message: str,
    history: List[ChatMessage],
    file_context: str | None = None,
    language: str = "en",           # ← NEW
) -> tuple[str, str]:
    """
    Non-streaming completion. Returns (content, session_id).
    """
    session_id = str(uuid.uuid4())
    llm = get_llm(streaming=False)
    messages = _build_lc_messages(mode, history, message, file_context, language)  # ← passes language

    response = await llm.ainvoke(messages)
    return response.content, session_id
