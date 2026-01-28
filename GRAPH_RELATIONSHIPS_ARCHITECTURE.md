# Graph Relationships & Unsupervised Learning Architecture

## Current State Analysis

### ✅ What EXISTS:
1. **Basic Entity Tables:**
   - `startups` (companies)
   - `investors` (VC firms + team members)
   - `sources` (syndicates, decks, notes)
   - `documents` (with embeddings)
   - `decisions` (investment decisions)

2. **Basic Relationships:**
   - `matches` table (startup ↔ investor/mentor/corporate)
   - Foreign keys between entities
   - Event-scoped relationships

### ❌ What's MISSING:
1. **Graph Structure:**
   - No unified graph table for all relationships
   - No relationship types (invested_in, co_invested_with, introduced_by, etc.)
   - No relationship weights/strength
   - No temporal tracking (when relationships formed)

2. **Entity Resolution:**
   - No deduplication (same company in different sources = different records)
   - No canonical company IDs
   - No fuzzy matching across sources

3. **Unsupervised Learning:**
   - No automatic entity matching
   - No relationship inference
   - No pattern detection

4. **Graph Storage:**
   - No graph database (Neo4j, ArangoDB)
   - No graph indexes for fast traversal
   - No graph algorithms (PageRank, community detection)

---

## Recommended Architecture

### Phase 1: Graph Foundation (Week 1-2)

#### 1.1 Entity Resolution Table
```sql
-- Canonical entities (deduplicated companies/investors)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'investor', 'syndicate', 'person')),
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- lowercase, no special chars
  aliases TEXT[], -- ["Giga Energy", "GigaEnergy", "Giga Energy Inc"]
  metadata JSONB DEFAULT '{}'::jsonb, -- {industry: "Energy", stage: "Series A"}
  confidence_score FLOAT DEFAULT 1.0, -- How confident we are this is correct
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_normalized ON entities USING GIN(normalized_name gin_trgm_ops);
CREATE INDEX idx_entities_aliases ON entities USING GIN(aliases);
```

#### 1.2 Entity Mappings (Link Sources → Canonical Entities)
```sql
-- Maps raw data to canonical entities
CREATE TABLE entity_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'startup', 'document', 'source', 'decision'
  source_id UUID NOT NULL, -- ID in the source table
  source_name TEXT NOT NULL, -- Original name from source
  confidence FLOAT DEFAULT 0.8, -- Match confidence
  matched_by TEXT DEFAULT 'manual', -- 'manual', 'fuzzy', 'embedding', 'llm'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_entity_mappings_entity ON entity_mappings(entity_id);
CREATE INDEX idx_entity_mappings_source ON entity_mappings(source_type, source_id);
```

#### 1.3 Graph Relationships Table
```sql
-- Unified graph for all relationships
CREATE TABLE graph_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'invested_in',           -- Investor → Company
    'co_invested_with',      -- Investor ↔ Investor (same deal)
    'introduced_by',         -- Company → Investor (via syndicate)
    'syndicate_member',      -- Investor → Syndicate
    'portfolio_company',     -- Fund → Company
    'competitor',            -- Company ↔ Company
    'partner',               -- Company ↔ Company
    'advisor',               -- Person → Company
    'mentor',                -- Person → Company
    'founder',               -- Person → Company
    'employee',              -- Person → Company
    'related_document'       -- Entity → Document
  )),
  strength FLOAT DEFAULT 1.0, -- Relationship strength (0-1)
  metadata JSONB DEFAULT '{}'::jsonb, -- {deal_size: 1000000, date: "2024-01-01"}
  source_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  inferred BOOLEAN DEFAULT FALSE, -- True if inferred by ML, False if explicit
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_entity_id, to_entity_id, relationship_type, source_event_id)
);

CREATE INDEX idx_graph_from ON graph_relationships(from_entity_id);
CREATE INDEX idx_graph_to ON graph_relationships(to_entity_id);
CREATE INDEX idx_graph_type ON graph_relationships(relationship_type);
CREATE INDEX idx_graph_inferred ON graph_relationships(inferred);
```

---

### Phase 2: Unsupervised Learning (Week 3-4)

#### 2.1 Entity Matching Algorithm

**Strategy: Multi-stage Matching**

1. **Exact Match** (confidence: 1.0)
   - Normalized name match
   - Exact alias match

2. **Fuzzy Match** (confidence: 0.7-0.9)
   - Levenshtein distance < 3
   - Jaro-Winkler similarity > 0.85
   - Trigram similarity (PostgreSQL pg_trgm)

3. **Embedding Match** (confidence: 0.6-0.8)
   - Cosine similarity > 0.85
   - Use VoyageAI embeddings for company names

