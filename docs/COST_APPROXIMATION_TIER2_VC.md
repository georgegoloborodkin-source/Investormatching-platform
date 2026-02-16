# Cost approximation: onboarding a Tier 2 VC

Rough breakdown of **where money is spent**, **per-document API injections**, and **calculated beginning vs monthly** costs for one Tier 2 VC.

---

## 1. Per-document API injections (what runs per new/updated doc)

For **every new or changed document** (upload or Drive sync), the pipeline runs exactly this (from `CIS.tsx` + converter backend):

| Step | API / action | Count per doc | Notes |
|------|----------------|----------------|--------|
| **1. Chunking** | In-browser | 1× | Text truncated to **12,000 chars**; parent-child chunks: max **6 parents** × **3 children** = **up to 18 chunks**. |
| **2. Contextualize chunk** | `contextualizeChunk` (LLM) | **Up to 18×** | One call per chunk. Input: doc title, first 500 chars summary, chunk text. Output: enriched chunk + short header. |
| **3. Embed chunk** | `embedQuery` (embedding API) | **Up to 18×** | One call per chunk (enriched or raw text). Voyage/OpenAI-style embedding. |
| **4. Extract entities** | `extractEntities` (LLM) | **1×** | After embeddings. Input: doc title, text (capped), optional PDF base64. Output: entities, relationships, KPIs. |
| **5. Extract company properties** | `extractCompanyProperties` (LLM) | **0 or 1×** | Only when doc is linked to a company (e.g. Drive folder name match). Enriches that company card. |

**Unchanged documents in Drive sync are skipped** (no API calls).

So **per document**, in the worst case:
- **18 contextualize + 18 embed + 1 extractEntities + 0 or 1 extractCompanyProperties**  
  → **37–38 API calls per doc** (most are small; the expensive ones are LLM: contextualize × chunks + extractEntities + optional extractCompanyProperties).

Typical medium doc (e.g. 5–6 chunks): **~6 contextualize + 6 embed + 1 extractEntities** = 13 calls; with company link **+1 extractCompanyProperties** = 14.

---

## 2. Where money is spent (by service)

| Service | What it does in your app | Who bills you |
|--------|---------------------------|----------------|
| **Converter backend** | Hosts all AI: embeddings, extract-company-properties, extract-entities, contextualize-chunk, chat, rerank, etc. (e.g. Render, Fly.io, Railway) | Render / Fly / Railway |
| **LLM + embeddings** | Called by the converter backend (OpenAI, Anthropic, etc.): chat, extraction, contextual headers, embeddings | OpenAI / Anthropic (or whoever the backend uses) |
| **Supabase** | DB (documents, embeddings, entities, decisions, chat, sync_config), Auth, Storage (uploaded files) | Supabase |
| **Google** | Drive API: list files, get modified time, download content | Google (usually free within quota) |
| **Frontend hosting** | Serves the React app (e.g. Vercel, Netlify) | Vercel / Netlify |

So **real money** is spent on: **converter backend hosting**, **LLM/embedding usage** (through that backend), **Supabase**, and optionally **frontend hosting**.

---

## 3. Typical Tier 2 VC usage (assumptions)

- **Users:** 3–8 (partners + associates)
- **Documents:** 200–500 at onboarding, then ~10–30 new/updated per month (Drive sync + uploads)
- **Company entities:** 50–150
- **Decisions:** 20–80 logged
- **Chat:** 50–150 queries/month
- **Sync:** 1 Drive folder, sync 1×/day or on login

---

## 4. Cost by category (approximate)

### 4.1 Converter backend (e.g. Render)

- **Role:** Runs all AI endpoints (embed, contextualize-chunk, extract-entities, extract-company-properties, ask, rerank, etc.).
- **Free tier:** Service may spin down when idle; cold starts can slow first request.
- **Paid (e.g. ~$7–25/mo):** Always-on, no spin-down.
- **Approx:** **$0** (free tier) or **$7–25/mo** (small paid instance).

### 4.2 LLM + embeddings (via converter backend)

Backend calls an LLM (Claude/OpenAI) and an embedding API. Ballpark **per doc** and **per chat**:

