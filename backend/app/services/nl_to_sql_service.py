"""
ArthaSync — Natural Language → SQL Service
Two-step NL→SQL pipeline:
  Step 1: LLM converts user question → SQL (with schema context, no streaming)
  Step 2: Execute SQL against arthasync PostgreSQL
  Step 3: LLM narrates results in plain English (streamed back to user)

This is a hard separation — the SQL generation call is cheap, fast, and never
streamed; only the final human-readable answer is streamed.
"""

import json
import re
import uuid
from typing import AsyncGenerator, Any

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from app.config import settings
from app.services.database_service import execute_query, get_schema_summary


# ── Prompts ───────────────────────────────────────────────────────────────────

_SQL_GENERATION_SYSTEM = """You are a PostgreSQL expert. Your ONLY job is to convert a natural language question into a single valid SQL SELECT query for the arthasync database.

RULES:
1. Output ONLY the SQL query — no explanation, no markdown fences, no preamble.
2. Always prefix every table with 'arthasync.' (e.g. arthasync.sales, arthasync.purchase).
3. Use ILIKE for case-insensitive text matching.
4. Use CURRENT_DATE for today's date.
5. Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE.
6. If the question cannot be answered with SQL (e.g. it's a general question), output exactly: NOT_A_QUERY
7. Always add a LIMIT clause (max 200) unless counting rows.
8. For amounts, cast to NUMERIC if needed for arithmetic.
9. Do not add a trailing semicolon.
10. CRITICAL: NEVER use a column name that is not explicitly listed in the schema below. (e.g., do not invent 'archive_status' or 'is_archived').
11. If the user asks about "invoices" or "bills", remember that all invoices and bills are in `arthasync.invoices`. Use `type = 'purchase'` for vendor bills and `type = 'sales'` for customer invoices.
12. NEVER join all tables together. ONLY query the specific table(s) necessary to answer the user's question.
13. If the user asks to draw, plot, or show a chart/graph (e.g. "show bar chart of invoices"), you MUST generate the SQL query to fetch the underlying data. Select a descriptive text/date column for the X-axis (e.g. `to_char(invoice_date, 'YYYY-MM') AS month`, or `invoice_number`) and a numeric column for the Y-axis (e.g. `SUM(total_amount)`). Ensure you do not over-filter dates unless the user asks for a specific year. Do NOT output NOT_A_QUERY.

{schema}
"""

_NARRATION_SYSTEM = """You are ArthaSync Database Intelligence — a helpful business analyst.
The user asked a question, SQL was executed against the arthasync database, and you received the results.
Your job: explain the results clearly in plain business language.

Rules:
- Be concise and direct. Lead with the key insight.
- Format numbers with commas (e.g. ₹1,23,456). Use ₹ for INR amounts.
- If the result set has rows, summarise the key takeaways. Do NOT draw markdown tables of the raw data (the user already sees an interactive data grid and chart below your message).
- CRITICAL: If the user asks for a chart, graph, or plot, do NOT output Python code, SQL scripts, or instructions for Excel. The ArthaSync UI automatically renders a rich interactive chart for them! Simply summarise the data trends and tell them they can view the chart below your message.
- If the result is empty, say so clearly and suggest why (date range, filters, etc.).
- If there was a SQL error, explain what went wrong in plain English and suggest a correction.
- Never expose raw SQL errors verbatim to the user — translate them.
- Keep responses under 250 words unless the data demands more.
"""


def _get_fast_llm() -> ChatGroq:
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=settings.GROQ_MODEL,   # Using 70b model for accurate SQL generation
        temperature=0.0,
        max_tokens=2048,
    )


def _get_main_llm(streaming: bool = False) -> ChatGroq:
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=settings.GROQ_MODEL,
        temperature=0.4,
        streaming=streaming,
        max_tokens=1024,
    )


