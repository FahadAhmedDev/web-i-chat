/*
  # Initial Schema Setup for Webichat

  1. New Tables
    - `webinars`: Stores webinar information
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `title` (text)
      - `description` (text)
      - `user_id` (uuid, references auth.users)
      - `video_url` (text)
      - `duration` (integer, in seconds)
      - `settings` (jsonb)

    - `webinar_sessions`: Stores scheduled session times
      - `id` (uuid, primary key)
      - `webinar_id` (uuid, references webinars)
      - `start_time` (timestamp with time zone)
      - `end_time` (timestamp with time zone)
      - `timezone` (text)

    - `chat_messages`: Stores chat messages
      - `id` (uuid, primary key)
      - `webinar_id` (uuid, references webinars)
      - `session_id` (uuid, references webinar_sessions)
      - `user_id` (uuid)
      - `message` (text)
      - `created_at` (timestamp)
      - `is_admin` (boolean)

    - `attendees`: Stores attendee information
      - `id` (uuid, primary key)
      - `webinar_id` (uuid, references webinars)
      - `session_id` (uuid, references webinar_sessions)
      - `name` (text)
      - `email` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create webinars table
CREATE TABLE webinars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text,
  user_id uuid REFERENCES auth.users NOT NULL,
  video_url text NOT NULL,
  duration integer NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb
);

-- Create webinar_sessions table
CREATE TABLE webinar_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid REFERENCES webinars ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text NOT NULL
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid REFERENCES webinars ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES webinar_sessions ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false
);

-- Create attendees table
CREATE TABLE attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id uuid REFERENCES webinars ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES webinar_sessions ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE webinars ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- Policies for webinars
CREATE POLICY "Users can read their own webinars"
  ON webinars FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webinars"
  ON webinars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webinars"
  ON webinars FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for webinar_sessions
CREATE POLICY "Users can manage sessions for their webinars"
  ON webinar_sessions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

-- Policies for chat_messages
CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for attendees
CREATE POLICY "Webinar owners can view attendees"
  ON attendees FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));