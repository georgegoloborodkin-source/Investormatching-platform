# Understanding `main.py` — Beginner's Guide

This guide walks through **main.py** like a roadmap: what the app does, how it’s built, and how the main functions work together.

---

## 1. What is this app?

**Company Second Brain V2** is a **backend API** that:

- **Converts** messy text/CSV/PDF into structured data (startups, investors, mentors, corporates).
- **Ingests** documents (PDFs, ClickUp, Google Drive) and uses AI to extract text.
- **Answers questions** about your data (“Ask the fund”) using semantic search + Claude.
- **Uses** either **Claude (Anthropic)** or **Ollama** (local models) for conversion and Q&A.

So in one sentence: *It’s a FastAPI server that uses AI to turn documents and text into structured data and to answer questions about that data.*

---

## 2. How is the file structured? (Top to bottom)

Rough order of what you’ll see in `main.py`:

| Section | Lines (approx) | What it does |
|--------|-----------------|--------------|
| **Imports & app setup** | 1–51 | Libraries, FastAPI app, optional ORJSON |
| **Security (JWT)** | 55–134 | Who is the user? What can they see? |
| **Document ingestion** | 136–281 | PDF → text using Claude (or page images) |
| **Config (env vars)** | 283–328 | API keys, model names, limits |
| **Helpers (Ollama/Anthropic)** | 330–416 | Get API URL, list models, pick model, get client |
| **CORS** | 418–434 | Allow frontend to call this API |
| **Data models (Pydantic)** | 436–499 | Request/response shapes (StartupData, InvestorData, etc.) |
| **Conversion logic** | 643–880+ | Build prompt, call LLM, parse JSON, structured output |
| **Ask-the-fund logic** | 882–1890+ | Query understanding, search, answer with Claude |
| **Normalizers** | 1892–2215 | Raw dict → `StartupData` / `InvestorData` / etc. |
| **File handling** | 2216+ | Extract text from uploaded files (PDF, CSV, …) |
| **API routes** | 2516+ | `@app.get`, `@app.post` — the actual endpoints |
| **Startup & run** | 4398–4452 | Print config, start uvicorn server |

You don’t have to memorize line numbers; use your editor’s “Go to symbol” or search for function names.

---

## 3. Key concepts

### 3.1 FastAPI and dependencies

- **FastAPI** is the web framework. It gives you routes like `GET /health` and `POST /convert`.
- **Dependencies** are functions that run before a route and inject values (e.g. `get_auth_context` injects who the user is).
- **Pydantic** models (e.g. `ConversionRequest`, `StartupData`) validate request bodies and response shapes.

### 3.2 Two AI backends

- **Claude (Anthropic)** — cloud API; used for conversion and “Ask the fund” when `ANTHROPIC_API_KEY` is set.
- **Ollama** — local models; used when no Claude key or when `CONVERTER_PROVIDER=ollama`.

The code chooses between them using env vars and availability.

---

## 4. Important functions (in order of use)

### 4.1 Security (used by many routes)

- **`get_auth_context(authorization)`**  
  Reads the `Authorization: Bearer <token>` header, decodes the JWT, and returns an `AuthContext` (user_id, group_ids, org_id, role). If `ENFORCE_AUTH` is false or no token, returns an “anonymous” context.

- **`acl_metadata_filter(auth)`**  
  Builds a filter (e.g. for vector DB) so users only see documents they’re allowed to see (by user/group/org).

### 4.2 Document ingestion (PDF → text)

- **`extract_pdf_with_claude_native(pdf_bytes, max_pages)`**  
  Sends the PDF to Claude as a document block (or falls back to page images if too big). Returns one big string of extracted text.

- **`_extract_pdf_as_page_images(pdf_bytes, max_pages)`**  
  Fallback: render each page as PNG, send each image to Claude Vision, concatenate the text.

### 4.3 Config and model selection

- **`get_anthropic_api_url()`**  
  Returns the correct Anthropic API URL (e.g. `https://api.anthropic.com/v1/messages`).

- **`fetch_ollama_model_names()`**  
  Calls Ollama’s HTTP API (or Python client) to list installed models.

- **`pick_model(available_models)`**  
  Chooses which model to use (env `OLLAMA_MODEL`, or `vc-converter*`, or `llama3.1*`, etc.).

- **`get_ollama_client()`**  
  Returns an Ollama client pointed at `OLLAMA_HOST`.

### 4.4 Conversion pipeline (core of “convert”)

- **`create_conversion_prompt(data, data_type)`**  
  Builds the prompt: “Extract startup/investor/… from this data and return JSON.” Trims input to `MAX_MODEL_INPUT_CHARS`.

- **`call_anthropic(prompt)`**  
  Sends the prompt to Claude (with model fallbacks) and returns the raw text response.

- **`call_anthropic_structured(prompt, result_schema)`**  
  Same idea but uses Claude’s “tools” with a Pydantic schema so the response is guaranteed to be valid JSON matching `StructuredConversionResult`.

- **`parse_ollama_response(response)`**  
  Takes raw model text, strips markdown code blocks, finds the first complete JSON object/array (bracket balancing), and returns a Python dict. Used when not using structured output.

- **`normalize_startup_data(data)`**, **`normalize_investor_data(data)`**, etc.  
  Take the raw dict from the model and convert it into proper `StartupData`, `InvestorData`, etc. (with defaults and type fixes).

### 4.5 “Ask the fund” pipeline

- **`extract_search_keywords(user_query)`**  
  Uses an LLM to turn the user’s question into search-friendly keywords.

