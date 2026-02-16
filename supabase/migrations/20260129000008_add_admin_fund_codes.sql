-- Admin-controlled fund code system
-- Admin creates fund codes, MDs enter code to become MD of that fund

-- Add admin role to user_profiles (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role_enum'
  ) THEN
    CREATE TYPE user_role_enum AS ENUM ('team_member', 'organizer', 'managing_partner', 'admin');
  ELSE
    -- Add admin to existing enum if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_enum')
    ) THEN
      ALTER TYPE user_role_enum ADD VALUE 'admin';
    END IF;
  END IF;
END $$;

-- Create fund_codes table (admin creates these)
CREATE TABLE IF NOT EXISTS fund_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  fund_name TEXT NOT NULL,
  fund_slug TEXT,
  fund_type TEXT,
  website TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE, -- When first MD uses it
  used_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL, -- First MD who used it
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT unique_fund_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_fund_codes_code ON fund_codes(code);
CREATE INDEX IF NOT EXISTS idx_fund_codes_created_by ON fund_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_fund_codes_active ON fund_codes(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE fund_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Fund Codes (drop first so migration is idempotent)
DROP POLICY IF EXISTS "Admins can view all fund codes" ON fund_codes;
DROP POLICY IF EXISTS "Anyone can view active fund codes" ON fund_codes;
DROP POLICY IF EXISTS "Admins can create fund codes" ON fund_codes;
DROP POLICY IF EXISTS "Admins can update fund codes" ON fund_codes;

-- Admins can view all fund codes
CREATE POLICY "Admins can view all fund codes"
  ON fund_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Anyone can view active fund codes (to check if code exists during signup)
CREATE POLICY "Anyone can view active fund codes"
  ON fund_codes FOR SELECT
  USING (is_active = true);

-- Only admins can create fund codes
CREATE POLICY "Admins can create fund codes"
  ON fund_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    AND created_by = auth.uid()
  );

-- Only admins can update fund codes
CREATE POLICY "Admins can update fund codes"
  ON fund_codes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Function to generate fund code (e.g., ORBIT-1234)
CREATE OR REPLACE FUNCTION generate_fund_code(fund_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  prefix text;
  random_num text;
  final_code text;
BEGIN
  -- Get first 4-6 uppercase letters from fund name
  prefix := UPPER(REGEXP_REPLACE(SUBSTRING(fund_name FROM 1 FOR 6), '[^A-Z]', '', 'g'));
  IF LENGTH(prefix) < 4 THEN
    prefix := 'FUND';
  END IF;
  
  -- Generate 4-digit random number
  LOOP
    random_num := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    final_code := prefix || '-' || random_num;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM fund_codes WHERE code = final_code) THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_code;
END;
$$;

