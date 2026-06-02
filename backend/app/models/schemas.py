"""
ArthaSync — Pydantic schemas for request / response validation
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class AgentMode(str, Enum):
    INVOICE = "invoice"
    DATABASE = "database"
    OPERATIONS = "operations"
    MARKETING = "marketing"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    mode: AgentMode = Field(..., description="Which AI agent to activate")
    message: str = Field(..., min_length=1, max_length=8000)
    language: str = Field(default="en", description="'en', 'hi', or 'mr'")  # ← NEW
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
