# Upload flow: deck → chunking → embedding → extraction → card

## 1. You did not push — I only edited files

**I cannot push to your repo.** You need to commit and push yourself:

```bash
git add -A
git commit -m "Fix: entity name cleaning, kg_edges relation_type mapping, 406 on kg_entities, contextual timeout"
git push
```

---

## 2. How the flow works (step-by-step)

### Step 1: You send the deck

- You upload a file (e.g. PDF) in CIS → **Documents** (or drag-and-drop).
- Frontend: file is read; for PDFs, client-side PDF.js extracts text (and optionally base64 for server-side extraction).
- A row is created in **Supabase**: `documents` (title, `event_id`, `storage_path`, `raw_content`, etc.) and the file is stored in **Supabase Storage**.

### Step 2: Chunking

- **Where:** Frontend (`CIS.tsx`), inside `indexDocumentEmbeddings`.
- **What:** `buildParentChildChunks(rawContent)` splits the document into **parent** chunks (~2000 chars, 200 overlap) and **child** chunks (~400 chars, 80 overlap). Each stored piece is a (parent, child) pair so retrieval can return a bit of surrounding context.
- **Why:** Small chunks = precise semantic search; parent text = context when showing snippets.

### Step 3: Embedding (in parallel with extraction)

- For each (parent, child) pair:
  1. **Optional contextual enrichment:** Frontend calls backend `POST /contextualize-chunk` (title + summary + chunk) → backend returns a short “contextual header” + enriched text. If this times out (e.g. 6s), the raw chunk is used.
  2. **Embed:** Frontend calls backend `POST /embed/query` with the (enriched or raw) text → Voyage returns a 1536-dim vector.
  3. **Store:** Frontend inserts into **Supabase** `document_embeddings`: `document_id`, `chunk_text`, `parent_text`, `embedding`, etc.
- So: **chunking happens in the browser; embedding is done by the converter API; vectors are stored in Postgres (pgvector).**

### Step 4: Company entity and property extraction

- **Link or create entity:**  
  If the document isn’t already linked to a company entity (e.g. by a DB trigger), the frontend tries to **find or create** a company in `kg_entities`:
  - It **cleans the document title** (e.g. "Robonito Brochure 2025 with Case Study" → "Robonito"), then looks up or creates an entity with that name and links `documents.company_entity_id`.
- **Property extraction:**  
  Frontend calls backend **`POST /extract-company-properties/stream`** (with PDF base64 when available). Backend uses Claude to extract structured fields (bio, funding_stage, arr, problem, solution, **unit economics**, etc.) and returns JSON. Frontend then calls **`mergeCompanyCardFromExtraction`** to write only into **empty** fields on the company card (never overwriting user edits).
- **Entity/relationship extraction:**  
  Frontend calls **`POST /extract-entities/stream`** → backend returns entities, relationships, KPIs. Frontend inserts into `kg_entities`, `kg_edges`, `company_kpis`. Relation types from the AI are **normalized** to the DB’s allowed list (e.g. `uses` → `partner_of`) so inserts don’t violate the check constraint.

### Step 5: What you see on the card

- The **company card** (e.g. Robonito) is built from **`kg_entities.properties`** for that entity. So: whatever was **merged** from extraction + any manual edits.
- Sections shown: Investment Snapshot (funding_stage, amount_seeking, valuation, arr, mrr, burn_rate, runway, use_of_funds), Market & Product (problem, solution, tam/sam/som, competitive_edge), Business Model & GTM, **Unit Economics** (cac, ltv, ltv_cac_ratio, payback_period, gross_margin, net_margin, churn_rate), Team, etc.

---

## 3. Why you might not see all VC parameters (e.g. Unit Economics)

- **Backend** is asked to extract unit economics: `cac`, `ltv`, `ltv_cac_ratio`, `payback_period`, `gross_margin`, `net_margin`, `churn_rate` (see `main.py` extraction schema and streaming normalization). So if Claude **returns** them, they are normalized and sent to the frontend.
- **Frontend** merge only fills **empty** fields; it doesn’t drop unit-economics keys. The **card UI** has a “Unit Economics” section that shows when any of those fields have a value; if none do, it still shows the section but with empty placeholders.
- So if **Unit Economics stay empty** on the card, it’s usually because:
  1. **The document doesn’t mention them** — e.g. a short brochure often doesn’t include CAC, LTV, gross margin, etc. Claude is instructed not to invent; so it leaves those fields empty.
  2. **Different doc type** — Extraction is tuned for “pitch deck” / “investment memo” / “data room”. A one-pager or marketing brochure may not contain those metrics, so they won’t be extracted.
- **What you can do:**  
  - Use a **data room doc or investment memo** that actually contains unit economics, and re-run extraction (or re-upload) for that company.  
  - Or **manually fill** Unit Economics on the card; the merge will not overwrite your edits.  
  - If you want them to appear more often from brochures, we can add a short hint in the extraction prompt: “If the document does not mention unit economics, leave those fields empty; do not infer.”

---

## 4. Summary

| Step | Where | What |
|------|--------|------|
| 1. Send deck | Frontend → Supabase | Upload file → `documents` row + Storage |
| 2. Chunking | Frontend | `buildParentChildChunks(raw_content)` → parent/child pairs |
| 3. Embedding | Frontend → Converter → Supabase | Optional contextualize → embed → insert `document_embeddings` |
| 4. Entity + props | Frontend → Converter → Supabase | Create/link company entity → extract company properties (stream) → merge into `kg_entities.properties` |
| 5. Entities/edges/KPIs | Frontend → Converter → Supabase | Extract entities/relationships/KPIs (stream) → insert `kg_entities`, `kg_edges`, `company_kpis` (relation_type normalized) |
| 6. Card | Frontend | Reads `kg_entities.properties` → shows Investment Snapshot, Market & Product, Unit Economics, etc. |

Unit Economics appear when **either** the extracted JSON from the doc contains those fields **or** you type them in manually; they don’t appear when the source document simply doesn’t mention them.
