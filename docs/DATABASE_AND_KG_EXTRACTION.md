# Database Structure (Supabase) & KG Entity/Edge Extraction

Two parts: (1) how the Supabase database is structured and what connects to what, (2) how kg entities and edges are extracted and stored.

---

## Why events?

**Organization** = your fund (one tenant). **Event** = a **workspace** under that fund. Almost all data (documents, decisions, sources, company cards, KG, chat, sync config) is scoped by **event_id**, not only by org.

- **Without events:** One org would have a single pile of documents and companies. You couldn’t separate “Fund I” from “Fund II” or “Deal flow 2025” from “Portfolio review” without ad‑hoc tags or folders.
- **With events:** One fund can have multiple events (e.g. “Fund I”, “Fund II”, “Syndicate A”). Each event has its own documents, embeddings, kg_entities, kg_edges, company cards, and chat. You switch the “active” event in the app; everything you see (Sources, Connections, Chat, Drive sync) belongs to that event.

So events exist to give **multiple workspaces per fund** and keep data separated by vintage, deal pool, or initiative. If you only ever need one workspace per org, you still have at least one event (e.g. “Main Event” created by default); the model doesn’t go away, it just has one row per org.

---

## Part 1: Database structure — what connects to who

### Hierarchy (top to bottom)

```
auth.users (Supabase Auth)
    │
    └── user_profiles (id = auth.users.id)
            │
            └── organization_id ──► organizations (id)

organizations (id)
    │
    └── events (organization_id)
            │
            ├── documents (event_id)
            ├── decisions (event_id)
            ├── sources (event_id)
            ├── source_folders (event_id)
            ├── sync_configurations (event_id + organization_id)
            ├── company_connections (event_id)
            ├── kg_entities (event_id)
            ├── kg_edges (event_id)
            ├── company_kpis (event_id)
            ├── chat_threads (event_id)
            ├── chat_messages (event_id)
            ├── investors (event_id)      -- matchmaking
            ├── startups (event_id)       -- matchmaking
            ├── time_slots (event_id)
            ├── matches (event_id)
            ├── mentors (event_id)
            └── corporates (event_id)
```

### Table-by-table connections

| Table | Key columns | Connects to |
|-------|-------------|-------------|
| **organizations** | id, name, slug | Root for multi-tenant; no FK to others. |
| **user_profiles** | id (PK, FK → auth.users), organization_id | User belongs to one org. |
| **events** | id, organization_id | Event belongs to one org. All fund/CIS data is scoped by event_id. |
| **documents** | id, event_id, created_by, folder_id, company_entity_id | Event; optional folder (source_folders); optional link to one company (kg_entities). |
| **decisions** | id, event_id, actor_id, document_id | Event; optional user (actor), optional document. |
| **sources** | id, event_id, created_by | Event; user who created. |
| **source_folders** | id, event_id, created_by | Event; used to group documents (e.g. “Portfolio”, “Deal X”). |
| **document_folder_links** | document_id, folder_id, created_by | Links documents to folders (many-to-many). |
| **document_embeddings** | id, document_id, chunk_text, embedding | One row per chunk; document_id → documents. |
| **kg_entities** | id, event_id, name, normalized_name, entity_type, properties, source_document_id, created_by | Event; optional source document; optional creator. |
| **kg_edges** | id, event_id, source_entity_id, target_entity_id, relation_type, source_document_id, created_by, review_status, reviewed_by | Event; source/target → kg_entities; optional document. |
| **company_connections** | id, event_id, source_company_name, target_company_name, source_document_id, target_document_id, created_by | Event; optional links to documents. (Names are text; not FK to kg_entities.) |
| **company_kpis** | id, event_id, company_name, metric_name, value, entity_id, source_document_id, created_by | Event; optional entity_id → kg_entities; optional document. |
| **sync_configurations** | id, organization_id, event_id, source_type, config, created_by | Org + event; one config per (org, event, source_type) e.g. Google Drive. |
| **chat_threads** | id, event_id, parent_id, title, created_by | Event; optional parent thread. |
| **chat_messages** | id, event_id, thread_id, role, content, source_doc_ids, created_by | Event; thread → chat_threads; optional doc IDs. |

### Important relationships in one diagram

```
organizations
    └── events
            ├── documents ◄──── document_embeddings (document_id)
            │       ├── folder_id ──► source_folders
            │       └── company_entity_id ──► kg_entities
            │
            ├── document_folder_links ──► documents, source_folders
            │
            ├── kg_entities ◄──── kg_edges (source_entity_id, target_entity_id)
            │       └── source_document_id ──► documents
            │
            ├── kg_edges ──► kg_entities, documents (source_document_id)
            │
            ├── company_connections (event_id; company names as text)
            ├── company_kpis ──► kg_entities (optional entity_id), documents (optional)
            │
            ├── chat_threads ◄──── chat_messages (thread_id)
            │
            └── sync_configurations (also organization_id)
```

**RLS:** Every table above (except `organizations` and `auth.users`) gates access by “user’s org = event’s org” (via `event_id` → `events.organization_id`). So “who connects to who” for security is: **user → user_profiles.organization_id → events.organization_id → event_id on the row.**

---

## Part 2: Extraction of kg entities and edges

### Where it happens

- **API (external):** The **converter API** (`VITE_CONVERTER_API_URL`, e.g. Render) exposes:
  - `POST /extract-entities` (text-only)
  - `POST /extract-entities/stream` (streaming, used when PDF base64 is sent)
