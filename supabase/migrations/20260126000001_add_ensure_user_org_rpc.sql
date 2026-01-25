-- Create RPC to safely create and link an organization for a user
-- This avoids client-side RLS issues during signup

CREATE OR REPLACE FUNCTION public.ensure_user_organization(org_name text, org_slug text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_org_id uuid;
  created_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT organization_id INTO existing_org_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF existing_org_id IS NOT NULL THEN
    SELECT * INTO created_org
    FROM public.organizations
    WHERE id = existing_org_id;
    RETURN created_org;
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING * INTO created_org;

  UPDATE public.user_profiles
  SET organization_id = created_org.id
  WHERE id = auth.uid();

  RETURN created_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_organization(text, text) TO authenticated;
