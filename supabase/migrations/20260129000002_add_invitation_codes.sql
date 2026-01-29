-- Add invitation code system (simpler than tokens for team members)

-- Add invitation_code column to organizations (one code per fund)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invitation_code TEXT UNIQUE;

-- Generate invitation codes for existing organizations
UPDATE organizations
SET invitation_code = UPPER(SUBSTRING(MD5(id::text), 1, 8))
WHERE invitation_code IS NULL;

-- Create function to generate readable codes (e.g., ORBIT-1234)
CREATE OR REPLACE FUNCTION generate_invitation_code(org_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  prefix text;
  random_num text;
BEGIN
  -- Get first 4-6 uppercase letters from org name
  prefix := UPPER(REGEXP_REPLACE(SUBSTRING(org_name FROM 1 FOR 6), '[^A-Z]', '', 'g'));
  IF LENGTH(prefix) < 4 THEN
    prefix := 'FUND';
  END IF;
  
  -- Generate 4-digit random number
  random_num := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  RETURN prefix || '-' || random_num;
END;
$$;

-- Update create_fund_for_md to generate invitation code
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
  invite_code text;
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

  -- Generate unique invitation code
  LOOP
    invite_code := generate_invitation_code(fund_name);
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE invitation_code = invite_code) THEN
      EXIT;
    END IF;
  END LOOP;

  -- Create organization with invitation code
  INSERT INTO public.organizations (name, slug, invitation_code)
  VALUES (fund_name, fund_slug, invite_code)
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
    'invitation_code', invite_code,
    'organization', jsonb_build_object(
      'id', new_org.id,
      'name', new_org.name,
      'slug', new_org.slug,
      'invitation_code', invite_code
    )
  );
END;
$$;

-- RPC: Join fund by invitation code
CREATE OR REPLACE FUNCTION public.join_fund_by_code(invitation_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record public.organizations;
  user_profile public.user_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Find organization by code
  SELECT * INTO org_record
  FROM organizations
  WHERE invitation_code = UPPER(invitation_code);

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

  -- Link user to organization
  UPDATE user_profiles
  SET organization_id = org_record.id
  WHERE id = auth.uid();

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

GRANT EXECUTE ON FUNCTION public.join_fund_by_code(text) TO authenticated;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_invitation_code ON organizations(invitation_code);
