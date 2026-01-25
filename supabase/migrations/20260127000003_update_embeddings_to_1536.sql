-- Update embeddings to support OpenAI (1536 dimensions) instead of Ollama (768)
-- This migration updates the schema to support OpenAI embeddings

-- Drop existing index (will recreate with new dimension)
DROP INDEX IF EXISTS idx_document_embeddings_embedding;

-- Drop existing function
DROP FUNCTION IF EXISTS match_documents(VECTOR(768), INT, UUID);

-- Update embedding column to 1536 dimensions (OpenAI text-embedding-3-small)
-- Note: This will fail if there are existing embeddings with 768 dimensions
-- In that case, you may need to drop and recreate the table
ALTER TABLE document_embeddings 
  ALTER COLUMN embedding TYPE VECTOR(1536);

-- Recreate index with new dimension
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding 
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Recreate function with 1536 dimensions
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