4. **LLM Match** (confidence: 0.7-0.9)
   - Claude analyzes context: "Are 'Giga Energy' and 'GigaEnergy Inc' the same?"
   - Use when fuzzy/embedding uncertain

#### 2.2 Relationship Inference

**Automatic Detection:**

```python
# Pseudo-code for relationship inference

def infer_relationships(document_text, entities):
    """
    Extract relationships from document text using Claude.
    """
    prompt = f"""
    Extract relationships between entities from this document.
    
    Entities: {entities}
    Document: {document_text[:2000]}
    
    Return JSON:
    {{
      "relationships": [
        {{
          "from": "entity_name",
          "to": "entity_name", 
          "type": "invested_in|co_invested_with|...",
          "confidence": 0.9,
          "evidence": "quote from document"
        }}
      ]
    }}
    """
    # Call Claude API
    # Parse relationships
    # Insert into graph_relationships with inferred=true
```

**Pattern Detection:**
- If Company A and Investor B appear in same document → `related_document`
- If Investor B invested in Company A (from decision) → `invested_in`
- If Company A and Company B in same syndicate → `co_invested_with`
- If same investors in multiple companies → `co_invested_with` between investors

---

### Phase 3: Graph Storage Optimization (Week 5-6)

#### 3.1 PostgreSQL Graph Extensions

**Option A: Use pgvector for Graph Embeddings**
```sql
-- Store graph embeddings for fast similarity search
ALTER TABLE entities ADD COLUMN graph_embedding VECTOR(1536);
CREATE INDEX idx_entities_graph_embedding ON entities 
  USING ivfflat (graph_embedding vector_cosine_ops);
```

**Option B: Use PostgreSQL WITH RECURSIVE for Graph Traversal**
```sql
-- Find all companies connected to an investor (2 hops)
WITH RECURSIVE investor_network AS (
  SELECT from_entity_id, to_entity_id, relationship_type, 1 as depth
  FROM graph_relationships
  WHERE from_entity_id = 'investor-uuid'
  
  UNION ALL
  
  SELECT gr.from_entity_id, gr.to_entity_id, gr.relationship_type, in.depth + 1
  FROM graph_relationships gr
  JOIN investor_network in ON gr.from_entity_id = in.to_entity_id
  WHERE in.depth < 2
)
SELECT DISTINCT to_entity_id FROM investor_network;
```

#### 3.2 Materialized Views for Common Queries
```sql
-- Pre-compute investor portfolios
CREATE MATERIALIZED VIEW investor_portfolios AS
SELECT 
  e1.id as investor_id,
  e1.canonical_name as investor_name,
  e2.id as company_id,
  e2.canonical_name as company_name,
  gr.strength,
  gr.metadata->>'deal_size' as deal_size,
  gr.created_at as investment_date
FROM graph_relationships gr
JOIN entities e1 ON gr.from_entity_id = e1.id
JOIN entities e2 ON gr.to_entity_id = e2.id
WHERE gr.relationship_type = 'invested_in'
  AND e1.entity_type = 'investor'
  AND e2.entity_type = 'company';

CREATE INDEX idx_portfolios_investor ON investor_portfolios(investor_id);
CREATE INDEX idx_portfolios_company ON investor_portfolios(company_id);

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY investor_portfolios;
```

---

### Phase 4: Unsupervised Learning Pipeline (Week 7-8)

#### 4.1 Background Job: Entity Resolution

```python
# Background job (run every hour)
async def resolve_entities():
    """
    1. Find unmatched entities (no entity_mapping)
    2. Try to match with existing entities
    3. Create new entity if no match found
    4. Update confidence scores
    """
    unmatched = get_unmatched_entities()
    
    for entity in unmatched:
        # Try exact match
        match = find_exact_match(entity.name)
        if match:
            create_entity_mapping(entity, match, confidence=1.0)
            continue
        
        # Try fuzzy match
        match = find_fuzzy_match(entity.name, threshold=0.85)
        if match:
            create_entity_mapping(entity, match, confidence=0.8)
            continue
        
        # Try embedding match
        match = find_embedding_match(entity.name, threshold=0.85)
        if match:
            create_entity_mapping(entity, match, confidence=0.7)
            continue
        
        # Create new canonical entity
        create_new_entity(entity)
```

#### 4.2 Background Job: Relationship Inference

```python
# Background job (run every 6 hours)
async def infer_relationships():
    """
    1. Find documents with multiple entities
    2. Use Claude to extract relationships
    3. Insert inferred relationships
    4. Update relationship strength based on evidence count
    """
    documents = get_documents_with_multiple_entities()
    
    for doc in documents:
        entities = extract_entities_from_doc(doc)
        if len(entities) < 2:
            continue
        
        # Use Claude to infer relationships
        relationships = await claude_extract_relationships(doc, entities)
        
        for rel in relationships:
            insert_graph_relationship(
                from_entity=rel['from'],
                to_entity=rel['to'],
                type=rel['type'],
                inferred=True,
                confidence=rel['confidence'],
                source_document_id=doc.id
            )
```

