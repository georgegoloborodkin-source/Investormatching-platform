# Pitch-ready: How chunking works and how it talks to the DB

**Copy the text below into chat or use it in a pitch.**

---

## How chunking works

We don’t feed whole documents to search. We split each document into **small, overlapping segments (chunks)** and store **one vector per chunk** so we can retrieve only the bits that match the question.

**Parent–child chunking**

- We use a **parent–child** scheme so we keep both local context (the exact sentence) and surrounding context (the paragraph/section).
- **Parents:** We split the document into “parent” segments of **2,000 characters** with **200 characters overlap** between consecutive parents (so a sentence isn’t cut at the boundary). We take at most **6 parent chunks** per document (first ~12k characters).
- **Children:** Each parent is split again into smaller “child” chunks of **400 characters** with **80 characters overlap**. We keep at most **3 child chunks per parent**.
- So one document becomes at most **6 × 3 = 18 chunks** (often fewer). Each chunk we actually embed and store is a **child**; we store the **parent text** next to it so the model gets surrounding context when we retrieve.

**Before embedding: optional “contextual” header**

- For each child chunk we can call our backend to generate a short **contextual header** (e.g. “This section describes Roadrims’ unit economics and burn rate”) and prepend it to the chunk before we embed it. That follows the “contextual retrieval” idea and improves match quality. If that step times out or fails, we still embed the raw chunk.

**Where the text comes from**

- For PDFs we either send the file to the AI to “read” visually (when possible) or extract text (e.g. via a PDF library). The **first 12,000 characters** of that text are used for chunking and embedding. The rest can still be used for entity extraction or other flows, but not for chunk search.

So in one line: **we take up to 12k characters per doc, split into parent chunks (2k, 200 overlap), then child chunks (400, 80 overlap), optionally add a contextual header per child, then embed each child and store it with its parent.**

---

## How it communicates with the database

**Storage (ingestion)**

- **Table:** `document_embeddings` (in Postgres via Supabase).
- **Columns we care about:** `document_id`, `chunk_text` (the child text), `parent_text` (the parent segment), `parent_index`, `child_index`, `embedding` (a **1536-dimensional vector** from VoyageAI), and optionally `contextual_header`.
- **Flow:** For each child chunk we (1) optionally get a contextual header from our converter API, (2) call the converter’s `/embed/query` with the text to embed (header + child or just child), (3) get back a 1536-d vector, (4) insert one row into `document_embeddings` with that vector, the child text, parent text, and indices.
- The **embedding** column uses the **pgvector** extension (type `vector(1536)`). We have an **IVFFlat index** on that column (cosine distance) so similarity search is fast.

**Search (at query time)**

- The user’s question is **rewritten** by the AI if it’s vague or a follow-up (e.g. “What about their unit economics?” → “What are Roadrims’ unit economics?”). That rewritten query is what we embed and search with.
- We send the rewritten query to the same **embedding API** (with type “query”) and get a **1536-d query vector**.
- We call a **Postgres function** `match_document_chunks(query_embedding, match_count, filter_event_id)`. It:
  - Joins `document_embeddings` with `documents` so we only see chunks for the current event/fund.
  - Orders by **cosine similarity** between the query vector and each row’s `embedding` (pgvector’s `<=>` operator).
  - Returns the top N rows with `document_id`, `similarity`, `chunk_text`, `parent_text`, and indices.
- So the DB doesn’t “call out” to the AI for search; it only does **vector math** inside Postgres. All embedding and LLM calls go through our **converter API**; the frontend just sends text and gets vectors, then passes the query vector into the DB.

**Hybrid search (optional keyword leg)**

- We can also run **keyword search** on the `documents` table (full-text search on `raw_content`) via `match_documents_keyword`. Results are merged with the vector results (e.g. RRF or similar) so we get both “meaning similar” and “exact words” matches. So: **vector search on chunks in `document_embeddings`, keyword search on full document text in `documents`; merge and rank.**

**After retrieval**

- The top chunks (and optionally keyword snippets) are passed as **sources** to the LLM (Claude), together with company cards and conversation history. The model answers only from those sources so answers are grounded in your data. We can also run a **GraphRAG-style** step where the AI scores each retrieved chunk for relevance and optionally expands to neighboring chunks before we send the final set to the answer model.

So in one line: **the frontend gets a query vector from the converter, calls `match_document_chunks` in Postgres with that vector and event id, gets back the closest chunks; optionally runs keyword search and GraphRAG; then sends those chunks to the LLM as context.**

---

## One-paragraph version (for a quick pitch)

We chunk each document into small overlapping segments (parent 2k chars, child 400 chars, with overlap so we don’t cut mid-sentence), optionally add a one-line “contextual” header per chunk via our API, then embed each chunk with VoyageAI into a 1536-d vector and store it in Postgres in `document_embeddings` using pgvector. When the user asks a question, we rewrite it if needed, embed the question the same way, and call a Postgres function that does cosine-similarity search over those vectors scoped to the fund’s event, returning the best-matching chunks. We can also run keyword search on the full document text and merge the two. Those chunks (and company cards) are then sent to Claude as the only context, so every answer is grounded in your docs and your DB—no hallucination from the rest of the web unless we explicitly turn on web search.
