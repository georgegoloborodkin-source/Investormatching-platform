# ML in Orbit Ventures / CIS — and Questions for Your LP-Connected Co-Founder

## Part 1: ML / AI Used in the Program Today

### High-level picture

The platform is a **RAG (Retrieval-Augmented Generation) system**: it turns your documents into searchable vectors, finds relevant chunks for each question, then uses a large language model (Claude) to answer using those chunks (and optional web search). Several ML components work together.

---

### 1. Embeddings (semantic search)

**What it does:** Converts text into fixed-size vectors so we can find “similar” text by vector distance (e.g. cosine similarity).

**What’s used:**
- **Primary:** **VoyageAI** — model `voyage-large-2`, **1536 dimensions**
  - Used for both **document chunks** (at index time) and **user queries** (at query time)
  - `input_type`: `"document"` for chunks, `"query"` for the user question (Voyage optimizes for this)
- **Fallbacks** (if Voyage isn’t configured): OpenAI `text-embedding-3-small` (1536 dims), or Ollama `nomic-embed-text` (local)

**Where:** Backend `ollama-converter/main.py` — `generate_embedding_voyage`, `/embed/query`; frontend calls these when indexing docs and when sending the user’s question.

---

### 2. Claude (Anthropic) — two models

**Primary (heavy lifting):** **Claude Sonnet** (`claude-sonnet-4-20250514` by default)

- **Chat / “Ask the fund”:** Builds the final answer from retrieved chunks (+ optional web search).
- **Entity extraction:** Companies, people, relationships, KPIs from documents.
- **Company property extraction:** Bio, stage, ARR, TAM, competitors, GTM, unit economics, social links, etc., from pitch decks (including **native PDF vision** — Sonnet “sees” the PDF layout/tables/charts).
- **Connection suggestions:** Suggests company–company connections from docs + existing graph.
- **PDF understanding:** When you upload a PDF, the backend can send it as a **document block** (base64) so Claude reads it visually instead of raw text only.

**Secondary (fast/cheap):** **Claude Haiku** (`claude-haiku-4-20250514`)

- **Query rewriting:** Turns vague or follow-up questions (“What about their unit economics?”) into a full, standalone query that still refers to the right company/context. This runs *before* retrieval so search sees a clear question.
- **Contextual chunk headers:** For each text chunk, Haiku generates a short “what this chunk is about” header; the chunk is stored as `header + chunk`. That improves retrieval quality (idea from “contextual retrieval”).
- **GraphRAG-style relevance:** After vector search returns chunks, Haiku scores each chunk as relevant or not to the query; if there aren’t enough relevant chunks, the system can pull in “neighboring” chunks and score those too. So retrieval is **vector search → LLM relevance filter → optional expansion**.

There is a **model fallback**: if the configured Claude model returns 404 (e.g. retired), the backend automatically tries the next in the chain (e.g. `claude-sonnet-4-20250514`, `claude-3-7-sonnet-latest`, `claude-haiku-4-20250514`).

---

### 3. RAG pipeline (how a question becomes an answer)

1. **Query rewriting (Haiku):** User question → rewritten, contextualized query (especially for short/follow-up questions).
2. **Embed query (Voyage):** Rewritten query → 1536-dim vector.
3. **Vector + keyword search:** Backend (e.g. Supabase/pgvector) does **hybrid search**: vector similarity + keyword match on `document_chunks` (and any ACL filters). Returns top chunks.
4. **GraphRAG-style step (Haiku):** Each chunk is assessed: “Is this relevant to the query?” Low-relevance chunks can be dropped; if needed, neighboring chunks are fetched and assessed too.
5. **Answer (Sonnet):** A prompt is built from: system instructions + retrieved chunks + conversation history + optional **web search**. When the user turns on “web search,” Claude can call Anthropic’s **native web search** tool (`web_search_20250305`) for up-to-date results; citations are formatted as `[number] [Title](url)`.

So in one sentence: **Voyage does semantic (and hybrid) retrieval; Haiku does query rewriting and chunk relevance; Sonnet does extraction, PDF understanding, and the final answer (with optional web search).**

---

### 4. Optional: Web search

- **What:** Anthropic’s **native web search** (beta), enabled when the user toggles it in the UI.
- **How:** The Ask request includes `web_search_enabled`; the backend adds the `web_search_20250305` tool to the Claude call. Claude can then search the web and cite sources (e.g. for “latest funding” or “company X 2026”).

---

### 5. Summary table

| Component            | Technology              | Role |
|----------------------|-------------------------|------|
| Embeddings           | VoyageAI `voyage-large-2` (1536d) | Semantic indexing and query encoding |
| Query rewriting      | Claude Haiku            | Turn vague/follow-up into clear search query |
| Chunk headers        | Claude Haiku            | Contextual retrieval (better chunk matches) |
| Chunk relevance      | Claude Haiku            | GraphRAG-style filter/expand after vector search |
| Chat / answers       | Claude Sonnet           | Synthesize answer from chunks + optional web |
| Entity extraction    | Claude Sonnet           | Entities, relationships, KPIs from text/PDF |
| Company properties   | Claude Sonnet           | Rich fields from pitch decks (with PDF vision) |
| Web search           | Anthropic `web_search_20250305` | Live web when user enables it |
| Vector DB            | Supabase/pgvector       | Store 1536-d vectors, hybrid search |

---

## Part 2: Questions to Ask Your Co-Founder (LP & Fund Connections)

Use these to turn their network and experience into clear product, GTM, and positioning input.

### Product–market and “would they use it?”

1. When you talk to GPs or LPs, what’s the **one tool or process** they complain about most (deal flow, portfolio monitoring, LP reporting, sourcing)?
2. If we described Orbit as “company intelligence + doc chat + connection graph for your fund,” what would they say is **missing** for it to be a no-brainer for a Tier 2 fund?
3. Would any of their LP or GP contacts actually **pilot** this with real deal flow? What would we need to promise (e.g. security, SLA, specific features)?

### Distribution and sales motion

4. In their experience, how do tools like this typically **get in the door** at a fund — GP intro, LP intro, placement agent, or outbound? Who’s the best “first yes”?
5. Who’s the **economic buyer** — managing partner, head of ops, head of IR — and who’s the daily user (associate, analyst)?
6. Are there **fund-of-funds or family offices** in their network that would care more about LP reporting than deal flow? Would that be a different product slice?

### Pricing and competition

7. What do comparable tools (e.g. Notion, Airtable, Affinity, custom spreadsheets) **cost** per fund in their world? What’s the range they’d expect to pay for “one place for companies, docs, and Q&A”?
8. What do they **use today** for company/deal tracking and LP updates? What do they hate about it?

### Compliance and risk

9. What **compliance or security** expectations do LPs have when a fund uses a third-party tool (e.g. SOC 2, data residency, audit trail)? Does that differ by LP type (e.g. pension vs family office)?
10. Would **anonymized or aggregated** usage stats (e.g. “X funds use this for portfolio monitoring”) help with LP conversations, or is that irrelevant?

### Roadmap and positioning

11. If we added **LP-facing reporting** (e.g. auto-summaries, portfolio health, attribution), would that change how they’d position us to LPs (e.g. “tool for the fund” vs “tool that helps the fund report to LPs”)?
12. What’s the **single feature** they’d want to see before introducing us to their best GP or LP contact?

---

You can use Part 1 to explain “what’s under the hood” to technical stakeholders and Part 2 to structure conversations with your co-founder and, later, with LPs and funds they connect you to.
