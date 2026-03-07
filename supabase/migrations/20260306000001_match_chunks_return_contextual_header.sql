-- Return contextual_header from match_document_chunks and match_document_chunks_scoped
-- so retrieval can include it in document context (column exists from add_structured_kpis).
-- Must DROP first because return type (OUT parameters) is changing.

DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(1536), INT, UUID);
DROP FUNCTION IF EXISTS match_document_chunks_scoped(VECTOR(1536), INT, UUID, UUID[]);

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_count INT,
  filter_event_id UUID
)
RETURNS TABLE (
  document_id UUID,
  similarity FLOAT,
  chunk_text TEXT,
  parent_text TEXT,
  parent_index INT,
  child_index INT,
  contextual_header TEXT
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
    de.child_index,
    de.contextual_header
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE d.event_id = filter_event_id
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

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
  child_index INT,
  contextual_header TEXT
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
    de.child_index,
    de.contextual_header
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
