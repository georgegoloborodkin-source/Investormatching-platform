-- Auto-create Company Cards from Document Ingestion
-- When a document is uploaded, automatically create a company entity if the document title looks like a company name

-- Add company_id to documents (optional FK - documents can exist without a company entity)
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS company_entity_id UUID REFERENCES kg_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_company_entity ON documents(company_entity_id);

-- Function: Auto-create company entity from document title
CREATE OR REPLACE FUNCTION auto_create_company_from_document()
RETURNS TRIGGER AS $$
DECLARE
  company_name TEXT;
  normalized_name TEXT;
  company_entity_id UUID;
  doc_title TEXT;
BEGIN
  -- Only process if document has a title and no company_entity_id yet
  IF NEW.title IS NULL OR NEW.title = '' OR NEW.company_entity_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  doc_title := TRIM(NEW.title);
  
  -- Skip if title looks like a generic document name
  IF doc_title ILIKE '%document%' OR 
     doc_title ILIKE '%uploaded%' OR 
     doc_title ILIKE '%file%' OR
     doc_title ILIKE 'untitled%' OR
     LENGTH(doc_title) < 2 THEN
    RETURN NEW;
  END IF;

  -- Clean up title: remove common file extensions and suffixes
  company_name := REGEXP_REPLACE(doc_title, '\s*(pitch|deck|memo|presentation|report|summary|notes|doc|pdf|docx|xlsx)$', '', 'i');
  company_name := REGEXP_REPLACE(company_name, '\.[^.]+$', ''); -- Remove file extension
  company_name := TRIM(company_name);
  
  -- Skip if too short after cleaning
  IF LENGTH(company_name) < 2 THEN
    RETURN NEW;
  END IF;

  normalized_name := LOWER(TRIM(company_name));

  -- Check if company entity already exists (by normalized name)
  SELECT id INTO company_entity_id
  FROM kg_entities
  WHERE event_id = NEW.event_id
    AND normalized_name = normalized_name
    AND entity_type = 'company'
  LIMIT 1;

  -- Create company entity if it doesn't exist
  IF company_entity_id IS NULL THEN
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
      company_name,
      normalized_name,
      jsonb_build_object(
        'auto_created', true,
        'source', 'document_title',
        'first_seen_document', NEW.id
      ),
      NEW.id,
      0.7, -- Lower confidence for auto-created from title
      NEW.created_by
    )
    RETURNING id INTO company_entity_id;
  ELSE
    -- Update existing entity: add this document to its properties
    UPDATE kg_entities
    SET properties = COALESCE(properties, '{}'::jsonb) || 
        jsonb_build_object(
          'document_count', COALESCE((properties->>'document_count')::int, 0) + 1,
          'last_seen_document', NEW.id
        ),
        updated_at = NOW()
    WHERE id = company_entity_id;
  END IF;

  -- Link document to company entity
  NEW.company_entity_id := company_entity_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create company on document insert
DROP TRIGGER IF EXISTS trigger_auto_create_company_from_document ON documents;
CREATE TRIGGER trigger_auto_create_company_from_document
  BEFORE INSERT OR UPDATE OF title ON documents
  FOR EACH ROW
  WHEN (NEW.title IS NOT NULL AND NEW.title != '')
  EXECUTE FUNCTION auto_create_company_from_document();

-- Function: Get company card data (all info about a company)
CREATE OR REPLACE FUNCTION get_company_card(company_entity_id UUID, filter_event_id UUID DEFAULT NULL)
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
    WHERE ke.id = company_entity_id
      AND ke.entity_type = 'company'
      AND (filter_event_id IS NULL OR ke.event_id = filter_event_id)
  ),
  doc_stats AS (
    SELECT 
      COUNT(*)::BIGINT as doc_count,
      ARRAY_AGG(d.id) FILTER (WHERE d.id IS NOT NULL) as doc_ids
    FROM documents d
    WHERE d.company_entity_id = company_entity_id
      AND (filter_event_id IS NULL OR d.event_id = filter_event_id)
  ),
  conn_stats AS (
    SELECT 
      COUNT(*)::BIGINT as conn_count,
      ARRAY_AGG(cc.id) FILTER (WHERE cc.id IS NOT NULL) as conn_ids
    FROM company_connections cc
    WHERE (cc.source_company_name = (SELECT name FROM company_info)
           OR cc.target_company_name = (SELECT name FROM company_info))
      AND (filter_event_id IS NULL OR cc.event_id = filter_event_id)
  ),
  kpi_stats AS (
    SELECT 
      COUNT(*)::BIGINT as kpi_count,
      jsonb_object_agg(ck.metric_name, jsonb_build_object(
        'value', ck.value,
        'unit', ck.unit,
        'period', ck.period
      )) FILTER (WHERE ck.metric_name IS NOT NULL) as kpi_summary
    FROM company_kpis ck
    WHERE ck.company_name = (SELECT name FROM company_info)
      AND (filter_event_id IS NULL OR ck.event_id = filter_event_id)
  ),
  rel_stats AS (
    SELECT 
      COUNT(*)::BIGINT as rel_count,
      ARRAY_AGG(DISTINCT ke2.name) FILTER (WHERE ke2.name IS NOT NULL) as related_names
    FROM kg_edges ke
    JOIN kg_entities ke2 ON (
      (ke.source_entity_id = company_entity_id AND ke2.id = ke.target_entity_id)
      OR (ke.target_entity_id = company_entity_id AND ke2.id = ke.source_entity_id)
    )
    WHERE ke.event_id = COALESCE(filter_event_id, (SELECT event_id FROM company_info))
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
    COALESCE(ks.kpi_count, 0),
    COALESCE(ks.kpi_summary, '{}'::jsonb),
    COALESCE(rs.rel_count, 0),
    COALESCE(rs.related_names, ARRAY[]::TEXT[])
  FROM company_info ci
  CROSS JOIN doc_stats ds
  CROSS JOIN conn_stats cs
  CROSS JOIN kpi_stats ks
  CROSS JOIN rel_stats rs;
END;
$$ LANGUAGE plpgsql STABLE;

-- Index for faster company lookups
CREATE INDEX IF NOT EXISTS idx_kg_entities_company_normalized ON kg_entities(normalized_name, entity_type) 
  WHERE entity_type = 'company';
