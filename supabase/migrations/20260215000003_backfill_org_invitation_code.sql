-- Backfill invitation_code for organizations that have NULL (e.g. created via ensure_user_organization)
UPDATE organizations
SET invitation_code = UPPER(SUBSTRING(MD5(id::text), 1, 8))
WHERE invitation_code IS NULL;

-- RPC: ensure current user's org has an invitation code (generate if null). MD/organizer only.
CREATE OR REPLACE FUNCTION public.ensure_organization_invitation_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id_val uuid;
  code_val text;
  org_row organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT organization_id INTO org_id_val
  FROM user_profiles
  WHERE id = auth.uid();

  IF org_id_val IS NULL THEN
    RAISE EXCEPTION 'you do not belong to an organization';
  END IF;

  -- Only MD or organizer can ensure/generate invitation code
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('managing_partner', 'organizer')
  ) THEN
    RAISE EXCEPTION 'only managing partners or organizers can view the invitation code';
  END IF;

  SELECT * INTO org_row FROM organizations WHERE id = org_id_val;

  IF org_row.invitation_code IS NOT NULL THEN
    RETURN jsonb_build_object('invitation_code', org_row.invitation_code);
  END IF;

  -- Generate unique code from org id (8-char hex, unique per org)
  code_val := UPPER(SUBSTRING(MD5(org_id_val::text), 1, 8));

  UPDATE organizations
  SET invitation_code = code_val
  WHERE id = org_id_val;

  RETURN jsonb_build_object('invitation_code', code_val);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_organization_invitation_code() TO authenticated;
COMMENT ON FUNCTION public.ensure_organization_invitation_code() IS 'Returns or generates invitation_code for the current user organization. MD/organizer only.';
