-- Fix: default folder creation trigger fails RLS when a new user creates their first event.
-- The trigger runs as the invoking user; inserts into source_folders had created_by = NULL
-- and were blocked by "Users can manage own folders". Run the trigger function as DEFINER
-- so the system insert bypasses RLS.

CREATE OR REPLACE FUNCTION ensure_default_folders_for_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_names TEXT[] := ARRAY[
    'Portfolio Companies',
    'Investors',
    'Funds',
    'Deals',
    'Market Research',
    'Due Diligence'
  ];
  v_folder_name TEXT;
  v_folder_exists BOOLEAN;
BEGIN
  FOREACH v_folder_name IN ARRAY v_folder_names
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM source_folders
      WHERE event_id = p_event_id
      AND LOWER(name) = LOWER(v_folder_name)
    ) INTO v_folder_exists;

    IF NOT v_folder_exists THEN
      INSERT INTO source_folders (event_id, name, created_by)
      VALUES (p_event_id, v_folder_name, NULL)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION ensure_default_folders_for_event IS 'Creates default folders for an event if they do not already exist. SECURITY DEFINER so trigger can insert despite RLS on source_folders.';