| Action | When | Rough cost per call | Tier 2 VC (approx) |
|--------|------|----------------------|--------------------|
| **Embedding** | Per chunk (**up to 18/doc**) | ~$0.00001–0.00002 per chunk | 500 docs × ~10 chunks → **~$0.05–0.10** one-time; **~$0.002–0.006/mo** (20 docs) |
| **Contextualize chunk** | Per chunk (**up to 18/doc**) | ~$0.0001–0.0003 per chunk | 500 docs × ~10 chunks → **~$0.50–1.50** one-time; **~$0.02–0.06/mo** (20 docs) |
| **Extract entities** | Once per doc | ~$0.001–0.004 per doc | 500 docs → **~$0.50–2** one-time; **~$0.02–0.12/mo** (20 docs) |
| **Extract company properties** | 0 or 1× per doc (when linked) | ~$0.001–0.003 per doc | 500 docs × 50% → **~$0.25–0.75** one-time; **~$0.01–0.03/mo** |
| **Chat (ask/stream)** | Per user query | ~$0.02–0.10 per query | 100 queries/mo → **~$2–10/mo** |
| **Rerank / rewrite / suggest / analyze** | Occasional | Small | **~$0.50–2/mo** |

- **One-time (e.g. 500 docs onboarded):** **~$1.30–4.35** (embeddings + contextualize + extract entities + extract company).
- **Ongoing per month (docs only):** **~$0.05–0.21** for ~20 new/updated docs; **chat** dominates (see below).

So: **yes, we spend money on AI** — mainly on **chat** and on **sync/upload** (embeddings + extraction). Unchanged files in Drive sync are skipped and cost nothing.

### 4.3 Supabase

- **Free tier:** 500 MB DB, 1 GB storage, 50K MAU (auth). Often enough for a single Tier 2 VC early on.
- **Pro (~$25/mo):** More DB, storage, and egress; required if you exceed free limits.
- **Approx:** **$0** (free) or **$25–50/mo** (Pro, depending on DB size and storage).  
  (Embeddings + `raw_content` + entities can reach hundreds of MB; monitor usage.)

### 4.4 Google Drive API

- List/metadata/download within standard quotas: **free**.
- **Approx:** **$0** for typical Tier 2 VC usage.

### 4.5 Frontend hosting (e.g. Vercel)

- **Free tier:** Usually enough for one team.
- **Pro (~$20/mo):** If you need more bandwidth or team features.
- **Approx:** **$0** or **~$20/mo**.

---

## 5. Calculated: beginning vs monthly (Tier 2 VC)

### 5.1 One-time (beginning / onboarding)

Assume **350 documents** at go-live (mid range 200–500):

| Cost item | Calculation | USD |
|-----------|------------|-----|
| **Contextualize** | 350 docs × ~10 chunks × $0.0002 | **~$0.70** |
| **Embed** | 350 docs × ~10 chunks × $0.000015 | **~$0.05** |
| **Extract entities** | 350 × $0.0025 | **~$0.88** |
| **Extract company** | 175 docs (50%) × $0.002 | **~$0.35** |
| **AI subtotal (onboarding)** | | **~$2.00–3.50** |
| **Hosting (Supabase, backend, frontend)** | One-time setup = **$0** (no prorations) | **$0** |
| **Total one-time** | | **~$2–4** |

So **at the beginning**, a Tier 2 VC pays **~$2–4** in AI usage to onboard 350 docs; no other one-time platform fee if you use free tiers.

### 5.2 Every month (ongoing)

Assume **20 new/updated docs/month**, **100 chat queries**, free tiers for backend + frontend + Supabase where possible:

| Cost item | Calculation | USD/mo |
|-----------|------------|--------|
| **Contextualize** | 20 × 10 × $0.0002 | **~$0.04** |
| **Embed** | 20 × 10 × $0.000015 | **~$0.003** |
| **Extract entities** | 20 × $0.0025 | **~$0.05** |
| **Extract company** | 10 × $0.002 | **~$0.02** |
| **Chat** | 100 × $0.05 (mid) | **~$5** |
| **Rerank / suggest / analyze** | | **~$1** |
| **AI subtotal (monthly)** | | **~$6–7** |
| **Converter backend** | Free or paid | **$0 or $7–25** |
| **Supabase** | Free or Pro | **$0 or $25–50** |
| **Frontend** | Free or Pro | **$0 or $20** |
| **Total per month** | | **~$6–102** |

### 5.3 Summary table (what they pay)

| Scenario | Beginning (one-time) | Every month |
|----------|------------------------|-------------|
| **Minimum** (free tiers, 350 docs, then 20 docs/mo + 100 chat) | **~$2–4** | **~$6–10** |
| **Typical** (paid backend $15, rest free) | **~$2–4** | **~$21–32** |
| **High** (backend + Supabase Pro + frontend Pro) | **~$2–4** | **~$55–110** |
| **Heavy** (5,000 docs at start, 100 docs/mo + 300–500 chat) | **~$28–35** | **~$22–120** |

