-- Allow documents to be linked to multiple folders

CREATE TABLE IF NOT EXISTS document_folder_links (
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES source_folders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (document_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_document_folder_links_document_id ON document_folder_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_folder_links_folder_id ON document_folder_links(folder_id);

-- Backfill existing single-folder assignments
INSERT INTO document_folder_links (document_id, folder_id, created_by)
SELECT id, folder_id, created_by
FROM documents
WHERE folder_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE document_folder_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org document folders" ON document_folder_links;
DROP POLICY IF EXISTS "Users can manage org document folders" ON document_folder_links;

CREATE POLICY "Users can view org document folders"
  ON document_folder_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN events e ON e.id = d.event_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE d.id = document_folder_links.document_id
        AND up.organization_id = e.organization_id
    )
  );

CREATE POLICY "Users can manage org document folders"
  ON document_folder_links FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN events e ON e.id = d.event_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE d.id = document_folder_links.document_id
        AND (
          d.created_by = auth.uid()
          OR (up.role = 'organizer' AND up.organization_id = e.organization_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN events e ON e.id = d.event_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE d.id = document_folder_links.document_id
        AND (
          d.created_by = auth.uid()
          OR (up.role = 'organizer' AND up.organization_id = e.organization_id)
        )
    )
  );
