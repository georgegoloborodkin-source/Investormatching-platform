# Chunking Strategy

> How we split documents into embeddable segments for semantic search.

---

## Terminology

| Term | Meaning |
|------|---------|
| **Fixed-size chunking** | Split text at fixed character/token windows with overlap. No awareness of content structure. |
| **Semantic chunking** | Split at natural boundaries (sentences, paragraphs, sections) so each chunk is a coherent unit of meaning. Size limits still apply, but boundaries prefer structure over raw character counts. |
| **Agentic chunking** | An LLM decides *where* to split, reading the document and outputting labeled topic sections (e.g. "Unit economics", "Team", "Market size"). Highest quality boundaries -- the LLM understands meaning, not just structure. |
| **Contextual enrichment** | After chunking, an LLM generates a short header per chunk describing its content within the document. This improves embedding quality but does **not** change where splits occur. |

---

## Current approach: Agentic chunking with semantic fallback

We use a **two-tier strategy**: try agentic (LLM-driven) chunking first, fall back to semantic (paragraph/sentence-based) chunking if the LLM is unavailable or fails.

### How it works

```
Document text (up to 12k chars)
  |
  +-- POST /agentic-chunk (Claude Haiku)
  |     |
  |     +-- SUCCESS: LLM returns labeled topic sections
  |     |     e.g. [{label: "Company Overview", text: "..."}, ...]
  |     |     Each section becomes a parent chunk
  |     |
  |     +-- FAILURE/TIMEOUT: Fall back to semantic splitting
  |           Split on paragraph boundaries, merge to ~2k parents
  |
  +-- For each parent (agentic section or semantic paragraph group):
  |     +-- splitIntoSentences()
  |     +-- mergeIntoSentenceChunks() -> child[] (up to ~500 chars, max 4 per parent)
  |     +-- Fallback: chunkTextWithOverlap() if no sentence boundaries
  |
  +-- For each child chunk:
  |     +-- contextualizeChunk() -> enriched text (optional, 6s timeout)
  |     +-- embedQuery() -> 1536-d vector (VoyageAI)
  |     +-- INSERT into document_embeddings
  |
  +-- extractAndStoreEntities() -> knowledge graph (after embedding)
```

### Tier 1: Agentic chunking (primary)

1. Send the document title + text to `POST /agentic-chunk` on the backend.
2. Claude Haiku reads the full document and returns a JSON array of labeled sections.
3. The LLM is prompted to:
   - Keep every word of the original text (no summarizing or dropping).
   - Maintain the original order.
   - Split at natural topic boundaries (headings, topic shifts, paragraph breaks).
   - Produce sections between 200-3000 characters each.
   - Give each section a short descriptive label (3-8 words).
4. Each returned section becomes a **parent chunk**.
5. If the LLM call fails, times out (15s), or returns empty/invalid JSON, we fall through to Tier 2.

**Cost**: One Haiku call per document at index time (~2-4 cents for a typical pitch deck).

### Tier 2: Semantic chunking (fallback)

1. Split on **paragraph boundaries** (`\n\n`), merge consecutive paragraphs up to ~2,000 chars.
2. If no paragraph structure, split on **sentence boundaries** instead.
3. If a single paragraph/sentence exceeds the limit, fall back to fixed-size character windows.
4. Max **8 parent chunks** per document.

This tier requires **no LLM calls** -- it's pure heuristic splitting.

### Child splitting (same for both tiers)

1. Each parent is split on **sentence boundaries**.
2. Consecutive sentences are merged into child chunks up to **~500 characters**.
3. If a parent has no sentence structure, fall back to character-window splitting (100 overlap).
4. Max **4 child chunks per parent**.

### Contextual enrichment (applied on top)

After agentic or semantic splitting, each child chunk optionally gets a Claude-generated contextual header (via `/contextualize-chunk`). This is the same as before -- it enriches *what gets embedded* without changing split points.

---

## Constants

