# Architecture & Key Concepts — CTO Overview

This doc explains **what we built, how it fits together, and why** so you can describe it simply or in depth (investors, engineers, partners).

---

## 1. What the product is (one sentence)

**A fund intelligence platform:** the fund’s documents, decisions, and companies live in one place; AI chat and analytics run on top of that so the team can ask questions, track decisions, and see portfolio/connection graphs.

---

## 2. High-level stack (and why)

| Layer | What we use | Why |
|--------|-------------|-----|
| **Frontend** | React (Vite), TypeScript, Tailwind, shadcn/ui | Single-page app, fast dev loop, consistent UI. Main “product” lives in `CIS.tsx` (tabs: Chat, Dashboard, Sources, Decisions, Companies, Connections, Engine). |
| **Backend / DB** | Supabase (Postgres + Auth + RLS + Storage) | One platform for DB, auth, row-level security, and file storage. No separate backend service to run. |
| **AI / embeddings** | External converter API (`VITE_CONVERTER_API_URL`, e.g. Render) | All LLM and embedding calls go to this service (extract entities, company properties, embed chunks, chat, rerank). Keeps API keys and heavy compute off the frontend and out of Supabase. |
| **Ingestion** | Google Drive (and ClickUp) via OAuth + sync config | Documents come from Drive folders (and optionally ClickUp). Sync is configurable (e.g. daily); only new/changed files trigger AI. |

**Simple version:** “React frontend, Supabase for data and auth, and an external AI API for embeddings and LLM. Documents can be uploaded or synced from Google Drive.”

---

## 3. Multi-tenant model: Organization → Event

- **Organization** = the fund (one per fund). Users belong to an org via `user_profiles.organization_id`.
- **Event** = a “workspace” or “deal memory” under that org. Most data is scoped by `event_id`: documents, decisions, sources, company cards, connections, chat threads.
- **Why:** One fund can have multiple events (e.g. different vintages or deal pools). Access is “see everything in my org’s events I’m allowed to see,” enforced by RLS.

**Simple version:** “Everything is scoped by fund (organization) and then by event (workspace). So we can support one fund, many workspaces, and clear access control.”

---

## 4. Core data concepts (CIS = “fund memory”)

### Documents

- **What:** Uploaded or synced files (PDF, doc, etc.). Stored in Supabase Storage; metadata and optional extracted JSON in `documents` (e.g. `event_id`, `title`, `source_type`, `raw_content` or link to storage).
- **Why:** Single place for memos, decks, term sheets. Drives RAG (chunks from these docs are embedded and searched).

### Decisions

- **What:** Logged investment decisions: who (actor), what (action type: e.g. Pass, Invest), which company (`startup_name`), outcome, notes, optional link to a document.
- **Why:** Audit trail and input for the Decision Engine (analytics by partner, sector, stage, conversion, velocity).

### Sources

- **What:** External “sources” (e.g. a Google Drive source, ClickUp list). High-level link to where documents come from; folders live in `source_folders`; which docs belong to which folder in `document_folder_links`.
- **Why:** So we know “this doc came from this Drive folder” and can scope sync and UI (e.g. “only my folder”).

### Company cards (knowledge-graph entities)

- **What:** One card per company (or fund) = one row in `kg_entities` with `entity_type = 'company'` (or `'fund'`). Fields like name, website, LinkedIn, email, bio, stage, etc. live in `properties` (JSONB). The UI shows “company cards” built from these entities (plus doc count, connections).
- **Why:** Structured company profile that can be filled by AI extraction or by hand; same entity is used for connections and for chat (we inject all company cards into chat context so the model can answer “company X’s social / contact”).

### Connections

- **What:** Explicit company-to-company (or fund–company) relationships: e.g. “Company A → Company B, type Partnership.” Stored in `company_connections` (and optionally reflected in `kg_edges`). Types: BD, INV, Knowledge, Partnership, Portfolio; status: To Connect, Connected, Rejected, etc.
- **Why:** So the fund can see and manage relationship graph (who to connect, who’s already connected). Auto-extraction of relationships from text is currently disabled (was too noisy).

**Simple version:** “We have documents, decision logs, sources (e.g. Drive), company cards (one per company/fund), and explicit connections between companies. Chat and analytics run on this.”

---

## 5. Knowledge graph (kg_entities + kg_edges)

- **kg_entities:** Nodes: companies, people, funds, rounds, sectors, etc. Each has `name`, `normalized_name` (for dedup, e.g. “Trashcoin” vs “Trashcoin Limited”), `entity_type`, and `properties` (JSONB).
- **kg_edges:** Directed edges between entities: e.g. `founded`, `works_at`, `invested_in`, `partner_of`, `portfolio_company`. Each edge can have `source_document_id` and confidence.
- **Why:** Enables “graph-aware” retrieval and future reasoning (e.g. “companies in this sector that this fund invested in”). Company cards in the UI are the company (and fund) entities; connections can be backed by or mirrored to edges. We normalize company names (e.g. strip “Limited”, “Ltd”) so the same company doesn’t get duplicate cards.

