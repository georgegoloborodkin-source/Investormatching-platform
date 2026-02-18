-- Gmail Integration: extend documents, sync_configurations, add email tables
-- Enables reading, storing and searching emails from venture firm Gmail inboxes.

-- 1. Add Gmail-specific columns to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_labels TEXT[],
  ADD COLUMN IF NOT EXISTS email_from TEXT,
  ADD COLUMN IF NOT EXISTS email_to TEXT[],
  ADD COLUMN IF NOT EXISTS email_cc TEXT[],
  ADD COLUMN IF NOT EXISTS email_subject TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_has_attachments BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_gmail_message_id
  ON documents(gmail_message_id) WHERE gmail_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_gmail_thread_id
  ON documents(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- 2. Widen documents.source_type to include 'gmail'
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_type_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_source_type_check
  CHECK (source_type IN ('upload', 'paste', 'api', 'google_drive', 'gmail'));

-- 3. Add 'gmail' to sync_configurations.source_type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_configurations') THEN
    ALTER TABLE sync_configurations DROP CONSTRAINT IF EXISTS sync_configurations_source_type_check;
    ALTER TABLE sync_configurations
      ADD CONSTRAINT sync_configurations_source_type_check
      CHECK (source_type IN ('clickup', 'google_drive', 'gmail'));

    -- Also update the unique constraint to allow per-type configs (gmail + google_drive for same event)
    ALTER TABLE sync_configurations DROP CONSTRAINT IF EXISTS unique_sync_config;
    ALTER TABLE sync_configurations
      ADD CONSTRAINT unique_sync_config UNIQUE (organization_id, event_id, source_type);
  END IF;
END $$;

-- 4. New table: email_attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  gmail_attachment_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, gmail_attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_doc ON email_attachments(document_id);

ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_attachments' AND policyname = 'Users can view email attachments via document') THEN
    CREATE POLICY "Users can view email attachments via document"
      ON email_attachments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM documents d
          JOIN events e ON e.id = d.event_id
          JOIN user_profiles up ON up.organization_id = e.organization_id
          WHERE d.id = email_attachments.document_id
          AND up.id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. New table: email_threads (conversation grouping)
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  participants TEXT[],
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_email_threads_event ON email_threads(event_id);

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_threads' AND policyname = 'Users can view email threads in their org') THEN
    CREATE POLICY "Users can view email threads in their org"
      ON email_threads FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM events e
          JOIN user_profiles up ON up.organization_id = e.organization_id
          WHERE e.id = email_threads.event_id
          AND up.id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_threads' AND policyname = 'Org members can manage email threads') THEN
    CREATE POLICY "Org members can manage email threads"
      ON email_threads FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM events e
          JOIN user_profiles up ON up.organization_id = e.organization_id
          WHERE e.id = email_threads.event_id
          AND up.id = auth.uid()
        )
      );
  END IF;
END $$;
