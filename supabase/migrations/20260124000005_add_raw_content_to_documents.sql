-- Add raw_content column to documents table for storing original text

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS raw_content TEXT;

-- Add index for full-text search (optional, but useful)
CREATE INDEX IF NOT EXISTS idx_documents_raw_content_gin ON documents USING gin(to_tsvector('english', raw_content))
WHERE raw_content IS NOT NULL;