/*
  # Add user integrations table

  1. New Tables
    - `user_integrations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `provider` (text)
      - `access_token` (text)
      - `refresh_token` (text)
      - `location_id` (text)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for user access
*/

CREATE TABLE user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  location_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint for user_id and provider
ALTER TABLE user_integrations
ADD CONSTRAINT unique_user_provider UNIQUE (user_id, provider);

-- Enable RLS
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own integrations"
  ON user_integrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);