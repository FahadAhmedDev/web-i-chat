/*
  # Update chat messages schema

  1. Changes
    - Make session_id column nullable
    - Drop foreign key constraint for session_id
    - Update policies to allow messages without session_id

  2. Rationale
    - Allow chat messages for live streams and previews where no session exists
    - Maintain data integrity while allowing more flexible message handling
*/

-- Make session_id nullable and drop foreign key constraint
ALTER TABLE chat_messages 
  ALTER COLUMN session_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

-- Add optional foreign key constraint that allows null values
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES webinar_sessions(id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Update or create policies to handle null session_id
DROP POLICY IF EXISTS "Public read access for chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Public insert access for chat messages" ON chat_messages;

CREATE POLICY "Public read access for chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Public insert access for chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS chat_messages_webinar_session_idx 
ON chat_messages(webinar_id, session_id);