-- Switch embeddings to 1024 dimensions (Voyage models like voyage-3)

-- Drop existing index (will recreate with new dimension)
DROP INDEX IF EXISTS idx_document_embeddings_embedding;

-- Drop existing functions
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(1536), INT, UUID);
DROP FUNCTION IF EXISTS match_documents(VECTOR(1536), INT, UUID);

-- Update embedding column to 1024 dimensions
-- NOTE: This will fail if there are existing embeddings with 1536 dimensions.
-- In that case, delete and re-embed documents after this migration.
ALTER TABLE document_embeddings
  ALTER COLUMN embedding TYPE VECTOR(1024);

-- Recreate index with new dimension
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Recreate function with 1024 dimensions
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1024),
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

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1024),
  match_count INT,
  filter_event_id UUID
)
RETURNS TABLE (
  document_id UUID,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT de.document_id,
         1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE d.event_id = filter_event_id
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;
