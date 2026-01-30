-- Add sync configurations table for auto-syncing ClickUp and Google Drive

CREATE TABLE IF NOT EXISTS sync_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('clickup', 'google_drive')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- {clickup_list_id, google_drive_folder_id, sync_frequency, etc.}
  sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'pending')),
  last_sync_error TEXT,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_sync_config UNIQUE (organization_id, event_id, source_type)
);

CREATE INDEX idx_sync_configs_org ON sync_configurations(organization_id);
CREATE INDEX idx_sync_configs_event ON sync_configurations(event_id);
CREATE INDEX idx_sync_configs_next_sync ON sync_configurations(next_sync_at) WHERE is_active = true;

-- Enable RLS
ALTER TABLE sync_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Sync Configurations
-- Users can view sync configs for their organization
CREATE POLICY "Users can view org sync configs"
  ON sync_configurations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = sync_configurations.organization_id
    )
  );

-- MD/organizer can create/update sync configs
CREATE POLICY "MD can manage sync configs"
  ON sync_configurations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = sync_configurations.organization_id
      AND user_profiles.role IN ('managing_partner', 'organizer')
    )
  );

-- Function to update updated_at
CREATE TRIGGER update_sync_configs_updated_at BEFORE UPDATE ON sync_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
