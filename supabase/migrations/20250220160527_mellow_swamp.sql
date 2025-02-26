/*
  # Add location_id column to user_integrations table

  1. Changes
    - Add location_id column if it doesn't exist
    - Add index for location_id lookups

  2. Notes
    - Uses safe DDL operations with IF NOT EXISTS
    - Maintains existing data
*/

-- Add location_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'user_integrations' 
    AND column_name = 'location_id'
  ) THEN
    ALTER TABLE user_integrations
    ADD COLUMN location_id text;
  END IF;
END $$;

-- Add index for location_id lookups if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'user_integrations' 
    AND indexname = 'idx_user_integrations_location_id'
  ) THEN
    CREATE INDEX idx_user_integrations_location_id 
    ON user_integrations(location_id);
  END IF;
END $$;