| Parameter | Value | Notes |
|-----------|-------|-------|
| `MAX_EMBED_CHARS` | 12,000 | Document text cap |
| `CHILD_SIZE` | 500 | Target max chars per child |
| `FALLBACK_OVERLAP` | 100 | Overlap when falling back to character windows |
| `MAX_PARENT_CHUNKS` (semantic) | 8 | Per document in semantic fallback |
| `MAX_CHILD_PER_PARENT` | 4 | Per parent |
| `max_sections` (agentic) | 8 | Max sections the LLM can return |
| Agentic timeout | 15s | Frontend timeout for `/agentic-chunk` call |
| Contextual enrichment timeout | 6s | Per-chunk timeout for `/contextualize-chunk` |

---

## Why agentic chunking?

| Aspect | Fixed-size | Semantic | Agentic |
|--------|-----------|----------|---------|
| **Boundary quality** | Arbitrary | Paragraph/sentence | Topic/section |
| **LLM cost at index** | None | None | ~2-4c per doc (Haiku) |
| **Handles headings/topics** | No | No | Yes |
| **Labels for debugging** | No | No | Yes (each section is labeled) |
| **Fallback resilience** | N/A | N/A | Falls back to semantic if LLM fails |

Agentic chunking produces the highest-quality chunk boundaries because the LLM *understands* the document's structure and meaning. A pitch deck section about "Team & Advisors" will become one chunk, not an arbitrary 400-character window that cuts the CEO's bio in half.

The small Haiku cost per document (~2-4 cents) is justified because:
- Better chunk boundaries -> better embedding quality -> better retrieval accuracy.
- Each document is only chunked once (at upload time), so the cost is amortized over all future queries.
- The semantic fallback ensures zero downtime if the LLM is unavailable.

---

## Architecture

**Backend** (`ollama-converter/main.py`):
- `POST /agentic-chunk` -- Takes document title + text, returns labeled sections via Claude Haiku.
- `POST /contextualize-chunk` -- Enriches individual chunks with contextual headers (unchanged).
- `_paragraph_fallback()` -- Server-side fallback if Claude is unavailable (paragraph merging).

**Frontend** (`src/utils/aiConverter.ts`):
- `agenticChunk()` -- Calls `/agentic-chunk` with 15s timeout, returns sections or fallback flag.
- `contextualizeChunk()` -- Calls `/contextualize-chunk` per child chunk (unchanged).

**CIS.tsx** (`src/pages/CIS.tsx`):
- `buildParentChildChunks(text, title)` -- Async. Tries agentic, falls back to semantic.
- `buildSemanticParentChildChunks(text)` -- Synchronous semantic fallback (paragraph/sentence splitting).
- `indexDocumentEmbeddings()` -- Orchestrates the full pipeline: chunk -> enrich -> embed -> store.

---

## Multi-Query RAG (retrieval-time complement)

While chunking happens at **index time**, multi-query RAG improves retrieval at **query time**. For each user question:

1. An LLM (Haiku) generates **2-3 diverse reformulations** via `POST /multi-query` (e.g. "What is their burn rate?" -> also "monthly cash expenditure and runway", "operating expenses vs revenue").
2. All variants are **embedded in parallel** (VoyageAI).
3. `match_document_chunks` runs for **each embedding in parallel** against Postgres.
4. Results are **merged and deduplicated** -- keeping the best similarity score per document.
5. The merged set feeds into the existing pipeline: optional GraphRAG, RRF merge with keyword search, reranking, and answer generation.

This means agentic chunking + multi-query RAG work together: better chunk boundaries (from agentic chunking) AND broader recall (from multi-query) combine to surface the most relevant information.

---

## Related docs

- [PITCH_CHUNKING_AND_DB.md](./PITCH_CHUNKING_AND_DB.md) -- High-level pitch-ready explanation.
- [DATABASE_AND_KG_EXTRACTION.md](./DATABASE_AND_KG_EXTRACTION.md) -- Schema details for `document_embeddings`.
- [ML_STACK_AND_LP_COFOUNDER_QUESTIONS.md](./ML_STACK_AND_LP_COFOUNDER_QUESTIONS.md) -- Embedding model choices and cost breakdown.
