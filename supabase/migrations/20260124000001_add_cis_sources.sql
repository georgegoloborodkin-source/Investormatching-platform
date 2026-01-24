-- CIS sources tracking (syndicates, companies, notes, decks)

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT,
  source_type TEXT DEFAULT 'other' CHECK (source_type IN ('syndicate', 'company', 'deck', 'notes', 'other')),
  external_url TEXT,
  storage_path TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_event_id ON sources(event_id);
CREATE INDEX IF NOT EXISTS idx_sources_created_by ON sources(created_by);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org sources" ON sources;
DROP POLICY IF EXISTS "Users can manage own sources" ON sources;

CREATE POLICY "Users can view org sources"
  ON sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = sources.event_id
      )
    )
  );

CREATE POLICY "Users can manage own sources"
  ON sources FOR ALL
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = sources.event_id
      )
    )
  );


