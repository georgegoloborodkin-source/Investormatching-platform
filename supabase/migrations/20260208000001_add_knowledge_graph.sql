-- Knowledge Graph: typed entity nodes + relationship edges
-- Enables graph-aware retrieval (founder → company → round → investor)

-- Entity nodes (companies, people, funds, etc.)
CREATE TABLE IF NOT EXISTS kg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  -- Entity identity
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'person', 'fund', 'round', 'sector', 'metric', 'location')),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- lowercase, trimmed for dedup
  
  -- Flexible properties (different per entity_type)
  properties JSONB DEFAULT '{}',
  -- e.g. company: {industry, stage, founded_year, hq}
  -- e.g. person: {role, email, linkedin}
  -- e.g. fund: {aum, vintage, focus}
  -- e.g. round: {type, amount, date, valuation}
  
  -- Provenance
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 0.8, -- extraction confidence
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relationship edges (directed)
CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  source_entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  
  -- Relationship type
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'founded',          -- person → company
    'works_at',         -- person → company
    'invested_in',      -- fund/person → company
    'raised',           -- company → round
    'led_round',        -- fund → round
    'partner_of',       -- company → company
    'competitor_of',    -- company → company
    'acquired',         -- company → company
    'operates_in',      -- company → sector
    'located_in',       -- company → location
    'board_member',     -- person → company
    'advisor',          -- person → company
    'portfolio_company' -- fund → company
  )),
  
  -- Edge metadata
  properties JSONB DEFAULT '{}',
  -- e.g. invested_in: {amount, date, ownership_pct}
  -- e.g. works_at: {role, start_date}
  
  -- Provenance
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 0.8,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kg_entities_event ON kg_entities(event_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_name ON kg_entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_kg_entities_document ON kg_entities(source_document_id);

CREATE INDEX IF NOT EXISTS idx_kg_edges_event ON kg_edges(event_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_relation ON kg_edges(relation_type);
CREATE INDEX IF NOT EXISTS idx_kg_edges_document ON kg_edges(source_document_id);

-- RLS
ALTER TABLE kg_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org entities"
  ON kg_entities FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = kg_entities.event_id
      )
    )
  );

CREATE POLICY "Users can manage entities"
  ON kg_entities FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('organizer', 'managing_partner')
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = kg_entities.event_id
      )
    )
  );

CREATE POLICY "Users can view org edges"
  ON kg_edges FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = kg_edges.event_id
      )
    )
  );

CREATE POLICY "Users can manage edges"
  ON kg_edges FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('organizer', 'managing_partner')
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = kg_edges.event_id
      )
    )
  );

-- Graph traversal helper: find all entities connected to a given entity (1-hop)
CREATE OR REPLACE FUNCTION kg_neighbors(
  entity_id UUID,
  max_depth INT DEFAULT 1
)
RETURNS TABLE (
  entity_id UUID,
  entity_type TEXT,
  entity_name TEXT,
  relation_type TEXT,
  direction TEXT, -- 'outgoing' or 'incoming'
  edge_properties JSONB,
  depth INT
)
LANGUAGE sql
STABLE
AS $$
  -- Outgoing edges
  SELECT
    e.target_entity_id AS entity_id,
    ke.entity_type,
    ke.name AS entity_name,
    e.relation_type,
    'outgoing'::TEXT AS direction,
    e.properties AS edge_properties,
    1 AS depth
  FROM kg_edges e
  JOIN kg_entities ke ON ke.id = e.target_entity_id
  WHERE e.source_entity_id = kg_neighbors.entity_id

  UNION ALL

  -- Incoming edges
  SELECT
    e.source_entity_id AS entity_id,
    ke.entity_type,
    ke.name AS entity_name,
    e.relation_type,
    'incoming'::TEXT AS direction,
    e.properties AS edge_properties,
    1 AS depth
  FROM kg_edges e
  JOIN kg_entities ke ON ke.id = e.source_entity_id
  WHERE e.target_entity_id = kg_neighbors.entity_id;
$$;

-- Find entity by name (fuzzy)
CREATE OR REPLACE FUNCTION kg_find_entity(
  search_name TEXT,
  filter_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  name TEXT,
  properties JSONB,
  confidence FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ke.id,
    ke.entity_type,
    ke.name,
    ke.properties,
    ke.confidence
  FROM kg_entities ke
  WHERE ke.normalized_name ILIKE '%' || LOWER(TRIM(search_name)) || '%'
    AND (filter_event_id IS NULL OR ke.event_id = filter_event_id)
  ORDER BY
    CASE WHEN ke.normalized_name = LOWER(TRIM(search_name)) THEN 0 ELSE 1 END,
    ke.confidence DESC
  LIMIT 20;
$$;
