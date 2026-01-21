-- CIS documents storage + link to decisions

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT,
  source_type TEXT DEFAULT 'upload' CHECK (source_type IN ('upload', 'paste', 'api')),
  file_name TEXT,
  detected_type TEXT,
  extracted_json JSONB,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_event_id ON documents(event_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);

-- Link decisions -> documents
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org documents" ON documents;
DROP POLICY IF EXISTS "Users can manage own documents" ON documents;

CREATE POLICY "Users can view org documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = documents.event_id
      )
    )
  );

CREATE POLICY "Users can manage own documents"
  ON documents FOR ALL
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = documents.event_id
      )
    )
  );

