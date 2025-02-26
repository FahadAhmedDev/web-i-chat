/*
  # Add contact collection for chat participants

  1. Changes
    - Add unique constraint on email per webinar
    - Add RLS policies for public access to contacts table
    - Add validation trigger for phone numbers
  
  2. Security
    - Enable public insert access for contacts
    - Maintain RLS for reading contacts
*/

-- Add unique constraint for email per webinar
ALTER TABLE contacts
ADD CONSTRAINT unique_email_per_webinar UNIQUE (webinar_id, email);

-- Add phone number validation trigger
CREATE OR REPLACE FUNCTION validate_phone_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Basic phone validation (must be at least 10 digits)
  IF NEW.phone !~ '^\+?[0-9]{10,}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Must contain at least 10 digits.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phone_validation
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION validate_phone_number();

-- Update RLS policies for contacts
DROP POLICY IF EXISTS "Users can insert own contact info" ON contacts;
DROP POLICY IF EXISTS "Users can read own contact info" ON contacts;

-- Allow anyone to insert contact info
CREATE POLICY "Anyone can insert contact info"
  ON contacts
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only webinar owners can read contacts
CREATE POLICY "Webinar owners can read contacts"
  ON contacts
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = contacts.webinar_id
    AND webinars.user_id = auth.uid()
  ));