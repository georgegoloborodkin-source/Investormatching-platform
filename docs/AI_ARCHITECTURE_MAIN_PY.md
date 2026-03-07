# AI Architecture in `main.py` — CTO Overview

This document explains how the AI stack is wired in the FastAPI backend (`ollama-converter/main.py`), with focus on **Gemini**: where it’s used, how it’s connected, and how provider selection works.

---

## 1. High-level picture

- **Two LLM providers:** **Google Gemini** and **Anthropic Claude**. Only one is “primary” at runtime.
- **Provider selection** is driven by env vars: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and `CONVERTER_PROVIDER`.
- When **Gemini is primary**, it is used for: conversion, simple ask, streaming ask, and the **agent stream** (chat in CIS). Claude is not called (avoids 503 and billing issues).
- **RAG (documents)** for the agent is implemented in the backend: embeddings + Supabase vector/keyword search, then context is injected into the Gemini system prompt.

---

## 2. Provider selection (when is Gemini used?)

| Env vars | Result |
|----------|--------|
| `GEMINI_API_KEY` set, `CONVERTER_PROVIDER` ≠ `"claude"` (or unset) | **Gemini primary** — conversion, ask, agent stream, and (when set) email parsing use Gemini. |
| `GEMINI_API_KEY` set, `CONVERTER_PROVIDER=claude` | **Claude primary** — all LLM paths use Anthropic. |
| No `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` set | **Claude only** — `USE_ANTHROPIC=True`. |
| No `ANTHROPIC_API_KEY`, no `GEMINI_API_KEY` | **503** — at least one provider must be configured. |

**Formula used everywhere:**

```text
use_gemini = GEMINI_API_KEY and (CONVERTER_PROVIDER != "claude" or not ANTHROPIC_API_KEY)
USE_ANTHROPIC = ANTHROPIC_API_KEY and (CONVERTER_PROVIDER == "claude" or not GEMINI_API_KEY)
```

So: **Gemini is used when you have a Gemini key and haven’t explicitly forced Claude.**

---

## 3. Gemini module — SDK and config

**Location:** ~lines 49–56 (import), 431–516 (config + core functions).

### 3.1 Optional import

```python
try:
    from google import genai as _genai_module
    from google.genai import types as _genai_types
    _gemini_sdk_available = True
except ImportError:
    _genai_module = None
    _genai_types = None
    _gemini_sdk_available = False
```

- Package: **`google-genai`** (not the older `google-generativeai`).
- If the import fails, all Gemini code paths raise 503 with a message to `pip install google-genai`.

### 3.2 Environment and globals

| Variable | Env var | Default | Role |
|----------|---------|--------|------|
| `GEMINI_API_KEY` | `GEMINI_API_KEY` | — | Required for any Gemini call. |
| `GEMINI_MODEL` | `GEMINI_MODEL` | `gemini-3.1-pro-preview` | Main model for convert, ask, agent. |
| `GEMINI_EMAIL_MODEL` | `GEMINI_EMAIL_MODEL` | `gemini-2.5-flash-lite` | Lighter model for email parsing only. |

### 3.3 Client and config helpers

- **`_get_gemini_client()`**  
  - Returns `genai.Client(api_key=GEMINI_API_KEY)`.  
  - Raises 503 if `GEMINI_API_KEY` is missing or SDK not available.

- **`_gemini_config(max_output_tokens, temperature)`**  
  - Returns `GenerateContentConfig` (or a dict) for `max_output_tokens` and `temperature`.

### 3.4 Core API: `call_gemini(...)`

**Signature:**

```python
async def call_gemini(
    prompt: str,
    system_instruction: Optional[str] = None,
    model: str = GEMINI_MODEL,
    max_tokens: int = 8192,
    temperature: float = 0.1,
) -> str
```

**Behavior:**

1. Gets client via `_get_gemini_client()`.
2. Uses **async** client: `client.aio`.
3. Builds a single `contents` string: if `system_instruction` is set, it’s `system_instruction + "\n\n" + prompt`; else just `prompt`.
4. Calls `aio.models.generate_content(model=..., contents=contents, config=config)`.
5. Returns `response.text.strip()` or `""`.
6. Always closes the aio client in a `finally` block.

**Important:** There is **no streaming** in `call_gemini`. Streaming in the UI is faked by chunking the full response (e.g. 80 chars) in the agent path.

### 3.5 Email parsing: `parse_email_with_gemini(raw_email_text) -> str`

- Uses **`GEMINI_EMAIL_MODEL`** (e.g. `gemini-2.5-flash-lite`).
- System prompt: normalize and clean email (From/To/Date/Subject/body), strip HTML, output only cleaned text.
- Truncates input to 120k chars.
- Returns cleaned text or original on error.

