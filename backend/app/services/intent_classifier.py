from langchain_core.messages import HumanMessage, SystemMessage
from app.models.schemas import AgentMode, IntentResult
from app.prompts.system_prompts import INTENT_CLASSIFIER_PROMPT
from app.services.llm_service import get_llm

async def classify_intent(message: str, file_id: str | None = None) -> IntentResult:
    """Classifies the user's message intent using the fast LLM model."""
    llm = get_llm(streaming=False, fast=True)
    messages = [
        SystemMessage(content=INTENT_CLASSIFIER_PROMPT),
        HumanMessage(content=f"Message: {message}")
    ]
    
    try:
        response = await llm.ainvoke(messages)
        intent_str = response.content.strip().lower()
        
        # Clean up in case the LLM outputs extra text
        for mode in AgentMode:
            if mode.value in intent_str:
                return IntentResult(intent=mode, confidence=0.9)
                
        # Default fallback
        return IntentResult(intent=AgentMode.GENERAL, confidence=0.5, reasoning="Fallback")
    except Exception as e:
        print(f"[intent_classifier] Error: {e}")
        return IntentResult(intent=AgentMode.GENERAL, confidence=0.0, reasoning=str(e))
