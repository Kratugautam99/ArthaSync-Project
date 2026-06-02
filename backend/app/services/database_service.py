"""
ArthaSync — PostgreSQL Database Service
Single authoritative DB service for the arthasync schema.

Fixes applied:
  • All connections set search_path = arthasync, public via pool init callback
  • get_schema_summary() returns rich schema with constraints & sample values for NL→SQL
  • execute_query() properly qualifies tables & auto-appends LIMIT
  • check_db_connection() verifies arthasync schema specifically
"""

import re
from typing import Any, Optional
from urllib.parse import urlparse, unquote_plus

import asyncpg

from app.config import settings

_pool: Optional[asyncpg.Pool] = None


# ── Connection pool ────────────────────────────────────────────────────────────

def _parse_dsn() -> dict:
    """
    Parse DATABASE_URL into asyncpg keyword args.
    Handles both:
      postgresql://user:pass@host:port/dbname
      postgresql+asyncpg://user:pass@host:port/dbname
    """
    raw = settings.DATABASE_URL.strip()
    raw = re.sub(r'^postgresql\+\w+://', 'postgresql://', raw)
    p = urlparse(raw)
    return {
        "host":     p.hostname or "localhost",
        "port":     p.port or 5432,
        "user":     unquote_plus(p.username) if p.username else "postgres",
        "password": unquote_plus(p.password) if p.password else "postgres",
        "database": (p.path or "/arthasync").lstrip("/") or "arthasync",
    }


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Set search_path for every new connection so bare table names resolve to arthasync.*"""
    await conn.execute("SET search_path = arthasync, public")


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        params = _parse_dsn()
        _pool = await asyncpg.create_pool(
            **params,
            min_size=1,
            max_size=5,
            command_timeout=30,
            init=_init_connection,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def check_db_connection() -> tuple[bool, str]:
    """Ping the database. Returns (ok, status_message)."""
    try:
        params = _parse_dsn()
        pool = await get_pool()
        async with pool.acquire() as conn:
            pg_version = await conn.fetchval("SELECT current_setting('server_version')")
            table_count = await conn.fetchval(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'arthasync'"
            )
            return True, (
                f"PostgreSQL {pg_version} · "
                f"{params['host']}:{params['port']}/{params['database']} · "
                f"{table_count} tables in arthasync schema"
            )
    except Exception as e:
        return False, str(e)


# ── Schema introspection for NL→SQL ──────────────────────────────────────────

async def get_schema_summary() -> str:
    """
    Return a rich arthasync schema description injected into the Database Agent
    system prompt so the LLM can generate accurate SQL without guessing column names.

    Format:
      arthasync.<table>(col1 TYPE, col2 TYPE, ...)
      -- key constraints + business notes
    """
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    t.table_name,
                    string_agg(
                        c.column_name || ' ' || c.data_type
                        || CASE WHEN c.column_name = 'id' THEN ' PK' ELSE '' END
                        || CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
                        ', '
                        ORDER BY c.ordinal_position
                    ) AS columns
                FROM information_schema.tables t
                JOIN information_schema.columns c
                    ON c.table_name  = t.table_name
                   AND c.table_schema = t.table_schema
                WHERE t.table_schema = 'arthasync'
                  AND t.table_type  = 'BASE TABLE'
                GROUP BY t.table_name
                ORDER BY t.table_name
                """
            )

            if not rows:
                return "⚠️ No tables found in the arthasync schema."

            lines = ["PostgreSQL schema: arthasync\n"]
            for row in rows:
                lines.append(f"  arthasync.{row['table_name']}({row['columns']})")

            # Add human-readable business notes for each key table
            lines += [
                "",
                "-- Business context:",
                "-- arthasync.sales       : outgoing invoices to customers; payment_status IN ('pending','paid','partial','overdue')",
                "-- arthasync.purchase    : incoming bills from vendors; same payment_status values",
                "-- arthasync.quotation   : price quotes sent to customers (not yet invoiced)",
                "-- arthasync.expense     : business expenses (travel, utilities, etc.); direction='out'",
                "-- arthasync.ledger      : double-entry cash flow log; direction IN ('in','out','transfer')",
                "-- arthasync.users       : app users",
                "-- arthasync.file_uploads: uploaded invoice image files",
                "",
                "-- Generated/computed columns (do NOT include in INSERT):",
                "--   sales.total_tax        = cgst_amount + sgst_amount",
                "--   sales.amount_due       = grand_total - amount_paid",
                "--   purchase.total_tax     = cgst_amount + sgst_amount",
                "--   purchase.amount_due    = grand_total - amount_paid",
                "--   expense.total_amount   = expense_amount + gst_amount",
                "--   expense.amount_due     = expense_amount + gst_amount - amount_paid",
                "",
                "-- Always prefix table names with 'arthasync.' in every query.",
                "-- Use ILIKE for case-insensitive text searches.",
                "-- Date columns are type DATE; use CURRENT_DATE for today.",
            ]
            return "\n".join(lines)

    except Exception as e:
        return f"⚠️ Could not read schema: {e}"