async def generate_sql(user_question: str, schema: str) -> str:
    """
    Step 1: Convert natural language question → SQL.
    Returns raw SQL string or 'NOT_A_QUERY'.
    """
    llm = _get_fast_llm()
    system = _SQL_GENERATION_SYSTEM.format(schema=schema)
    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=user_question),
    ])
    sql = response.content.strip()
    # Strip any accidental markdown fences the model might add
    sql = re.sub(r'^```(?:sql)?\s*', '', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\s*```$', '', sql)
    return sql.strip()


async def stream_nl_to_sql_response(
    user_question: str,
    history: list,
) -> AsyncGenerator[str, None]:
    """
    Full NL→SQL pipeline with SSE streaming.

    Yields SSE events:
      {"type": "session",      "session_id": "..."}
      {"type": "sql_generated","sql": "SELECT ..."}      ← before execution
      {"type": "query_result", "data": {...}}             ← raw DB result
      {"type": "chunk",        "content": "..."}         ← streamed narration
      {"type": "done"}
    """
    session_id = str(uuid.uuid4())
    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    # ── Step 1: Get schema ────────────────────────────────────────────────────
    schema = await get_schema_summary()

    # ── Step 2: Generate SQL ──────────────────────────────────────────────────
    try:
        sql = await generate_sql(user_question, schema)
    except Exception as e:
        yield f"data: {json.dumps({'type': 'chunk', 'content': f'⚠️ Could not generate SQL: {e}'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    if sql == "NOT_A_QUERY":
        # Fall through to general LLM answer (no DB execution)
        async for event in _stream_general_answer(user_question, history, schema, session_id):
            yield event
        return

    # Emit the generated SQL so the frontend can show it
    yield f"data: {json.dumps({'type': 'sql_generated', 'sql': sql})}\n\n"

    # ── Step 3: Execute SQL ───────────────────────────────────────────────────
    db_result = await execute_query(sql)
    yield f"data: {json.dumps({'type': 'query_result', 'data': db_result})}\n\n"

    # ── Step 4: Stream narration ──────────────────────────────────────────────
    result_summary = _format_result_for_narration(db_result)
    narration_prompt = (
        f"User question: {user_question}\n\n"
        f"SQL executed:\n{sql}\n\n"
        f"Database result:\n{result_summary}"
    )

    llm = _get_main_llm(streaming=True)
    try:
        async for chunk in llm.astream([
            SystemMessage(content=_NARRATION_SYSTEM),
            HumanMessage(content=narration_prompt),
        ]):
            if chunk.content:
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.content})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'chunk', 'content': f'⚠️ Could not narrate results: {e}'})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


async def _stream_general_answer(
    question: str,
    history: list,
    schema: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    """
    Fallback: question is about the DB/schema but not a data query.
    Stream a helpful answer with full schema context.
    """
    from app.prompts.system_prompts import get_system_prompt
    from app.models.schemas import AgentMode
    from langchain_core.messages import AIMessage

    system_prompt = get_system_prompt(AgentMode.DATABASE) + f"\n\nCurrent database schema:\n{schema}"
    messages = [SystemMessage(content=system_prompt)]

    for msg in history:
        if msg.role.value == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role.value == "assistant":
            messages.append(AIMessage(content=msg.content))

    messages.append(HumanMessage(content=question))

    llm = _get_main_llm(streaming=True)
    try:
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.content})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'chunk', 'content': f'⚠️ Error: {e}'})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


def _format_result_for_narration(result: dict) -> str:
    """Compact serialisation of query results for the narration LLM."""
    if "error" in result:
        return f"ERROR: {result['error']}"

    columns = result.get("columns", [])
    rows = result.get("rows", [])
    row_count = result.get("row_count", 0)
    truncated = result.get("truncated", False)

    if not rows:
        return result.get("message", "0 rows returned.")

    # Build a compact table (max 50 rows for the narration context)
    header = " | ".join(columns)
    separator = "-" * len(header)
    lines = [f"Columns: {header}", separator]
    for row in rows[:50]:
        lines.append(" | ".join(str(v) if v is not None else "NULL" for v in row))

    if truncated or row_count > 50:
        lines.append(f"... ({row_count} total rows, showing first 50)")

    return "\n".join(lines)
