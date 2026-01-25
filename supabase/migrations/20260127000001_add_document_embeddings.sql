-- Enable pgvector + document embeddings for semantic search

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT,
  embedding VECTOR(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org embeddings" ON document_embeddings;
DROP POLICY IF EXISTS "Users can insert org embeddings" ON document_embeddings;

CREATE POLICY "Users can view org embeddings"
  ON document_embeddings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN events e ON e.id = d.event_id
      JOIN user_profiles up ON up.organization_id = e.organization_id
      WHERE d.id = document_embeddings.document_id
      AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org embeddings"
  ON document_embeddings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN events e ON e.id = d.event_id
      JOIN user_profiles up ON up.organization_id = e.organization_id
      WHERE d.id = document_embeddings.document_id
      AND up.id = auth.uid()
    )
  );

-- Semantic search helper: match documents by embedding
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768),
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