**Simple version:** “We have a small knowledge graph: entities (companies, people, funds) and relationships. Company cards are the company entities; we use the graph for dedup and for future graph-based features.”

---

## 6. RAG (retrieval-augmented chat)

- **Embeddings:** Document text is chunked (parent/child), optionally enriched with a “contextual” header from the converter API, then each chunk is embedded (via converter API) and stored in `document_embeddings` (vector column in Postgres).
- **Retrieval:** User question is embedded; we search with `match_document_chunks` (vector similarity) and optionally keyword (`match_documents_keyword`). We merge and rank (e.g. RRF), then pass top chunks + **all company cards** as “sources” to the LLM.
- **Why:** Chat answers from your documents and from structured card data (e.g. “Bianca’s LinkedIn”) instead of hallucinating. Company cards are always in context so any question about a company can use card info.

**Simple version:** “We embed document chunks and the user’s question, search for the closest chunks, and send those plus every company card to the LLM so answers are grounded in your data.”

---

## 7. Sync (Google Drive)

- **What:** User connects a Drive folder; we store that in `sync_configurations` (per org/event, with `sync_frequency`: e.g. daily, hourly, on_login). On sync we list files, compare `modifiedTime`, and for new/changed files we download, create a `documents` row, run embeddings + entity/property extraction, and link the doc to a company entity (by folder name or file title, normalized).
- **Why:** So the fund’s “source of truth” (e.g. a shared Drive folder) stays in sync with the platform without manual uploads. Cost control: only new/changed files trigger AI (embeddings + extraction).

**Simple version:** “We sync from a chosen Google Drive folder. Only new or changed files are processed and sent to the AI; the rest is skipped to save cost.”

---

## 8. Security and access

- **Auth:** Supabase Auth (email/password or OAuth). User identity is in `auth.users`; we extend with `user_profiles` (role, `organization_id`, etc.).
- **Roles:** e.g. `organizer`, `investor`, `managing_partner`, `admin`. Used for “who can do what” (e.g. manage sync, manage entities, see Decision Engine).
- **RLS (row-level security):** Every table that holds fund data is protected by policies that check: “user’s `organization_id` matches the org that owns this row (via `event_id` → `events.organization_id`).” So a user never sees another fund’s data.
- **Why:** Multi-tenant safety at the DB layer; no app-level “if org then filter” that could be bypassed.

**Simple version:** “Access is by Supabase Auth and roles; the database only returns rows for the user’s organization, enforced by Postgres RLS.”

---

## 9. Key flows (one line each)

- **Chat:** Embed question → vector + keyword search over `document_embeddings` / documents → add company cards → send to converter API → stream answer.
- **Company card:** Entity in `kg_entities`; properties (and optional conflicts) merged from AI extraction with “higher confidence wins”; normalized name for dedup (e.g. “Trashcoin” vs “Trashcoin Limited” → one card).
- **Decision Engine:** Reads `decisions`; filters by sector/stage/partner; computes rates, velocity, conversion; shows charts (and is MD-only or restricted by role if you enforce that).
- **Drive sync:** List Drive files → for each new/changed file: download → insert document → run embeddings + extraction → find or create company entity (by normalized name) → merge properties.
- **Connections:** Stored in `company_connections`; UI shows graph and list; auto-extraction of relationships from text is off for now to avoid wrong links.

---

## 10. Where the “smarts” live

- **Frontend (CIS.tsx):** Orchestration: which tab, when to call which API, how to build chat context (docs + company cards), how to display cards/connections/decisions. No business logic in the DB beyond RLS and a few RPCs (e.g. `get_company_card`, `update_company_card_properties`, `match_document_chunks`).
- **Converter API (external):** All LLM and embedding calls: extract entities, extract company properties, contextualize chunk, embed, chat, rerank, rewrite query. We don’t store API keys in the frontend; the converter runs on your infra (e.g. Render).
- **Supabase:** Storage of structured data, auth, RLS, and vector search. Migrations define the schema and policies; we avoid putting complex logic in DB functions except where it’s clearly better (e.g. matching chunks by embedding).

---

## 11. How to say it in a few sentences (e.g. to an investor)

“We built a fund intelligence platform. The fund’s documents and decision logs live in a single place, scoped by organization and event. We use a knowledge graph for companies and relationships, and we embed document chunks so the team can ask questions in natural language and get answers grounded in their own data. We sync from Google Drive so the pipeline stays up to date without manual uploads. Access and multi-tenancy are enforced at the database with row-level security. The heavy AI work (embeddings, extraction, chat) is done by an external API we control, so we can scale and secure it separately.”

---

*Last updated to reflect: company cards always in chat context, pending relationship reviews disabled, company name normalization for dedup, and auto-overwrite by confidence for card properties.*
