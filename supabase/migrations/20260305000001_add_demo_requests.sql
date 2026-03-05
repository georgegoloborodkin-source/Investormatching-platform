-- Get a Demo form submissions (landing page)
-- Visible in Supabase Dashboard → Table Editor → demo_requests

CREATE TABLE IF NOT EXISTS demo_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  linkedin_url TEXT,
  company TEXT NOT NULL,
  company_size TEXT,
  country TEXT,
  how_heard TEXT,
  motivation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anyone to submit (anonymous insert from landing page)
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert for demo requests"
  ON demo_requests FOR INSERT
  WITH CHECK (true);

-- Only authenticated users can read (optional: restrict to admins later)
CREATE POLICY "Authenticated users can view demo requests"
  ON demo_requests FOR SELECT
  USING (auth.role() = 'authenticated');

-- Table is visible in Supabase Dashboard; use service role or SQL editor to view all rows
