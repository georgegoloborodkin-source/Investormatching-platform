-- Auto-create Company Cards from Document Ingestion
-- When a document is uploaded, automatically create a company entity if the document title looks like a company name

-- Add company_id to documents (optional FK - documents can exist without a company entity)
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS company_entity_id UUID REFERENCES kg_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_company_entity ON documents(company_entity_id);

-- Function: Auto-create company entity from document title
-- Uses AFTER INSERT so the document row exists when we reference it via FK
CREATE OR REPLACE FUNCTION auto_create_company_from_document()
RETURNS TRIGGER AS $$
DECLARE
  v_company_name TEXT;
  v_normalized_name TEXT;
  v_company_entity_id UUID;
  v_doc_title TEXT;
BEGIN
  -- Only process if document has a title and no company_entity_id yet
  IF NEW.title IS NULL OR NEW.title = '' OR NEW.company_entity_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  v_doc_title := TRIM(NEW.title);
  
  -- Skip if title looks like a generic document name
  IF v_doc_title ILIKE '%document%' OR 
     v_doc_title ILIKE '%uploaded%' OR 
     v_doc_title ILIKE '%file%' OR
     v_doc_title ILIKE 'untitled%' OR
     LENGTH(v_doc_title) < 2 THEN
    RETURN NULL;
  END IF;

  -- Clean up title: remove common file extensions first
  v_company_name := REGEXP_REPLACE(v_doc_title, '\.[^.]+$', ''); -- Remove file extension like .pdf .docx
  -- Remove common suffixes (case-insensitive, word boundary)
  v_company_name := REGEXP_REPLACE(v_company_name, '\s*[-_]?\s*(pitch\s*deck|pitch|deck|memo|presentation|report|summary|notes|overview|profile|tearsheet|one[- ]?pager|executive\s+summary|data\s+room|financials|appendix)$', '', 'i');
  -- Remove trailing separators and whitespace
  v_company_name := REGEXP_REPLACE(v_company_name, '[\s_-]+$', '');
  v_company_name := TRIM(v_company_name);
  
  -- Skip if too short after cleaning
  IF LENGTH(v_company_name) < 2 THEN
    RETURN NULL;
  END IF;

  v_normalized_name := LOWER(TRIM(v_company_name));

  -- Check if company entity already exists (by normalized name)
  SELECT ke.id INTO v_company_entity_id
  FROM kg_entities ke
  WHERE ke.event_id = NEW.event_id
    AND ke.normalized_name = v_normalized_name
    AND ke.entity_type = 'company'
  LIMIT 1;

  -- Create company entity if it doesn't exist
  IF v_company_entity_id IS NULL THEN
    INSERT INTO kg_entities (
      event_id,
      entity_type,
      name,
      normalized_name,
      properties,
      source_document_id,
      confidence,
      created_by
    ) VALUES (
      NEW.event_id,
      'company',
      v_company_name,
      v_normalized_name,
      jsonb_build_object(
        'auto_created', true,
        'source', 'document_title',
        'first_seen_document', NEW.id,
        'bio', '',
        'funding_stage', '',
        'amount_seeking', '',
        'valuation', '',
        'arr', '',
        'burn_rate', '',
        'runway_months', '',
        'problem', '',
        'solution', '',
        'tam', '',
        'competitive_edge', '',
        'founders', '[]'::jsonb,
        'ai_rationale', '',
        'website', '',
        'logo_url', ''
      ),
      NEW.id,
      0.7,
      NEW.created_by
    )
    RETURNING id INTO v_company_entity_id;
  ELSE
    -- Update existing entity: add this document to its properties
    UPDATE kg_entities
    SET properties = COALESCE(properties, '{}'::jsonb) || 
        jsonb_build_object(
          'document_count', COALESCE((properties->>'document_count')::int, 0) + 1,
          'last_seen_document', NEW.id
        ),
        updated_at = NOW()
    WHERE id = v_company_entity_id;
  END IF;

  -- Link document to company entity (UPDATE since row already exists in AFTER trigger)
  UPDATE documents SET company_entity_id = v_company_entity_id WHERE id = NEW.id;

  RETURN NULL; -- AFTER triggers return NULL
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create company AFTER document insert (document must exist for FK)
DROP TRIGGER IF EXISTS trigger_auto_create_company_from_document ON documents;
CREATE TRIGGER trigger_auto_create_company_from_document
  AFTER INSERT OR UPDATE OF title ON documents
  FOR EACH ROW
  WHEN (NEW.title IS NOT NULL AND NEW.title != '')
  EXECUTE FUNCTION auto_create_company_from_document();

