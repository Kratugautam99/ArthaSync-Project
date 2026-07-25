<div align="center">

<img src="https://img.shields.io/badge/ArthaSync-Commerce%20AI-7c5cfc?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeT0iMjAiIGZvbnQtc2l6ZT0iMjAiPuKCs108L3RleHQ+PC9zdmc+" alt="ArthaSync"/>

# 🪙 **Artha$ync**
**An AI operating system for Indian SME finance — built with Next.js, FastAPI, and Groq.**
---


Four specialized agents. One chat interface. From invoice OCR to plain-English SQL — all in your language.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Groq](https://img.shields.io/badge/Groq-llama--3.3--70b-orange?style=flat-square)](https://console.groq.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)](https://www.python.org)
[![uv](https://img.shields.io/badge/uv-package%20manager-DE5D43?style=flat-square)](https://docs.astral.sh/uv)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](https://choosealicense.com/licenses/mit/)


</div>

---

## Table of Contents

- [What is ArthaSync?](#what-is-arthasync)
- [Architecture](#architecture)
- [How the NL→SQL pipeline works](#how-the-nlsql-pipeline-works)
- [How invoice processing works](#how-invoice-processing-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Option A — Manual (two terminals)](#a)
- [Option B — Docker Compose (recommended)](#b)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)


---
## What is ArthaSync?

ArthaSync is a full-stack AI operating system designed for Indian retail SMEs. It exposes four domain-specific AI agents through a single chat UI, each with its own system prompt, tool pipeline, and database integration.

Instead of a generic chatbot, each mode is purpose-built:

- **Invoice Processor** — upload a PDF or photo of an invoice; the agent extracts structured JSON, validates GST fields, and writes the record directly to your PostgreSQL ledger.
- **Database Intelligence** — ask questions in plain English (or Hindi/Marathi); a two-step LLM pipeline converts them to SQL, executes against the `arthasync` schema, and narrates the results back.
- **Operations AI** — process automation, SOP generation, and bottleneck analysis for business workflows.
- **Marketing Intelligence** — copy generation, campaign strategy, and SEO recommendations.

All responses stream over SSE so the UI feels instant even on slow connections.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / App                            │
│                                                                 │
│   Next.js 16 (App Router)  ·  TypeScript  ·  Tailwind CSS 4     │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐     │
│   │ Invoice  │  │ Database │  │ Operations │  │ Marketing │     │
│   │  Agent   │  │  Agent   │  │   Agent    │  │  Agent    │     │
│   └────┬─────┘  └────┬─────┘  └─────┬──────┘  └─────┬─────┘     │
│        └─────────────┴──────────────┴────────────────┘          │
│                       ChatContext (React)                       │
│                       arthasyncApi.ts  (SSE client)             │
└───────────────────────────────┬─────────────────────────────────┘
                                │  POST /api/chat/stream
                                │  text/event-stream (SSE)
┌───────────────────────────────▼─────────────────────────────────┐
│                        FastAPI Backend                          │
│                                                                 │
│   ModeRouter                                                    │
│   ├── DATABASE  →  nl_to_sql_service                            │
│   │               ├── Step 1: LLM (8b fast) → SQL               │
│   │               ├── Step 2: asyncpg → execute                 │
│   │               └── Step 3: LLM (70b) → narrate (streamed)    │
│   │                                                             │
│   ├── INVOICE   →  llm_service  (stream)                        │
│   │               └── invoice_db_service → write to ledger      │
│   │                                                             │
│   └── OPERATIONS / MARKETING → llm_service  (stream)            │
│                                                                 │
│   file_service  ·  pytesseract OCR  ·  Groq vision fallback     │
└───────────────────────────────┬─────────────────────────────────┘
                                │  asyncpg connection pool
┌───────────────────────────────▼─────────────────────────────────┐
│                    PostgreSQL 16 + pgvector                     │
│                                                                 │
│   arthasync schema                                              │
│   ├── sales          (outgoing invoices + GST breakdown)        │
│   ├── purchase       (vendor invoices auto-written by AI)       │
│   ├── ledger         (double-entry credit/debit journal)        │
│   ├── expense        (operational costs + reimbursements)       │
│   ├── quotation      (customer quotes + pricing drafts)         │
│   ├── users          (accounts, roles, and authentication)      │
│   └── file_uploads   (OCR results + file metadata)              │
└─────────────────────────────────────────────────────────────────┘
```

### How the NL→SQL pipeline works

The Database agent uses a deliberate two-model design to balance speed and quality:

1. **SQL generation** — `llama-3.1-8b-instant` (cheap, fast, temperature 0) converts the user's question into a SQL `SELECT`. The model is instructed to output raw SQL with no markdown, always prefix tables with `arthasync.`, and return `NOT_A_QUERY` for conversational inputs.
2. **Query execution** — `asyncpg` runs the SQL against PostgreSQL. Errors are caught and passed forward instead of surfaced raw to the user.
3. **Narration** — `llama-3.3-70b-versatile` receives the user's original question + SQL results and streams a plain-English (or Hindi/Marathi) business summary back to the client over SSE.

### How invoice processing works

1. User uploads a PDF or image via `POST /api/upload`.
2. `file_service` saves the file, runs `pytesseract` for OCR, with Groq vision as a fallback for low-quality scans.
3. The extracted text is stored in `arthasync.file_uploads` and returned as a `file_id`.
4. User sends a message in Invoice mode with that `file_id`.
5. The LLM extracts structured JSON matching the `arthasync.purchase` schema.
6. After streaming completes, `invoice_db_service` parses the JSON and writes a row to `arthasync.purchase` plus a corresponding debit in `arthasync.ledger` — all in a single transaction.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, NVM |
| Styling | Tailwind CSS 4, custom design tokens |
| State | React Context + `useState` (per-session chat history) |
| Backend | FastAPI 0.115, Python 3.12, Uvicorn |
| LLM Framework | LangChain + LangGraph |
| LLM Provider | Groq (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`) |
| Database | PostgreSQL 16 + pgvector + pgcrypto |
| DB Driver | `asyncpg` (connection pool with `search_path = arthasync`) |
| OCR | `pytesseract` + Groq vision fallback |
| Environments | **uv** (Python), **PNPM** (JS/TS) |
| Containerisation | Docker Compose |

---

## Project Structure

```
ArthaSync/
|
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing page (EN/HI/MR multilingual)
│   │   └── dashboard/
│   │       └── page.tsx          # Main chat dashboard
│   ├── components/
│   │   ├── ChatInput.tsx         # Message composer + file upload trigger
│   │   ├── MessageBubble.tsx     # Renders text + query result tables
│   │   ├── Sidebar.tsx           # Agent mode switcher + session list
│   │   ├── TypingIndicator.tsx   # SSE streaming indicator
│   │   └── WelcomeCards.tsx      # Mode-specific example prompts
│   ├── context/
│   │   └── ChatContext.tsx       # Global state: sessions, mode, language, uploads
│   └── lib/
│       └── arthasyncApi.ts       # SSE client, upload helper, mode fetcher
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, lifespan, middleware, router mount
│   │   ├── config.py             # Pydantic-settings (env vars)
│   │   ├── models/
│   │   │   └── schemas.py        # AgentMode enum, ChatRequest/Response, UploadResponse
│   │   ├── routes/
│   │   │   ├── chat.py           # POST /api/chat/stream  (SSE)
│   │   │   ├── upload.py         # POST /api/upload
│   │   │   └── health.py         # GET  /api/health
│   │   ├── services/
│   │   │   ├── llm_service.py         # Groq streaming via langchain-groq
│   │   │   ├── nl_to_sql_service.py   # NL→SQL→execute→narrate pipeline
│   │   │   ├── invoice_db_service.py  # Parsed invoice → purchase + ledger tables
│   │   │   ├── file_service.py        # Upload, OCR, DB persist
│   │   │   └── database_service.py    # asyncpg pool, schema introspection
│   │   └── prompts/
│   │       └── system_prompts.py      # Per-agent system prompts
│   ├── pyproject.toml            # uv/hatch project manifest
│   ├── uv.lock                   # Locked dependency tree
│   ├── Dockerfile
│   └── .env.example
│
├── postgres-init/
│   └── init.sql                  # Schema bootstrap (runs on first docker-compose up)
│
├── project-information/
│
├── test-items/
│
├── docker-compose.yml
│
├── .gitignore
│
└── README.md (This File)
```

---

## Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **PostgreSQL 16** (local) — or skip this if you're using Docker Compose
- **[uv](https://docs.astral.sh/uv/)** — fast Python package manager
- **[Groq API key](https://console.groq.com)** — free tier is sufficient

Install `uv` if you don't have it:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---
<a id="a"></a>
### Option A — Manual (two terminals)

#### 1. Clone and configure

```bash
git clone https://github.com/your-username/ArthaSync.git
cd ArthaSync
```

#### 2. Backend

```bash
cd backend

# Copy the example env file and fill in your values
cp .env.example .env
# Open .env and set GROQ_API_KEY and DATABASE_URL

# Install uv
pip install uv

# Start the dev server
uv run uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**  
Interactive API docs at **http://localhost:8000/docs**

#### 3. Frontend

Open a second terminal:

```bash
cd frontend

pnpm i

pnpm run dev
```

Frontend runs at **http://localhost:3000**

> **Note:** Make sure `NEXT_PUBLIC_BACKEND_URL` in your frontend environment points to `http://localhost:8000` (this is the default if the variable is unset).

---
<a id="b"></a>
### Option B — Docker Compose (recommended)

Spins up PostgreSQL, the FastAPI backend, and the Next.js frontend in one command. The `postgres-init/init.sql` script runs automatically on first boot to create the `arthasync` schema.

```bash
# From the project root
cp backend/.env.example backend/.env
# Add your GROQ_API_KEY to backend/.env

docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

To stop and remove containers:

```bash
docker-compose down
```

To wipe the database volume as well:

```bash
docker-compose down -v
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the required values:

```env
# App
ENVIRONMENT=development
SECRET_KEY=change-me-in-production

# Groq — get your free key at https://console.groq.com
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FAST_MODEL=llama-3.1-8b-instant

# PostgreSQL
# For local dev:   postgresql+asyncpg://postgres:postgres@localhost:5432/arthasync
# For Docker:      postgresql+asyncpg://postgres:postgres@postgres:5432/arthasync
DATABASE_URL=postgresql+asyncpg://arthasync_user:ChangeThisStrongPassword@localhost:5432/arthasync

# CORS — add your frontend origin
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# File uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=20
```

---

## API Reference

### `POST /api/chat/stream`

Streams an SSE response from the active agent.

**Request body:**

```json
{
  "mode": "invoice | database | operations | marketing",
  "message": "Show me all pending invoices this month",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "session_id": "optional-uuid",
  "file_id": "optional — required for invoice mode"
}
```

**SSE event types:**

```
data: {"type": "session", "session_id": "..."}
data: {"type": "chunk",   "content": "Partial response text..."}
data: {"type": "query_result", "columns": [...], "rows": [...], "row_count": 12}
data: {"type": "db_save", "purchase_id": "...", "ledger_id": "..."}
data: {"type": "done",    "session_id": "..."}
data: {"type": "error",   "message": "..."}
```

### `POST /api/upload`

Accepts a PDF or image (PNG/JPG/TIFF/BMP), runs OCR, and returns a `file_id` to pass to the chat endpoint.

**Response:**

```json
{
  "file_id": "uuid",
  "filename": "invoice.jpg",
  "size_bytes": 204800,
  "extracted_text": "Preview of extracted text...",
  "message": "File uploaded and text extracted successfully."
}
```

### `GET /api/health`

Returns Groq connectivity status and database pool health.

---

## Database Schema

The `Arthasync` PostgreSQL schema is bootstrapped automatically by `postgres-init/init.sql` on first run.

```
  Schema   |     Name     | Type  |  Owner
-----------+--------------+-------+----------
 arthasync | expense      | table | postgres
 arthasync | file_uploads | table | postgres
 arthasync | ledger       | table | postgres
 arthasync | purchase     | table | postgres
 arthasync | quotation    | table | postgres
 arthasync | sales        | table | postgres
 arthasync | users        | table | postgres
```

Key design decisions:
- All monetary columns use `NUMERIC(15,2)` — no floating-point finance.
- `total_tax` and `amount_due` are generated columns (computed from CGST + SGST and grand total).
- Every `asyncpg` connection sets `search_path = arthasync, public` so queries work without schema prefix.
- The NL→SQL agent is instructed to always qualify tables with `arthasync.` and never issue write statements.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

Please keep PRs focused — one feature or fix per PR. For significant changes, open an issue first to discuss the approach.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built for Indian Retail SMEs. Powered by Open Source Technologies.
</div>
