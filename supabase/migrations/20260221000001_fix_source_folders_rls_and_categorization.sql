-- Fix 1: 403 on source_folders INSERT
-- The "Users can manage own folders" policy only allows organizer role.
-- managing_partner and other org members are blocked from creating folders.
-- Solution: Allow ALL org members to INSERT folders for their org's events.

DROP POLICY IF EXISTS "Org members can insert folders" ON source_folders;
CREATE POLICY "Org members can insert folders"
  ON source_folders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = source_folders.event_id
      )
    )
  );

-- Also allow org members to DELETE folders (not just organizer)
DROP POLICY IF EXISTS "Org members can delete folders" ON source_folders;
CREATE POLICY "Org members can delete folders"
  ON source_folders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = source_folders.event_id
      )
    )
  );

-- Fix 2: Update the DB-side ensure_default_folders function to include
-- BD and Mentors/Corporates folders, AND set category column
CREATE OR REPLACE FUNCTION ensure_default_folders_for_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_folder_exists BOOLEAN;
  v_defaults CONSTANT TEXT[][] := ARRAY[
    ARRAY['Portfolio Companies', 'Portfolio Companies'],
    ARRAY['Investors', 'Funds'],
    ARRAY['Funds', 'Funds'],
    ARRAY['Deals', 'Sourcing'],
    ARRAY['Market Research', 'Sourcing'],
    ARRAY['Due Diligence', 'Portfolio Companies'],
    ARRAY['BD', 'BD'],
    ARRAY['Mentors / Corporates', 'Mentors / Corporates']
  ];
  i INT;
BEGIN
  FOR i IN 1..array_length(v_defaults, 1) LOOP
    SELECT EXISTS (
      SELECT 1 FROM source_folders
      WHERE event_id = p_event_id
      AND LOWER(name) = LOWER(v_defaults[i][1])
    ) INTO v_folder_exists;

    IF NOT v_folder_exists THEN
      INSERT INTO source_folders (event_id, name, created_by, category)
      VALUES (p_event_id, v_defaults[i][1], NULL, v_defaults[i][2])
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Backfill: ensure BD and Mentors/Corporates folders exist for all events
DO $$
DECLARE
  v_event_id UUID;
BEGIN
  FOR v_event_id IN SELECT id FROM events LOOP
    PERFORM ensure_default_folders_for_event(v_event_id);
  END LOOP;
END $$;

-- Fix 3: Backfill categories for any folders missing them
UPDATE source_folders SET category = 'BD'
WHERE lower(name) IN ('bd', 'business development') AND (category IS NULL OR category = 'Portfolio Companies');

UPDATE source_folders SET category = 'Mentors / Corporates'
WHERE lower(name) IN ('mentors / corporates', 'mentors', 'corporates', 'organizations', 'mentors/corporates')
AND (category IS NULL OR category = 'Portfolio Companies');

UPDATE source_folders SET category = 'Sourcing'
WHERE lower(name) IN ('sourcing', 'deals', 'market research', 'deal flow', 'pipeline')
AND (category IS NULL OR category = 'Portfolio Companies');

UPDATE source_folders SET category = 'Funds'
WHERE lower(name) IN ('funds', 'investors', 'lps', 'limited partners')
AND (category IS NULL OR category = 'Portfolio Companies');
