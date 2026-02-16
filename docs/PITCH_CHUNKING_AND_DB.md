# Pitch-ready: How chunking works and how it talks to the DB

**Copy the text below into chat or use it in a pitch.**

---

## How chunking works

We don't feed whole documents to search. We split each document into **small, topic-based segments (chunks)** and store **one vector per chunk** so we can retrieve only the bits that match the question.

**Agentic chunking (LLM-driven)**

- We use **agentic chunking**: an LLM (Claude Haiku) reads the full document and splits it into **labeled topic sections** -- e.g. "Company Overview", "Unit Economics", "Team & Advisors". This means chunks align with the *meaning* of the document, not arbitrary character boundaries.
- Each section becomes a **parent chunk**. Within each parent, we split on **sentence boundaries** into smaller **child chunks** (up to ~500 chars, max 4 per parent). So one document becomes at most ~32 child chunks, each one a coherent piece of a labeled topic.
- If the LLM is unavailable, we **fall back to semantic chunking** (split on paragraph and sentence boundaries) -- so the system never fails, it just degrades gracefully.

**Before embedding: optional "contextual" header**

- For each child chunk we can call our backend to generate a short **contextual header** (e.g. "This section describes Roadrims' unit economics and burn rate") and prepend it to the chunk before we embed it. That follows the "contextual retrieval" idea and improves match quality. If that step times out or fails, we still embed the raw chunk.

**Where the text comes from**

- For PDFs we either send the file to the AI to "read" visually (when possible) or extract text (e.g. via a PDF library). The **first 12,000 characters** of that text are used for chunking and embedding. The rest can still be used for entity extraction or other flows, but not for chunk search.

So in one line: **we take up to 12k characters per doc, have an LLM split it into labeled topic sections, break each section into sentence-aligned child chunks, optionally add a contextual header per child, then embed each child and store it with its parent.**

> For the full technical details and design rationale, see [CHUNKING_STRATEGY.md](./CHUNKING_STRATEGY.md).

---

## How it communicates with the database

**Storage (ingestion)**

- **Table:** `document_embeddings` (in Postgres via Supabase).
- **Columns we care about:** `document_id`, `chunk_text` (the child text), `parent_text` (the parent segment), `parent_index`, `child_index`, `embedding` (a **1536-dimensional vector** from VoyageAI), and optionally `contextual_header`.
- **Flow:** For each child chunk we (1) optionally get a contextual header from our converter API, (2) call the converter's `/embed/query` with the text to embed (header + child or just child), (3) get back a 1536-d vector, (4) insert one row into `document_embeddings` with that vector, the child text, parent text, and indices.
- The **embedding** column uses the **pgvector** extension (type `vector(1536)`). We have an **IVFFlat index** on that column (cosine distance) so similarity search is fast.

**Search (at query time) -- Multi-Query RAG**

- The user's question is **rewritten** by the AI if it's vague or a follow-up (e.g. "What about their unit economics?" -> "What are Roadrims' unit economics?").
- We then use **multi-query expansion**: an LLM generates **2-3 diverse reformulations** of the query (e.g. "monthly cash expenditure and runway", "operating expenses vs revenue"). This improves recall by searching from multiple angles.
- All query variants are **embedded in parallel** via VoyageAI, producing multiple 1536-d query vectors.
- We run **`match_document_chunks` for each variant in parallel** against Postgres, then **merge and deduplicate** results (keeping the best similarity score per document).
- The merged results go through the same ranking pipeline: optional **GraphRAG** relevance scoring, **RRF merge** with keyword results, reranking, and document fetching.
- So the DB still does only **vector math** inside Postgres. All LLM calls (query expansion, embedding) go through our **converter API**; the frontend orchestrates the parallel searches and merge.

**Hybrid search (optional keyword leg)**

- We can also run **keyword search** on the `documents` table (full-text search on `raw_content`) via `match_documents_keyword`. Results are merged with the vector results (e.g. RRF or similar) so we get both "meaning similar" and "exact words" matches. So: **vector search on chunks in `document_embeddings`, keyword search on full document text in `documents`; merge and rank.**

**After retrieval**

- The top chunks (and optionally keyword snippets) are passed as **sources** to the LLM (Claude), together with company cards and conversation history. The model answers only from those sources so answers are grounded in your data. We can also run a **GraphRAG-style** step where the AI scores each retrieved chunk for relevance and optionally expands to neighboring chunks before we send the final set to the answer model.

So in one line: **the frontend gets a query vector from the converter, calls `match_document_chunks` in Postgres with that vector and event id, gets back the closest chunks; optionally runs keyword search and GraphRAG; then sends those chunks to the LLM as context.**

---

## One-paragraph version (for a quick pitch)

We use agentic chunking: an LLM reads each document and splits it into labeled topic sections (e.g. "Unit Economics", "Team"), then we break each section into sentence-aligned child chunks (~500 chars), optionally add a contextual header per chunk, and embed each with VoyageAI into a 1536-d vector stored in Postgres using pgvector. At query time, we use multi-query RAG: an LLM generates 2-3 diverse reformulations of the question, we embed and search all variants in parallel, then merge and deduplicate results. We also run keyword search and merge the two with Reciprocal Rank Fusion. Those chunks (and company cards) are then sent to Claude as the only context, so every answer is grounded in your docs and your DB -- no hallucination from the rest of the web unless we explicitly turn on web search.
