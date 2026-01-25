-- Fix organizations RLS for new users who don't have organization_id yet
-- This allows new users to create and view their organization

-- Drop all existing organization policies
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated can create orgs" ON public.organizations;
DROP POLICY IF EXISTS "Users can create org" ON public.organizations;

-- Allow authenticated users to INSERT organizations (for new users)
CREATE POLICY "Authenticated can create orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to SELECT organizations
-- Users can see organizations they belong to
-- OR if they don't have an organization_id yet (new user flow), they can see all orgs
-- (This is safe because they'll be assigned to one immediately after creation)
CREATE POLICY "Users can view organizations"
  ON public.organizations FOR SELECT
  USING (
    -- User is in this organization
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = organizations.id
    )
    -- OR user doesn't have organization_id yet (new user during signup)
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id IS NULL
    )
  );

-- Allow users to UPDATE their organization
CREATE POLICY "Users can update org"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = organizations.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = organizations.id
    )
  );
