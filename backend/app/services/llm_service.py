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


from groq import Groq

def _get_groq_client() -> Groq:
    """Return a raw Groq client for endpoints that langchain doesn't support (like Audio)."""
    return Groq(api_key=settings.GROQ_API_KEY)

def get_llm(streaming: bool = False, fast: bool = False) -> ChatGroq:
    """Return a configured ChatGroq instance."""
    model = settings.GROQ_FAST_MODEL if fast else settings.GROQ_MODEL
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=model,
        temperature=0.7,
        streaming=streaming,
        max_tokens=2500,
    )


from langchain_core.messages import ToolMessage

async def stream_response(
    mode: AgentMode,
    message: str,
    history: List[ChatMessage],
    file_context: str | None = None,
    language: str = "en",
) -> AsyncGenerator[str, None]:
    """
    Stream SSE-formatted chunks from Groq, with Tool Calling support.
    Yields JSON strings: {"type": "chunk", "content": "..."}
    """
    session_id = str(uuid.uuid4())
    messages = _build_lc_messages(mode, history, message, file_context, language)

    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    try:
        tools = []
        if mode == AgentMode.TALLY_SYNC:
            from app.services.agent_tools import get_tally_tools
            tools = get_tally_tools()
        elif mode == AgentMode.ZOHO_SYNC:
            from app.services.agent_tools import get_zoho_tools
            tools = get_zoho_tools()
        elif mode == AgentMode.CAMERA_TRACK:
            from app.services.agent_tools import get_camera_tools
            tools = get_camera_tools()

        if tools:
            # Agent Loop for Tool Calling
            llm_with_tools = get_llm(streaming=False).bind_tools(tools)
            iterations = 0
            while iterations < 5:
                iterations += 1
                response = await llm_with_tools.ainvoke(messages)
                if getattr(response, "tool_calls", None):
                    messages.append(response)
                    for tc in response.tool_calls:
                        tool_name = tc["name"]
                        try:
                            if tool_name == "push_to_tally_tool":
                                from app.services.agent_tools import push_to_tally_tool
                                res = await push_to_tally_tool.ainvoke(tc["args"])
                            elif tool_name == "push_to_zoho_tool":
                                from app.services.agent_tools import push_to_zoho_tool
                                res = await push_to_zoho_tool.ainvoke(tc["args"])
                            elif tool_name == "sync_items_to_tally_tool":
                                from app.services.agent_tools import sync_items_to_tally_tool
                                res = await sync_items_to_tally_tool.ainvoke(tc["args"])
                            elif tool_name == "sync_items_to_zoho_tool":
                                from app.services.agent_tools import sync_items_to_zoho_tool
                                res = await sync_items_to_zoho_tool.ainvoke(tc["args"])
                            else:
                                res = "Unknown tool"
                        except Exception as e:
                            res = f"Tool Execution Error: {str(e)}"
                        
                        messages.append(ToolMessage(content=str(res), tool_call_id=tc["id"]))
                    # Loop continues, invoking LLM again with the tool's result
                else:
                    # Final text response
                    if response.content:
                        yield f"data: {json.dumps({'type': 'chunk', 'content': response.content})}\n\n"
                    break
            
            if iterations >= 5:
                yield f"data: {json.dumps({'type': 'chunk', 'content': '\n\n*(Error: Max tool iterations reached, halting to prevent infinite loop)*'})}\n\n"
        else:
            # Standard streaming
            llm = get_llm(streaming=True)
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
    language: str = "en",
) -> tuple[str, str]:
    """
    Non-streaming completion with Tool Calling support.
    """
    session_id = str(uuid.uuid4())
    messages = _build_lc_messages(mode, history, message, file_context, language)

    tools = []
    if mode == AgentMode.TALLY_SYNC:
        from app.services.agent_tools import get_tally_tools
        tools = get_tally_tools()
    elif mode == AgentMode.ZOHO_SYNC:
        from app.services.agent_tools import get_zoho_tools
        tools = get_zoho_tools()
    elif mode == AgentMode.CAMERA_TRACK:
        from app.services.agent_tools import get_camera_tools
        tools = get_camera_tools()

    llm = get_llm(streaming=False)
    if tools:
        llm = llm.bind_tools(tools)
        
    iterations = 0
    while iterations < 5:
        iterations += 1
        response = await llm.ainvoke(messages)
        if getattr(response, "tool_calls", None):
            messages.append(response)
            for tc in response.tool_calls:
                tool_name = tc["name"]
                try:
                    if tool_name == "push_to_tally_tool":
                        from app.services.agent_tools import push_to_tally_tool
                        res = await push_to_tally_tool.ainvoke(tc["args"])
                    elif tool_name == "push_to_zoho_tool":
                        from app.services.agent_tools import push_to_zoho_tool
                        res = await push_to_zoho_tool.ainvoke(tc["args"])
                    elif tool_name == "sync_items_to_tally_tool":
                        from app.services.agent_tools import sync_items_to_tally_tool
                        res = await sync_items_to_tally_tool.ainvoke(tc["args"])
                    elif tool_name == "sync_items_to_zoho_tool":
                        from app.services.agent_tools import sync_items_to_zoho_tool
                        res = await sync_items_to_zoho_tool.ainvoke(tc["args"])
                    else:
                        res = "Unknown tool"
                except Exception as e:
                    res = f"Tool Execution Error: {str(e)}"
                
                messages.append(ToolMessage(content=str(res), tool_call_id=tc["id"]))
        else:
            return response.content, session_id
            
    return response.content + "\n\n*(Error: Max tool iterations reached)*", session_id