-- RPC: Create fund code (admin only)
CREATE OR REPLACE FUNCTION public.create_fund_code(
  fund_name text,
  fund_slug text DEFAULT NULL,
  fund_type text DEFAULT NULL,
  website text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  new_code text;
  fund_code_record fund_codes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Check user is admin
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();

  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'only admins can create fund codes';
  END IF;

  -- Generate unique code
  new_code := generate_fund_code(fund_name);

  -- Create fund code
  INSERT INTO fund_codes (code, fund_name, fund_slug, fund_type, website, created_by)
  VALUES (new_code, fund_name, fund_slug, fund_type, website, auth.uid())
  RETURNING * INTO fund_code_record;

  RETURN jsonb_build_object(
    'success', true,
    'code', new_code,
    'fund_name', fund_name,
    'id', fund_code_record.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_fund_code(text, text, text, text) TO authenticated;

-- RPC: Join fund by code (MDs use this)
-- This replaces the old join_fund_by_code and create_fund_for_md
DROP FUNCTION IF EXISTS public.join_fund_by_code(text);
DROP FUNCTION IF EXISTS public.create_fund_for_md(text, text, text, text);

CREATE OR REPLACE FUNCTION public.join_fund_by_code(code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fund_code_record fund_codes;
  user_profile user_profiles;
  existing_org organizations;
  new_org organizations;
  invite_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Get user profile
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = auth.uid();

  -- Check user is MD
  IF user_profile.role != 'managing_partner' THEN
    RAISE EXCEPTION 'only managing partners can join funds using fund codes';
  END IF;

  -- Check user doesn't already belong to an org
  IF user_profile.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'you already belong to an organization';
  END IF;

  -- Find fund code
  SELECT * INTO fund_code_record
  FROM fund_codes
  WHERE code = UPPER(code_param)
    AND is_active = true;

  IF fund_code_record IS NULL THEN
    RAISE EXCEPTION 'invalid or inactive fund code';
  END IF;

  -- Check if user was previously removed from this organization (if org exists)
  IF fund_code_record.used_at IS NOT NULL AND fund_code_record.used_by IS NOT NULL THEN
    -- Fund already exists, check blacklist
    SELECT organization_id INTO existing_org
    FROM user_profiles
    WHERE id = fund_code_record.used_by;
    
    IF existing_org IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM removed_team_members
        WHERE organization_id = existing_org.id
        AND user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'you were previously removed from this fund. Please contact an admin.';
      END IF;
    END IF;
  END IF;

  -- Check if fund already exists (first MD already used the code)
  IF fund_code_record.used_at IS NOT NULL AND fund_code_record.used_by IS NOT NULL THEN
    -- Fund exists, join it
    SELECT * INTO existing_org
    FROM organizations
    WHERE id = (SELECT organization_id FROM user_profiles WHERE id = fund_code_record.used_by);
    
    IF existing_org IS NULL THEN
      RAISE EXCEPTION 'fund code was used but organization not found';
    END IF;

    -- Link user to existing organization
    UPDATE user_profiles
    SET organization_id = existing_org.id
    WHERE id = auth.uid();

    -- Remove from blacklist if present
    DELETE FROM removed_team_members
    WHERE organization_id = existing_org.id
    AND user_id = auth.uid();

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', existing_org.id,
      'organization', jsonb_build_object(
        'id', existing_org.id,
        'name', existing_org.name,
        'slug', existing_org.slug
      ),
      'message', 'Joined existing fund'
    );
  ELSE
    -- First MD using this code - create the fund
    -- Generate invitation code for team members
    LOOP
      invite_code := generate_fund_code(fund_code_record.fund_name);
      IF NOT EXISTS (SELECT 1 FROM organizations WHERE invitation_code = invite_code) THEN
        EXIT;
      END IF;
    END LOOP;

    -- Create organization
    INSERT INTO organizations (name, slug, invitation_code)
    VALUES (
      fund_code_record.fund_name,
      COALESCE(fund_code_record.fund_slug, slugify(fund_code_record.fund_name)),
      invite_code
    )
    RETURNING * INTO new_org;

    -- Link user to organization
    UPDATE user_profiles
    SET organization_id = new_org.id
    WHERE id = auth.uid();

    -- Mark fund code as used
    UPDATE fund_codes
    SET used_at = NOW(),
        used_by = auth.uid()
    WHERE id = fund_code_record.id;

    -- Create default event
    INSERT INTO events (organization_id, name, status)
    VALUES (new_org.id, 'Main Event', 'active');

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', new_org.id,
      'invitation_code', invite_code,
      'organization', jsonb_build_object(
        'id', new_org.id,
        'name', new_org.name,
        'slug', new_org.slug,
        'invitation_code', invite_code
      ),
      'message', 'Fund created successfully'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_fund_by_code(text) TO authenticated;

-- Helper function for slugify (if not exists)
CREATE OR REPLACE FUNCTION slugify(input_text text)
RETURNS text
LANGUAGE sql
AS $$
  SELECT LOWER(REGEXP_REPLACE(REGEXP_REPLACE(input_text, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
$$;

-- Add comment
COMMENT ON TABLE fund_codes IS 'Fund codes created by admin. MDs enter these codes to create or join funds.';
COMMENT ON FUNCTION public.create_fund_code IS 'Admin-only function to create fund codes. MDs then use these codes to create/join funds.';
COMMENT ON FUNCTION public.join_fund_by_code IS 'MDs use this to create or join a fund using an admin-created fund code.';
