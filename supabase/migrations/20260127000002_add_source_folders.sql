-- Add source folders for per-member organization of documents

CREATE TABLE IF NOT EXISTS source_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_folders_event_id ON source_folders(event_id);
CREATE INDEX IF NOT EXISTS idx_source_folders_created_by ON source_folders(created_by);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES source_folders(id) ON DELETE SET NULL;

ALTER TABLE source_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org folders" ON source_folders;
DROP POLICY IF EXISTS "Users can manage own folders" ON source_folders;

CREATE POLICY "Users can view org folders"
  ON source_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = source_folders.event_id
      )
    )
  );

CREATE POLICY "Users can manage own folders"
  ON source_folders FOR ALL
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = source_folders.event_id
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = source_folders.event_id
      )
    )
  );
