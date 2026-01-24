-- Expand user role options for VC teams

-- Normalize old investor role to team_member
UPDATE user_profiles
SET role = 'team_member'
WHERE role = 'investor';

-- Update role constraint + default
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('organizer', 'managing_partner', 'team_member'));

ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'team_member';


