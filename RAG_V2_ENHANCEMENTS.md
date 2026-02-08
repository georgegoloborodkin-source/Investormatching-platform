# RAG V2 Enhancement Plan

## 1. Automatic Data Ingestion with Human Review

### Current State
- ✅ Entity extraction runs automatically on document upload
- ✅ Extracted entities/relationships/KPIs are stored directly in `kg_entities`, `kg_edges`, `company_kpis`
- ✅ Connections graph is manually editable (status changes)
- ❌ No review/approval workflow for auto-extracted data

### Enhancement: Add Review Workflow

**Database Changes:**
```sql
-- Add review status to entities
ALTER TABLE kg_entities ADD COLUMN review_status TEXT DEFAULT 'pending' 
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'edited'));
ALTER TABLE kg_entities ADD COLUMN reviewed_by UUID REFERENCES user_profiles(id);
ALTER TABLE kg_entities ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Add review status to edges
ALTER TABLE kg_edges ADD COLUMN review_status TEXT DEFAULT 'pending';
ALTER TABLE kg_edges ADD COLUMN reviewed_by UUID REFERENCES user_profiles(id);
ALTER TABLE kg_edges ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Add review status to KPIs
ALTER TABLE company_kpis ADD COLUMN review_status TEXT DEFAULT 'pending';
ALTER TABLE company_kpis ADD COLUMN reviewed_by UUID REFERENCES user_profiles(id);
ALTER TABLE company_kpis ADD COLUMN reviewed_at TIMESTAMPTZ;
```

**Frontend UI:**
1. **"Review Extractions" Tab** in CIS:
   - Shows pending extractions grouped by document
   - Confidence scores displayed (low confidence = requires review)
   - Bulk approve/reject actions
   - Edit entity properties before approval
   - Auto-approve high-confidence extractions (confidence > 0.9)

2. **Auto-populate Connections Graph:**
   - When relationships are approved, auto-create connections in `company_connections` table
   - Analyst can edit connection type/status after auto-creation
   - Show "AI-suggested" badge on auto-created connections

**Backend Logic:**
- Only show `review_status='approved'` entities in RAG retrieval
- Low-confidence extractions (confidence < 0.7) always require manual review
- High-confidence extractions (confidence > 0.9) can be auto-approved

---

## 2. Why Decision Logger?

**Purpose:**
The Decision Logger tracks **investment decisions, meeting notes, and action items** that provide crucial context for answering questions like:
- "What did we decide about Company X?"
- "What were the key takeaways from the meeting with Y?"
- "What follow-ups are pending?"

**How It's Used in RAG:**
- Decision logs are included in the prompt when answering questions
- Claude can reference past decisions to provide accurate, context-aware answers
- Prevents contradictions (e.g., "We decided to pass" vs "We're interested")

**Enhancement:**
- Auto-extract decisions from meeting notes/emails
- Link decisions to companies in knowledge graph
- Show decision timeline in company profile

---

## 3. Web Data Checking (Reduce Hallucinations)

### Current State
- ❌ System does NOT check web data
- ✅ Only uses uploaded documents + connections graph
- ✅ This reduces hallucinations but limits knowledge

### Enhancement: Add Web Search Tool (Low Priority)

**Implementation:**
1. Add `web_search` tool to `TOOLS_FOR_ANSWERS`:
```python
{
    "name": "web_search",
    "description": "Search the web for current information. Use ONLY when: (1) user explicitly asks for current/latest info, (2) uploaded sources don't contain the answer, (3) question is about public companies/funding/news. NEVER use for internal portfolio decisions.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "max_results": {"type": "integer", "description": "Max results (default 3)"}
        },
        "required": ["query"]
    }
}
```

2. **Priority Rules:**
   - **Priority 1:** Uploaded documents (highest confidence)
   - **Priority 2:** Knowledge graph (medium confidence)
   - **Priority 3:** Web search (lowest confidence, only if needed)

3. **Citation Requirements:**
   - Web results MUST be cited as `[Web: source_url]`
   - Always mention "This information is from public sources and may not reflect internal decisions"

4. **Hallucination Prevention:**
   - Never use web data for internal portfolio decisions
   - Always prefer uploaded sources over web
   - Show confidence scores in answers

---

## 4. Render Logs Analysis

### ✅ What's Working:
- Server running correctly
- Embeddings working (Voyage API)
- Query rewriting working
- Semantic search working
- Reranking working
- Streaming answers working
- CORS configured correctly

### ⚠️ Issues Found:

1. **Embedding Dimension Mismatch:**
   - Logs show: `Voyage Model: voyage-3-lite` (512 dims)
   - Config shows: `Embedding Dimensions: 1536` (WRONG!)
   - Actual: `[VOYAGE] Generated embedding with 512 dimensions` (CORRECT)
   - **Fix:** Update `EMBEDDING_DIM` env var to match model (512 for voyage-3-lite, 1024 for voyage-3)

2. **Missing Dependencies (Non-Critical):**
   - `orjson` not installed (using JSONResponse fallback - OK)
   - `uvloop` not installed (using asyncio fallback - OK)
   - `httptools` not installed (using h11 fallback - OK)
   - `anthropic` SDK not installed (using httpx fallback - OK)

3. **Recommendation:**
   - Add to `requirements.txt`:
     ```
     orjson>=3.9.0
     uvloop>=0.19.0
     httptools>=0.6.0
     anthropic>=0.34.0
     ```
   - Update `EMBEDDING_DIM` env var in Render to `512` (for voyage-3-lite) or switch to `voyage-3` (1024 dims)

---

## Implementation Priority

1. **High Priority:**
   - Fix embedding dimension config
   - Add review workflow for auto-extractions
   - Auto-populate connections graph from approved relationships

2. **Medium Priority:**
   - Add web search tool (with strict priority rules)
   - Enhance decision logger with auto-extraction

3. **Low Priority:**
   - Install performance dependencies (orjson, uvloop, httptools)
   - Add confidence-based auto-approval
