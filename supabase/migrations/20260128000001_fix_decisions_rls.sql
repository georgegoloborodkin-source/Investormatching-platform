-- Fix RLS policy for decisions table to allow org members to insert decisions
-- The current policy only allows inserts when actor_id = auth.uid(), but we allow actor_id to be null
-- for flexibility (users can log decisions on behalf of others or with just actor_name)

DROP POLICY IF EXISTS "Users can manage own decisions" ON decisions;

-- Allow users in the same organization to insert/update/delete decisions
-- This allows:
-- 1. Users to log decisions with their own actor_id
-- 2. Users to log decisions with actor_id = null (just actor_name)
-- 3. Organizers to manage any decisions in their org
CREATE POLICY "Users can manage org decisions"
  ON decisions FOR ALL
  USING (
    -- Allow if actor_id matches current user
    actor_id = auth.uid()
    -- OR if actor_id is null and user is in same org as event
    OR (
      actor_id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.organization_id = (
          SELECT organization_id FROM events WHERE events.id = decisions.event_id
        )
      )
    )
    -- OR if user is organizer in same org
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = decisions.event_id
      )
    )
  )
  WITH CHECK (
    -- For INSERT, check that user is in same org as the event being inserted
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = decisions.event_id
      )
    )
  );
