  -- Fix: "source_company_name is ambiguous" error when approving pending relationship reviews.
  -- The sync_approved_edges_to_connections trigger function used local variable names
  -- (source_company_name, target_company_name, connection_type) that collide with
  -- the column names in company_connections. Renamed variables to v_* to avoid ambiguity.

  CREATE OR REPLACE FUNCTION sync_approved_edges_to_connections()
  RETURNS TRIGGER AS $$
  DECLARE
    v_source_company_name TEXT;
    v_target_company_name TEXT;
    v_connection_type TEXT;
  BEGIN
    -- Only process if review_status changed to 'approved'
    IF NEW.review_status = 'approved' AND (OLD.review_status IS NULL OR OLD.review_status != 'approved') THEN
      -- Get company names from entities
      SELECT 
        se.name,
        te.name,
        map_kg_relation_to_connection_type(NEW.relation_type)
      INTO v_source_company_name, v_target_company_name, v_connection_type
      FROM kg_entities se, kg_entities te
      WHERE se.id = NEW.source_entity_id
        AND te.id = NEW.target_entity_id
        AND se.entity_type = 'company'
        AND te.entity_type = 'company';
      
      -- Only create connection if both are companies
      IF v_source_company_name IS NOT NULL AND v_target_company_name IS NOT NULL THEN
        -- Check if connection already exists
        IF NOT EXISTS (
          SELECT 1 FROM company_connections
          WHERE event_id = NEW.event_id
            AND company_connections.source_company_name = v_source_company_name
            AND company_connections.target_company_name = v_target_company_name
            AND company_connections.connection_type = v_connection_type
        ) THEN
          INSERT INTO company_connections (
            event_id,
            source_company_name,
            target_company_name,
            connection_type,
            connection_status,
            source_document_id,X  
            ai_reasoning,
            created_by
          ) VALUES (
            NEW.event_id,
            v_source_company_name,
            v_target_company_name,
            v_connection_type,
            'To Connect',
            NEW.source_document_id,
            COALESCE((NEW.properties->>'reasoning')::TEXT, 'Auto-extracted from document'),
            NEW.reviewed_by
          );
        END IF;
      END IF;
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
