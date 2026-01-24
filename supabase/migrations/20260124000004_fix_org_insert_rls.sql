-- Allow users to create their own organization

DROP POLICY IF EXISTS "Users can create org" ON public.organizations;

CREATE POLICY "Users can create org"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


