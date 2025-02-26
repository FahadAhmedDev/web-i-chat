/*
  # Update chat access permissions

  1. Changes
    - Drop existing chat message policies
    - Add new policies to allow public access to chat messages
    - Allow anonymous users to read and insert chat messages
    - Remove auth requirements for chat messages

  2. Security
    - Enable public access while maintaining data integrity
    - Keep webinar association for message organization
*/

-- Drop existing policies
DROP POLICY IF EXISTS "chat_messages_insert_policy" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_policy" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can read chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Anonymous users can read chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Anonymous users can insert chat messages" ON chat_messages;

-- Create new simplified policies
CREATE POLICY "Public read access to chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Ensure RLS is enabled but allow public access
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;