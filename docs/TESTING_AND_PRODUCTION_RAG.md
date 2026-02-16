# Testing and Production Readiness: Chunking + Multi-Query RAG

How to test agentic chunking, semantic fallback, and multi-query RAG, and what to check before going to production.

---

## 1. Prerequisites

- **Backend (ollama-converter):** Running locally or at `VITE_CONVERTER_API_URL`. Needs `ANTHROPIC_API_KEY` for agentic chunking and multi-query; works without it (fallbacks).
- **Frontend:** `npm run dev` with `VITE_CONVERTER_API_URL` pointing at your converter.
- **Supabase:** Project with `document_embeddings`, `documents`, and RPCs `match_document_chunks`, `match_documents_keyword`.

---

## 2. Manual Testing

### 2.1 Backend endpoints (curl or Postman)

**Health (sanity check):**
```bash
curl -s http://localhost:8000/health
# Expect: {"status":"ok", ...}
```

**Multi-query (query expansion):**
```bash
curl -s -X POST http://localhost:8000/multi-query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is their burn rate and unit economics?", "max_variants": 3}'
# Expect: {"queries": ["original", "variant1", "variant2"], "model_used": "..."}
# Without ANTHROPIC_API_KEY: {"queries": ["original only"], "model_used": ""}
```

**Agentic chunk (document splitting):**
```bash
curl -s -X POST http://localhost:8000/agentic-chunk \
  -H "Content-Type: application/json" \
  -d '{"document_title": "Test Deck", "document_text": "Company Overview. We are a SaaS startup.\n\nTeam. Our CEO has 10 years experience.\n\nUnit Economics. Burn rate is $50k/month.", "max_sections": 6}'
# Expect: {"sections": [{"label": "...", "text": "..."}, ...], "model_used": "...", "fallback": false}
# Without ANTHROPIC_API_KEY: fallback: true, sections from paragraph split
```

**Contextualize-chunk (existing):**
```bash
curl -s -X POST http://localhost:8000/contextualize-chunk \
  -H "Content-Type: application/json" \
  -d '{"document_title": "Deck", "document_summary": "Pitch deck", "chunk_text": "Burn rate is $50k/month.", "chunk_index": 0, "total_chunks": 3}'
# Expect: {"enriched_chunk": "...", "contextual_header": "..."}
```

### 2.2 Frontend flow (E2E-style)

1. **Upload a document (agentic + semantic chunking)**  
   - Go to CIS, upload a PDF or paste text (e.g. a short pitch).  
   - In DevTools Console look for:  
     - `[CHUNK] Agentic chunking succeeded: N sections` or `[CHUNK] Using semantic fallback chunking`.  
     - `[EMBED] Indexed N chunks for doc ...`.  
   - If the backend has no API key, you should see semantic fallback and no errors.

2. **Ask a question (multi-query RAG)**  
   - Ask something that benefits from multiple phrasings (e.g. “What’s their burn rate and runway?”).  
   - In Console look for:  
     - `[MULTI-QUERY] Variants: [...]` (if multi-query succeeded).  
     - `[PARALLEL] Multi-query semantic search: { variants: N, totalRawHits: ..., mergedUnique: ... }`.  
   - Answer should cite the right doc; try a few questions to see recall.

3. **Fallbacks**  
   - Stop the converter or set a wrong `VITE_CONVERTER_API_URL`: upload/ask should fail gracefully (no hard crash).  
   - Disable `ANTHROPIC_API_KEY` on the converter: agentic chunking → semantic; multi-query → single query; answers should still work.

---

## 3. Automated backend tests (optional)

Use the existing pattern in `ollama-converter/test_validation.py`: call the API with `requests`. Example tests you can add (or run as a one-off script):

- **Multi-query:** POST `/multi-query` with a question; assert `queries` is a list, length >= 1, first element equals the question; without API key assert `queries.length === 1`.
- **Agentic-chunk:** POST `/agentic-chunk` with short text; assert `sections` is a list, each item has `label` and `text`, and all characters of input appear in concatenated `section.text`; without API key assert `fallback === true`.

