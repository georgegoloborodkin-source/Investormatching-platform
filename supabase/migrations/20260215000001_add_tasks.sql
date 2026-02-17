-- Task hub: MD assigns tasks to investment team; team sees my tasks and updates status

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assignee_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'done')),
  start_date TIMESTAMP WITH TIME ZONE,
  deadline TIMESTAMP WITH TIME ZONE,
  status_note TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- View: user can see tasks in events belonging to their org
CREATE POLICY "Users can view org tasks"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN events e ON e.id = tasks.event_id
      WHERE up.id = auth.uid()
      AND up.organization_id = e.organization_id
    )
  );

-- Insert: only MD/organizer can create tasks (for their org events)
CREATE POLICY "MD can insert tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN events e ON e.id = tasks.event_id
      WHERE up.id = auth.uid()
      AND up.organization_id = e.organization_id
      AND up.role IN ('managing_partner', 'organizer')
    )
  );

-- Update: MD can update any task in org; assignee can update status/status_note of their own tasks
CREATE POLICY "Users can update org tasks"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN events e ON e.id = tasks.event_id
      WHERE up.id = auth.uid()
      AND up.organization_id = e.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN events e ON e.id = tasks.event_id
      WHERE up.id = auth.uid()
      AND up.organization_id = e.organization_id
    )
  );

-- Delete: only MD/organizer can delete tasks
CREATE POLICY "MD can delete tasks"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN events e ON e.id = tasks.event_id
      WHERE up.id = auth.uid()
      AND up.organization_id = e.organization_id
      AND up.role IN ('managing_partner', 'organizer')
    )
  );
