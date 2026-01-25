-- Fix organizations RLS for new users who don't have organization_id yet
-- This allows new users to create and view their organization

-- Drop all existing organization policies (handle all possible names)
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated can create orgs" ON public.organizations;
DROP POLICY IF EXISTS "Users can create org" ON public.organizations;
DROP POLICY IF EXISTS "Users can update org" ON public.organizations;

-- Ensure RLS is enabled and authenticated role has table privileges
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;

-- Allow authenticated users to INSERT organizations (for new users)
CREATE POLICY "Authenticated can create orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to SELECT organizations
-- Use SECURITY DEFINER function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.user_can_view_org(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get user's organization_id (bypasses RLS)
  SELECT organization_id INTO user_org_id
  FROM public.user_profiles
  WHERE id = auth.uid();
  
  -- User belongs to this organization
  IF user_org_id = org_id THEN
    RETURN true;
  END IF;
  
  -- New user flow: can view org if they don't have an org yet
  -- AND the org was created recently (within last 10 minutes)
  -- This allows them to see the org they just created
  IF user_org_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = org_id
      AND created_at > NOW() - INTERVAL '10 minutes'
    );
  END IF;
  
  RETURN false;
END;
$$;

CREATE POLICY "Users can view organizations"
  ON public.organizations FOR SELECT
  USING (public.user_can_view_org(organizations.id));

-- Helper function for UPDATE policy (avoids recursion)
CREATE OR REPLACE FUNCTION public.user_can_update_org(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.organization_id = org_id
  );
$$;

-- Allow users to UPDATE their organization
CREATE POLICY "Users can update org"
  ON public.organizations FOR UPDATE
  USING (public.user_can_update_org(organizations.id))
  WITH CHECK (public.user_can_update_org(organizations.id));
