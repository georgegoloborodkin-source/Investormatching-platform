-- Scoped version of match_document_chunks that filters by folder_ids at the DB level.
-- When filter_folder_ids is NULL or empty, behaves like the original (no folder filter).
-- When provided, only returns chunks from documents that belong to those folders
-- (via documents.folder_id OR document_folder_links).

CREATE OR REPLACE FUNCTION match_document_chunks_scoped(
  query_embedding VECTOR(1536),
  match_count INT,
  filter_event_id UUID,
  filter_folder_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  similarity FLOAT,
  chunk_text TEXT,
  parent_text TEXT,
  parent_index INT,
  child_index INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    de.document_id,
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.chunk_text,
    de.parent_text,
    de.parent_index,
    de.child_index
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE d.event_id = filter_event_id
    AND (
      filter_folder_ids IS NULL
      OR array_length(filter_folder_ids, 1) IS NULL
      OR d.folder_id = ANY(filter_folder_ids)
      OR EXISTS (
        SELECT 1 FROM document_folder_links dfl
        WHERE dfl.document_id = d.id
          AND dfl.folder_id = ANY(filter_folder_ids)
      )
    )
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Helper: resolve folder_ids → document_ids in one query
CREATE OR REPLACE FUNCTION resolve_scoped_document_ids(
  p_event_id UUID,
  p_folder_ids UUID[]
)
RETURNS UUID[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT doc_id), ARRAY[]::UUID[])
  FROM (
    SELECT d.id AS doc_id
    FROM documents d
    WHERE d.event_id = p_event_id
      AND d.folder_id = ANY(p_folder_ids)
    UNION
    SELECT dfl.document_id AS doc_id
    FROM document_folder_links dfl
    JOIN documents d ON d.id = dfl.document_id
    WHERE d.event_id = p_event_id
      AND dfl.folder_id = ANY(p_folder_ids)
  ) sub;
$$;

-- Helper: resolve folder_ids → entity_ids (companies with docs in those folders)
CREATE OR REPLACE FUNCTION resolve_scoped_entity_ids(
  p_event_id UUID,
  p_folder_ids UUID[]
)
RETURNS UUID[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT entity_id), ARRAY[]::UUID[])
  FROM (
    SELECT d.company_entity_id AS entity_id
    FROM documents d
    WHERE d.event_id = p_event_id
      AND d.company_entity_id IS NOT NULL
      AND d.folder_id = ANY(p_folder_ids)
    UNION
    SELECT d.company_entity_id AS entity_id
    FROM document_folder_links dfl
    JOIN documents d ON d.id = dfl.document_id
    WHERE d.event_id = p_event_id
      AND d.company_entity_id IS NOT NULL
      AND dfl.folder_id = ANY(p_folder_ids)
  ) sub;
$$;
