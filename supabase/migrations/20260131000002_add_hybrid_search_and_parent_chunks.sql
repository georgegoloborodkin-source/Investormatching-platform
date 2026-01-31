-- Add parent/child chunk metadata for parent-child retrieval
ALTER TABLE document_embeddings
  ADD COLUMN IF NOT EXISTS parent_text TEXT,
  ADD COLUMN IF NOT EXISTS parent_index INT,
  ADD COLUMN IF NOT EXISTS child_index INT;

-- Semantic search helper: return chunk + parent text for matched embeddings
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_count INT,
  filter_event_id UUID
)
RETURNS TABLE (
  document_id UUID,
  similarity FLOAT,
  chunk_text TEXT,
  parent_text TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    de.document_id,
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.chunk_text,
    de.parent_text
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE d.event_id = filter_event_id
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Keyword search helper: match documents with full-text ranking
CREATE OR REPLACE FUNCTION match_documents_keyword(
  query_text TEXT,
  match_count INT,
  filter_event_id UUID
)
RETURNS TABLE (
  document_id UUID,
  rank FLOAT,
  snippet TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id AS document_id,
    ts_rank_cd(
      to_tsvector('english', COALESCE(d.raw_content, '')),
      websearch_to_tsquery('english', query_text)
    ) AS rank,
    ts_headline(
      'english',
      COALESCE(d.raw_content, ''),
      websearch_to_tsquery('english', query_text),
      'MaxWords=50, MinWords=20, ShortWord=3, HighlightAll=false'
    ) AS snippet
  FROM documents d
  WHERE d.event_id = filter_event_id
    AND to_tsvector('english', COALESCE(d.raw_content, '')) @@ websearch_to_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
