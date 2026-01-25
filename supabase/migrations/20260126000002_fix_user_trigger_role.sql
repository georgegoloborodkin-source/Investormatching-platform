-- Fix handle_new_user trigger to use correct role (team_member instead of investor)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'team_member'  -- Changed from 'investor' to 'team_member'
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