#### 4.3 Relationship Strength Calculation

```python
def calculate_relationship_strength(from_entity, to_entity, rel_type):
    """
    Calculate strength based on:
    - Number of documents mentioning both
    - Explicit mentions vs inferred
    - Recency (newer = stronger)
    - Decision outcomes (positive = stronger)
    """
    explicit_count = count_explicit_relationships(from_entity, to_entity, rel_type)
    inferred_count = count_inferred_relationships(from_entity, to_entity, rel_type)
    doc_count = count_shared_documents(from_entity, to_entity)
    recency_score = calculate_recency(from_entity, to_entity)
    
    strength = (
        explicit_count * 0.4 +
        inferred_count * 0.2 +
        doc_count * 0.2 +
        recency_score * 0.2
    )
    
    return min(strength, 1.0)
```

---

## Implementation Roadmap

### Week 1-2: Foundation
- [ ] Create `entities` table
- [ ] Create `entity_mappings` table
- [ ] Create `graph_relationships` table
- [ ] Migrate existing data to entities
- [ ] Basic entity resolution (exact + fuzzy)

### Week 3-4: Matching
- [ ] Implement embedding-based matching
- [ ] Implement LLM-based matching (Claude)
- [ ] Background job for entity resolution
- [ ] UI for manual entity merging

### Week 5-6: Relationships
- [ ] Extract relationships from decisions
- [ ] Extract relationships from documents (Claude)
- [ ] Relationship inference pipeline
- [ ] Graph visualization UI

### Week 7-8: Learning
- [ ] Relationship strength calculation
- [ ] Pattern detection (co-investment, syndicates)
- [ ] Materialized views for fast queries
- [ ] Graph analytics (PageRank, communities)

---

## Example Queries

### Find all companies an investor has invested in:
```sql
SELECT e2.canonical_name, gr.strength, gr.metadata
FROM graph_relationships gr
JOIN entities e1 ON gr.from_entity_id = e1.id
JOIN entities e2 ON gr.to_entity_id = e2.id
WHERE e1.canonical_name = 'Orbit Ventures'
  AND gr.relationship_type = 'invested_in'
ORDER BY gr.strength DESC;
```

### Find co-investors (investors who invested in same companies):
```sql
SELECT DISTINCT e1.canonical_name as investor1, e2.canonical_name as investor2
FROM graph_relationships gr1
JOIN graph_relationships gr2 ON gr1.to_entity_id = gr2.to_entity_id
JOIN entities e1 ON gr1.from_entity_id = e1.id
JOIN entities e2 ON gr2.from_entity_id = e2.id
WHERE gr1.relationship_type = 'invested_in'
  AND gr2.relationship_type = 'invested_in'
  AND gr1.from_entity_id != gr2.from_entity_id
  AND e1.entity_type = 'investor'
  AND e2.entity_type = 'investor';
```

### Find related companies (same investors, same sector):
```sql
-- Companies with overlapping investor base
SELECT e1.canonical_name as company1, e2.canonical_name as company2,
       COUNT(*) as shared_investors
FROM graph_relationships gr1
JOIN graph_relationships gr2 ON gr1.from_entity_id = gr2.from_entity_id
JOIN entities e1 ON gr1.to_entity_id = e1.id
JOIN entities e2 ON gr2.to_entity_id = e2.id
WHERE gr1.relationship_type = 'invested_in'
  AND gr2.relationship_type = 'invested_in'
  AND e1.id != e2.id
  AND e1.entity_type = 'company'
  AND e2.entity_type = 'company'
GROUP BY e1.id, e2.id
HAVING COUNT(*) >= 2
ORDER BY shared_investors DESC;
```

---

## Benefits

1. **Automatic Entity Resolution:**
   - "Giga Energy" + "GigaEnergy Inc" → Same entity
   - Reduces duplicates as more data arrives

2. **Relationship Discovery:**
   - Automatically finds connections between companies/investors
   - Learns patterns (who co-invests with whom)

3. **Efficient Storage:**
   - Single source of truth for entities
   - Graph structure enables fast traversal
   - Materialized views for common queries

4. **Scalability:**
   - Handles millions of relationships
   - Background jobs don't block UI
   - Incremental learning (gets better over time)

---

## Next Steps

1. **Create migration** for graph tables
2. **Implement entity resolution** algorithm
3. **Build relationship inference** pipeline
4. **Add graph visualization** UI
5. **Set up background jobs** for learning
