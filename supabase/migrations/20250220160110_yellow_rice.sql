/*
  # Update user integrations table

  1. Changes
    - Add IF NOT EXISTS to table creation
    - Add IF NOT EXISTS to constraints and policies
    - Add DROP IF EXISTS for safety
    - Add proper error handling

  2. Security
    - Ensure RLS policies are properly set
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_integrations'
  ) THEN
    DROP POLICY IF EXISTS "Users can manage their own integrations" ON user_integrations;
  END IF;
END $$;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  location_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_provider'
  ) THEN
    ALTER TABLE user_integrations
    ADD CONSTRAINT unique_user_provider UNIQUE (user_id, provider);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage their own integrations"
  ON user_integrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider 
ON user_integrations(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_integrations_provider 
ON user_integrations(provider);