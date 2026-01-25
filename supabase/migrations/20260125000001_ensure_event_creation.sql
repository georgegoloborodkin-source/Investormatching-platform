-- Ensure users can always create events in their organization
-- This fixes "no active event" errors for new users

-- Drop existing event policies
DROP POLICY IF EXISTS "Users can view org events" ON events;
DROP POLICY IF EXISTS "Users can manage org events" ON events;

-- Allow users to view events in their organization
CREATE POLICY "Users can view org events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = events.organization_id
    )
  );

-- Allow users to INSERT events in their organization
CREATE POLICY "Users can create org events"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = events.organization_id
    )
  );

-- Allow users to UPDATE events in their organization
CREATE POLICY "Users can update org events"
  ON events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = events.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = events.organization_id
    )
  );

-- Allow users to DELETE events in their organization (optional, for cleanup)
CREATE POLICY "Users can delete org events"
  ON events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = events.organization_id
    )
  );
