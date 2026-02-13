-- Update embeddings to 1536 dimensions for voyage-large-2 model
-- This migration updates the schema to support voyage-large-2 (1536 dimensions)

-- Drop existing index (will recreate with new dimension)
DROP INDEX IF EXISTS idx_document_embeddings_embedding;

-- Drop existing functions
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(1024), INT, UUID);
DROP FUNCTION IF EXISTS match_document_chunks(VECTOR(768), INT, UUID);
DROP FUNCTION IF EXISTS match_documents(VECTOR(1024), INT, UUID);
DROP FUNCTION IF EXISTS match_documents(VECTOR(768), INT, UUID);

-- Update embedding column to 1536 dimensions (voyage-large-2)
-- NOTE: This will fail if there are existing embeddings with different dimensions.
-- In that case, you may need to delete existing embeddings and re-embed documents.
ALTER TABLE document_embeddings
  ALTER COLUMN embedding TYPE VECTOR(1536);

-- Recreate index with new dimension
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Recreate function with 1536 dimensions
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
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
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