---

## 4. Where Gemini is used (entry points)

### 4.1 Conversion (structured data from pitch/docs)

**Endpoint:** `POST /convert` (and the logic used by `/convert-file` after text extraction).

**Flow:**

1. Build prompt from request (e.g. `create_conversion_prompt(request.data, request.dataType)`).
2. If **Gemini path**:  
   `use_gemini = GEMINI_API_KEY and CONVERTER_PROVIDER != "claude"`.  
   Then: `call_gemini(prompt, system_instruction=system, model=GEMINI_MODEL, max_tokens=8192, temperature=0.1)`.
3. Response is parsed as JSON (e.g. `parse_ollama_response`) into startups/investors/mentors/corporates, etc.

So: **conversion is a single Gemini (or Claude) call; no tools, no RAG.**

### 4.2 Simple ask (single non-streaming answer)

**Endpoint:** Used when the frontend calls the “ask” API that returns one answer (not the agent stream).

**Flow:**

1. `use_gemini_for_ask = GEMINI_API_KEY and (CONVERTER_PROVIDER != "claude" or not ANTHROPIC_API_KEY)`.
2. If true: build a Venture OS system message; then `call_gemini(prompt, system_instruction=system_msg, model=GEMINI_MODEL, max_tokens=10000, temperature=0.5)` and return the string.

No tools, no document retrieval in this path — the prompt is built from whatever the frontend sends (e.g. pre-fetched sources).

### 4.3 Streaming ask (SSE)

**Function:** `stream_anthropic_answer(...)`.

- If `use_gemini_for_ask`: calls `call_gemini(...)` once (non-streaming), then **yields** the full text as a single JSON chunk `{"text": text}`. So “streaming” is one chunk.
- If not Gemini, the rest of the function streams via Anthropic (tools, etc.).

### 4.4 Agent stream (CIS chat — main RAG path)

**Endpoint:** `POST /ask/agent/stream`.

This is the path that **must** be able to use documents and chunks.

**Flow when Gemini is used (`use_gemini_agent`):**

1. **Validate** `event_id` (required).
2. **Decisions & connections**  
   From request body or, if missing, from Supabase:  
   `decisions` table, `company_connections` table, filtered by `event_id`.
3. **Document context (RAG)**  
   `doc_context = await _retrieve_document_context_for_gemini(event_id, question, folder_ids=request.folder_ids)`.  
   This is the only place in the Gemini path where documents/chunks are fetched (see below).
4. **System prompt**  
   - Base: `AGENT_SYSTEM_PROMPT` (Venture OS, tools description, etc.).  
   - Then: Decision history block + Company connections block.  
   - If `doc_context` non-empty: “Document context (from your uploaded documents)” + `doc_context` + instruction to use it as primary source.  
   - If empty: instruction that there is no document content, only decisions/connections.  
   - Optional: Reflexion memory appended.
5. **One Gemini call**  
   `text = await call_gemini(question, system_instruction=sys_prompt, model=GEMINI_MODEL, max_tokens=8000, temperature=0.1)`.
6. **Streaming to client**  
   Response is chunked (e.g. 80 chars per SSE) and sent as `data: {"text": "..."}\n\n`, then `data: [DONE]\n\n`.  
   If Gemini returns empty, a short fallback message is sent instead.

So: **agent stream = one RAG call (`_retrieve_document_context_for_gemini`) + one `call_gemini` + chunked SSE.** No tool loop for Gemini; tools (e.g. search_documents) exist for the **Claude** agent path only.

### 4.5 Gmail ingest (email parsing)

**Flow:** When building the ingested content for a Gmail message, if `GEMINI_API_KEY` is set, the backend calls `parse_email_with_gemini(content)` to normalize the email text before storing/returning. So **email parsing is the only place that uses `GEMINI_EMAIL_MODEL`.**

---

## 5. How Gemini is connected to documents (RAG)

Document access for the **Gemini agent** is implemented entirely in **`_retrieve_document_context_for_gemini(event_id, question, folder_ids)`**.

### 5.1 Role

- **Input:** `event_id` (workspace), user `question`, optional `folder_ids` (scope).
- **Output:** One string: concatenated excerpts (chunks/snippets) with document titles, or empty string if nothing found or on error.

This string is injected into the system prompt as “Document context (from your uploaded documents)” so that **Gemini sees documents only via this pre-retrieved context** — it does not call tools to search.

### 5.2 Three-tier retrieval

