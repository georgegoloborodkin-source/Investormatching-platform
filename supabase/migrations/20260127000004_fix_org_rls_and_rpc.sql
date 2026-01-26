-- Fix organizations RLS and ensure RPC exists for safe org creation

-- Ensure RPC exists (safe org creation without client-side inserts)
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

-- Organizations RLS policies
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create org" ON public.organizations;
DROP POLICY IF EXISTS "Users can view org" ON public.organizations;
DROP POLICY IF EXISTS "Organizers can update org" ON public.organizations;

CREATE POLICY "Users can create org"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view org"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = organizations.id
    )
  );

CREATE POLICY "Organizers can update org"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = organizations.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = organizations.id
    )
  );
