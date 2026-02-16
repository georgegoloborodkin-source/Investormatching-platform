-- Team members join by organization invitation code (not fund code).
-- MDs use join_fund_by_code (fund_codes table); team members use this (organizations.invitation_code).

CREATE OR REPLACE FUNCTION public.join_org_by_invitation_code(code_param text)
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

  -- Find organization by invitation code (the code the MD shares with the team)
  SELECT * INTO org_record
  FROM organizations
  WHERE organizations.invitation_code = UPPER(TRIM(code_param));

  IF org_record IS NULL THEN
    RAISE EXCEPTION 'invalid invitation code';
  END IF;

  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization';
  END IF;

  IF user_profile.role != 'team_member' THEN
    RAISE EXCEPTION 'only team members can join via invitation code';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM removed_team_members
    WHERE organization_id = org_record.id
    AND user_id = auth.uid()
  ) INTO was_removed;

  IF was_removed THEN
    RAISE EXCEPTION 'you were previously removed from this organization. Please contact a managing partner to be re-invited.';
  END IF;

  UPDATE user_profiles
  SET organization_id = org_record.id
  WHERE id = auth.uid();

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

GRANT EXECUTE ON FUNCTION public.join_org_by_invitation_code(text) TO authenticated;
COMMENT ON FUNCTION public.join_org_by_invitation_code(text) IS 'Team members use this to join a fund using the invitation code from their Managing Partner.';
