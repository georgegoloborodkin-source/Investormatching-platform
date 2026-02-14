-- Add Google Drive sync tracking columns to documents table
-- Enables dedup & change detection for folder-based Drive sync

-- 1. Add Drive-specific columns
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_modified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documents_gdrive_file_id
  ON documents(google_drive_file_id)
  WHERE google_drive_file_id IS NOT NULL;

-- 2. Widen the source_type CHECK to include 'google_drive'
--    Current constraint: ('upload', 'paste', 'api')
--    We drop the old check and add a new one that also allows 'google_drive'.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_type_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_source_type_check
  CHECK (source_type IN ('upload', 'paste', 'api', 'google_drive'));

-- 3. Update sync_configurations.sync_frequency to include 'on_login' (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_configurations') THEN
    ALTER TABLE sync_configurations DROP CONSTRAINT IF EXISTS sync_configurations_sync_frequency_check;
    ALTER TABLE sync_configurations
      ADD CONSTRAINT sync_configurations_sync_frequency_check
      CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual', 'on_login'));
  END IF;
END $$;