- **`rewrite_query_with_llm(question, previous_messages)`**  
  Rewrites the question for better retrieval (e.g. expanding abbreviations).

- **`build_answer_prompt(...)`**  
  Builds the prompt that Claude sees: question + retrieved snippets.

- **`call_anthropic_answer(prompt, question, sources)`**  
  Calls Claude to generate the final answer.

- **`stream_anthropic_answer(...)`**  
  Same but streams the answer token-by-token (SSE).

### 4.6 File and validation helpers

- **`extract_text_content(file)`**  
  Given an uploaded file (PDF, CSV, etc.), extracts text (e.g. PDF via Claude, CSV by reading). Returns `(text, detected_type)`.

- **`try_direct_csv_parse(text_data, data_type)`**  
  If the input looks like CSV, parse it directly without calling the LLM (faster and more reliable for clean CSV).

---

## 5. Main API endpoints (routes)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/` | Root; basic info |
| GET | `/health` | Health check |
| GET | `/embedding-config` | Which embedding provider/model is used |
| GET | `/models` | List Ollama models (and which one is picked) |
| POST | `/convert` | **Main conversion**: send text → get structured startups/investors/mentors/corporates |
| POST | `/convert-file` | Upload a file → same structured output |
| POST | `/validate-file` | Check if a file is valid (and get templates) |
| POST | `/validate` | Validate raw data |
| POST | `/ask` | Ask a question about the fund’s data (with auth) |
| POST | `/ask/stream` | Same, but stream the answer |
| POST | `/ingest/document-stream` | Ingest a document (e.g. PDF) with streaming |
| POST | `/ingest/clickup` | Ingest from ClickUp |
| POST | `/ingest/google-drive` | Ingest from Google Drive |
| POST | `/embed/query` | Get embedding vector for a query |
| POST | `/rerank` | Rerank documents (e.g. with Cohere) |
| POST | `/contextualize-chunk` | Add context to a chunk for retrieval |
| POST | `/graphrag/retrieve` | GraphRAG-style retrieval (with auth) |
| POST | `/suggest-connections` | Suggest connections (with auth) |
| POST | `/rewrite-query` | Rewrite a query for search |

The “heart” of the app for conversion is **`POST /convert`** and **`POST /convert-file`**.

---

## 6. Flow of a typical “convert” request

When a client sends **POST /convert** with `{ "data": "some text or CSV...", "dataType": "startup" }`:

1. **Route** `convert_data(request)` runs.
2. If `format == 'csv'`, it tries **`try_direct_csv_parse`** first; if that returns a result, it’s returned and no LLM is used.
3. Otherwise:
   - **`create_conversion_prompt(request.data, request.dataType)`** builds the prompt.
   - If Claude is configured:
     - It tries **`call_anthropic_structured(prompt)`** (strict JSON via tools).
     - If that fails, it falls back to **`call_anthropic(prompt)`** and **`parse_ollama_response(response_text)`**.
   - If using Ollama:
     - **`fetch_ollama_model_names()`** → **`pick_model(...)`** → **`get_ollama_client().chat(...)`** with the prompt, then **`parse_ollama_response`**.
4. **Unwrap** the parsed dict (e.g. `data`, `startups`, `investors`).
5. **Normalize** each item with **`normalize_startup_data`** / **`normalize_investor_data`** / etc.
6. Build a **`ConversionResponse`** (startups, investors, mentors, corporates, detectedType, confidence, warnings, errors) and return it.

So: **request → prompt → LLM (Claude or Ollama) → parse JSON → normalize → response.**

---

## 7. How the server starts

At the bottom of `main.py`:

- **`if __name__ == "__main__"`** runs when you execute `python main.py`.
- It optionally sets **uvloop** as the event loop (faster async).
- **`startup_event`** is registered with FastAPI; when the app starts it prints config (embedding provider, JWT, Claude, PDF strategy, etc.).
- **`uvicorn.run(app, host="0.0.0.0", port=...)`** starts the HTTP server (port from `PORT` or `OLLAMA_CONVERTER_PORT`, default 8000).

So: **run `python main.py` → startup event prints config → uvicorn serves the app.**

---

## 8. Summary diagram

```
                    Client (browser / frontend)
                              |
                    POST /convert or /convert-file
                              |
                    convert_data() or convert_file()
                              |
         +--------------------+--------------------+
         |                                         |
   format==csv?                            create_conversion_prompt()
   try_direct_csv_parse()                            |
         |                                    Claude or Ollama?
         |                                    +------+------+
         |                                    |             |
         |                           call_anthropic_*   Ollama .chat()
         |                           or _structured()         |
         |                                    |             |
         +--------------------+---------------+
                              |
                    parse_ollama_response() if needed
                              |
                    normalize_*_data() for each entity
                              |
                    ConversionResponse (startups, investors, ...)
                              |
                    JSON response to client
```

---

## 9. Where to read next

- **Conversion only:** `create_conversion_prompt` → `call_anthropic` / `call_anthropic_structured` → `parse_ollama_response` → `normalize_*_data` and the `/convert` route.
- **Auth:** `get_auth_context`, `acl_metadata_filter`, and routes that use `Depends(get_auth_context)`.
- **PDF ingestion:** `extract_pdf_with_claude_native` and `_extract_pdf_as_page_images`.
- **Ask the fund:** `/ask` and `/ask/stream`, then `extract_search_keywords`, `build_answer_prompt`, `call_anthropic_answer` / `stream_anthropic_answer`.

If you tell me which part you care about most (e.g. “only conversion” or “only auth”), we can go through that part line by line next.
