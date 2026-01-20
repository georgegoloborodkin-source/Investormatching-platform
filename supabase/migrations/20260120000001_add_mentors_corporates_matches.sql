-- Add mentors & corporates tables + extend matches for target types

-- Mentors table
CREATE TABLE IF NOT EXISTS mentors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
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

-- Corporates table
CREATE TABLE IF NOT EXISTS corporates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
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

-- Extend matches for generic target types
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS target_id UUID,
  ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'investor' CHECK (target_type IN ('investor', 'mentor', 'corporate')),
  ADD COLUMN IF NOT EXISTS startup_name TEXT,
  ADD COLUMN IF NOT EXISTS target_name TEXT,
  ADD COLUMN IF NOT EXISTS startup_attending BOOLEAN,
  ADD COLUMN IF NOT EXISTS target_attending BOOLEAN;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mentors_event_id ON mentors(event_id);
CREATE INDEX IF NOT EXISTS idx_mentors_user_id ON mentors(user_id);
CREATE INDEX IF NOT EXISTS idx_corporates_event_id ON corporates(event_id);
CREATE INDEX IF NOT EXISTS idx_corporates_user_id ON corporates(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_target_id ON matches(target_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_mentors_updated_at ON mentors;
DROP TRIGGER IF EXISTS update_corporates_updated_at ON corporates;
CREATE TRIGGER update_mentors_updated_at BEFORE UPDATE ON mentors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_corporates_updated_at BEFORE UPDATE ON corporates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporates ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Mentors can manage own record" ON mentors;
DROP POLICY IF EXISTS "Corporates can manage own record" ON corporates;

CREATE POLICY "Mentors can manage own record"
  ON mentors FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = mentors.event_id
      )
    )
  );

CREATE POLICY "Corporates can manage own record"
  ON corporates FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = corporates.event_id
      )
    )
  );

