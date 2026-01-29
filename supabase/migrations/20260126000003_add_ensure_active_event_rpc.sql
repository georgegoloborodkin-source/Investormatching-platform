-- Create RPC to safely ensure an active event exists for an organization
-- This bypasses RLS for event creation during signup flows

CREATE OR REPLACE FUNCTION public.ensure_active_event(org_id uuid)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_event public.events;
  created_event public.events;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO existing_event
  FROM public.events
  WHERE organization_id = org_id
    AND status = 'active'
  ORDER BY date DESC
  LIMIT 1;

  IF existing_event.id IS NOT NULL THEN
    RETURN existing_event;
  END IF;

  INSERT INTO public.events (organization_id, name, status)
  VALUES (org_id, 'Main Event', 'active')
  RETURNING * INTO created_event;

  RETURN created_event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_active_event(uuid) TO authenticated;
