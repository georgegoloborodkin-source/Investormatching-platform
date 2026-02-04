-- Company connections table for tracking relationships between companies/sources
-- Similar to Nick's note_connections but adapted for VC workflow

CREATE TABLE IF NOT EXISTS company_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  
  -- Source and target companies (references documents/sources)
  source_company_name TEXT NOT NULL,
  target_company_name TEXT NOT NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  target_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  
  -- Connection metadata
  connection_type TEXT NOT NULL DEFAULT 'BD' CHECK (connection_type IN ('BD', 'INV', 'Knowledge', 'Partnership', 'Portfolio')),
  connection_status TEXT NOT NULL DEFAULT 'To Connect' CHECK (connection_status IN ('To Connect', 'Connected', 'Rejected', 'In Progress', 'Completed')),
  
  -- Context from AI chat
  ai_reasoning TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view connections in their events"
  ON company_connections FOR SELECT
  USING (event_id IN (
    SELECT id FROM events WHERE fund_id IN (
      SELECT fund_id FROM user_fund_memberships WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create connections in their events"
  ON company_connections FOR INSERT
  WITH CHECK (event_id IN (
    SELECT id FROM events WHERE fund_id IN (
      SELECT fund_id FROM user_fund_memberships WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update connections in their events"
  ON company_connections FOR UPDATE
  USING (event_id IN (
    SELECT id FROM events WHERE fund_id IN (
      SELECT fund_id FROM user_fund_memberships WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete connections in their events"
  ON company_connections FOR DELETE
  USING (event_id IN (
    SELECT id FROM events WHERE fund_id IN (
      SELECT fund_id FROM user_fund_memberships WHERE user_id = auth.uid()
    )
  ));

-- Indexes for performance
CREATE INDEX idx_company_connections_event_id ON company_connections(event_id);
CREATE INDEX idx_company_connections_source ON company_connections(source_company_name);
CREATE INDEX idx_company_connections_target ON company_connections(target_company_name);
CREATE INDEX idx_company_connections_status ON company_connections(connection_status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_company_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_company_connections_updated_at
  BEFORE UPDATE ON company_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_company_connections_updated_at();
