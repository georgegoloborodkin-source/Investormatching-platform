-- Fix RLS policy to allow managing_partner to view team members

-- Update helper function to check for both organizer and managing_partner
CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('organizer', 'managing_partner')
  );
$$;

-- Drop and recreate the policy
DROP POLICY IF EXISTS "Organizers can view org profiles" ON public.user_profiles;

CREATE POLICY "Organizers can view org profiles"
  ON public.user_profiles FOR SELECT
  USING (
    public.is_organizer()
    AND organization_id = public.current_user_org_id()
  );
