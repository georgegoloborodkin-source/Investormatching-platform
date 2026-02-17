-- Allow org members to update source_folders (e.g. category) for folders in their org's events.
-- Fixes 400 when backfilling category: folders created by trigger/sync may have created_by = NULL,
-- so "Users can manage own folders" (created_by = auth.uid()) blocks updates. This policy allows
-- any org member to update folders in their org so category backfill and UI category change work.
ALTER TABLE source_folders ADD COLUMN IF NOT EXISTS category text DEFAULT 'Portfolio Companies';

DROP POLICY IF EXISTS "Org members can update folder category" ON source_folders;
CREATE POLICY "Org members can update folder category"
  ON source_folders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (SELECT organization_id FROM events WHERE events.id = source_folders.event_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (SELECT organization_id FROM events WHERE events.id = source_folders.event_id)
    )
  );
