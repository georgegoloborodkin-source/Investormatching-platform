-- Support both 1024 (Voyage) and 1536 (OpenAI) embedding dimensions
-- Update table to support variable dimensions (PostgreSQL vector supports this)

-- First, update the embedding column to support variable dimensions
-- Note: We can't directly change VECTOR(1536) to VECTOR without dropping/recreating
-- So we'll create a new column and migrate, or use a UNION approach in functions

-- Create a function that accepts 1024-dimension embeddings (Voyage finance-2)
CREATE OR REPLACE FUNCTION match_document_chunks_1024(
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
    1 - (de.embedding <=> query_embedding::vector) AS similarity,
    de.chunk_text,
    de.parent_text
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE d.event_id = filter_event_id
  ORDER BY de.embedding <=> query_embedding::vector
  LIMIT match_count;
$$;

-- Also create a version that accepts 1536 (for OpenAI/backward compatibility)
CREATE OR REPLACE FUNCTION match_document_chunks_1536(
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
    AND vector_dims(de.embedding) = 1536
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Keep the original function for backward compatibility (defaults to 1536)
-- But make it smarter: try to cast to the right dimension
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
    AND vector_dims(de.embedding) = 1536
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;
