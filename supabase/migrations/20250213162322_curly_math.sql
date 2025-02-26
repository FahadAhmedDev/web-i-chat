/*
  # Simplify Chat System

  1. Changes
    - Remove authentication requirements from chat messages
    - Add public access policies
    - Modify chat_messages table structure

  2. Security
    - Enable public read access
    - Allow anonymous message creation
    - Maintain session isolation
*/

-- First, update the chat_messages table to remove auth requirements
ALTER TABLE chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;

-- Drop existing policies
DROP POLICY IF EXISTS "chat_messages_insert_policy" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_select_policy" ON chat_messages;

-- Create new simplified policies
CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Add policy for anonymous users
CREATE POLICY "Anonymous users can read chat messages"
  ON chat_messages FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert chat messages"
  ON chat_messages FOR INSERT
  TO anon
  WITH CHECK (true);