Run with the converter up: `python ollama-converter/test_validation.py` (and add a similar `test_rag_endpoints.py` if you create it).

---

## 4. Production readiness checklist

### 4.1 Environment and config

- [ ] **Converter:** `ANTHROPIC_API_KEY` set in production (Render/backend env) so agentic chunking and multi-query run; if not set, fallbacks are used (semantic chunking, single query).
- [ ] **Frontend:** `VITE_CONVERTER_API_URL` points at the production converter URL (no localhost).
- [ ] **Supabase:** Production project; `document_embeddings` and RPCs exist and are migrated.

### 4.2 Timeouts and fallbacks

- [ ] **Agentic chunking:** Frontend waits up to 15s for `agenticChunk()`; on timeout or error it falls back to semantic chunking (no user-facing error for “slow chunking”).
- [ ] **Multi-query:** Frontend waits up to 5s for `generateMultiQueries()`; on timeout or error it uses the single rewritten query.
- [ ] **Contextual enrichment:** Per-chunk timeout ~6s; on failure the raw chunk is embedded.  
All of these are already implemented; confirm in production that slow or failing converter doesn’t break uploads or search.

### 4.3 Observability

- [ ] **Logs:** Backend logs `[AGENTIC-CHUNK]`, `[MULTI-QUERY]`, `[CONTEXTUAL]` (and errors). Ensure production logs are collected (e.g. Render logs, or your logging pipeline).
- [ ] **Console:** Frontend logs `[CHUNK]`, `[MULTI-QUERY]`, `[PARALLEL]` in DevTools; consider feature flags or env to reduce verbosity in production if needed.
- [ ] **Errors:** User-facing messages should not expose “VITE_CONVERTER_API_URL is not set” or raw API errors; use generic “AI service unavailable” style messages (see MVP_READINESS_VC_FIRM.md).

### 4.4 Cost and limits

- [ ] **Agentic chunking:** One Haiku call per document at index time (~2–4c per doc). No change at query time.
- [ ] **Multi-query:** One Haiku call per question (~0.1c). If you add rate limits or quotas, include this.
- [ ] **Embeddings:** Multi-query runs 2–3 embeddings per question (one per variant). Voyage cost scales with that; acceptable for typical usage.
- [ ] **Rate limits:** If you use Anthropic rate limits, ensure burst (e.g. multi-query + contextual headers + GraphRAG) doesn’t trip 429s; add retries/backoff if needed.

### 4.5 Security and robustness

- [ ] **Converter URL:** Only the frontend and your backend talk to the converter; API keys never in the frontend.
- [ ] **Input size:** Backend already truncates doc text (e.g. 12k chars) and query variants; no extra change needed unless you raise limits.
- [ ] **Idempotency:** Re-uploading the same document overwrites/re-indexes chunks (existing behavior); no duplicate rows if your flow checks `document_id` before insert.

---

## 5. Quick smoke test (production)

1. Open production app, go to CIS.
2. Upload one short document (or use an existing one).
3. Ask one factual question that should hit that doc.
4. Confirm: answer is grounded, no “AI service not configured” unless you intend to disable the converter.
5. Check backend logs for `[MULTI-QUERY]` and/or `[AGENTIC-CHUNK]` to confirm the new paths are used.

---

## 6. Summary

| What              | How to test                                                    | Production check                          |
|-------------------|----------------------------------------------------------------|-------------------------------------------|
| Multi-query RAG   | POST `/multi-query`, then ask a question and check console     | Env set, logs show variants, fallback OK |
| Agentic chunking  | POST `/agentic-chunk`; upload doc and check console            | Env set, semantic fallback if API fails  |
| Semantic fallback | Disable API key or timeout; upload doc                         | No crash, chunks still created            |
| End-to-end        | Upload doc → ask question → check answer and citations         | Smoke test on prod URL                    |

All new behavior is behind existing or new timeouts and fallbacks, so production stays safe even when the LLM or network is slow or unavailable.
