-- Allow MD to join by EITHER fund code (admin) OR org invitation code.
-- So "fund code" from admin and "invitation code" from Invite Your Team both work for MD.

CREATE OR REPLACE FUNCTION public.join_fund_by_code(code_param text)
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
    RAISE EXCEPTION 'invalid or inactive fund code';
  END IF;

  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  IF user_profile.role != 'managing_partner' THEN
    RAISE EXCEPTION 'only managing partners can join funds using fund codes';
  END IF;

  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization';
  END IF;

  -- 1) Try fund_codes (admin-created fund code)
  SELECT * INTO fund_code_record
  FROM fund_codes
  WHERE code = code_normalized
    AND is_active = true;

  IF fund_code_record IS NOT NULL THEN
    -- Existing logic: create org or join existing fund
    IF fund_code_record.used_at IS NOT NULL AND fund_code_record.used_by IS NOT NULL THEN
      SELECT organization_id INTO existing_org
      FROM user_profiles
      WHERE id = fund_code_record.used_by;
      IF existing_org IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid()) THEN
          RAISE EXCEPTION 'you were previously removed from this fund. Please contact an admin.';
        END IF;
      END IF;

      SELECT * INTO existing_org
      FROM organizations
      WHERE id = (SELECT organization_id FROM user_profiles WHERE id = fund_code_record.used_by);

      IF existing_org IS NULL THEN
        RAISE EXCEPTION 'fund code was used but organization not found';
      END IF;

      UPDATE user_profiles SET organization_id = existing_org.id WHERE id = auth.uid();
      DELETE FROM removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid();

      RETURN jsonb_build_object(
        'success', true,
        'organization_id', existing_org.id,
        'organization', jsonb_build_object('id', existing_org.id, 'name', existing_org.name, 'slug', existing_org.slug),
        'message', 'Joined existing fund'
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
        'message', 'Fund created successfully'
      );
    END IF;
  END IF;

  -- 2) Fallback: try organization invitation code (so admin can give MD the "Invite Your Team" code)
  SELECT * INTO existing_org
  FROM organizations
  WHERE invitation_code = code_normalized;

  IF existing_org IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM removed_team_members
      WHERE organization_id = existing_org.id AND user_id = auth.uid()
    ) INTO was_removed;

    IF was_removed THEN
      RAISE EXCEPTION 'you were previously removed from this organization. Please contact a managing partner to be re-invited.';
    END IF;

    UPDATE user_profiles SET organization_id = existing_org.id WHERE id = auth.uid();
    DELETE FROM removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid();

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', existing_org.id,
      'organization', jsonb_build_object('id', existing_org.id, 'name', existing_org.name, 'slug', existing_org.slug),
      'message', 'Joined existing fund'
    );
  END IF;

  RAISE EXCEPTION 'invalid or inactive fund code';
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_fund_by_code(text) TO authenticated;
COMMENT ON FUNCTION public.join_fund_by_code(text) IS 'MDs use this to create or join a fund. Accepts either an admin-created fund code or an organization invitation code.';
