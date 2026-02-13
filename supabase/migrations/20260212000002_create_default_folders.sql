-- Create default folders for all events: Portfolio Companies, Investors, etc.
-- These folders enable folder-based auto-card creation

-- Function to ensure default folders exist for an event
CREATE OR REPLACE FUNCTION ensure_default_folders_for_event(p_event_id UUID)
RETURNS VOID AS $$
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
  -- Loop through each default folder name
  FOREACH v_folder_name IN ARRAY v_folder_names
  LOOP
    -- Check if folder already exists for this event
    SELECT EXISTS (
      SELECT 1 FROM source_folders
      WHERE event_id = p_event_id
      AND LOWER(name) = LOWER(v_folder_name)
    ) INTO v_folder_exists;
    
    -- Create folder if it doesn't exist
    IF NOT v_folder_exists THEN
      INSERT INTO source_folders (event_id, name, created_by)
      VALUES (p_event_id, v_folder_name, NULL)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Auto-create default folders when a new event is created
CREATE OR REPLACE FUNCTION create_default_folders_on_event_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default folders for the new event
  PERFORM ensure_default_folders_for_event(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on events table
DROP TRIGGER IF EXISTS trigger_create_default_folders ON events;
CREATE TRIGGER trigger_create_default_folders
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_default_folders_on_event_insert();

-- Backfill: Create default folders for all existing events
DO $$
DECLARE
  v_event_id UUID;
BEGIN
  FOR v_event_id IN SELECT id FROM events
  LOOP
    PERFORM ensure_default_folders_for_event(v_event_id);
  END LOOP;
END $$;

-- Add comment explaining the default folders
COMMENT ON FUNCTION ensure_default_folders_for_event IS 'Creates default folders (Portfolio Companies, Investors, Funds, Deals, Market Research, Due Diligence) for an event if they do not already exist. Used for folder-based auto-card creation.';
