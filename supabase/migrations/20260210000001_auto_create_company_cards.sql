-- Auto-create Company Cards from Document Ingestion
-- ONLY creates a company entity when the document title looks like a company pitch deck / investment memo.
-- Titles like "Derivatives trading intern (2)" or "Trashcoin_Scaling_Operations" are skipped.

-- Add company_id to documents (optional FK)
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS company_entity_id UUID REFERENCES kg_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_company_entity ON documents(company_entity_id);

-- ──────────────────────────────────────────────────────────
-- Helper: extract a company name from a document title.
-- Returns NULL if the title doesn't look like a company doc.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION extract_company_name_from_title(p_title TEXT)
RETURNS TEXT AS $$
DECLARE
  v_clean TEXT;
  v_name  TEXT;
BEGIN
  IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 2 THEN RETURN NULL; END IF;

  v_clean := TRIM(p_title);

  -- ── 1. Skip titles that are clearly NOT company names ──
  -- Generic / operational docs
  IF v_clean ~* '(^|\s)(intern|resume|cv|cover\s*letter|certificate|transcript|letter\s+of|offer\s+letter|contract|agreement|invoice|receipt|manual|handbook|guide|tutorial|template|checklist|agenda|minutes|action\s+items|todo|to-do|meeting\s+notes|quarterly\s+report|annual\s+report|monthly\s+report|weekly\s+update|status\s+update|onboarding|training|policy|procedure|regulation|compliance|audit|tax|payroll|expense|budget|forecast|projection|roadmap|sprint|backlog|changelog|release\s+notes|readme|license|terms|privacy\s+policy|faq)(\s|$|[_-])' THEN
    RETURN NULL;
  END IF;

  -- Documents about generic topics (not a company)
  IF v_clean ~* '(^|\s)(trading|derivatives|scaling|operations|marketing|strategy|analysis|research|benchmark|comparison|landscape|market\s+overview|industry|sector|thesis|framework|playbook|workflow|process|pipeline|funnel|metrics|kpis|okrs|goals|objectives)(\s|$|[_-])' THEN
    RETURN NULL;
  END IF;

  -- Files with version numbers / copy markers like "(2)", "v3", "copy", "final", "draft"
  IF v_clean ~ '\(\d+\)\s*$' THEN
    RETURN NULL;  -- "Something (2)" is a duplicate, not a company
  END IF;

  -- Skip if title has too many words and no clear company-document pattern
  -- (company docs usually follow: "CompanyName - DocType" or "CompanyName DocType")
  IF array_length(string_to_array(v_clean, ' '), 1) > 8 THEN
    RETURN NULL;
  END IF;

  -- ── 2. Extract company name from common patterns ──
  -- Remove file extension
  v_name := REGEXP_REPLACE(v_clean, '\.[^.]+$', '');

  -- Pattern: "CompanyName - Investment Deck - December 2025"  →  "CompanyName"
  -- Split on " - " or " – " and take the first segment
  IF v_name ~ '\s+[-–]\s+' THEN
    v_name := SPLIT_PART(v_name, ' - ', 1);
    IF v_name = '' OR v_name = v_clean THEN
      v_name := SPLIT_PART(REGEXP_REPLACE(v_clean, '\.[^.]+$', ''), ' – ', 1);
    END IF;
  END IF;

  -- Remove common document-type suffixes
  v_name := REGEXP_REPLACE(v_name, '\s*[-_]?\s*(pitch\s*deck|pitch|deck|investment\s+deck|investment\s+memo|memo|presentation|report|summary|notes|overview|profile|tearsheet|one[- ]?pager|executive\s+summary|data\s*room|financials|appendix|proposal|brief|intro|introduction|brochure|prospectus|term\s*sheet|cap\s*table)$', '', 'i');

  -- Remove date suffixes like "December 2025", "Q4 2025", "2025"
  v_name := REGEXP_REPLACE(v_name, '\s*[-_]?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|q[1-4])?\s*\d{4}\s*$', '', 'i');

  -- Remove trailing separators, underscores, whitespace
  v_name := REGEXP_REPLACE(v_name, '[\s_-]+$', '');
  v_name := TRIM(v_name);

  -- Replace underscores with spaces for readability
  v_name := REPLACE(v_name, '_', ' ');
  v_name := TRIM(v_name);

  -- ── 3. Validate the extracted name looks like a company name ──
  -- Too short
  IF LENGTH(v_name) < 2 THEN RETURN NULL; END IF;

  -- Too long (company names are typically ≤ 5 words)
  IF array_length(string_to_array(v_name, ' '), 1) > 5 THEN RETURN NULL; END IF;

  -- All lowercase with spaces = likely a description, not a proper noun
  -- Company names usually have at least one uppercase letter
  IF v_name = LOWER(v_name) AND v_name ~ '\s' THEN RETURN NULL; END IF;

  RETURN v_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ──────────────────────────────────────────────────────────
-- Trigger function: Auto-create company from document title
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_create_company_from_document()
RETURNS TRIGGER AS $$
DECLARE
  v_company_name TEXT;
  v_normalized_name TEXT;
  v_company_entity_id UUID;
