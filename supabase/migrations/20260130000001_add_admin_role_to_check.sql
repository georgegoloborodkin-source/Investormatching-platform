-- Add 'admin' role to user_profiles role check constraint

-- Drop the existing constraint
ALTER TABLE user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Recreate the constraint with 'admin' included
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('team_member', 'organizer', 'managing_partner', 'admin'));
