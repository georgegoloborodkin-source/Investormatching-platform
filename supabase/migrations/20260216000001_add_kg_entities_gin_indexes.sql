-- GIN index on kg_entities.properties for fast JSONB queries
-- Required by Agentic RAG search_portfolio tool (filters by country, sector, stage, etc.)

CREATE INDEX IF NOT EXISTS idx_kg_entities_properties_gin
  ON kg_entities USING GIN (properties);

-- Composite index for fast entity type + event scoping
CREATE INDEX IF NOT EXISTS idx_kg_entities_type_event
  ON kg_entities (entity_type, event_id);

-- Index for normalized_name lookups (used by kg_find_entity and agent tools)
CREATE INDEX IF NOT EXISTS idx_kg_entities_normalized_name
  ON kg_entities (normalized_name, event_id);