BEGIN
  -- Skip if already linked
  IF NEW.company_entity_id IS NOT NULL THEN RETURN NULL; END IF;

  -- Try to extract a company name
  v_company_name := extract_company_name_from_title(NEW.title);
  
  -- If extraction returned NULL, this document doesn't look like a company doc → skip
  IF v_company_name IS NULL THEN RETURN NULL; END IF;

  v_normalized_name := LOWER(TRIM(v_company_name));

  -- Check if company entity already exists
  SELECT ke.id INTO v_company_entity_id
  FROM kg_entities ke
  WHERE ke.event_id = NEW.event_id
    AND ke.normalized_name = v_normalized_name
    AND ke.entity_type = 'company'
  LIMIT 1;

  -- Create company entity if new
  IF v_company_entity_id IS NULL THEN
    INSERT INTO kg_entities (
      event_id, entity_type, name, normalized_name,
      properties, source_document_id, confidence, created_by
    ) VALUES (
      NEW.event_id, 'company', v_company_name, v_normalized_name,
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
      NEW.id, 0.7, NEW.created_by
    )
    RETURNING id INTO v_company_entity_id;
  ELSE
    -- Update existing: increment doc count
    UPDATE kg_entities
    SET properties = COALESCE(properties, '{}'::jsonb) || 
        jsonb_build_object(
          'document_count', COALESCE((properties->>'document_count')::int, 0) + 1,
          'last_seen_document', NEW.id
        ),
        updated_at = NOW()
    WHERE id = v_company_entity_id;
  END IF;

  -- Link document to company
  UPDATE documents SET company_entity_id = v_company_entity_id WHERE id = NEW.id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_auto_create_company_from_document ON documents;
CREATE TRIGGER trigger_auto_create_company_from_document
  AFTER INSERT OR UPDATE OF title ON documents
  FOR EACH ROW
  WHEN (NEW.title IS NOT NULL AND NEW.title != '')
  EXECUTE FUNCTION auto_create_company_from_document();

-- ──────────────────────────────────────────────────────────
-- get_company_card RPC
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_company_card(uuid, uuid);
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
    SELECT ke.id, ke.name, ke.properties, ke.event_id
    FROM kg_entities ke
    WHERE ke.id = p_company_entity_id
      AND ke.entity_type = 'company'
      AND (p_filter_event_id IS NULL OR ke.event_id = p_filter_event_id)
  ),
  doc_stats AS (
    SELECT COUNT(*)::BIGINT as doc_count,
      ARRAY_AGG(d.id) FILTER (WHERE d.id IS NOT NULL) as doc_ids
    FROM documents d
    WHERE d.company_entity_id = p_company_entity_id
      AND (p_filter_event_id IS NULL OR d.event_id = p_filter_event_id)
  ),
  conn_stats AS (
    SELECT COUNT(*)::BIGINT as conn_count,
      ARRAY_AGG(cc.id) FILTER (WHERE cc.id IS NOT NULL) as conn_ids
    FROM company_connections cc
    WHERE (cc.source_company_name = (SELECT ci.name FROM company_info ci LIMIT 1)
           OR cc.target_company_name = (SELECT ci.name FROM company_info ci LIMIT 1))
      AND (p_filter_event_id IS NULL OR cc.event_id = p_filter_event_id)
  ),
  kpi_stats AS (
    SELECT COUNT(*)::BIGINT as kpi_cnt,
      jsonb_object_agg(ck.metric_name, jsonb_build_object('value', ck.value, 'unit', ck.unit, 'period', ck.period))
        FILTER (WHERE ck.metric_name IS NOT NULL) as kpi_agg
    FROM company_kpis ck
    WHERE ck.company_name = (SELECT ci.name FROM company_info ci LIMIT 1)
      AND (p_filter_event_id IS NULL OR ck.event_id = p_filter_event_id)
  ),
  rel_stats AS (
    SELECT COUNT(*)::BIGINT as rel_count,
      ARRAY_AGG(DISTINCT ke2.name) FILTER (WHERE ke2.name IS NOT NULL) as related_names
    FROM kg_edges edg
    JOIN kg_entities ke2 ON (
      (edg.source_entity_id = p_company_entity_id AND ke2.id = edg.target_entity_id)
      OR (edg.target_entity_id = p_company_entity_id AND ke2.id = edg.source_entity_id)
    )
    WHERE edg.event_id = COALESCE(p_filter_event_id, (SELECT ci.event_id FROM company_info ci LIMIT 1))
      AND ke2.entity_type = 'company'
  )
  SELECT ci.id, ci.name, ci.properties,
    COALESCE(ds.doc_count, 0), COALESCE(ds.doc_ids, ARRAY[]::UUID[]),
    COALESCE(cs.conn_count, 0), COALESCE(cs.conn_ids, ARRAY[]::UUID[]),
    COALESCE(ks.kpi_cnt, 0), COALESCE(ks.kpi_agg, '{}'::jsonb),
    COALESCE(rs.rel_count, 0), COALESCE(rs.related_names, ARRAY[]::TEXT[])
  FROM company_info ci
  CROSS JOIN doc_stats ds CROSS JOIN conn_stats cs
  CROSS JOIN kpi_stats ks CROSS JOIN rel_stats rs;
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────
-- Update function for editable card fields
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_company_card_properties(p_entity_id UUID, p_new_properties JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE kg_entities
  SET properties = COALESCE(properties, '{}'::jsonb) || p_new_properties, updated_at = NOW()
  WHERE id = p_entity_id AND entity_type = 'company';
END;
$$ LANGUAGE plpgsql;

-- Index
CREATE INDEX IF NOT EXISTS idx_kg_entities_company_normalized ON kg_entities(normalized_name, entity_type) 
  WHERE entity_type = 'company';
