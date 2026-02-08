-- Add review workflow to knowledge graph edges
-- This allows auto-extracted relationships to be reviewed before appearing in connections graph

ALTER TABLE kg_edges 
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending' 
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'edited'));
ALTER TABLE kg_edges 
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES user_profiles(id);
ALTER TABLE kg_edges 
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Map kg_edges relation_type to company_connections connection_type
-- This function converts knowledge graph relationships to connection graph format
CREATE OR REPLACE FUNCTION map_kg_relation_to_connection_type(kg_relation TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE kg_relation
    WHEN 'partner_of' THEN 'Partnership'
    WHEN 'invested_in' THEN 'INV'
    WHEN 'portfolio_company' THEN 'Portfolio'
    WHEN 'competitor_of' THEN 'BD' -- Competitors are business relationships, not knowledge
    WHEN 'acquired' THEN 'BD' -- Acquisitions are business relationships
    ELSE 'BD' -- Default to BD for other relationships
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;  

-- Function to auto-create company_connections from approved kg_edges
CREATE OR REPLACE FUNCTION sync_approved_edges_to_connections()
RETURNS TRIGGER AS $$
DECLARE
  source_company_name TEXT;
  target_company_name TEXT;
  connection_type TEXT;
BEGIN
  -- Only process if review_status changed to 'approved'
  IF NEW.review_status = 'approved' AND (OLD.review_status IS NULL OR OLD.review_status != 'approved') THEN
    -- Get company names from entities
    SELECT 
      se.name,
      te.name,
      map_kg_relation_to_connection_type(NEW.relation_type)
    INTO source_company_name, target_company_name, connection_type
    FROM kg_entities se, kg_entities te
    WHERE se.id = NEW.source_entity_id
      AND te.id = NEW.target_entity_id
      AND se.entity_type = 'company'
      AND te.entity_type = 'company';
    
    -- Only create connection if both are companies
    IF source_company_name IS NOT NULL AND target_company_name IS NOT NULL THEN
      -- Check if connection already exists
      IF NOT EXISTS (
        SELECT 1 FROM company_connections
        WHERE event_id = NEW.event_id
          AND source_company_name = source_company_name
          AND target_company_name = target_company_name
          AND connection_type = connection_type
      ) THEN
        INSERT INTO company_connections (
          event_id,
          source_company_name,
          target_company_name,
          connection_type,
          connection_status,
          source_document_id,
          ai_reasoning,
          created_by
        ) VALUES (
          NEW.event_id,
          source_company_name,
          target_company_name,
          connection_type::connection_type,
          'To Connect', -- Default status for auto-created connections
          NEW.source_document_id,
          COALESCE((NEW.properties->>'reasoning')::TEXT, 'Auto-extracted from document'),
          NEW.reviewed_by -- Use reviewer as creator
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create connections when edges are approved
DROP TRIGGER IF EXISTS trigger_sync_approved_edges ON kg_edges;
CREATE TRIGGER trigger_sync_approved_edges
  AFTER UPDATE OF review_status ON kg_edges
  FOR EACH ROW
  WHEN (NEW.review_status = 'approved' AND (OLD.review_status IS NULL OR OLD.review_status != 'approved'))
  EXECUTE FUNCTION sync_approved_edges_to_connections();

-- Index for querying pending reviews
CREATE INDEX IF NOT EXISTS idx_kg_edges_review_status ON kg_edges(review_status) 
  WHERE review_status = 'pending';
