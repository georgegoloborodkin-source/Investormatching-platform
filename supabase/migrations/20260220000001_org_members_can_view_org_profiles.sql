-- Allow all org members (including team_member, lp) to read same-org profiles.
-- This fixes "Created by: Unknown" on task cards for investment team members,
-- so they can see who assigned/created the task.

CREATE POLICY "Org members can view same-org profiles"
  ON public.user_profiles FOR SELECT
  USING (
    public.current_user_org_id() IS NOT NULL
    AND organization_id = public.current_user_org_id()
  );
