-- Improve invitation system: prevent removed users from rejoining
-- Track removed users and enhance join_fund_by_code

-- Create table to track removed users (blacklist)
CREATE TABLE IF NOT EXISTS removed_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  removed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  removed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  
  -- Prevent duplicate entries
  CONSTRAINT unique_removed_member UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_removed_members_org ON removed_team_members(organization_id);
CREATE INDEX idx_removed_members_user ON removed_team_members(user_id);

-- Enable RLS
ALTER TABLE removed_team_members ENABLE ROW LEVEL SECURITY;

-- MDs can view removed members for their org
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

-- MDs can insert removed members
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

-- Update remove_team_member RPC to track removed users
CREATE OR REPLACE FUNCTION public.remove_team_member(member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role text;
  current_user_org_id uuid;
  member_org_id uuid;
  member_role text;
  result jsonb;
BEGIN
  -- Get current user's role and organization
  SELECT role, organization_id INTO current_user_role, current_user_org_id
  FROM public.user_profiles
  WHERE id = auth.uid();
  
  -- Check if current user is MD or organizer
  IF current_user_role NOT IN ('managing_partner', 'organizer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only managing partners and organizers can remove team members'
    );
  END IF;
  
  IF current_user_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You must belong to an organization to remove team members'
    );
  END IF;
  
  -- Get member's organization and role
  SELECT organization_id, role INTO member_org_id, member_role
  FROM public.user_profiles
  WHERE id = member_id;
  
  -- Check if member exists
  IF member_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Team member not found or already removed'
    );
  END IF;
  
  -- Check if member is in the same organization
  IF member_org_id != current_user_org_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Team member is not in your organization'
    );
  END IF;
  
  -- Prevent removing other MDs/organizers (only allow removing team_member role)
  -- MDs can remove other MDs/organizers, but let's be explicit
  IF member_role IN ('managing_partner', 'organizer') AND current_user_role != 'managing_partner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only managing partners can remove other administrators'
    );
  END IF;
  
  -- Prevent removing yourself
  IF member_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You cannot remove yourself from the organization'
    );
  END IF;
  
  -- Track removed member BEFORE removing (so we have the org_id)
  INSERT INTO removed_team_members (organization_id, user_id, removed_by, reason)
  VALUES (current_user_org_id, member_id, auth.uid(), 'Removed by ' || current_user_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET removed_at = NOW(), removed_by = auth.uid();
  
  -- Remove the member by setting organization_id to null
  UPDATE public.user_profiles
  SET organization_id = NULL
  WHERE id = member_id
  AND organization_id = current_user_org_id;
  
  -- Check if update succeeded
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to remove team member'
    );
  END IF;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Team member removed successfully'
  );
END;
$$;

-- Update join_fund_by_code to check if user was previously removed
CREATE OR REPLACE FUNCTION public.join_fund_by_code(code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record public.organizations;
  user_profile public.user_profiles;
  was_removed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Find organization by code
  SELECT * INTO org_record
  FROM organizations
  WHERE organizations.invitation_code = UPPER(code_param);

  IF org_record IS NULL THEN
    RAISE EXCEPTION 'invalid invitation code';
  END IF;

  -- Get user profile
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  -- Check user doesn't already belong to an org
  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization';
  END IF;

  -- Check user is team_member
  IF user_profile.role != 'team_member' THEN
    RAISE EXCEPTION 'only team members can join via invitation code';
  END IF;

  -- Check if user was previously removed from this organization
  SELECT EXISTS (
    SELECT 1 FROM removed_team_members
    WHERE organization_id = org_record.id
    AND user_id = auth.uid()
  ) INTO was_removed;

  IF was_removed THEN
    RAISE EXCEPTION 'you were previously removed from this organization. Please contact a managing partner to be re-invited.';
  END IF;

  -- Link user to organization
  UPDATE user_profiles
  SET organization_id = org_record.id
  WHERE id = auth.uid();

  -- Remove from blacklist if they were there (in case of re-invitation via email)
  DELETE FROM removed_team_members
  WHERE organization_id = org_record.id
  AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', org_record.id,
    'organization', jsonb_build_object(
      'id', org_record.id,
      'name', org_record.name,
      'slug', org_record.slug
    )
  );
END;
$$;

-- Add comment
COMMENT ON TABLE removed_team_members IS 'Tracks users who were removed from organizations to prevent them from rejoining via invitation codes';