- **Frontend:** `src/utils/aiConverter.ts` → `extractEntities(...)` calls that API.
- **Orchestration:** `src/pages/CIS.tsx` → `extractAndStoreEntities(...)` calls `extractEntities`, then writes to Supabase (`kg_entities`, `kg_edges`, `company_kpis`).

So: **extraction is done in the converter API (LLM); storage is done in the frontend (CIS.tsx) after the API returns.**

### When it runs

`extractAndStoreEntities` is invoked in one place only:

- **After embedding indexing:** Inside `indexDocumentEmbeddings` (CIS.tsx), after all chunks for a document are embedded and stored, we call:
  - `void extractAndStoreEntities(documentId, rawContent, docTitle, eventId, pdfBase64ForExtraction);`
- So **whenever a document gets its embeddings indexed**, we also run entity/relationship/KPI extraction for that document.

That happens when:

1. **Drive sync:** For each new or changed file we call `indexDocumentEmbeddings(docRow.id, ...)`, which at the end calls `extractAndStoreEntities`.
2. **Local upload (Sources tab):** After a document is saved we call `indexDocumentEmbeddings(...)`, which again calls `extractAndStoreEntities`.
3. **AI conversion / paste flow:** When a document is created from conversion/paste we call `indexDocumentEmbeddings(...)` in the background, which triggers `extractAndStoreEntities`.

So: **every document that goes through the embedding pipeline also goes through entity/edge extraction** (same event, same user context).

### Flow (step by step)

1. **Input to API**
   - `extractEntities({ document_title, document_text, document_type, pdf_base64? })` in `aiConverter.ts`.
   - Text is capped (e.g. first 12,000 chars) when passed from `extractAndStoreEntities`.

2. **Converter API**
   - If `pdf_base64` is set: call `/extract-entities/stream` (long timeout).
   - Else: call `/extract-entities` (text-only).
   - Returns: `{ entities: [...], relationships: [...], kpis: [...] }`.
   - Each entity: `{ name, type, properties?, confidence? }` (type = company | person | fund | etc.).
   - Each relationship: `{ source_name, target_name, relation_type, properties?, confidence? }`.
   - Each KPI: `{ company_name, metric_name, value, period?, ... }`.

3. **Step 1 — Insert entities (CIS.tsx, extractAndStoreEntities)**
   - For each entity we compute a **normalized key**: for company/fund we use `normalizeCompanyNameForMatch(name)`; for others, `name.toLowerCase().trim()`.
   - Look up existing: `kg_entities` where `event_id`, `normalized_name`, `entity_type` match.
   - If found: reuse that entity’s `id`. If not: insert into `kg_entities` (event_id, entity_type, name, normalized_name, properties, confidence, source_document_id, created_by) and take the new `id`.
   - We keep a map: **normalized_key → entity_id** for the next step.

4. **Step 2 — Insert relationships (edges)**
   - For each relationship we resolve **source** and **target** to entity IDs using the map (we try both raw lowercase and canonical company name so “Trashcoin Limited” matches “Trashcoin”).
   - If either side is missing we skip that relationship (and log).
   - We map API relation types to DB-allowed types (e.g. `founder` → `founded`, `invested` → `invested_in`) and default unknown to `partner_of`.
   - We avoid duplicates: if an edge (source_entity_id, target_entity_id, relation_type) already exists we skip.
   - Insert into `kg_edges`: event_id, source_entity_id, target_entity_id, relation_type, properties, confidence, source_document_id, created_by, **review_status** (if confidence ≥ 0.85 we set `approved` and set reviewed_by/reviewed_at; else `pending`).

5. **Step 3 — Insert KPIs**
   - For each KPI we insert into `company_kpis` (event_id, company_name, metric_name, value, period, etc.) if no row exists for same event, company_name, metric_name, period.

### Where in the codebase

| What | Where |
|------|--------|
| Call converter API (extract entities/relationships/KPIs) | `src/utils/aiConverter.ts` → `extractEntities()` |
| Decide when to run extraction | `src/pages/CIS.tsx` → `indexDocumentEmbeddings()` → at the end calls `extractAndStoreEntities()` |
| Build request, call API, parse stream | `aiConverter.ts` → `extractEntities()`, `parseSSEExtractionStream()` |
| Insert into kg_entities | `CIS.tsx` → `extractAndStoreEntities()` → Step 1 (loop over extraction.entities, supabase.from("kg_entities").insert or reuse existing) |
| Insert into kg_edges | `CIS.tsx` → `extractAndStoreEntities()` → Step 2 (loop over extraction.relationships, supabase.from("kg_edges").insert) |
| Insert into company_kpis | `CIS.tsx` → `extractAndStoreEntities()` → Step 3 |
| Normalize company name for dedup | `src/utils/supabaseHelpers.ts` → `normalizeCompanyNameForMatch()` (used when building entity key and when resolving relationship source/target) |

### Summary

- **Database:** Everything fund-related is under **organizations → events**. Documents, decisions, sources, folders, embeddings, **kg_entities**, **kg_edges**, company_connections, company_kpis, chat, and sync config all tie to an **event_id** (and often to **documents** or **kg_entities**).
- **Extraction:** Done **in the converter API**; **stored from the frontend** in `extractAndStoreEntities` (CIS.tsx), which runs **after every document embedding run**. Entities are deduped by (event_id, normalized_name, entity_type); edges are created from relationships with optional review_status; KPIs are written to company_kpis.
