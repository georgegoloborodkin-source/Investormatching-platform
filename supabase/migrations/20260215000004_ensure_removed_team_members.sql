-- Ensure removed_team_members exists (may be missing if 20260129000006 was skipped).
-- Required by join_fund_by_code and join_org_by_invitation_code.

CREATE TABLE IF NOT EXISTS removed_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  removed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  removed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  CONSTRAINT unique_removed_member UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_removed_members_org ON removed_team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_removed_members_user ON removed_team_members(user_id);

ALTER TABLE removed_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MDs can view removed members" ON removed_team_members;
CREATE POLICY "MDs can view removed members"
  ON removed_team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = removed_team_members.organization_id
      AND user_profiles.role IN ('managing_partner', 'organizer')
    )
  );

DROP POLICY IF EXISTS "MDs can track removed members" ON removed_team_members;
CREATE POLICY "MDs can track removed members"
  ON removed_team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = removed_team_members.organization_id
      AND user_profiles.role IN ('managing_partner', 'organizer')
    )
    AND removed_by = auth.uid()
  );

COMMENT ON TABLE removed_team_members IS 'Tracks users who were removed from organizations to prevent them from rejoining via invitation codes.';
