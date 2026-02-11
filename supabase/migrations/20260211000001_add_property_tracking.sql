-- Property tracking for smart merge: sources, conflicts, and user-edited fields
-- These are stored inside the JSONB `properties` column of kg_entities,
-- but we also add dedicated columns for efficient querying.

-- Track which fields were manually edited by the user (never overwrite these)
ALTER TABLE kg_entities
  ADD COLUMN IF NOT EXISTS edited_fields TEXT[] DEFAULT '{}';

-- Track property provenance: which document provided each field value
-- Format: { "field_name": { "document_id": "uuid", "confidence": 0.9, "extracted_at": "iso" } }
ALTER TABLE kg_entities
  ADD COLUMN IF NOT EXISTS property_sources JSONB DEFAULT '{}';

-- Track unresolved conflicts between documents
-- Format: [{ "field": "funding_stage", "values": [{"value":"Seed","source":"doc1"},{"value":"Series A","source":"doc2"}], "detected_at":"iso" }]
ALTER TABLE kg_entities
  ADD COLUMN IF NOT EXISTS property_conflicts JSONB DEFAULT '[]';

-- Index for finding entities with unresolved conflicts
CREATE INDEX IF NOT EXISTS idx_kg_entities_has_conflicts
  ON kg_entities USING gin (property_conflicts)
  WHERE property_conflicts != '[]'::jsonb;

-- Update the update_company_card_properties RPC to also handle the tracking columns
CREATE OR REPLACE FUNCTION update_company_card_properties(p_entity_id UUID, p_new_properties JSONB)
RETURNS VOID AS $$
DECLARE
  v_edited TEXT[];
  v_sources JSONB;
  v_conflicts JSONB;
BEGIN
  -- Extract tracking fields from the new properties if provided
  v_edited := CASE
    WHEN p_new_properties ? '_edited_fields'
    THEN ARRAY(SELECT jsonb_array_elements_text(p_new_properties->'_edited_fields'))
    ELSE NULL
  END;
  
  v_sources := p_new_properties->'_property_sources';
  v_conflicts := p_new_properties->'_property_conflicts';

  -- Update properties (merge)
  UPDATE kg_entities
  SET
    properties = COALESCE(properties, '{}'::jsonb) || (p_new_properties - '_edited_fields' - '_property_sources' - '_property_conflicts'),
    edited_fields = COALESCE(v_edited, edited_fields),
    property_sources = CASE WHEN v_sources IS NOT NULL THEN v_sources ELSE property_sources END,
    property_conflicts = CASE WHEN v_conflicts IS NOT NULL THEN v_conflicts ELSE property_conflicts END,
    updated_at = NOW()
  WHERE id = p_entity_id AND entity_type IN ('company', 'fund');
END;
$$ LANGUAGE plpgsql;

-- Helper: resolve a conflict (user picks a value)
CREATE OR REPLACE FUNCTION resolve_property_conflict(
  p_entity_id UUID,
  p_field TEXT,
  p_chosen_value TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Set the chosen value in properties
  UPDATE kg_entities
  SET
    properties = COALESCE(properties, '{}'::jsonb) || jsonb_build_object(p_field, p_chosen_value),
    -- Mark field as user-edited so it won't be overwritten again
    edited_fields = array_append(
      COALESCE(edited_fields, '{}'),
      p_field
    ),
    -- Remove this conflict from the list
    property_conflicts = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(property_conflicts, '[]'::jsonb)) AS elem
      WHERE elem->>'field' != p_field
    ),
    updated_at = NOW()
  WHERE id = p_entity_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: get entities with unresolved conflicts for an event
CREATE OR REPLACE FUNCTION get_entities_with_conflicts(p_event_id UUID)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  conflict_count INT,
  conflicts JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.name,
    jsonb_array_length(COALESCE(ke.property_conflicts, '[]'::jsonb))::INT,
    ke.property_conflicts
  FROM kg_entities ke
  WHERE ke.event_id = p_event_id
    AND ke.entity_type IN ('company', 'fund')
    AND jsonb_array_length(COALESCE(ke.property_conflicts, '[]'::jsonb)) > 0
  ORDER BY ke.name;
END;
$$ LANGUAGE plpgsql STABLE;