# ── Safe SELECT-only execution ─────────────────────────────────────────────────

_WRITE_OPS = re.compile(
    r'\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b',
    re.IGNORECASE,
)


def _is_safe(sql: str) -> tuple[bool, str]:
    s = sql.strip().lstrip(';').strip()
    upper = s.upper()
    if not (upper.startswith('SELECT') or upper.startswith('WITH')):
        return False, "Only SELECT / WITH queries are permitted."
    if _WRITE_OPS.search(s):
        return False, "Query blocked: contains a write operation keyword."
    return True, ""


async def execute_query(sql: str) -> dict[str, Any]:
    """
    Execute a read-only SELECT query against the arthasync schema.

    Returns:
      { columns, rows, row_count }  on success
      { error }                     on failure
    """
    ok, reason = _is_safe(sql)
    if not ok:
        return {"error": reason}

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = sql.strip().rstrip(';')
            # Auto-qualify bare table names (sales → arthasync.sales etc.)
            query = _qualify_tables(query)
            # Cap result set
            if 'LIMIT' not in query.upper():
                query += ' LIMIT 200'

            records = await conn.fetch(query)

            if not records:
                return {
                    "columns": [],
                    "rows": [],
                    "row_count": 0,
                    "message": "Query executed successfully — 0 rows returned.",
                }

            columns = list(records[0].keys())
            result_rows = [
                [str(v) if v is not None else None for v in record.values()]
                for record in records
            ]

            return {
                "columns": columns,
                "rows": result_rows,
                "row_count": len(result_rows),
                "truncated": len(records) >= 200,
            }

    except asyncpg.UndefinedTableError as e:
        return {"error": f"Table not found: {e}"}
    except asyncpg.PostgresSyntaxError as e:
        return {"error": f"SQL syntax error: {e}"}
    except asyncpg.PostgresError as e:
        return {"error": f"Database error: {e}"}
    except Exception as e:
        return {"error": f"Unexpected error: {e}"}


_ARTHASYNC_TABLES = {
    'sales', 'purchase', 'quotation', 'expense', 'ledger', 'users', 'file_uploads'
}

_TABLE_RE = re.compile(
    r'(?<![.\w])(' + '|'.join(_ARTHASYNC_TABLES) + r')(?![.\w])',
    re.IGNORECASE,
)


def _qualify_tables(sql: str) -> str:
    """
    Prefix bare arthasync table names with 'arthasync.' so queries work
    even when the LLM omits the schema prefix.
    Skips names that are already qualified (arthasync.sales) or are aliases.
    """
    def _replace(m: re.Match) -> str:
        start = m.start()
        # Don't double-qualify: check if preceded by 'arthasync.'
        preceding = sql[max(0, start - 11):start]
        if preceding.endswith('arthasync.'):
            return m.group(0)
        return f"arthasync.{m.group(0)}"

    return _TABLE_RE.sub(_replace, sql)
