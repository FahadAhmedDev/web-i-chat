/*
  # Fix chat messages table constraints and policies

  1. Changes
    - Make session_id nullable to support live streams without sessions
    - Add deferred foreign key constraint for session_id
    - Update policies to handle null session_id values
    - Add index for performance

  2. Security
    - Maintain RLS policies for public access
    - Keep existing security model
*/

-- First, drop existing foreign key constraint if it exists
ALTER TABLE chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

-- Make session_id nullable
ALTER TABLE chat_messages 
ALTER COLUMN session_id DROP NOT NULL;

-- Add new deferred foreign key constraint that allows null values
ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES webinar_sessions(id)
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Drop existing policies
DO $$ 
BEGIN
  -- Drop policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'chat_messages'
  ) THEN
    DROP POLICY IF EXISTS "Public read access for chat messages" ON chat_messages;
    DROP POLICY IF EXISTS "Public insert access for chat messages" ON chat_messages;
  END IF;
END $$;

-- Create new policies that handle null session_id
CREATE POLICY "Public read access for chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Public insert access for chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS chat_messages_webinar_session_idx 
ON chat_messages(webinar_id, session_id);

-- Add index for timestamp-based queries
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
ON chat_messages(created_at);