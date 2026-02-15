# Cost approximation: onboarding a Tier 2 VC

Rough breakdown of **where money is spent** and **monthly / one-time** estimates so you can onboard a Tier 2 VC with clear expectations.

---

## 1. Where money is spent (by service)

| Service | What it does in your app | Who bills you |
|--------|---------------------------|----------------|
| **Converter backend** | Hosts all AI: embeddings, extract-company-properties, extract-entities, contextualize-chunk, chat, rerank, etc. (e.g. Render, Fly.io, Railway) | Render / Fly / Railway |
| **LLM + embeddings** | Called by the converter backend (OpenAI, Anthropic, etc.): chat, extraction, contextual headers, embeddings | OpenAI / Anthropic (or whoever the backend uses) |
| **Supabase** | DB (documents, embeddings, entities, decisions, chat, sync_config), Auth, Storage (uploaded files) | Supabase |
| **Google** | Drive API: list files, get modified time, download content | Google (usually free within quota) |
| **Frontend hosting** | Serves the React app (e.g. Vercel, Netlify) | Vercel / Netlify |

So **real money** is spent on: **converter backend hosting**, **LLM/embedding usage** (through that backend), **Supabase**, and optionally **frontend hosting**.

---

## 2. Typical Tier 2 VC usage (assumptions)

- **Users:** 3–8 (partners + associates)
- **Documents:** 200–500 at onboarding, then ~10–30 new/updated per month (Drive sync + uploads)
- **Company entities:** 50–150
- **Decisions:** 20–80 logged
- **Chat:** 50–150 queries/month
- **Sync:** 1 Drive folder, sync 1×/day or on login

---

## 3. Cost by category (approximate)

### 3.1 Converter backend (e.g. Render)

- **Role:** Runs all AI endpoints (embed, contextualize-chunk, extract-entities, extract-company-properties, ask, rerank, etc.).
- **Free tier:** Service may spin down when idle; cold starts can slow first request.
- **Paid (e.g. ~$7–25/mo):** Always-on, no spin-down.
- **Approx:** **$0** (free tier) or **$7–25/mo** (small paid instance).

### 3.2 LLM + embeddings (via converter backend)

Backend calls an LLM (Claude/OpenAI) and an embedding API. Ballpark **per doc** and **per chat**:

| Action | When | Rough cost per call | Tier 2 VC (approx) |
|--------|------|----------------------|--------------------|
| **Embedding** | Per chunk (e.g. ~5 chunks/doc) | ~$0.0001–0.0003 per doc | 500 docs → **~$0.05–0.15** one-time; **~$0.01–0.05/mo** incremental |
| **Contextualize chunk** | Per chunk before embedding | ~$0.0002–0.001 per doc | 500 docs → **~$0.10–0.50** one-time; **~$0.01–0.05/mo** incremental |
| **Extract entities** | Once per doc (sync/upload) | ~$0.001–0.003 per doc | 500 docs → **~$0.50–1.50** one-time; **~$0.02–0.10/mo** incremental |
| **Extract company properties** | Once per doc (sync/upload) | ~$0.001–0.003 per doc | 500 docs → **~$0.50–1.50** one-time; **~$0.02–0.10/mo** incremental |
| **Chat (ask/stream)** | Per user query | ~$0.02–0.10 per query | 100 queries/mo → **~$2–10/mo** |
| **Rerank / rewrite / suggest / analyze** | Occasional | Small | **~$0.50–2/mo** |

- **One-time (e.g. 500 docs onboarded):** **~$2–5** (embeddings + contextualize + extract entities + extract company).
- **Ongoing per month:** **~$3–15** (incremental docs + **chat**; chat is usually the largest variable).

So: **yes, we spend money on AI** — mainly on **chat** and on **sync/upload** (embeddings + extraction). Unchanged files in Drive sync are skipped and cost nothing.

### 3.3 Supabase

- **Free tier:** 500 MB DB, 1 GB storage, 50K MAU (auth). Often enough for a single Tier 2 VC early on.
- **Pro (~$25/mo):** More DB, storage, and egress; required if you exceed free limits.
- **Approx:** **$0** (free) or **$25–50/mo** (Pro, depending on DB size and storage).  
  (Embeddings + `raw_content` + entities can reach hundreds of MB; monitor usage.)

### 3.4 Google Drive API

- List/metadata/download within standard quotas: **free**.
- **Approx:** **$0** for typical Tier 2 VC usage.

### 3.5 Frontend hosting (e.g. Vercel)

- **Free tier:** Usually enough for one team.
- **Pro (~$20/mo):** If you need more bandwidth or team features.
- **Approx:** **$0** or **~$20/mo**.

---

## 4. Full approximation summary (Tier 2 VC)

| Item | One-time (onboarding) | Per month (ongoing) |
|------|------------------------|----------------------|
| Converter backend (e.g. Render) | — | **$0–25** |
| LLM + embeddings (AI usage) | **~$2–5** | **~$3–15** |
| Supabase | — | **$0–50** |
| Google Drive API | — | **$0** |
| Frontend (e.g. Vercel) | — | **$0–20** |
| **Total** | **~$2–5** | **~$3–110** |

- **Low end (free tiers, light use):** **~$3–10/mo** (mostly AI chat + a bit of sync).
- **Mid (one paid backend, moderate chat + sync):** **~$15–40/mo**.
- **High (backend + Supabase Pro + more chat/sync):** **~$50–110/mo**.

So **right now**, the money is spent on:

1. **AI (LLM + embeddings)** — largest variable: chat plus sync/upload (embeddings + entity + company extraction).
2. **Converter backend hosting** — if you use a paid plan so the service is always-on.
3. **Supabase** — if you outgrow the free tier.
4. **Frontend** — only if you use a paid hosting plan.

---

## 5. How to reduce cost for a Tier 2 VC

- **Sync:** Keep sync frequency **daily or on-login** (not every 15 min) so only real new/updated files trigger AI.
- **Chat:** Cap or monitor chat usage; consider a smaller/cheaper model for simple queries.
- **Embeddings:** Skip **contextualize-chunk** for some docs (e.g. very long or low-value) to save LLM cost; embeddings still run but are cheaper.
- **Supabase:** Stay on free tier as long as DB + storage are under limits; archive or trim old docs/embeddings if needed.
- **Backend:** Use free tier if cold starts are acceptable; otherwise one small paid instance is usually enough for one fund.

---

## 6. One-sentence summary

**We spend money on: (1) AI (LLM + embeddings) for chat and for each new/updated document during sync or upload, (2) optional paid hosting for the converter backend and frontend, and (3) Supabase if we exceed the free tier** — with a full approximation for onboarding one Tier 2 VC of **about $2–5 one-time** and **about $3–110/month** depending on usage and which services are on paid plans.
