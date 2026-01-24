-- Fix sources RLS to avoid user_profiles recursion

DROP POLICY IF EXISTS "Users can view org sources" ON public.sources;
DROP POLICY IF EXISTS "Users can manage own sources" ON public.sources;

CREATE POLICY "Users can view org sources"
  ON public.sources FOR SELECT
  USING (
    (SELECT organization_id FROM public.events WHERE events.id = sources.event_id) = public.current_user_org_id()
  );

CREATE POLICY "Users can manage own sources"
  ON public.sources FOR ALL
  USING (
    created_by = auth.uid()
    OR (
      public.is_organizer()
      AND (SELECT organization_id FROM public.events WHERE events.id = sources.event_id) = public.current_user_org_id()
    )
  );
