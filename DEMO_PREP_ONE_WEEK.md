# One-Week Demo Prep — Investment Analysts

**Goal:** Ship a stable, professional demo in 1 week.  
**Audience:** Investment analysts (expect polish, clear errors, no dev noise).

---

## SSE vs WebSockets — Recommendation

**Use SSE (what you have).** Do **not** switch to WebSockets for this platform.

| | SSE / HTTP streaming | WebSockets |
|--|----------------------|------------|
| **Direction** | Server → client (one-way) | Bidirectional |
| **Your use case** | Chat streaming, extraction status, ingestion progress | N/A — you don't need client→server real-time |
| **Complexity** | Simple (fetch + `ReadableStream`, or `EventSource`) | Higher (connection lifecycle, heartbeats, reconnects) |
| **Proxies / Render** | Works with standard HTTP; keeps connection alive via streaming | Can be blocked or need special config |
| **Demo risk** | Low — already implemented | High — new code, more failure modes |

You already stream via **`fetch` + `response.body.getReader()`** with SSE-style `data: {...}\n\n` from `/ask/stream`, `/extract-entities/stream`, etc. That is the right pattern. **No change needed for the demo.**

---

## Must Fix (Days 1–2)

- [ ] **Env for demo**
  - Set `VITE_CONVERTER_API_URL` to your live converter (e.g. Render).
  - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for production.
  - Use a `.env.production` or hosting env vars so the built app has them; don’t rely on local `.env` only.

- [ ] **Converter API down**
  - When `resolveConverterApiBaseUrl()` fails (no health), the app can throw: *"VITE_CONVERTER_API_URL is not set..."* or fail on first AI action.
  - Add a **graceful message** on CIS load or first use: e.g. “AI features are temporarily unavailable. You can still browse and manage documents.” and disable only chat/convert/embed actions, not the whole page.

- [ ] **Debug logs**
  - **Frontend:** Many `console.log("[DEBUG] ...")` in `CIS.tsx` (and a few in `aiConverter.ts`). For demo build, strip or gate behind `import.meta.env.DEV` so analysts don’t see console noise.
  - **Backend:** ~117 `print(...)` / `[DEBUG]` in `ollama-converter/main.py`. Gate behind an env (e.g. `DEBUG=1`) or remove from `/ask/stream` and other demo-critical paths so logs don’t look like “debug mode” in production.

---

## Should Fix (Days 3–4)

- [ ] **User-facing errors**
  - Replace raw API messages (e.g. “VITE_CONVERTER_API_URL is not set”) with short, analyst-friendly copy: e.g. “AI service is not configured. Contact your administrator.”
  - Ensure timeouts (e.g. 70s for ask, 15s for embedding) show a clear message: “The request took too long. Please try a shorter question or try again later.” — not a stack trace or “Request timed out” without context.

- [ ] **Loading states**
  - Chat: “Searching your documents…” then “Generating answer…” so analysts see progress during long RAG + LLM.
  - Document upload: “Uploading…” → “Extracting text…” → “Indexing for search…” so it’s clear why there’s a delay (embeddings, extraction).

- [ ] **Empty states**
  - CIS: When there are no documents, keep a clear line like “No documents yet. Upload pitch decks or CSVs to get started.” (you have “No documents yet.” — ensure it’s visible and actionable).
  - Chat: When there’s no history, a single short line: “Ask a question about your documents” so the value prop is obvious.

---

## Nice to Have (Days 5–7)

- [ ] **Health check in UI**
  - Optional: small “AI status: OK” or “AI unavailable” in header/footer (call converter `/health` once on load). Helps you and analysts know if the backend is up.

- [ ] **Demo script**
  - One-page “Demo script” (in repo or Notion): order of steps (e.g. 1) Upload a deck, 2) Ask “What does this company do?”, 3) Show sources). Reduces fumbling during the meeting.

- [ ] **.env.example**
  - Add `.env.example` with `VITE_CONVERTER_API_URL=`, `VITE_SUPABASE_URL=`, `VITE_SUPABASE_PUBLISHABLE_KEY=`, and a one-line comment each. So whoever runs the app next knows what’s required.

- [ ] **README**
  - Add a “Demo / production” section: required env vars, where to set them (Vercel/Render), and “Converter API must be running at VITE_CONVERTER_API_URL.”

---

## Don’t Do This Week

- **Do not** migrate chat/streaming to WebSockets.
- **Do not** add big new features; focus on stability and clarity.
- **Do not** leave `[DEBUG]` or `print()` in demo-critical paths without gating.

---

## Quick Checklist (copy to your tracker)

```
[ ] VITE_CONVERTER_API_URL + Supabase env set for production build
[ ] Graceful message when converter API is down (no hard throw on first use)
[ ] Debug logs gated or removed for production (frontend + backend)
[ ] Friendly error messages (no "VITE_... is not set" in UI)
[ ] Timeout messages user-friendly
[ ] Loading copy for chat and upload
[ ] Empty states clear and actionable
[ ] .env.example + README demo section (optional)
[ ] Demo script for analysts (optional)
```
