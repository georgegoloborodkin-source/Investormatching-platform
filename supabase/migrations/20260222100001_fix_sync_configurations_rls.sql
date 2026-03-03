-- Fix sync_configurations RLS: allow any org member to manage sync configs
-- (not just managing_partner / organizer). Matches orbit-platform behaviour.

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "MD can manage sync configs"        ON public.sync_configurations;
DROP POLICY IF EXISTS "Users can view org sync configs"   ON public.sync_configurations;

-- Re-create with orbit-platform style: any org member can CRUD
CREATE POLICY "Members can view org sync configs" ON public.sync_configurations
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Members can create org sync configs" ON public.sync_configurations
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Members can update org sync configs" ON public.sync_configurations
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Members can delete org sync configs" ON public.sync_configurations
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
  );
