-- Add mentors & corporates tables, plus generic match targets

CREATE TABLE IF NOT EXISTS mentors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  linkedin_url TEXT,
  geo_focus TEXT[],
  industry_preferences TEXT[],
  expertise_areas TEXT[],
  total_slots INTEGER,
  availability_status TEXT DEFAULT 'present' CHECK (availability_status IN ('present', 'not-attending')),
  slot_availability JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corporates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  firm_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT,
  geo_focus TEXT[],
  industry_preferences TEXT[],
  partnership_types TEXT[],
  stages TEXT[],
  total_slots INTEGER,
  availability_status TEXT DEFAULT 'present' CHECK (availability_status IN ('present', 'not-attending')),
  slot_availability JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS target_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS startup_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS startup_attending BOOLEAN;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS target_attending BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_mentors_event_id ON mentors(event_id);
CREATE INDEX IF NOT EXISTS idx_corporates_event_id ON corporates(event_id);

-- Enable RLS
ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create orgs (MVP)
DROP POLICY IF EXISTS "Authenticated can create orgs" ON organizations;
CREATE POLICY "Authenticated can create orgs"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow org members to manage events
DROP POLICY IF EXISTS "Users can manage org events" ON events;
CREATE POLICY "Users can manage org events"
  ON events FOR ALL
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

-- Allow org members to manage investors
DROP POLICY IF EXISTS "Investors can manage own record" ON investors;
CREATE POLICY "Investors can manage own record"
  ON investors FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = investors.event_id
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = investors.event_id
      )
    )
  );

-- Allow org members to manage startups
DROP POLICY IF EXISTS "Startups can manage own record" ON startups;
CREATE POLICY "Startups can manage own record"
  ON startups FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = startups.event_id
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = startups.event_id
      )
    )
  );

-- Allow org members to manage mentors
DROP POLICY IF EXISTS "Users can manage mentors" ON mentors;
CREATE POLICY "Users can manage mentors"
  ON mentors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = mentors.event_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = mentors.event_id
      )
    )
  );

-- Allow org members to manage corporates
DROP POLICY IF EXISTS "Users can manage corporates" ON corporates;
CREATE POLICY "Users can manage corporates"
  ON corporates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = corporates.event_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = corporates.event_id
      )
    )
  );

-- Allow org members to manage time slots
DROP POLICY IF EXISTS "Users can manage time slots" ON time_slots;
CREATE POLICY "Users can manage time slots"
  ON time_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = time_slots.event_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = time_slots.event_id
      )
    )
  );

-- Allow org members to manage matches
DROP POLICY IF EXISTS "Users can manage event matches" ON matches;
CREATE POLICY "Users can manage event matches"
  ON matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = matches.event_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = matches.event_id
      )
    )
  );

