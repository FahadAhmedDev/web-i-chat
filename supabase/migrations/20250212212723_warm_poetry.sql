/*
  # Update chat message policies for anonymous chat

  1. Changes
    - Remove contact registration requirement
    - Allow any authenticated user to send messages
    - Maintain basic security with authentication

  2. Security
    - Messages still require authentication
    - Messages are linked to webinar and session
    - All users can read messages
*/

-- First, drop all existing chat message policies to ensure clean state
DO $$ 
BEGIN
  -- Drop policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'chat_messages' 
    AND policyname = 'Users can insert chat messages if registered'
  ) THEN
    DROP POLICY "Users can insert chat messages if registered" ON chat_messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'chat_messages' 
    AND policyname = 'Users can insert chat messages'
  ) THEN
    DROP POLICY "Users can insert chat messages" ON chat_messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'chat_messages' 
    AND policyname = 'Anyone can read chat messages'
  ) THEN
    DROP POLICY "Anyone can read chat messages" ON chat_messages;
  END IF;
END $$;

-- Create new simplified policies
CREATE POLICY "chat_messages_insert_policy"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "chat_messages_select_policy"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (true);