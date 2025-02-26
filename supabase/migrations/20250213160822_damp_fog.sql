/*
  # Add public access policies

  1. Changes
    - Add public access policies for webinars and sessions tables
    - Allow anonymous users to view webinars and sessions
    - Maintain existing policies for authenticated users

  2. Security
    - Only allows read access for public users
    - Maintains existing write policies for authenticated users
*/

-- Add public access policy for webinars
CREATE POLICY "Allow public read access to webinars"
  ON webinars
  FOR SELECT
  TO anon
  USING (true);

-- Add public access policy for webinar sessions
CREATE POLICY "Allow public read access to webinar sessions"
  ON webinar_sessions
  FOR SELECT
  TO anon
  USING (true);

-- Add public access policy for chat messages
CREATE POLICY "Allow public read access to chat messages"
  ON chat_messages
  FOR SELECT
  TO anon
  USING (true);