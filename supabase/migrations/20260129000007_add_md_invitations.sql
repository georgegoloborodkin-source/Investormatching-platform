-- Allow MDs to invite other MDs via email invitations
-- Extend invitations system to support managing_partner role

-- Update invitations table to allow managing_partner role
ALTER TABLE invitations 
  DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_role_check 
  CHECK (role IN ('team_member', 'organizer', 'managing_partner'));

-- Update accept_invitation RPC to handle MD invitations
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_record invitations;
  user_email text;
  user_profile user_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'user email not found';
  END IF;

  -- Get user profile to check current state
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  -- Check if user already belongs to an organization
  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization. Please leave your current organization first.';
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

  -- Check if user was previously removed from this organization
  IF EXISTS (
    SELECT 1 FROM removed_team_members
    WHERE organization_id = inv_record.organization_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'you were previously removed from this organization. Please contact a managing partner to be re-invited.';
  END IF;

  -- Update user profile with organization and role
  UPDATE user_profiles
  SET organization_id = inv_record.organization_id,
      role = inv_record.role
  WHERE id = auth.uid();

  -- Mark invitation as accepted
  UPDATE invitations
  SET accepted_at = NOW()
  WHERE id = inv_record.id;

  -- Remove from blacklist if they were there (in case of re-invitation)
  DELETE FROM removed_team_members
  WHERE organization_id = inv_record.organization_id
  AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', inv_record.organization_id,
    'role', inv_record.role
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.accept_invitation(text) IS 'Accepts an invitation and assigns the user to the organization with the specified role. Supports team_member, organizer, and managing_partner roles.';
