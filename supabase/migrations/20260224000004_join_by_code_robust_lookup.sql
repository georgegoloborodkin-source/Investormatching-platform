-- Robust fund code lookup: explicit schema, multiple match forms, and allow fund code
-- to work for team members too (same code joins existing fund as team_member or MD).

CREATE OR REPLACE FUNCTION public.join_by_code(code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_normalized text;
  fund_code_record public.fund_codes;
  user_profile public.user_profiles;
  existing_org public.organizations;
  new_org public.organizations;
  invite_code text;
  was_removed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  code_normalized := UPPER(TRIM(COALESCE(code_param, '')));
  IF code_normalized = '' THEN
    RAISE EXCEPTION 'Please enter a code.';
  END IF;

  -- Ensure profile exists (handles new users / post-wipe)
  INSERT INTO public.user_profiles (id, email, full_name, role)
  SELECT auth.uid(), u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), 'team_member'
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO user_profile
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization';
  END IF;

  -- 1) Fund code: match multiple forms (TRIM(code), code as-is, UPPER) so lookup always finds
  SELECT * INTO fund_code_record
  FROM public.fund_codes
  WHERE is_active = true
    AND (
      TRIM(code) = code_normalized
      OR UPPER(TRIM(code)) = code_normalized
      OR code = code_normalized
      OR code = TRIM(code_param)
    )
  LIMIT 1;

  IF fund_code_record.id IS NOT NULL THEN
    UPDATE public.user_profiles SET role = 'managing_partner' WHERE id = auth.uid();

    IF fund_code_record.used_at IS NOT NULL AND fund_code_record.used_by IS NOT NULL THEN
      SELECT * INTO existing_org
      FROM public.organizations
      WHERE id = (SELECT organization_id FROM public.user_profiles WHERE id = fund_code_record.used_by LIMIT 1);

      IF existing_org.id IS NULL THEN
        RAISE EXCEPTION 'Fund code was used but organization not found. Contact admin.';
      END IF;

      IF EXISTS (SELECT 1 FROM public.removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'You were previously removed from this fund. Please contact an admin.';
      END IF;

      UPDATE public.user_profiles SET organization_id = existing_org.id WHERE id = auth.uid();
      DELETE FROM public.removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid();

      RETURN jsonb_build_object(
        'success', true,
        'organization_id', existing_org.id,
        'organization', jsonb_build_object('id', existing_org.id, 'name', existing_org.name, 'slug', existing_org.slug),
        'message', 'Joined existing fund',
        'role', 'managing_partner'
      );
    ELSE
      LOOP
        invite_code := generate_fund_code(fund_code_record.fund_name);
        IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE invitation_code = invite_code) THEN
          EXIT;
        END IF;
      END LOOP;

      INSERT INTO public.organizations (name, slug, invitation_code)
      VALUES (
        fund_code_record.fund_name,
        COALESCE(fund_code_record.fund_slug, slugify(fund_code_record.fund_name)),
        invite_code
      )
      RETURNING * INTO new_org;

      UPDATE public.user_profiles SET organization_id = new_org.id WHERE id = auth.uid();
      UPDATE public.fund_codes SET used_at = NOW(), used_by = auth.uid() WHERE id = fund_code_record.id;
      INSERT INTO public.events (organization_id, name, status) VALUES (new_org.id, 'Main Event', 'active');

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

  -- 2) Organization invitation code
  SELECT * INTO existing_org
  FROM public.organizations
  WHERE invitation_code = code_normalized
     OR invitation_code = TRIM(COALESCE(code_param, ''))
  LIMIT 1;

  IF FOUND AND existing_org.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.removed_team_members
      WHERE organization_id = existing_org.id AND user_id = auth.uid()
    ) INTO was_removed;

    IF was_removed THEN
      RAISE EXCEPTION 'You were previously removed from this organization. Please contact a managing partner to be re-invited.';
    END IF;

    UPDATE public.user_profiles SET organization_id = existing_org.id, role = 'team_member' WHERE id = auth.uid();
    DELETE FROM public.removed_team_members WHERE organization_id = existing_org.id AND user_id = auth.uid();

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', existing_org.id,
      'organization', jsonb_build_object('id', existing_org.id, 'name', existing_org.name, 'slug', existing_org.slug),
      'message', 'Joined fund',
      'role', 'team_member'
    );
  END IF;

  RAISE EXCEPTION 'Invalid or inactive code. Use the fund code from admin (e.g. FUND-3424) or the invitation code from your MD.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_by_code(text) TO authenticated;
COMMENT ON FUNCTION public.join_by_code(text) IS 'Unified join: fund code or org invitation code. Robust lookup with explicit public schema.';
