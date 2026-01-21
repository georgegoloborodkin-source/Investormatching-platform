-- CIS decision logs

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  startup_name TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  confidence_score INTEGER,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_event_id ON decisions(event_id);
CREATE INDEX IF NOT EXISTS idx_decisions_actor_id ON decisions(actor_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_decisions_updated_at ON decisions;
CREATE TRIGGER update_decisions_updated_at BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org decisions" ON decisions;
DROP POLICY IF EXISTS "Users can manage own decisions" ON decisions;

CREATE POLICY "Users can view org decisions"
  ON decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = decisions.event_id
      )
    )
  );

CREATE POLICY "Users can manage own decisions"
  ON decisions FOR ALL
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = decisions.event_id
      )
    )
  );

