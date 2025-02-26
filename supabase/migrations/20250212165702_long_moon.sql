/*
  # Add Avatar Messages Table

  1. New Tables
    - `avatar_messages`
      - `id` (uuid, primary key)
      - `webinar_id` (uuid, foreign key to webinars)
      - `name` (text)
      - `message` (text)
      - `timestamp` (float)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `avatar_messages` table
    - Add policies for webinar owners to manage their avatar messages
*/

CREATE TABLE IF NOT EXISTS avatar_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid REFERENCES webinars ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  message text NOT NULL,
  timestamp float NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE avatar_messages ENABLE ROW LEVEL SECURITY;

-- Policies for avatar_messages
CREATE POLICY "Users can manage avatar messages for their webinars"
  ON avatar_messages FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));