So: **beginning ≈ $2–4** (one-time AI to index initial docs). **Monthly ≈ $6–10** at the low end (AI only), **~$20–35** typical (AI + paid backend), **~$55–110** if everything is on paid plans.

### 5.4 Heavy scenario: 5,000 docs at start + high monthly (chat-heavy)

If a Tier 2 VC onboard **5,000 documents** and then has **100 new/updated docs/month** and **300–500 chat queries/month**:

| Cost item | Calculation | USD |
|-----------|------------|-----|
| **One-time (5,000 docs)** | | |
| Contextualize | 5000 × 10 × $0.0002 | **~$10** |
| Embed | 5000 × 10 × $0.000015 | **~$0.75** |
| Extract entities | 5000 × $0.0025 | **~$12.50** |
| Extract company | 2500 × $0.002 | **~$5** |
| **One-time total** | | **~$28–35** |
| **Every month (100 docs + 400 chat)** | | |
| Contextualize | 100 × 10 × $0.0002 | **~$0.20** |
| Embed | 100 × 10 × $0.000015 | **~$0.015** |
| Extract entities | 100 × $0.0025 | **~$0.25** |
| Extract company | 50 × $0.002 | **~$0.10** |
| **Chat** | 400 × $0.05 | **~$20** |
| Rerank / analyze | | **~$2–3** |
| **AI subtotal (monthly)** | | **~$22–24** |
| Backend + Supabase + frontend | | **$0–95** |
| **Total per month** | | **~$22–120** |

So for **heavy use**:
- **Beginning (5,000 docs):** **~$28–35** one-time (AI only).
- **Monthly:** **~$22–24** AI + **$0–95** hosting = **~$22–120/mo** (chat is the main driver at 400 queries).

---

## 6. Full approximation summary (Tier 2 VC)

| Item | One-time (onboarding) | Per month (ongoing) |
|------|------------------------|----------------------|
| Converter backend (e.g. Render) | — | **$0–25** |
| LLM + embeddings (AI usage) | **~$2–4** | **~$6–15** (docs + chat) |
| Supabase | — | **$0–50** |
| Google Drive API | — | **$0** |
| Frontend (e.g. Vercel) | — | **$0–20** |
| **Total** | **~$2–4** | **~$6–110** |

- **Low end (free tiers, light use):** **~$6–10/mo** (mostly AI chat + sync).
- **Mid (one paid backend, moderate chat + sync):** **~$21–35/mo**.
- **High (backend + Supabase Pro + more chat/sync):** **~$55–110/mo**.
- **Heavy (5k docs at start, 100 docs/mo + 300–500 chat):** **~$28–35 one-time**, then **~$22–120/mo** (chat dominates monthly).

So **right now**, the money is spent on:

1. **AI (LLM + embeddings)** — largest variable: chat plus sync/upload (embeddings + entity + company extraction).
2. **Converter backend hosting** — if you use a paid plan so the service is always-on.
3. **Supabase** — if you outgrow the free tier.
4. **Frontend** — only if you use a paid hosting plan.

---

## 7. How to reduce cost for a Tier 2 VC

- **Sync:** Keep sync frequency **daily or on-login** (not every 15 min) so only real new/updated files trigger AI.
- **Chat:** Cap or monitor chat usage; consider a smaller/cheaper model for simple queries.
- **Embeddings:** Skip **contextualize-chunk** for some docs (e.g. very long or low-value) to save LLM cost; embeddings still run but are cheaper.
- **Supabase:** Stay on free tier as long as DB + storage are under limits; archive or trim old docs/embeddings if needed.
- **Backend:** Use free tier if cold starts are acceptable; otherwise one small paid instance is usually enough for one fund.

---

## 8. One-sentence summary

**We spend money on: (1) AI (LLM + embeddings) for chat and for each new/updated document (per doc: up to 18× contextualize + 18× embed + 1× extractEntities + 0–1× extractCompanyProperties), (2) optional paid hosting for the converter backend and frontend, and (3) Supabase if we exceed the free tier** — with **~$2–4 one-time** at the beginning (350 docs) and **~$6–10/mo** (low) to **~$55–110/mo** (high) depending on chat volume and which services are on paid plans.
