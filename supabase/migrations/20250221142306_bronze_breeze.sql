/*
  # Create User Profiles System
  
  This migration:
  1. Creates user_profiles table
  2. Sets up triggers for auto-creation
  3. Handles existing data migration
  4. Maintains referential integrity
*/

-- First create the user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE
  ON user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Create trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_new_user();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Migrate existing users to user_profiles
INSERT INTO user_profiles (id, email, full_name, created_at)
SELECT 
  id,
  email,
  email as full_name,
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Helper function to get current user profile
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS user_profiles
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM user_profiles
  WHERE id = auth.uid();
$$;

-- Update webinars table to reference user_profiles
-- First, ensure all users have profiles
DO $$
DECLARE
  webinar_user_id uuid;
BEGIN
  -- Get all unique user_ids from webinars that don't have profiles
  FOR webinar_user_id IN 
    SELECT DISTINCT user_id 
    FROM webinars w
    WHERE NOT EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = w.user_id
    )
  LOOP
    -- Get user info from auth.users
    INSERT INTO user_profiles (id, email, full_name, created_at)
    SELECT 
      id,
      email,
      email as full_name,
      created_at
    FROM auth.users
    WHERE id = webinar_user_id
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;