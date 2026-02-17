-- Dashboard architecture: add start_date to tasks, add LP role
-- Safe to run even if tasks table does not exist yet (run 20260215000001_add_tasks.sql first).

-- 1. Add start_date to tasks for real Gantt bars (only if tasks exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 2. Add 'lp' role to user_profiles constraint
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('team_member', 'organizer', 'managing_partner', 'admin', 'lp'));

-- 3. Add 'lp' role to invitations constraint (only if invitations exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
    ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
    ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
      CHECK (role IN ('team_member', 'organizer', 'managing_partner', 'lp'));
  END IF;
END $$;

-- 4. RLS: LPs cannot see tasks (only if tasks exists; drop first to avoid duplicate policy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    DROP POLICY IF EXISTS "LP cannot see tasks" ON tasks;
    CREATE POLICY "LP cannot see tasks"
      ON tasks FOR SELECT
      USING (
        NOT EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'lp'
        )
      );
  END IF;
END $$;

-- 5. RLS: LPs cannot see decision_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'decision_logs') THEN
    DROP POLICY IF EXISTS "LP cannot see decisions" ON decision_logs;
    CREATE POLICY "LP cannot see decisions"
      ON decision_logs FOR SELECT
      USING (
        NOT EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'lp'
        )
      );
  END IF;
END $$;
