/*
  # Update contacts table for anonymous users

  1. Changes
    - Make user_id column nullable to support anonymous users
    - Add index on email for faster lookups
    - Update validation trigger to handle international phone numbers

  2. Security
    - Maintain RLS policies for contact management
    - Allow anonymous users to create contacts
*/

-- Make user_id nullable for anonymous users
ALTER TABLE contacts
ALTER COLUMN user_id DROP NOT NULL;

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email);

-- Update phone validation to handle international formats
CREATE OR REPLACE FUNCTION validate_phone_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow international format (+) and require 10-15 digits
  IF NEW.phone !~ '^\+?[0-9]{10,15}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Must contain 10-15 digits, optionally starting with +';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure policies allow anonymous access
DROP POLICY IF EXISTS "Anyone can insert contact info" ON contacts;
CREATE POLICY "Anyone can insert contact info"
  ON contacts
  FOR INSERT
  TO public
  WITH CHECK (true);