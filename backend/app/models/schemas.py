"""
ArthaSync — Pydantic schemas for request / response validation
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class AgentMode(str, Enum):
    INVOICE      = "invoice"
    DATABASE     = "database"
    OPERATIONS   = "operations"
    MARKETING    = "marketing"
    TALLY_SYNC   = "tally_sync"
    ZOHO_SYNC    = "zoho_sync"
    CAMERA_TRACK = "camera_track"
    GENERAL      = "general"
    ONBOARDING   = "onboarding"


class MessageRole(str, Enum):
    USER      = "user"
    ASSISTANT = "assistant"
    SYSTEM    = "system"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    mode: Optional[AgentMode] = Field(default=None, description="Which AI agent to activate (None = auto-detect)")
    message: str = Field(..., min_length=1, max_length=8000)
    language: str = Field(default="en", description="'en', 'hi', or 'mr'")
    history: List[ChatMessage] = Field(default=[], max_length=50)
    session_id: Optional[str] = None
    file_id: Optional[str] = None


class ChatResponse(BaseModel):
    content: str
    mode: AgentMode
    session_id: str
    tokens_used: Optional[int] = None


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    size_bytes: int
    extracted_text: Optional[str] = None
    message: str


class HealthResponse(BaseModel):
    status: str
    groq_connected: bool
    version: str = "1.0.0"


class ModeInfo(BaseModel):
    id: AgentMode
    name: str
    description: str
    icon: str
    capabilities: List[str]
    example_prompts: List[str]


class IntentResult(BaseModel):
    intent: AgentMode
    confidence: float
    reasoning: Optional[str] = None


class BusinessProfile(BaseModel):
    business_type: str
    size: str
    uses_tally: bool = False
    uses_zoho: bool = False
    enabled_modes: List[AgentMode] = []
    completed_onboarding: bool = False
