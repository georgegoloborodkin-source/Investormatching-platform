-- Fix infinite recursion in user_profiles RLS policies

-- Helper: current user's organization id
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Helper: is current user organizer
CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'organizer'
  );
$$;

-- Drop the recursive policy and recreate using helper functions
DROP POLICY IF EXISTS "Organizers can view org profiles" ON public.user_profiles;

CREATE POLICY "Organizers can view org profiles"
  ON public.user_profiles FOR SELECT
  USING (
    public.is_organizer()
    AND organization_id = public.current_user_org_id()
  );


