-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  profile_exists boolean;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = NEW.id
  ) INTO profile_exists;

  -- Only create profile if it doesn't exist
  IF NOT profile_exists THEN
    INSERT INTO public.user_profiles (
      id,
      email,
      full_name,
      created_at,
      updated_at,
      last_login,
      is_active
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.created_at,
      NEW.created_at,
      NEW.last_sign_in_at,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger with AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Ensure all existing users have profiles
INSERT INTO public.user_profiles (
  id,
  email,
  full_name,
  created_at,
  updated_at,
  last_login,
  is_active
)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  created_at,
  created_at,
  last_sign_in_at,
  true
FROM auth.users
ON CONFLICT (id) DO NOTHING;