-- Function: Get company card data (all info about a company)
-- Parameters prefixed with p_ to avoid ambiguity with column names
CREATE OR REPLACE FUNCTION get_company_card(p_company_entity_id UUID, p_filter_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  company_properties JSONB,
  document_count BIGINT,
  document_ids UUID[],
  connection_count BIGINT,
  connection_ids UUID[],
  kpi_count BIGINT,
  kpi_summary JSONB,
  relationship_count BIGINT,
  related_companies TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH company_info AS (
    SELECT 
      ke.id,
      ke.name,
      ke.properties,
      ke.event_id
    FROM kg_entities ke
    WHERE ke.id = p_company_entity_id
      AND ke.entity_type = 'company'
      AND (p_filter_event_id IS NULL OR ke.event_id = p_filter_event_id)
  ),
  doc_stats AS (
    SELECT 
      COUNT(*)::BIGINT as doc_count,
      ARRAY_AGG(d.id) FILTER (WHERE d.id IS NOT NULL) as doc_ids
    FROM documents d
    WHERE d.company_entity_id = p_company_entity_id
      AND (p_filter_event_id IS NULL OR d.event_id = p_filter_event_id)
  ),
  conn_stats AS (
    SELECT 
      COUNT(*)::BIGINT as conn_count,
      ARRAY_AGG(cc.id) FILTER (WHERE cc.id IS NOT NULL) as conn_ids
    FROM company_connections cc
    WHERE (cc.source_company_name = (SELECT ci.name FROM company_info ci LIMIT 1)
           OR cc.target_company_name = (SELECT ci.name FROM company_info ci LIMIT 1))
      AND (p_filter_event_id IS NULL OR cc.event_id = p_filter_event_id)
  ),
  kpi_stats AS (
    SELECT 
      COUNT(*)::BIGINT as kpi_cnt,
      jsonb_object_agg(ck.metric_name, jsonb_build_object(
        'value', ck.value,
        'unit', ck.unit,
        'period', ck.period
      )) FILTER (WHERE ck.metric_name IS NOT NULL) as kpi_agg
    FROM company_kpis ck
    WHERE ck.company_name = (SELECT ci.name FROM company_info ci LIMIT 1)
      AND (p_filter_event_id IS NULL OR ck.event_id = p_filter_event_id)
  ),
  rel_stats AS (
    SELECT 
      COUNT(*)::BIGINT as rel_count,
      ARRAY_AGG(DISTINCT ke2.name) FILTER (WHERE ke2.name IS NOT NULL) as related_names
    FROM kg_edges edg
    JOIN kg_entities ke2 ON (
      (edg.source_entity_id = p_company_entity_id AND ke2.id = edg.target_entity_id)
      OR (edg.target_entity_id = p_company_entity_id AND ke2.id = edg.source_entity_id)
    )
    WHERE edg.event_id = COALESCE(p_filter_event_id, (SELECT ci.event_id FROM company_info ci LIMIT 1))
      AND ke2.entity_type = 'company'
  )
  SELECT 
    ci.id,
    ci.name,
    ci.properties,
    COALESCE(ds.doc_count, 0),
    COALESCE(ds.doc_ids, ARRAY[]::UUID[]),
    COALESCE(cs.conn_count, 0),
    COALESCE(cs.conn_ids, ARRAY[]::UUID[]),
    COALESCE(ks.kpi_cnt, 0),
    COALESCE(ks.kpi_agg, '{}'::jsonb),
    COALESCE(rs.rel_count, 0),
    COALESCE(rs.related_names, ARRAY[]::TEXT[])
  FROM company_info ci
  CROSS JOIN doc_stats ds
  CROSS JOIN conn_stats cs
  CROSS JOIN kpi_stats ks
  CROSS JOIN rel_stats rs;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update company card properties (for editable fields)
CREATE OR REPLACE FUNCTION update_company_card_properties(
  p_entity_id UUID,
  p_new_properties JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE kg_entities
  SET properties = COALESCE(properties, '{}'::jsonb) || p_new_properties,
      updated_at = NOW()
  WHERE id = p_entity_id
    AND entity_type = 'company';
END;
$$ LANGUAGE plpgsql;

-- Index for faster company lookups
CREATE INDEX IF NOT EXISTS idx_kg_entities_company_normalized ON kg_entities(normalized_name, entity_type) 
  WHERE entity_type = 'company';