1. **Vector search**  
   - Embed the `question` (Voyage / OpenAI / Ollama per `EMBEDDINGS_PROVIDER`).  
   - Call Supabase RPC:  
     - `match_document_chunks(query_embedding, match_count, filter_event_id)`  
     - or `match_document_chunks_scoped(..., filter_folder_ids)` if `folder_ids` are provided.  
   - Tables: `document_embeddings` (chunk_text, parent_text) joined to `documents` (event_id, title, etc.).  
   - Top chunks (e.g. 15) are formatted as `[n] **Title**\n<text>` (e.g. 800 chars per chunk).

2. **Keyword fallback**  
   - If vector returns no chunks: call `match_documents_keyword(query_text, match_count, filter_event_id)`.  
   - Uses full-text search on `documents.raw_content`; returns snippets.  
   - Same formatting as above so the prompt shape is unchanged.

3. **Raw excerpt fallback**  
   - If still no lines: fetch a few recent documents for `event_id` (e.g. `documents` table, order by created_at, limit 5), take `raw_content` and append first 1200 chars per doc.  
   - Ensures some document text is available even when embeddings/keyword don’t match.

### 5.3 Embeddings

- **Provider** is global: `EMBEDDINGS_PROVIDER` (voyage / openai / ollama).  
- **Dimension** must match the DB (e.g. 1536 for `match_document_chunks`).  
- **Same embedding pipeline** is used for RAG as elsewhere (e.g. frontend can use the same backend `/embed` or its own config; backend RAG uses the env-driven provider).

### 5.4 Data flow (agent, Gemini path)

```text
[Client] question + eventId + folderIds (optional)
    → POST /ask/agent/stream
    → Backend: use_gemini_agent?
        → Yes: get decisions/connections (request or Supabase)
             → _retrieve_document_context_for_gemini(event_id, question, folder_ids)
                 → embed question → match_document_chunks (or scoped) → optional keyword → optional raw
             → build sys_prompt (decisions + connections + doc_context + reflexion)
             → call_gemini(question, system_instruction=sys_prompt)
             → chunk response → SSE to client
```

So: **Gemini is connected to documents only through this single RAG function and the system prompt.** No document tools are called in the Gemini path.

---

## 6. Summary table (Gemini usage)

| Area | Uses Gemini? | Model | Notes |
|------|----------------|-------|--------|
| Conversion (`/convert`, `/convert-file`) | When `use_gemini` | `GEMINI_MODEL` | One shot; JSON parsing. |
| Simple ask | When `use_gemini_for_ask` | `GEMINI_MODEL` | One shot; no RAG in backend. |
| Streaming ask | When `use_gemini_for_ask` | `GEMINI_MODEL` | One `call_gemini`, then one yield. |
| **Agent stream** (`/ask/agent/stream`) | When `use_gemini_agent` | `GEMINI_MODEL` | RAG via `_retrieve_document_context_for_gemini`; one call; chunked SSE. |
| Gmail email parsing | When `GEMINI_API_KEY` set | `GEMINI_EMAIL_MODEL` | `parse_email_with_gemini` only. |

---

## 7. How to reason about it as CTO

1. **One LLM per request**  
   Each Gemini use is a single `generate_content` call (no native streaming, no tool loop). Complexity is in prompt construction and RAG, not in multi-step agents on the Gemini side.

2. **Provider switch is env-only**  
   All “use Gemini?” branches use the same condition. To force Claude everywhere: set `CONVERTER_PROVIDER=claude` and keep `ANTHROPIC_API_KEY`. To run Gemini-only: set `GEMINI_API_KEY`, don’t set `CONVERTER_PROVIDER=claude`.

3. **Documents only in agent stream**  
   The only backend path that pulls document chunks/raw text and sends them to the LLM is the **agent stream** via `_retrieve_document_context_for_gemini`. Other ask paths rely on whatever context the frontend puts in the prompt.

4. **RAG is backend-owned**  
   Embeddings (Voyage/OpenAI/Ollama), Supabase `match_document_chunks` / `match_documents_keyword`, and the three-tier fallback (vector → keyword → raw) are all in `main.py`. Frontend sends `event_id` and optional `folder_ids`; it does not send pre-retrieved chunks for the agent stream.

5. **Single source of truth for “when Gemini”**  
   The formula `bool(GEMINI_API_KEY) and (CONVERTER_PROVIDER != "claude" or not ANTHROPIC_API_KEY)` is the single rule. All Gemini entry points (convert, ask, stream_anthropic_answer, ask_agent_stream, and the decision to use parse_email_with_gemini) align with this.

This should be enough to understand and evolve the Gemini integration and its connection to documents and the rest of the stack.
