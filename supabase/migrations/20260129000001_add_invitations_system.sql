-- Add invitations system for team member onboarding

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('team_member', 'organizer')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_pending_invitation UNIQUE (organization_id, email, accepted_at)
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_organization ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Invitations
-- Users can view invitations for their organization (if they're MD/organizer)
CREATE POLICY "MD can view org invitations"
  ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = invitations.organization_id
      AND user_profiles.role IN ('managing_partner', 'organizer')
    )
  );

-- Users can view invitations sent to their email
CREATE POLICY "Users can view own invitations"
  ON invitations FOR SELECT
  USING (
    email = (SELECT email FROM user_profiles WHERE id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- MD/organizer can create invitations
CREATE POLICY "MD can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = invitations.organization_id
      AND user_profiles.role IN ('managing_partner', 'organizer')
    )
    AND invited_by = auth.uid()
  );

-- MD can update invitations (mark as accepted)
CREATE POLICY "MD can update invitations"
  ON invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = invitations.organization_id
      AND user_profiles.role IN ('managing_partner', 'organizer')
    )
  );

-- RPC: Accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_record invitations;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'user email not found';
  END IF;

  -- Find invitation
  SELECT * INTO inv_record
  FROM invitations
  WHERE token = invitation_token
    AND email = user_email
    AND accepted_at IS NULL
    AND expires_at > NOW();

  IF inv_record IS NULL THEN
    RAISE EXCEPTION 'invalid or expired invitation';
  END IF;

  -- Update user profile
  UPDATE user_profiles
  SET organization_id = inv_record.organization_id,
      role = inv_record.role
  WHERE id = auth.uid();

  -- Mark invitation as accepted
  UPDATE invitations
  SET accepted_at = NOW()
  WHERE id = inv_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', inv_record.organization_id,
    'role', inv_record.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- RPC: Create fund (for MD onboarding)
CREATE OR REPLACE FUNCTION public.create_fund_for_md(
  fund_name text,
  fund_slug text,
  fund_type text DEFAULT NULL,
  website text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org public.organizations;
  user_profile public.user_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Check user doesn't already have an org
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'user already belongs to an organization';
  END IF;

  -- Check user is MD
  IF user_profile.role != 'managing_partner' THEN
    RAISE EXCEPTION 'only managing partners can create funds';
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name, slug)
  VALUES (fund_name, fund_slug)
  RETURNING * INTO new_org;

  -- Link user to organization
  UPDATE user_profiles
  SET organization_id = new_org.id
  WHERE id = auth.uid();

  -- Create default event
  INSERT INTO public.events (organization_id, name, status)
  VALUES (new_org.id, 'Main Event', 'active');

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', new_org.id,
    'organization', jsonb_build_object(
      'id', new_org.id,
      'name', new_org.name,
      'slug', new_org.slug
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_fund_for_md(text, text, text, text) TO authenticated;
