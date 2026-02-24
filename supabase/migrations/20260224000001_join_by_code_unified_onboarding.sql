-- Unified onboarding: one RPC accepts either fund code (admin-created) or org invitation code.
-- No role check upfront; RPC sets role based on code type so it works even if profile/role is stale.
-- Fixes "invalid fund code" when a different user (MD or team member) enters a valid code.

CREATE OR REPLACE FUNCTION public.join_by_code(code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_normalized text;
  fund_code_record fund_codes;
  user_profile user_profiles;
  existing_org organizations;
  new_org organizations;
  invite_code text;
  was_removed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  code_normalized := UPPER(TRIM(code_param));
  IF code_normalized = '' THEN
    RAISE EXCEPTION 'Please enter a code.';
  END IF;

  -- Ensure profile exists (handles new users / post-wipe)
  INSERT INTO user_profiles (id, email, full_name, role)
  SELECT auth.uid(), u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), 'team_member'
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization';
  END IF;

  -- 1) Try fund code (admin-created): first user creates fund as MD, later users join as MD
  SELECT * INTO fund_code_record
  FROM fund_codes
  WHERE TRIM(code) = code_normalized
    AND is_active = true;

  IF fund_code_record IS NOT NULL THEN
    -- Set role to managing_partner when using a fund code (don't require it upfront)
    UPDATE user_profiles SET role = 'managing_partner' WHERE id = auth.uid();

    IF fund_code_record.used_at IS NOT NULL AND fund_code_record.used_by IS NOT NULL THEN
      -- Join existing fund
      SELECT * INTO existing_org
      FROM organizations
      WHERE id = (SELECT organization_id FROM user_profiles WHERE id = fund_code_record.used_by LIMIT 1);

      IF existing_org IS NULL THEN
        RAISE EXCEPTION 'Fund code was used but organization not found. Contact admin.';
      END IF;

      IF EXISTS (SELECT 1 FROM removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'You were previously removed from this fund. Please contact an admin.';
      END IF;

      UPDATE user_profiles SET organization_id = existing_org.id WHERE id = auth.uid();
      DELETE FROM removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid();

      RETURN jsonb_build_object(
        'success', true,
        'organization_id', existing_org.id,
        'organization', jsonb_build_object('id', existing_org.id, 'name', existing_org.name, 'slug', existing_org.slug),
        'message', 'Joined existing fund',
        'role', 'managing_partner'
      );
    ELSE
      -- First MD: create fund
      LOOP
        invite_code := generate_fund_code(fund_code_record.fund_name);
        IF NOT EXISTS (SELECT 1 FROM organizations WHERE invitation_code = invite_code) THEN
          EXIT;
        END IF;
      END LOOP;

      INSERT INTO organizations (name, slug, invitation_code)
      VALUES (
        fund_code_record.fund_name,
        COALESCE(fund_code_record.fund_slug, slugify(fund_code_record.fund_name)),
        invite_code
      )
      RETURNING * INTO new_org;

      UPDATE user_profiles SET organization_id = new_org.id WHERE id = auth.uid();
      UPDATE fund_codes SET used_at = NOW(), used_by = auth.uid() WHERE id = fund_code_record.id;
      INSERT INTO events (organization_id, name, status) VALUES (new_org.id, 'Main Event', 'active');

      RETURN jsonb_build_object(
        'success', true,
        'organization_id', new_org.id,
        'invitation_code', invite_code,
        'organization', jsonb_build_object(
          'id', new_org.id,
          'name', new_org.name,
          'slug', new_org.slug,
          'invitation_code', invite_code
        ),
        'message', 'Fund created successfully',
        'role', 'managing_partner'
      );
    END IF;
  END IF;

  -- 2) Try organization invitation code (what MD shares with team)
  SELECT * INTO existing_org
  FROM organizations
  WHERE invitation_code = code_normalized;

  IF existing_org IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM removed_team_members
      WHERE organization_id = existing_org.id AND user_id = auth.uid()
    ) INTO was_removed;

    IF was_removed THEN
      RAISE EXCEPTION 'You were previously removed from this organization. Please contact a managing partner to be re-invited.';
    END IF;

    UPDATE user_profiles SET organization_id = existing_org.id, role = 'team_member' WHERE id = auth.uid();
    DELETE FROM removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid();

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', existing_org.id,
      'organization', jsonb_build_object('id', existing_org.id, 'name', existing_org.name, 'slug', existing_org.slug),
      'message', 'Joined fund',
      'role', 'team_member'
    );
  END IF;

  RAISE EXCEPTION 'Invalid or inactive code. Managing Partners: use the fund code from admin. Team members: use the invitation code from your Managing Partner (shown after they create the fund).';
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_by_code(text) TO authenticated;
COMMENT ON FUNCTION public.join_by_code(text) IS 'Unified join: enter either admin fund code (become MD) or org invitation code (become team member). Role is set by code type.';
