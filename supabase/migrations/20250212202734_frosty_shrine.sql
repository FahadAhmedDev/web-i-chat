/*
  # Create contacts table and update chat policies

  1. New Tables
    - `contacts`
      - `id` (uuid, primary key)
      - `webinar_id` (uuid, references webinars)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `contacts` table
    - Add policies for authenticated users to read their own data
    - Add policies for webinar owners to read all contacts
*/

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid REFERENCES webinars ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own contact info
CREATE POLICY "Users can read own contact info"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own contact info
CREATE POLICY "Users can insert own contact info"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow webinar owners to read all contacts for their webinars
CREATE POLICY "Webinar owners can read all contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = contacts.webinar_id
    AND webinars.user_id = auth.uid()
  ));

-- Update chat_messages policies to require contact registration
CREATE POLICY "Users can insert chat messages if registered"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.webinar_id = chat_messages.webinar_id
      AND contacts.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM webinars
      WHERE webinars.id = chat_messages.webinar_id
      AND webinars.user_id = auth.uid()
    )
  );